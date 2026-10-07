import 'package:flutter/material.dart';
import '../core/friends.dart' show normalizeUsername;
import '../core/l10n.dart';
import '../ui/progress_card.dart';
import 'challenges_screen.dart';
import '../core/pick_image.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/format.dart';
import '../core/guide.dart';
import '../core/models.dart';
import '../core/my_sport.dart';
import '../core/player_avatar.dart';
import '../core/notifications.dart';
import '../ui/theme.dart';
import '../ui/app_icons.dart';
import '../core/avatar_presets.dart';
import 'avatar_builder_screen.dart';
import 'auth_screens.dart' show showLoginSheet;
import 'friends_panel.dart';
import 'password_card.dart';
import 'recap_sheet.dart';
import 'share_profile_sheet.dart';
import 'sticker_sheet.dart';
import '../ui/extra_sports_picker.dart';
import '../ui/screen_guide.dart';
import '../ui/widgets.dart';

class _ProfileCard extends StatelessWidget {
  final PublicUser user;
  final List<Sport> sports;
  const _ProfileCard({required this.user, required this.sports});

  @override
  Widget build(BuildContext context) {
    final sport = sports.where((s) => s.id == user.preferredSportId).firstOrNull;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(children: [
          UserAvatar(user, size: 96),
          const SizedBox(height: 12),
          Text('@${user.username}', textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (sport != null) SportInline(sport, iconSize: 18),
              if (sport != null && user.skillLevel != null) const SizedBox(width: 16),
              if (user.skillLevel != null)
                Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.star, size: 16, color: Theme.of(context).colorScheme.onSurfaceVariant),
                  const SizedBox(width: 4),
                  Text(skillLabels[user.skillLevel] ?? user.skillLevel ?? '', style: const TextStyle(fontWeight: FontWeight.w700)),
                ]),
            ],
          ),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(child: _Stat(value: user.gamesPlayed, label: tr('GAMES PLAYED', 'MATCHS JOUÉS'))),
            const SizedBox(width: 10),
            Expanded(child: _Stat(value: user.gamesCreated, label: tr('GAMES CREATED', 'MATCHS CRÉÉS'))),
          ]),
          const SizedBox(height: 12),
          Text(tr('Joined ${localDateFormat('MMMM y').format(user.createdAt)}', 'Inscrit en ${localDateFormat('MMMM y').format(user.createdAt)}'),
              style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
        ]),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final int value;
  final String label;
  const _Stat({required this.value, required this.label});
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(14)),
        child: Column(children: [
          Text('$value', style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w900, color: Palette.brand)),
          Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
        ]),
      );
}

class ProfileScreen extends StatefulWidget {
  /// Scroll to the friends section (friend request notifications).
  final bool focusFriends;
  const ProfileScreen({super.key, this.focusFriends = false});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  List<Sport> _sports = [];
  final _progressKey = GlobalKey(debugLabel: 'progress');
  final _challengesKey = GlobalKey(debugLabel: 'my-challenges');
  final _friendsKey = GlobalKey<FriendsPanelState>(debugLabel: 'friends');
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    ScreenGuide.maybeShow(context, screen: GuideScreen.profile, tips: [
      GuideTip(
        target: _progressKey,
        icon: const Icon(Icons.trending_up),
        title: tr('Your player card', 'Votre carte de joueur'),
        body: tr('Every game earns XP, badges and streaks. The more you play, the higher your level.',
            'Chaque match rapporte de l’XP, des badges et des séries. Plus vous jouez, plus votre niveau monte.'),
      ),
      GuideTip(
        target: _challengesKey,
        icon: const SwordsIcon(),
        title: tr('Ready for a duel?', 'Prêt pour un duel ?'),
        body: tr('Your challenges live here — and so do your stickers and monthly recap to share.',
            'Vos défis sont ici — tout comme vos stickers et votre récap du mois à partager.'),
      ),
    ]);
    context.read<AuthState>().refreshMe();
    if (widget.focusFriends) WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToFriends());
    context.read<Api>().get('/api/sports').then((j) {
      if (mounted) setState(() => _sports = [for (final s in j) Sport.fromJson(s)]);
    }).catchError((_) {});
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  /// The list builds lazily: step down until the friends card is laid out.
  void _scrollToFriends([int attempt = 0]) {
    if (!mounted) return;
    final ctx = _friendsKey.currentContext;
    if (ctx != null) {
      Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 350), curve: Curves.easeOutCubic);
      return;
    }
    if (attempt > 8 || !_scroll.hasClients) return;
    final pos = _scroll.position;
    _scroll.jumpTo((pos.pixels + pos.viewportDimension).clamp(0, pos.maxScrollExtent));
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToFriends(attempt + 1));
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final me = auth.user;
    if (me == null) return const SizedBox.shrink();
    return Scaffold(
      appBar: AppBar(title: Text(tr('PROFILE', 'PROFIL')), actions: [
        TextButton(
          onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => EditProfileScreen(sports: _sports))),
          child: Text(tr('Edit', 'Modifier')),
        ),
      ]),
      body: RefreshIndicator(
        onRefresh: () async {
          await Future.wait([auth.refreshMe(), if (_friendsKey.currentState case final f?) f.reload()]);
        },
        child: ListView(controller: _scroll, padding: floatingNavListPadding(context), children: [
          _ProfileCard(user: me, sports: _sports),
          if (hasSavedAvatar(avatarUrl: me.avatarUrl, avatarConfig: me.avatarConfig)) ...[
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () async {
                final ok = await Navigator.push<bool>(
                  context,
                  MaterialPageRoute(
                    builder: (_) => AvatarBuilderScreen(initialUrl: me.avatarUrl, initialConfig: me.avatarConfig, seed: me.username),
                  ),
                );
                if (ok == true && context.mounted) await auth.refreshMe();
              },
              child: Text(tr('EDIT PLAYER', 'MODIFIER L’AVATAR')),
            ),
          ],
          const SizedBox(height: 12),
          KeyedSubtree(key: _progressKey, child: const ProgressCard()),
          const SizedBox(height: 12),
          ShareProfileButton(me: me, sport: sportForUser(me, _sports)),
          const SizedBox(height: 12),
          FilledButton.icon(
            key: _challengesKey,
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ChallengesScreen())),
            icon: const Icon(Icons.sports_kabaddi),
            label: Text(tr('MY CHALLENGES', 'MES DÉFIS')),
          ),
          const SizedBox(height: 8),
          RecapButton(me: me, sport: sportSlugForUser(me, _sports)),
          if (!avatarArtOf(me).isEmpty) ...[
            const SizedBox(height: 8),
            StickerButton(art: avatarArtOf(me), sport: me.playerAvatar?.sport ?? sportSlugForUser(me, _sports)),
          ],
          const SizedBox(height: 16),
          FriendsPanel(key: _friendsKey),
          const SizedBox(height: 12),
          PasswordCard(key: ValueKey('password-${me.hasPassword}'), me: me),
          if (me.isAdmin)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Card(
                  child: ListTile(
                      leading: const Icon(Icons.build_outlined),
                      title: Text(tr('Admin tools are in the web dashboard', 'Les outils admin sont dans le tableau de bord web')))),
            ),
          const SizedBox(height: 16),
          OutlinedButton(
            onPressed: () async {
              await context.read<Notifications>().unregisterDevice();
              await auth.logout();
            },
            child: Text(tr('LOG OUT', 'SE DÉCONNECTER')),
          ),
        ]),
      ),
    );
  }
}

class EditProfileScreen extends StatefulWidget {
  final List<Sport> sports;
  const EditProfileScreen({super.key, required this.sports});
  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  late final Me _me = context.read<AuthState>().user!;
  late final _first = TextEditingController(text: _me.firstName);
  late final _last = TextEditingController(text: _me.lastName);
  late final _username = TextEditingController(text: _me.username);
  late String? _sportId = _me.preferredSportId;
  late List<String> _extra = [..._me.extraSportIds];
  late String _skill = _me.skillLevel ?? 'all_levels';
  late String? _avatar = _me.avatarUrl;
  bool _busy = false;
  String? _error;
  bool get _sportLocked => !_me.isAdmin && _me.preferredSportId != null;

  Future<void> _photo() async {
    final api = context.read<Api>();
    final auth = context.read<AuthState>();
    final f = await pickImageFile(context, maxWidth: 1024, imageQuality: 85);
    if (f == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final bytes = await f.readAsBytes();
      if (bytes.isEmpty) {
        setState(() => _error = tr('Could not read that image. Try another photo.', 'Impossible de lire cette image. Essayez une autre photo.'));
        return;
      }
      final url = await api.upload(bytes, f.name, 'avatar');
      await auth.updateMe({'avatar_url': url});
      if (mounted) setState(() => _avatar = url);
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final patch = <String, dynamic>{
        'first_name': _first.text.trim(),
        'last_name': _last.text.trim(),
        'username': _username.text.trim().replaceFirst(RegExp(r'^@+'), ''),
        'skill_level': _skill,
        'extra_sport_ids': _extra,
      };
      if (!_sportLocked && _sportId != null) patch['preferred_sport_id'] = _sportId;
      if (_avatar != null) patch['avatar_url'] = _avatar;
      await context.read<AuthState>().updateMe(patch);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(tr('EDIT PROFILE', 'MODIFIER LE PROFIL'))),
        body: ListView(padding: const EdgeInsets.all(20), children: [
          Center(
            child: SizedBox(
              width: 88,
              height: 88,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  GestureDetector(
                    onTap: _busy ? null : _photo,
                    child: UserAvatar(context.watch<AuthState>().user ?? _me, size: 88, overrideUrl: _avatar),
                  ),
                  if (_busy)
                    ClipOval(
                      child: ColoredBox(
                        color: const Color(0x99FFFFFF),
                        child: const Center(child: SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 2))),
                      ),
                    ),
                ],
              ),
            ),
          ),
          TextButton(onPressed: _busy ? null : _photo, child: Text(tr('Change photo', 'Changer la photo'))),
          TextField(controller: _first, decoration: InputDecoration(labelText: tr('First name', 'Prénom'))),
          const SizedBox(height: 12),
          TextField(controller: _last, decoration: InputDecoration(labelText: tr('Last name', 'Nom'))),
          const SizedBox(height: 12),
          TextField(controller: _username, decoration: InputDecoration(labelText: tr('Username', 'Nom d’utilisateur'))),
          const SizedBox(height: 12),
          if (_sportLocked) ...[
            Text(tr('Sport', 'Sport'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            if (widget.sports.where((s) => s.id == _me.preferredSportId).firstOrNull case final s?)
              SportInline(s)
            else
              const Text('—'),
            const SizedBox(height: 4),
            Text(tr('Set at signup and locked to keep the map focused.', 'Choisi à l\'inscription — verrouillé pour garder la carte ciblée.'),
                style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
            const SizedBox(height: 12),
            if (widget.sports.where((s) => s.active).length > 1) ...[
              ExtraSportsPicker(
                sports: widget.sports,
                mainSportId: _me.preferredSportId,
                selected: _extra,
                onChanged: (v) => setState(() => _extra = v),
                title: tr('Other sports on your map', 'Autres sports sur la carte'),
                hint: tr('Up to 2 extra sports — switch filters on the map.', 'Jusqu\'à 2 sports en plus — filtrez sur la carte.'),
              ),
              const SizedBox(height: 12),
            ],
          ] else
            DropdownButtonFormField<String>(
              initialValue: widget.sports.any((s) => s.id == _sportId) ? _sportId : null,
              decoration: InputDecoration(labelText: tr('Preferred sport', 'Sport préféré')),
              items: [
                for (final s in widget.sports.where((s) => s.active))
                  DropdownMenuItem(value: s.id, child: SportInline(s)),
              ],
              onChanged: (v) => setState(() => _sportId = v),
            ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _skill,
            decoration: InputDecoration(labelText: tr('Skill level', 'Niveau')),
            items: [for (final e in skillLabels.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
            onChanged: (v) => setState(() => _skill = v!),
          ),
          const SizedBox(height: 24),
        ]),
        bottomNavigationBar: StickyScreenActions(
          children: [
            ErrorBanner(_error),
            PrimaryButton(onPressed: _busy ? null : _save, child: Text(_busy ? '…' : tr('SAVE', 'ENREGISTRER'))),
          ],
        ),
      );
}

/// Opens a player's public profile by @username (deep links /u/{username});
/// works signed out (GET /api/profiles/{username}).
Future<void> openUserByUsername(BuildContext context, String username) =>
    Navigator.push(context, MaterialPageRoute(builder: (_) => UserScreen.byUsername(username)));

class UserScreen extends StatefulWidget {
  final String? userId;
  final String? username;
  const UserScreen({super.key, required String this.userId}) : username = null;
  const UserScreen.byUsername(String this.username, {super.key}) : userId = null;
  @override
  State<UserScreen> createState() => _UserScreenState();
}

class _UserScreenState extends State<UserScreen> {
  PublicUser? _user;
  List<Sport> _sports = [];
  String? _error;
  bool _notFound = false;

  String get _handle => normalizeUsername(widget.username ?? '');

  @override
  void initState() {
    super.initState();
    final api = context.read<Api>();
    final id = widget.userId;
    if (id == null && _handle.isEmpty) {
      _notFound = true;
      return;
    }
    final profile = id != null ? api.get('/api/users/$id') : api.get('/api/profiles/${Uri.encodeComponent(_handle)}');
    Future.wait([profile, api.get('/api/sports')]).then((r) {
      if (mounted) {
        setState(() {
          _user = PublicUser.fromJson(r[0]);
          _sports = [for (final s in r[1]) Sport.fromJson(s)];
        });
      }
    }).catchError((Object e) {
      if (!mounted) return;
      setState(() {
        if (e is ApiException && (e.code == 'user_not_found' || e.code == 'invalid_username' || e.status == 404)) {
          _notFound = true;
        } else {
          _error = errorText(e);
        }
      });
    });
  }

  Widget _notFoundBody(Me? viewer) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    final handle = _handle;
    return ListView(padding: const EdgeInsets.all(24), children: [
      Text(tr('Player not found', 'Joueur introuvable'), textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineSmall),
      const SizedBox(height: 8),
      Text(
        handle.isEmpty
            ? tr('This profile link is invalid.', 'Ce lien de profil est invalide.')
            : tr('There is no account @$handle on Find the Game yet.', 'Il n’y a pas encore de compte @$handle sur Find the Game.'),
        textAlign: TextAlign.center,
        style: TextStyle(color: muted),
      ),
      const SizedBox(height: 24),
      if (viewer == null)
        FilledButton(onPressed: () => showLoginSheet(context), child: Text(tr('LOG IN', 'SE CONNECTER')))
      else ...[
        if (viewer.username.toLowerCase() != handle.toLowerCase())
          TextButton(
            onPressed: () => Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => UserScreen(userId: viewer.id))),
            child: Text(tr('View your profile (@${viewer.username})', 'Voir votre profil (@${viewer.username})')),
          ),
        TextButton(onPressed: () => Navigator.pop(context), child: Text(tr('Back to map', 'Retour à la carte'))),
      ],
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final viewer = context.watch<AuthState>().user;
    final user = _user;
    final title = user != null ? '@${user.username}' : (_handle.isNotEmpty ? '@$_handle' : tr('PLAYER', 'JOUEUR'));
    return Scaffold(
      appBar: AppBar(title: Text(widget.username != null ? title : tr('PLAYER', 'JOUEUR'))),
      body: _notFound
          ? _notFoundBody(viewer)
          : user == null
              ? Center(child: _error != null ? Text(_error!) : const CircularProgressIndicator())
              : ListView(padding: const EdgeInsets.all(16), children: [
                  _ProfileCard(user: user, sports: _sports),
                  if (viewer?.id != user.id) ...[
                    const SizedBox(height: 12),
                    ProfileFriendActions(user: user),
                  ],
                  if (viewer != null && viewer.id != user.id) ...[
                    const SizedBox(height: 12),
                    PlayerChallengeBlock(player: user),
                  ],
                  if (viewer != null) ...[
                    const SizedBox(height: 12),
                    ProgressCard(userId: user.id),
                  ],
                ]),
    );
  }
}
