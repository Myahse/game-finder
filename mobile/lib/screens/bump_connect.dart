import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/bump.dart';
import '../core/l10n.dart';
import '../core/location.dart';
import '../core/models.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'profile_screen.dart';

/// "Connect on court" button (web: BumpConnectButton in the friends panel).
class BumpConnectButton extends StatelessWidget {
  const BumpConnectButton({super.key});

  @override
  Widget build(BuildContext context) => FilledButton.icon(
        onPressed: () => openBumpConnect(context),
        icon: const Icon(Icons.handshake_outlined),
        label: Text(tr('Connect on court', 'Se connecter sur le terrain')),
      );
}

Future<void> openBumpConnect(BuildContext context) => Navigator.of(context, rootNavigator: true).push(
      MaterialPageRoute<void>(fullscreenDialog: true, builder: (_) => const BumpConnectScreen()),
    );

enum _Phase { locating, waiting, matched, none, error }

/// Both players tap at the same time, close together → friends.
class BumpConnectScreen extends StatefulWidget {
  const BumpConnectScreen({super.key});
  @override
  State<BumpConnectScreen> createState() => _BumpConnectScreenState();
}

class _BumpConnectScreenState extends State<BumpConnectScreen> {
  _Phase _phase = _Phase.locating;
  int _left = 0;
  String? _error;
  PublicUser? _friend;
  bool _already = false;

  /// Bumps the run id so a stale poll from an earlier attempt stops itself.
  int _run = 0;
  Timer? _timer;

  /// True once matched or cancelled — no DELETE needed after that.
  bool _settled = false;
  late final Api _api;

  @override
  void initState() {
    super.initState();
    _api = context.read<Api>();
    _start(first: true);
  }

  @override
  void dispose() {
    _timer?.cancel();
    _run++;
    _cancelOnServer();
    super.dispose();
  }

  void _cancelOnServer() {
    if (_settled) return;
    _settled = true;
    _api.delete('/api/me/bump').catchError((_) => null);
  }

  Future<void> _start({bool first = false}) async {
    final run = ++_run;
    _timer?.cancel();
    _settled = false;
    if (!first) {
      setState(() {
        _phase = _Phase.locating;
        _error = null;
      });
    }
    final pos = await context.read<LocationState>().freshFix();
    if (!mounted || run != _run) return;
    if (pos == null) {
      _settled = true;
      setState(() {
        _phase = _Phase.error;
        _error = tr('Turn on location so we can find the player next to you.', 'Activez la localisation pour trouver le joueur à côté de vous.');
      });
      return;
    }
    final body = {'latitude': pos.latitude, 'longitude': pos.longitude};
    final started = DateTime.now();
    var polls = 0;

    Future<void> poll() async {
      if (!mounted || run != _run) return;
      try {
        final r = BumpResult.fromJson(Map<String, dynamic>.from(await _api.post('/api/me/bump', body) as Map));
        if (!mounted || run != _run) return;
        if (r.matched) {
          _settled = true;
          HapticFeedback.heavyImpact();
          setState(() {
            _phase = _Phase.matched;
            _friend = r.friend;
            _already = r.alreadyFriends;
          });
          return;
        }
      } catch (e) {
        if (!mounted || run != _run) return;
        setState(() {
          _phase = _Phase.error;
          _error = errorText(e);
        });
        return;
      }
      // Wall-clock time, but never less than the polls' own waits (keeps the window honest under fake time).
      final wall = DateTime.now().difference(started);
      final waited = bumpPollEvery * polls++;
      final left = bumpSecondsLeft(started.add(bumpWait), started.add(wall > waited ? wall : waited));
      if (left <= 0) {
        _cancelOnServer();
        setState(() => _phase = _Phase.none);
        return;
      }
      setState(() {
        _phase = _Phase.waiting;
        _left = left;
      });
      _timer = Timer(bumpPollEvery, poll);
    }

    await poll();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: tr('Close', 'Fermer'),
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: _phase == _Phase.matched ? _matched(context) : _searching(context),
            ),
          ),
        ),
      ),
    );
  }

  Widget _searching(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    final busy = _phase == _Phase.locating || _phase == _Phase.waiting;
    final title = switch (_phase) {
      _Phase.none => tr('No one found', 'Personne trouvé'),
      _Phase.error => tr("Couldn't connect", 'Connexion impossible'),
      _ => tr('Tap together', 'Touchez ensemble'),
    };
    final body = switch (_phase) {
      _Phase.locating => tr('Finding where you are…', 'Recherche de votre position…'),
      _Phase.waiting => tr(
          'Ask your friend to tap "Connect on court" now. Looking for 1 player next to you… ${_left}s',
          'Demandez à votre ami de toucher « Se connecter sur le terrain » maintenant. Recherche d’un joueur à côté… $_left s'),
      _Phase.none => tr('Make sure you both tap at the same time, close together, with location on.',
          'Touchez au même moment, l’un à côté de l’autre, localisation activée.'),
      _Phase.error => _error ?? '',
      _Phase.matched => '',
    };
    return Column(mainAxisSize: MainAxisSize.min, children: [
      _Pulse(active: busy),
      const SizedBox(height: 24),
      Text(title.toUpperCase(), textAlign: TextAlign.center, style: Theme.of(context).textTheme.displaySmall),
      const SizedBox(height: 8),
      Semantics(
        liveRegion: true,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: Text(body, textAlign: TextAlign.center, style: TextStyle(color: muted)),
        ),
      ),
      if (!busy) ...[
        const SizedBox(height: 20),
        PrimaryButton(onPressed: _start, child: Text(tr('TRY AGAIN', 'RÉESSAYER'))),
      ],
      const SizedBox(height: 24),
      Text(
        tr('Works when you are both within ~100 m and tap within a few seconds.',
            'Fonctionne si vous êtes à ~100 m l’un de l’autre et touchez à quelques secondes d’écart.'),
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: 12, color: muted),
      ),
    ]);
  }

  Widget _matched(BuildContext context) {
    final me = context.watch<AuthState>().user;
    final friend = _friend!;
    final name = '@${friend.username}';
    final ring = Theme.of(context).scaffoldBackgroundColor;
    Widget disc(PublicUser? u) => Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(color: ring, shape: BoxShape.circle),
          child: UserAvatar(u, size: 96),
        );
    return Column(mainAxisSize: MainAxisSize.min, children: [
      SizedBox(
        height: 104,
        width: 184,
        child: Stack(children: [
          if (me != null) Positioned(left: 0, child: disc(me)),
          Positioned(right: 0, child: disc(friend)),
        ]),
      ),
      const SizedBox(height: 24),
      Text(
        (_already ? tr('Already friends', 'Déjà amis') : tr('Connected!', 'Connectés !')).toUpperCase(),
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.displaySmall,
      ),
      const SizedBox(height: 8),
      Text(
        _already
            ? tr('You and $name were already connected.', 'Vous et $name étiez déjà connectés.')
            : tr('You and $name are now friends.', 'Vous et $name êtes maintenant amis.'),
        textAlign: TextAlign.center,
        style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
      ),
      const SizedBox(height: 28),
      PrimaryButton(onPressed: () => Navigator.pop(context), child: Text(tr('NICE', 'SUPER'))),
      const SizedBox(height: 8),
      SizedBox(
        width: double.infinity,
        child: OutlinedButton(
          onPressed: () => Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => UserScreen(userId: friend.id))),
          child: Text(tr('VIEW PROFILE', 'VOIR LE PROFIL')),
        ),
      ),
    ]);
  }
}

/// Handshake disc with expanding rings while searching.
class _Pulse extends StatefulWidget {
  final bool active;
  const _Pulse({required this.active});
  @override
  State<_Pulse> createState() => _PulseState();
}

class _PulseState extends State<_Pulse> with SingleTickerProviderStateMixin {
  late final _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600));

  @override
  void initState() {
    super.initState();
    if (widget.active) _c.repeat();
  }

  @override
  void didUpdateWidget(_Pulse old) {
    super.didUpdateWidget(old);
    if (widget.active && !_c.isAnimating) _c.repeat();
    if (!widget.active && _c.isAnimating) _c.stop();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    Widget ring(double phase) => AnimatedBuilder(
          animation: _c,
          builder: (_, _) {
            final t = (_c.value + phase) % 1;
            return Opacity(
              opacity: widget.active ? (1 - t) * 0.3 : 0,
              child: Container(
                width: 96 + 80 * t,
                height: 96 + 80 * t,
                decoration: const BoxDecoration(color: Palette.brand, shape: BoxShape.circle),
              ),
            );
          },
        );
    return SizedBox(
      width: 176,
      height: 176,
      child: Stack(alignment: Alignment.center, children: [
        ring(0),
        ring(0.5),
        Container(
          width: 96,
          height: 96,
          decoration: const BoxDecoration(
            color: Palette.brand,
            shape: BoxShape.circle,
            boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 16, offset: Offset(0, 6))],
          ),
          child: const Icon(Icons.handshake_outlined, size: 44, color: Colors.white),
        ),
      ]),
    );
  }
}
