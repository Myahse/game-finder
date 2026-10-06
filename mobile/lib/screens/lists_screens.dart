import 'dart:async';
import 'challenges_screen.dart';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/my_sport.dart';
import '../core/user_errors.dart';
import '../core/format.dart';
import '../core/location.dart';
import '../core/nearby.dart';
import '../core/models.dart';
import '../core/presence.dart';
import '../core/realtime.dart';
import '../ui/theme.dart';
import '../ui/app_icons.dart';
import '../ui/widgets.dart';
import 'court_screens.dart';
import 'game_screens.dart';

/// Base for tab lists that reload on realtime game events.
abstract class LiveListScreen extends StatefulWidget {
  final bool tabActive;
  const LiveListScreen({super.key, this.tabActive = true});
}

abstract class _LiveListState<T extends LiveListScreen> extends State<T> {
  StreamSubscription? _rt;
  Timer? _debounce;
  bool loading = true;
  String? error;

  Future<void> fetch();

  bool _tabLive() {
    if (!mounted || !widget.tabActive) return false;
    return true;
  }

  void _commit(void Function() update) {
    update();
    if (_tabLive()) setState(() {});
  }

  Future<void> reload({bool showLoading = false}) async {
    if (showLoading && _tabLive()) setState(() => loading = true);
    try {
      await fetch();
      error = null;
    } catch (e) {
      error = errorText(e);
      if (mounted && e is ApiException && e.code == 'browse_location_mismatch') {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) showApiIssue(context, e);
        });
      }
    }
    if (!mounted) return;
    _commit(() => loading = false);
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) reload(showLoading: true);
    });
    _rt = context.read<Realtime>().events.listen((ev) {
      if (ev['type'] != 'game' && ev['type'] != 'reconnected') return;
      if (!_tabLive()) return;
      _debounce?.cancel();
      _debounce = Timer(const Duration(milliseconds: 400), () => reload());
    });
  }

  @override
  void didUpdateWidget(covariant T oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.tabActive && !oldWidget.tabActive) reload();
  }

  @override
  void dispose() {
    _rt?.cancel();
    _debounce?.cancel();
    super.dispose();
  }

  void openGame(String id) {
    openGameScreen(context, id, onReturn: () {
      if (mounted) reload();
    });
  }
}

/// Nearby games: active first, closest → liveliest → most room.
class PlayScreen extends LiveListScreen {
  const PlayScreen({super.key, super.tabActive});
  @override
  State<PlayScreen> createState() => _PlayScreenState();
}

class _PlayScreenState extends _LiveListState<PlayScreen> {
  List<Game> _games = [];
  LocationState? _location;
  Timer? _locDebounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _location = context.read<LocationState>();
      _location!.addListener(_onLocation);
    });
  }

  @override
  void dispose() {
    _locDebounce?.cancel();
    _location?.removeListener(_onLocation);
    super.dispose();
  }

  void _onLocation() {
    if (!_tabLive()) return;
    _locDebounce?.cancel();
    _locDebounce = Timer(const Duration(milliseconds: 400), () {
      if (mounted) reload();
    });
  }

  @override
  Future<void> fetch() async {
    final api = context.read<Api>();
    final user = context.read<AuthState>().user;
    final c = context.read<LocationState>().center;
    var sportQ = '';
    if (!(user?.isAdmin ?? false) && user?.preferredSportId != null) {
      final sportsJ = await api.get('/api/sports');
      final sports = [for (final x in sportsJ) Sport.fromJson(x)];
      final slug = sportSlugForUser(user, sports);
      if (slug != null) sportQ = '&sport=$slug';
    }
    final j = await api.get(
      '/api/games/nearby?lat=${c.latitude}&lng=${c.longitude}&radius_km=$listNearbyRadiusKm&upcoming_hours=$playUpcomingHours$sportQ',
    );
    _games = sortPlayable([for (final g in j as List) Game.fromJson(g)]);
  }

  @override
  Widget build(BuildContext context) {
    final loc = context.watch<LocationState>();
    final live = _games.where((g) => g.isLive).toList();
    final split = splitScheduledBySoon(_games);
    final soon = split.soon;
    final upcoming = split.upcoming;
    final waitingGps = !loc.hasFix && loc.status != LocationStatus.denied && loc.status != LocationStatus.serviceOff;
    return Scaffold(
      appBar: AppBar(title: const Text('PLAY')),
      body: RefreshIndicator(
        onRefresh: () => reload(showLoading: true),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
          if (waitingGps)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                'Finding your location… Showing games near Grand-Bassam until GPS is ready.',
                style: TextStyle(fontSize: 13, color: Theme.of(context).colorScheme.onSurfaceVariant),
              ),
            )
          else if (!loc.hasFix)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                'Location is off — distances use Grand-Bassam. Turn on location to see games near you.',
                style: TextStyle(fontSize: 13, color: Theme.of(context).colorScheme.onSurfaceVariant),
              ),
            ),
          if (loading) const Center(child: CircularProgressIndicator()),
          ErrorBanner(error),
          if (!loading && _games.isEmpty && error == null)
            EmptyState(
              icon: Icons.sports_basketball,
              title: 'No games nearby yet',
              body: error != null ? 'Pull down to try again.' : 'Be the one who starts it.',
              action: PrimaryButton(
                onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CreateGameScreen())).then((_) => reload()),
                child: const Text('CREATE A GAME'),
              ),
            ),
          if (live.isNotEmpty) ...[
            Row(children: [
              Icon(Icons.local_fire_department, color: Theme.of(context).colorScheme.primary),
              const SizedBox(width: 8),
              Text('PLAYING NOW', style: Theme.of(context).textTheme.titleLarge),
            ]),
            const SizedBox(height: 8),
            for (final g in live) Padding(padding: const EdgeInsets.only(bottom: 8), child: GameCard(game: g, onTap: () => openGame(g.id))),
          ],
          if (soon.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text('STARTING SOON', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            for (final g in soon) Padding(padding: const EdgeInsets.only(bottom: 8), child: GameCard(game: g, onTap: () => openGame(g.id))),
          ],
          if (upcoming.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text('UPCOMING', style: Theme.of(context).textTheme.titleLarge),
            Padding(
              padding: const EdgeInsets.only(top: 4, bottom: 8),
              child: Text(
                'Scheduled in the next week near you.',
                style: TextStyle(fontSize: 13, color: Theme.of(context).colorScheme.onSurfaceVariant),
              ),
            ),
            for (final g in upcoming)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: GameCard(game: g, upcomingAccent: true, onTap: () => openGame(g.id)),
              ),
          ],
        ]),
      ),
    );
  }
}

class MyGamesScreen extends LiveListScreen {
  const MyGamesScreen({super.key, super.tabActive});
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
                leading: const Icon(Icons.circle, color: Palette.live, size: 14),
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
          if (!loading && _current.isEmpty)
            const EmptyState(icon: Icons.event, title: 'No games yet', body: 'Tap Play to find a game near you.'),
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
    if (n.type == 'challenge') {
      Navigator.push(context, MaterialPageRoute(builder: (_) => const ChallengesScreen()));
    } else if (gameId != null) {
      openGameScreen(context, gameId);
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
                    EmptyState(icon: Icons.notifications_outlined, title: 'All quiet', body: 'Game reminders, invites and games starting near you show up here.'),
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
                          leading: Icon(notificationIconData(n.type), color: Palette.brand),
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
