import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/location.dart';
import '../core/models.dart';
import '../core/presence.dart';
import '../core/realtime.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'court_screens.dart';
import 'game_screens.dart';

/// Base for lists that reload on realtime game events.
abstract class _LiveListState<T extends StatefulWidget> extends State<T> {
  StreamSubscription? _rt;
  Timer? _debounce;
  bool loading = true;
  String? error;

  Future<void> fetch();

  Future<void> reload() async {
    try {
      await fetch();
      error = null;
    } catch (e) {
      error = errorText(e);
    }
    if (mounted) setState(() => loading = false);
  }

  @override
  void initState() {
    super.initState();
    reload();
    _rt = context.read<Realtime>().events.listen((ev) {
      if (ev['type'] == 'game' || ev['type'] == 'reconnected') {
        _debounce?.cancel();
        _debounce = Timer(const Duration(milliseconds: 400), reload);
      }
    });
  }

  @override
  void dispose() {
    _rt?.cancel();
    _debounce?.cancel();
    super.dispose();
  }

  void openGame(String id) =>
      Navigator.push(context, MaterialPageRoute(builder: (_) => GameScreen(gameId: id))).then((_) => reload());
}

/// "I WANT TO PLAY": active games nearby, closest → liveliest → most room.
class PlayScreen extends StatefulWidget {
  const PlayScreen({super.key});
  @override
  State<PlayScreen> createState() => _PlayScreenState();
}

class _PlayScreenState extends _LiveListState<PlayScreen> {
  List<Game> _games = [];

  @override
  Future<void> fetch() async {
    final c = context.read<LocationState>().center;
    final j = await context.read<Api>().get('/api/games/nearby?lat=${c.latitude}&lng=${c.longitude}');
    _games = sortPlayable([for (final g in j) Game.fromJson(g)]);
  }

  @override
  Widget build(BuildContext context) {
    final live = _games.where((g) => g.isLive).toList();
    final soon = _games.where((g) => !g.isLive).toList();
    return Scaffold(
      appBar: AppBar(title: const Text('I WANT TO PLAY')),
      body: RefreshIndicator(
        onRefresh: reload,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          if (loading) const Center(child: CircularProgressIndicator()),
          ErrorBanner(error),
          if (!loading && _games.isEmpty)
            EmptyState(
              icon: '🏀',
              title: 'No games nearby yet',
              body: 'Be the one who starts it.',
              action: FilledButton(
                onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CreateGameScreen())).then((_) => reload()),
                child: const Text('CREATE A GAME'),
              ),
            ),
          if (live.isNotEmpty) ...[
            Text('🔥 PLAYING NOW', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            for (final g in live) Padding(padding: const EdgeInsets.only(bottom: 8), child: GameCard(game: g, onTap: () => openGame(g.id))),
          ],
          if (soon.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text('STARTING SOON', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            for (final g in soon) Padding(padding: const EdgeInsets.only(bottom: 8), child: GameCard(game: g, onTap: () => openGame(g.id))),
          ],
        ]),
      ),
    );
  }
}

class MyGamesScreen extends StatefulWidget {
  const MyGamesScreen({super.key});
  @override
  State<MyGamesScreen> createState() => _MyGamesScreenState();
}

class _MyGamesScreenState extends _LiveListState<MyGamesScreen> {
  List<Game> _current = [], _past = [];

  @override
  Future<void> fetch() async {
    final j = await context.read<Api>().get('/api/me/games?${context.read<LocationState>().query}');
    _current = [for (final g in j['current']) Game.fromJson(g)];
    _past = [for (final g in j['past']) Game.fromJson(g)];
  }

  @override
  Widget build(BuildContext context) {
    final presence = context.watch<PresenceState>().current;
    return Scaffold(
      appBar: AppBar(title: const Text('MY GAMES')),
      body: RefreshIndicator(
        onRefresh: reload,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          if (presence != null)
            Card(
              color: Palette.live.withValues(alpha: 0.12),
              child: ListTile(
                leading: const Text('🟢', style: TextStyle(fontSize: 22)),
                title: Text('Present at ${presence.courtName}', style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text('Since ${clock(presence.startedAt)} · until ${clock(presence.expiresAt)}'),
                onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => CourtDetailsScreen(courtId: presence.courtId))),
              ),
            ),
          const SizedBox(height: 12),
          if (loading) const Center(child: CircularProgressIndicator()),
          ErrorBanner(error),
          Text('NOW & UPCOMING', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          if (!loading && _current.isEmpty) const EmptyState(icon: '📅', title: 'No games yet', body: 'Tap Play to find a game near you.'),
          for (final g in _current) Padding(padding: const EdgeInsets.only(bottom: 8), child: GameCard(game: g, onTap: () => openGame(g.id))),
          if (_past.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text('PAST', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            for (final g in _past)
              Opacity(opacity: 0.75, child: Padding(padding: const EdgeInsets.only(bottom: 8), child: GameCard(game: g, onTap: () => openGame(g.id)))),
          ],
        ]),
      ),
    );
  }
}

class NotificationsScreen extends StatefulWidget {
  final VoidCallback onChanged;
  const NotificationsScreen({super.key, required this.onChanged});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<AppNotification> _items = [];
  bool _loading = true;
  StreamSubscription? _rt;

  static const _icons = {
    'game_reminder': '⏰',
    'game_invite': '🤝',
    'game_activity': '🔥',
    'presence_check': '📍',
    'game_cancelled': '✖',
    'system': '📣',
  };

  @override
  void initState() {
    super.initState();
    _load();
    _rt = context.read<Realtime>().ofType('notification').listen((_) => _load());
  }

  @override
  void dispose() {
    _rt?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final j = await context.read<Api>().get('/api/notifications');
      if (mounted) setState(() => _items = [for (final n in j['items']) AppNotification.fromJson(n)]);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _open(AppNotification n) async {
    final api = context.read<Api>();
    if (!n.read) {
      await api.post('/api/notifications/${n.id}/read').catchError((_) => null);
      widget.onChanged();
      _load();
    }
    if (!mounted) return;
    final gameId = n.data['game_id'] as String?;
    final courtId = n.data['court_id'] as String?;
    if (gameId != null) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => GameScreen(gameId: gameId)));
    } else if (courtId != null) {
      Navigator.push(context, MaterialPageRoute(builder: (_) => CourtDetailsScreen(courtId: courtId)));
    }
  }

  Future<void> _readAll() async {
    await context.read<Api>().post('/api/notifications/read-all').catchError((_) => null);
    widget.onChanged();
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('NOTIFICATIONS'),
        actions: [if (_items.any((n) => !n.read)) TextButton(onPressed: _readAll, child: const Text('Mark all read'))],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _items.isEmpty
                ? ListView(children: const [
                    EmptyState(icon: '🔔', title: 'All quiet', body: 'Game reminders, invites and games starting near you show up here.'),
                  ])
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _items.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (_, i) {
                      final n = _items[i];
                      return Card(
                        color: n.read ? null : Palette.brand.withValues(alpha: 0.06),
                        child: ListTile(
                          leading: Text(_icons[n.type] ?? '📣', style: const TextStyle(fontSize: 24)),
                          title: Text(n.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                          subtitle: Text('${n.body}\n${timeAgo(n.createdAt)}'),
                          isThreeLine: true,
                          trailing: n.read ? null : const CircleAvatar(radius: 5, backgroundColor: Palette.brand),
                          onTap: () => _open(n),
                        ),
                      );
                    },
                  ),
      ),
    );
  }
}
