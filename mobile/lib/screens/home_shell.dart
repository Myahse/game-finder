import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/notifications.dart';
import '../core/presence.dart';
import '../core/realtime.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'game_screens.dart';
import 'lists_screens.dart';
import 'map_screen.dart';
import 'profile_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _tab = 0;
  int _unread = 0;
  bool _promptOpen = false;
  final List<StreamSubscription> _subs = [];

  @override
  void initState() {
    super.initState();
    final rt = context.read<Realtime>();
    _subs.add(rt.ofType('notification').listen((ev) {
      _loadUnread();
      if (!mounted) return;
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
        nav.push(MaterialPageRoute(builder: (_) => GameScreen(gameId: p)));
      }
    }));
    _loadUnread();
  }

  SnackBarAction? _linkAction(Map<String, dynamic> data) {
    final gameId = data['game_id'] as String?;
    if (gameId == null) return null;
    return SnackBarAction(
      label: 'OPEN',
      onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => GameScreen(gameId: gameId))),
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
    for (final s in _subs) {
      s.cancel();
    }
    super.dispose();
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
    final presence = context.watch<PresenceState>();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _maybePrompt(presence);
    });
    final pages = [
      const MapScreen(),
      const PlayScreen(),
      const MyGamesScreen(),
      NotificationsScreen(onChanged: _loadUnread),
      const ProfileScreen(),
    ];
    return Scaffold(
      extendBody: true,
      body: IndexedStack(index: _tab, children: pages),
      bottomNavigationBar: _FloatingNavBar(
        selectedIndex: _tab,
        unread: _unread,
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
  });

  final int selectedIndex;
  final int unread;
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
                const NavigationDestination(
                  icon: Icon(Icons.map_outlined),
                  selectedIcon: Icon(Icons.map),
                  label: 'Map',
                ),
                const NavigationDestination(
                  icon: Icon(Icons.sports_basketball_outlined),
                  selectedIcon: Icon(Icons.sports_basketball),
                  label: 'Play',
                ),
                const NavigationDestination(
                  icon: Icon(Icons.event_outlined),
                  selectedIcon: Icon(Icons.event),
                  label: 'Games',
                ),
                NavigationDestination(
                  icon: Badge(
                    isLabelVisible: unread > 0,
                    label: Text(unread > 99 ? '99+' : '$unread'),
                    child: const Icon(Icons.notifications_outlined),
                  ),
                  selectedIcon: const Icon(Icons.notifications),
                  label: 'Alerts',
                ),
                const NavigationDestination(
                  icon: Icon(Icons.person_outline),
                  selectedIcon: Icon(Icons.person),
                  label: 'Profile',
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
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Icon(Icons.sports_basketball, size: 48, color: Palette.brand),
          Text('ARE YOU STILL PLAYING?', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 4),
          Text('Your check-in at ${p?.courtName ?? 'the court'} ends in $mins min.'),
          const SizedBox(height: 20),
          ErrorBanner(_error),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Palette.live),
            onPressed: _busy ? null : () => _run(widget.presence.confirm),
            child: const Text("YES, I'M STILL HERE"),
          ),
          const SizedBox(height: 10),
          OutlinedButton(onPressed: _busy ? null : () => _run(widget.presence.leave), child: const Text('I LEFT')),
        ]),
      ),
    );
  }
}
