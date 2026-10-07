import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/notifications.dart';
import '../core/presence.dart';
import '../core/map_pause.dart';
import '../core/progress_models.dart';
import '../core/realtime.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'avatar_builder_screen.dart';
import 'challenges_screen.dart';
import 'court_move.dart';
import 'game_screens.dart';
import 'lists_screens.dart';
import 'map_screen.dart';
import 'profile_screen.dart';
import '../core/l10n.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key, this.welcomeAvatar = false, this.onWelcomeShown});

  /// Straight after onboarding: open the avatar builder once (with Skip), like
  /// the web's /profile/avatar?welcome=1.
  final bool welcomeAvatar;
  final VoidCallback? onWelcomeShown;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> with WidgetsBindingObserver {
  int _tab = 0;
  bool _alertOpen = false;
  Timer? _changesTimer;
  int _unread = 0;
  bool _promptOpen = false;
  final List<StreamSubscription> _subs = [];
  final _playNavKey = GlobalKey(debugLabel: 'nav-play');

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _maybePrompt(context.read<PresenceState>());
    });
    if (widget.welcomeAvatar) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _openWelcomeAvatar());
    }
    context.read<PresenceState>().addListener(_onPresence);
    final rt = context.read<Realtime>();
    _subs.add(rt.ofType('notification').listen((ev) {
      _loadUnread();
      if (!mounted) return;
      if ((ev['data'] as Map?)?['kind'] == 'court_change') {
        _checkCourtChanges();
        return; // shown as an alert
      }
      if (ev['notification_type'] == 'presence_check') return; // handled by the prompt
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        behavior: SnackBarBehavior.floating,
        content: Text('${ev['title']}\n${ev['body']}'),
        action: _linkAction(Map<String, dynamic>.from(ev['data'] ?? const {})),
      ));
    }));
    _subs.add(context.read<Notifications>().responses.listen((r) {
      // Plain taps on a push/local notification open the related screen.
      final p = r.payload;
      if (r.actionId == null && p != null && !p.startsWith('presence:') && mounted) {
        final nav = Navigator.of(context);
        if (nav.canPop()) return; // already on a detail screen
        openGameScreen(context, p);
      }
    }));
    _loadUnread();
    WidgetsBinding.instance.addObserver(this);
    _changesTimer = Timer.periodic(const Duration(seconds: 60), (_) => _checkCourtChanges());
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkCourtChanges());
  }

  Future<void> _openWelcomeAvatar() async {
    if (!mounted) return;
    widget.onWelcomeShown?.call();
    final auth = context.read<AuthState>();
    final me = auth.user;
    if (me == null) return;
    final saved = await Navigator.of(context, rootNavigator: true).push<bool>(MaterialPageRoute(
      builder: (_) => AvatarBuilderScreen(
        welcome: true,
        initialUrl: me.avatarUrl,
        initialConfig: me.avatarConfig,
        seed: me.username,
      ),
    ));
    if (saved == true && mounted) await auth.refreshMe();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _checkCourtChanges();
  }

  /// A game/challenge I'm in moved court → alert until acknowledged.
  Future<void> _checkCourtChanges() async {
    if (_alertOpen || !mounted) return;
    final api = context.read<Api>();
    try {
      final j = await api.get('/api/me/court-changes');
      final list = [for (final c in (j as List)) CourtChange.fromJson(Map<String, dynamic>.from(c))];
      if (list.isEmpty || !mounted || _alertOpen) return;
      final change = list.first;
      _alertOpen = true;
      final res = await showCourtChangeAlert(context, change);
      _alertOpen = false;
      try {
        await api.post('/api/me/court-changes/${change.id}/seen');
      } catch (_) {}
      if (!mounted) return;
      if (res == 'view') {
        if (change.gameId != null) {
          openGameScreen(context, change.gameId!);
        } else {
          Navigator.push(context, MaterialPageRoute(builder: (_) => const ChallengesScreen()));
        }
      }
      if (list.length > 1) _checkCourtChanges();
    } catch (_) {
      _alertOpen = false;
    }
  }

  SnackBarAction? _linkAction(Map<String, dynamic> data) {
    final gameId = data['game_id'] as String?;
    if (gameId == null) return null;
    return SnackBarAction(
      label: tr('OPEN', 'OUVRIR'),
      onPressed: () => openGameScreen(context, gameId),
    );
  }

  Future<void> _loadUnread() async {
    try {
      final j = await context.read<Api>().get('/api/notifications');
      if (mounted) setState(() => _unread = (j['unread'] as num).toInt());
    } catch (_) {}
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _changesTimer?.cancel();
    context.read<PresenceState>().removeListener(_onPresence);
    for (final s in _subs) {
      s.cancel();
    }
    super.dispose();
  }

  void _onPresence() {
    if (mounted) _maybePrompt(context.read<PresenceState>());
  }

  /// In-app "Are you still playing?" when the app is open near expiry.
  void _maybePrompt(PresenceState presence) {
    if (_promptOpen || !presence.needsConfirmation) return;
    _promptOpen = true;
    showModalBottomSheet<void>(
      context: context,
      isDismissible: false,
      enableDrag: false,
      builder: (ctx) => _StillPlayingSheet(presence: presence),
    ).whenComplete(() => _promptOpen = false);
  }

  @override
  Widget build(BuildContext context) {
    // Do not keep FlutterMap in the tree under full-screen routes — it triggers
    // semantics.parentDataDirty loops. MapPause is toggled from [GameScreen].
    final mapPaused = context.watch<MapPause>().paused;

    final body = Stack(
      fit: StackFit.expand,
      children: [
        // Keep map mounted so WebSocket → API refresh runs without hot reload.
        Offstage(
          offstage: _tab != 0,
          child: MapScreen(
            key: const PageStorageKey('home-map'),
            onOpenPlayTab: () => setState(() => _tab = 1),
            tabActive: _tab == 0,
            playTabKey: _playNavKey,
          ),
        ),
        if (_tab == 1) PlayScreen(key: const ValueKey('home-play'), tabActive: true),
        if (_tab == 2) MyGamesScreen(key: const ValueKey('home-games'), tabActive: true),
        if (_tab == 3) NotificationsScreen(key: const ValueKey('home-alerts'), onChanged: _loadUnread),
        if (_tab == 4) const ProfileScreen(key: ValueKey('home-profile')),
      ],
    );

    return Scaffold(
      extendBody: true,
      body: ExcludeSemantics(excluding: mapPaused, child: body),
      bottomNavigationBar: _FloatingNavBar(
        selectedIndex: _tab,
        unread: _unread,
        playKey: _playNavKey,
        onSelected: (i) => setState(() => _tab = i),
      ),
    );
  }
}

/// Material 3 bar inset from the screen edge — same behavior as [Scaffold.bottomNavigationBar].
class _FloatingNavBar extends StatelessWidget {
  const _FloatingNavBar({
    required this.selectedIndex,
    required this.unread,
    required this.onSelected,
    this.playKey,
  });

  final int selectedIndex;
  final int unread;
  final GlobalKey? playKey;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final border = dark ? const Color(0xFF2A323D) : const Color(0xFFE8E4DC);

    return Material(
      color: Colors.transparent,
      elevation: 16,
      shadowColor: Colors.black.withValues(alpha: 0.2),
      child: SafeArea(
        minimum: const EdgeInsets.fromLTRB(20, 0, 20, 10),
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: scheme.shadow.withValues(alpha: dark ? 0.35 : 0.12),
                blurRadius: 20,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Material(
            color: scheme.surface,
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: BorderSide(color: border),
            ),
            clipBehavior: Clip.antiAlias,
            child: NavigationBar(
              selectedIndex: selectedIndex,
              onDestinationSelected: onSelected,
              destinations: [
                NavigationDestination(
                  icon: const Icon(Icons.map_outlined),
                  selectedIcon: const Icon(Icons.map),
                  label: tr('Map', 'Carte'),
                ),
                NavigationDestination(
                  key: playKey,
                  icon: const Icon(Icons.sports_basketball_outlined),
                  selectedIcon: const Icon(Icons.sports_basketball),
                  label: tr('Play', 'Jouer'),
                ),
                NavigationDestination(
                  icon: const Icon(Icons.event_outlined),
                  selectedIcon: const Icon(Icons.event),
                  label: tr('Games', 'Matchs'),
                ),
                NavigationDestination(
                  icon: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      const Icon(Icons.notifications_outlined),
                      if (unread > 0)
                        Positioned(
                          right: -2,
                          top: -2,
                          child: Container(
                            padding: const EdgeInsets.all(3),
                            decoration: const BoxDecoration(color: Palette.live, shape: BoxShape.circle),
                            constraints: const BoxConstraints(minWidth: 14, minHeight: 14),
                            child: Text(
                              unread > 9 ? '9+' : '$unread',
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.w900, height: 1),
                            ),
                          ),
                        ),
                    ],
                  ),
                  selectedIcon: const Icon(Icons.notifications),
                  label: tr('Alerts', 'Alertes'),
                ),
                NavigationDestination(
                  icon: const Icon(Icons.person_outline),
                  selectedIcon: const Icon(Icons.person),
                  label: tr('Profile', 'Profil'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _StillPlayingSheet extends StatefulWidget {
  final PresenceState presence;
  const _StillPlayingSheet({required this.presence});
  @override
  State<_StillPlayingSheet> createState() => _StillPlayingSheetState();
}

class _StillPlayingSheetState extends State<_StillPlayingSheet> {
  bool _busy = false;
  String? _error;

  Future<void> _run(Future<void> Function() f) async {
    setState(() => _busy = true);
    try {
      await f();
      if (mounted) Navigator.pop(context);
    } catch (e) {
      setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.presence.current;
    final mins = p == null ? 0 : p.expiresAt.difference(DateTime.now()).inMinutes.clamp(1, 60);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Icon(Icons.sports_basketball, size: 48, color: Palette.brand),
          Text(tr('ARE YOU STILL PLAYING?', 'VOUS JOUEZ ENCORE ?'), style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 4),
          Text(tr('Your check-in at ${p?.courtName ?? 'the court'} ends in $mins min.',
              'Votre présence à ${p?.courtName ?? 'ce terrain'} se termine dans $mins min.')),
          const SizedBox(height: 20),
          ErrorBanner(_error),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Palette.live),
            onPressed: _busy ? null : () => _run(widget.presence.confirm),
            child: Text(tr("YES, I'M STILL HERE", 'OUI, JE SUIS TOUJOURS LÀ')),
          ),
          const SizedBox(height: 10),
          OutlinedButton(onPressed: _busy ? null : () => _run(widget.presence.leave), child: Text(tr('I LEFT', 'JE SUIS PARTI'))),
        ]),
      ),
    );
  }
}
