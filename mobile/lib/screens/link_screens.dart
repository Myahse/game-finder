import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/deep_links.dart';
import '../core/format.dart';
import '../core/friend_invite.dart';
import '../core/game_join.dart';
import '../core/l10n.dart';
import '../core/map_pause.dart';
import '../core/models.dart';
import '../ui/app_icons.dart';
import '../ui/apple_button.dart';
import '../ui/google_button.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'auth_screens.dart';
import 'game_screens.dart';
import 'link_router.dart';
import 'profile_screen.dart';

/// "This link isn't valid anymore": a dead share link or invite (web
/// GameLinkPage / FriendInvitePage invalid states).
class LinkInvalidView extends StatelessWidget {
  final String title;
  final String? hint;
  final String actionLabel;
  final VoidCallback onAction;
  const LinkInvalidView({super.key, required this.title, this.hint, required this.actionLabel, required this.onAction});

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 8),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Icon(Icons.link_off, size: 48, color: muted),
        const SizedBox(height: 12),
        Text(title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
        if (hint != null) ...[
          const SizedBox(height: 6),
          Text(hint!, textAlign: TextAlign.center, style: TextStyle(color: muted)),
        ],
        const SizedBox(height: 20),
        FilledButton(onPressed: onAction, child: Text(actionLabel.toUpperCase())),
      ]),
    );
  }
}

/// Back to the app's first screen (map, welcome or onboarding).
void popToAppRoot(BuildContext context) => Navigator.of(context, rootNavigator: true).popUntil((r) => r.isFirst);

/// Closes the landing, then opens the login sheet; [link] reopens once signed in.
void _signInThenResume(BuildContext context, DeepLink link, {bool register = false}) {
  LinkRouter.instance.resumeAfterSignIn(link);
  final nav = Navigator.of(context, rootNavigator: true);
  nav.popUntil((r) => r.isFirst);
  if (register) {
    nav.push(MaterialPageRoute(builder: (_) => const RegisterScreen()));
  } else {
    final ctx = nav.overlay?.context;
    if (ctx != null) showLoginSheet(ctx);
  }
}

/// GET /api/game-links/{token}.
class GameSharePreview {
  final bool valid;
  final String gameId, status, courtName, sportName, sportSlug, gameType;
  final DateTime startTime;
  GameSharePreview.fromJson(Map<String, dynamic> j)
      : valid = j['valid'] != false,
        gameId = j['game_id'],
        status = j['status'] ?? 'scheduled',
        courtName = j['court_name'] ?? '',
        sportName = j['sport_name'] ?? '',
        sportSlug = j['sport_slug'] ?? '',
        gameType = j['game_type'] ?? 'pickup',
        startTime = DateTime.parse(j['start_time']).toLocal();
}

/// `/g/<token>`: what the shared game is, then sign in / join (web GameLinkPage).
class GameLinkScreen extends StatefulWidget {
  final String token;

  /// Opens the game once joined (tests replace it); default closes this
  /// landing and pushes the game screen.
  final void Function(BuildContext context, String gameId)? onOpenGame;
  const GameLinkScreen({super.key, required this.token, this.onOpenGame});

  @override
  State<GameLinkScreen> createState() => _GameLinkScreenState();
}

class _GameLinkScreenState extends State<GameLinkScreen> {
  GameSharePreview? _preview;
  Game? _game; // signed in: players and whether I'm in
  bool _loading = true;
  bool _busy = false;
  String? _error;
  String? _loadedFor; // user id the game was loaded for

  @override
  void initState() {
    super.initState();
    _load();
  }

  bool _ready(Me? u) => u != null && u.onboarded;

  Future<void> _load() async {
    final api = context.read<Api>();
    final me = context.read<AuthState>().user;
    try {
      final j = await api.get('/api/game-links/${Uri.encodeComponent(widget.token.trim())}');
      final p = GameSharePreview.fromJson(Map<String, dynamic>.from(j));
      Game? game;
      if (p.valid && _ready(me)) {
        try {
          game = Game.fromJson(Map<String, dynamic>.from(await api.get('/api/games/${Uri.encodeComponent(p.gameId)}')));
        } catch (_) {
          // The preview is enough to join; the game screen loads the rest.
        }
      }
      if (!mounted) return;
      setState(() {
        _preview = p;
        _game = game;
        _loadedFor = me?.id;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openGame(String gameId) {
    final open = widget.onOpenGame;
    if (open != null) return open(context, gameId);
    final nav = Navigator.of(context, rootNavigator: true);
    final pause = context.read<MapPause>();
    nav.pop();
    openGameOnNavigator(nav, pause, gameId);
  }

  Future<void> _join(GameSharePreview p) async {
    final g = _game;
    if (g == null) return _openGame(p.gameId); // join from the game screen
    setState(() {
      _busy = true;
      _error = null;
    });
    final api = context.read<Api>();
    try {
      final body = await prepareGameJoin(context, live: g.isLive, courtLat: g.courtLat, courtLng: g.courtLng);
      if (body == null || !mounted) return;
      await api.post('/api/games/${Uri.encodeComponent(g.id)}/join', body);
      if (mounted) _openGame(g.id);
    } catch (e) {
      if (!mounted) return;
      if (e is ApiException && e.code == 'already_joined') return _openGame(g.id);
      setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = context.watch<AuthState>().user;
    final ready = _ready(me);
    if (!_loading && ready && _preview?.valid == true && _loadedFor != me?.id) {
      _loadedFor = me?.id;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _load(); // signed in meanwhile: fetch players + joined
      });
    }
    final p = _preview;
    return Scaffold(
      appBar: AppBar(title: Text(tr('JOIN GAME', 'REJOINDRE LE MATCH'))),
      body: SafeArea(
        top: false,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          if (_loading)
            const Padding(padding: EdgeInsets.all(48), child: Center(child: CircularProgressIndicator()))
          else if (p == null || !p.valid)
            LinkInvalidView(
              title: tr('This game link isn’t valid anymore.', 'Ce lien de match n’est plus valide.'),
              hint: tr('It may have ended or been cancelled.', 'Le match est peut-être terminé ou a été annulé.'),
              actionLabel: ready ? tr('Back to map', 'Retour à la carte') : tr('Open Out For Ground', 'Ouvrir Out For Ground'),
              onAction: () => popToAppRoot(context),
            )
          else
            _card(context, p, me),
        ]),
      ),
    );
  }

  Widget _card(BuildContext context, GameSharePreview p, Me? me) {
    final theme = Theme.of(context);
    final muted = theme.colorScheme.onSurfaceVariant;
    final g = _game;
    final type = gameTypeLabels[p.gameType] ?? p.gameType;
    final link = GameShareLink(widget.token);
    final full = g != null && !g.joined && !gameHasOpenSpots(g);
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            SportIcon(p.sportSlug, size: 44, color: Palette.brand),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(p.courtName, style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
                Text('$type ${p.sportName.toLowerCase()}', style: TextStyle(color: muted)),
              ]),
            ),
          ]),
          const SizedBox(height: 14),
          Row(children: [
            Icon(p.status == 'active' ? Icons.circle : Icons.schedule, size: 14, color: p.status == 'active' ? Palette.live : muted),
            const SizedBox(width: 6),
            Expanded(child: Text(gameTimeLabel(p.status, p.startTime), style: TextStyle(color: muted))),
            if (g != null) ...[
              Icon(Icons.groups_outlined, size: 18, color: muted),
              const SizedBox(width: 4),
              Text(tr('${gamePlayerCountLabel(g.playerCount, g.maxPlayers)} players', '${gamePlayerCountLabel(g.playerCount, g.maxPlayers)} joueurs'),
                  style: TextStyle(color: muted, fontWeight: FontWeight.w700)),
            ],
          ]),
          const SizedBox(height: 16),
          if (me == null) ...[
            Text(tr('Sign in to view details and join.', 'Connecte-toi pour voir les détails et rejoindre le match.'), style: TextStyle(color: muted)),
            const SizedBox(height: 12),
            FilledButton(onPressed: () => _signInThenResume(context, link), child: Text(tr('SIGN IN', 'SE CONNECTER'))),
            TextButton(
              onPressed: () => _signInThenResume(context, link, register: true),
              child: Text(tr('Create account', 'Créer un compte')),
            ),
          ] else if (!me.onboarded)
            FilledButton(
              onPressed: () {
                LinkRouter.instance.resumeAfterSignIn(link);
                popToAppRoot(context);
              },
              child: Text(tr('Finish setup first →', 'Termine d’abord ton inscription →')),
            )
          else ...[
            ErrorBanner(_error),
            if (g != null && g.joined)
              FilledButton(onPressed: () => _openGame(g.id), child: Text(tr('OPEN GAME', 'OUVRIR LE MATCH')))
            else if (full) ...[
              Text(tr('This game is full.', 'Ce match est complet.'), textAlign: TextAlign.center, style: TextStyle(color: theme.colorScheme.error, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              OutlinedButton(onPressed: () => _openGame(p.gameId), child: Text(tr('VIEW GAME', 'VOIR LE MATCH'))),
            ] else ...[
              FilledButton(
                style: p.status == 'active' ? FilledButton.styleFrom(backgroundColor: Palette.live) : null,
                onPressed: _busy ? null : () => _join(p),
                child: Text(_busy ? '…' : tr('JOIN GAME', 'REJOINDRE LE MATCH')),
              ),
              TextButton(onPressed: _busy ? null : () => _openGame(p.gameId), child: Text(tr('View game', 'Voir le match'))),
            ],
          ],
        ]),
      ),
    );
  }
}

/// `/friend/<token>`: who invites me, then accept or sign up (web FriendInvitePage).
class FriendInviteScreen extends StatefulWidget {
  final String token;

  /// After accepting (tests replace it); default opens my profile's friends.
  final void Function(BuildContext context)? onAccepted;
  const FriendInviteScreen({super.key, required this.token, this.onAccepted});

  @override
  State<FriendInviteScreen> createState() => _FriendInviteScreenState();
}

class _FriendInviteScreenState extends State<FriendInviteScreen> {
  FriendInvitePreview? _preview;
  bool _loading = true;
  bool _accepting = false;
  String? _error;
  late final AuthState _auth;
  bool _wasSignedIn = false;

  @override
  void initState() {
    super.initState();
    _auth = context.read<AuthState>();
    final me = _auth.user;
    _wasSignedIn = me != null;
    // Kept through sign-up and onboarding, accepted afterwards.
    if (me == null || !me.onboarded) unawaited(PendingFriendInvite.stash(widget.token));
    _auth.addListener(_onAuth);
    _load();
  }

  @override
  void dispose() {
    _auth.removeListener(_onAuth);
    super.dispose();
  }

  /// Signed in from this screen: the invite went with the sign-in (or is
  /// accepted after onboarding), so go back to the app like the web does.
  void _onAuth() {
    final signedIn = _auth.user != null;
    if (signedIn && !_wasSignedIn && mounted) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && (ModalRoute.of(context)?.isActive ?? false)) popToAppRoot(context);
      });
    }
    _wasSignedIn = signedIn;
  }

  Future<void> _load() async {
    try {
      final p = await fetchFriendInvite(context.read<Api>(), widget.token);
      if (mounted) setState(() => _preview = p.valid ? p : null);
    } catch (_) {
      // Unknown or expired: the invalid state below.
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _accept() async {
    setState(() {
      _accepting = true;
      _error = null;
    });
    try {
      await acceptFriendInvite(context.read<Api>(), widget.token);
      await PendingFriendInvite.clear();
      if (!mounted) return;
      final done = widget.onAccepted;
      if (done != null) return done(context);
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const ProfileScreen(focusFriends: true)));
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _accepting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = context.watch<AuthState>().user;
    final p = _preview;
    return Scaffold(
      appBar: AppBar(title: Text(tr('FRIEND INVITE', 'INVITATION D’AMI'))),
      body: SafeArea(
        top: false,
        child: ListView(padding: const EdgeInsets.all(20), children: [
          if (_loading)
            const Padding(padding: EdgeInsets.all(48), child: Center(child: CircularProgressIndicator()))
          else if (p == null)
            LinkInvalidView(
              title: tr('This invite link is invalid or has expired.', 'Ce lien d’invitation est invalide ou a expiré.'),
              actionLabel: tr('Go to map', 'Aller à la carte'),
              onAction: () => popToAppRoot(context),
            )
          else
            ..._body(context, p, me),
        ]),
      ),
    );
  }

  List<Widget> _body(BuildContext context, FriendInvitePreview p, Me? me) {
    final theme = Theme.of(context);
    final muted = theme.colorScheme.onSurfaceVariant;
    final inviter = p.inviter;
    final dark = theme.brightness == Brightness.dark;
    return [
      Center(child: UserAvatar(inviter, size: 72)),
      const SizedBox(height: 12),
      Text('@${inviter.username}', textAlign: TextAlign.center, style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
      const SizedBox(height: 4),
      Text(tr('wants to be friends on Out For Ground.', 'veut devenir votre ami sur Out For Ground.'), textAlign: TextAlign.center, style: TextStyle(color: muted)),
      const SizedBox(height: 24),
      if (me != null && me.id == inviter.id)
        Text(tr('This is your own invite link — share it with someone else.', 'C’est votre propre lien d’invitation — partagez-le avec quelqu’un d’autre.'),
            textAlign: TextAlign.center, style: TextStyle(color: muted))
      else if (me != null && !me.onboarded) ...[
        Text(tr('Finish setting up your profile, then accept the invite from here or your profile.',
                'Terminez la configuration de votre profil, puis acceptez l’invitation ici ou depuis votre profil.'),
            textAlign: TextAlign.center, style: TextStyle(color: muted)),
        const SizedBox(height: 12),
        FilledButton(onPressed: () => popToAppRoot(context), child: Text(tr('CONTINUE SETUP', 'CONTINUER LA CONFIGURATION'))),
      ] else if (me != null) ...[
        ErrorBanner(_error),
        FilledButton(
          onPressed: _accepting ? null : _accept,
          child: Text(_accepting ? '…' : tr('ACCEPT FRIEND REQUEST', 'ACCEPTER LA DEMANDE D’AMI')),
        ),
      ] else ...[
        AppleSignInButton(onDark: dark),
        const SizedBox(height: 12),
        GoogleSignInButton(onDark: dark),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(children: [
            const Expanded(child: Divider()),
            Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: Text(tr('or', 'ou'), style: TextStyle(color: muted))),
            const Expanded(child: Divider()),
          ]),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context, rootNavigator: true).push(MaterialPageRoute(builder: (_) => const RegisterScreen())),
          child: Text(tr('CREATE ACCOUNT', 'CRÉER UN COMPTE')),
        ),
        const SizedBox(height: 8),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Text(tr('Already playing?', 'Déjà inscrit ?'), style: TextStyle(color: muted)),
          TextButton(onPressed: () => showLoginSheet(context), child: Text(tr('Log in', 'Se connecter'))),
        ]),
      ],
    ];
  }
}

/// `/verify-email?token=`: confirms the address (web VerifyEmailPage).
class VerifyEmailScreen extends StatefulWidget {
  final String token;
  const VerifyEmailScreen({super.key, required this.token});
  @override
  State<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends State<VerifyEmailScreen> {
  bool? _ok; // null while loading
  String _message = '';

  @override
  void initState() {
    super.initState();
    _verify();
  }

  Future<void> _verify() async {
    final token = widget.token.trim();
    if (token.isEmpty) {
      setState(() {
        _ok = false;
        _message = tr('This verification link is missing a token.', 'Ce lien de vérification ne contient pas de jeton.');
      });
      return;
    }
    try {
      await context.read<Api>().post('/api/auth/verify-email', {'token': token});
      if (mounted) setState(() => _ok = true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _ok = false;
          _message = errorText(e);
        });
      }
    }
  }

  void _toSignIn() {
    final signedIn = context.read<AuthState>().user != null;
    final nav = Navigator.of(context, rootNavigator: true);
    nav.popUntil((r) => r.isFirst);
    final ctx = nav.overlay?.context;
    if (!signedIn && ctx != null) showLoginSheet(ctx);
  }

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    final ok = _ok;
    return Scaffold(
      appBar: AppBar(title: Text(tr('VERIFY EMAIL', 'VÉRIFIER L’E-MAIL'))),
      body: SafeArea(
        top: false,
        child: ListView(padding: const EdgeInsets.all(24), children: [
          if (ok == null)
            const Padding(padding: EdgeInsets.all(48), child: Center(child: CircularProgressIndicator()))
          else ...[
            Icon(ok ? Icons.mark_email_read_outlined : Icons.error_outline, size: 48, color: ok ? Palette.live : Theme.of(context).colorScheme.error),
            const SizedBox(height: 12),
            Text(ok ? tr('Email verified.', 'E-mail vérifié.') : tr('Could not verify', 'Vérification impossible'),
                textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 6),
            Text(ok ? tr('You can sign in and use the app.', 'Vous pouvez vous connecter et utiliser l’app.') : _message,
                textAlign: TextAlign.center, style: TextStyle(color: muted)),
            const SizedBox(height: 20),
            if (ok)
              FilledButton(onPressed: _toSignIn, child: Text(tr('SIGN IN', 'SE CONNECTER')))
            else
              OutlinedButton(onPressed: _toSignIn, child: Text(tr('BACK TO SIGN IN', 'RETOUR À LA CONNEXION'))),
          ],
        ]),
      ),
    );
  }
}
