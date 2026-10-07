import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/my_sport.dart';
import '../core/user_errors.dart';
import '../core/format.dart';
import '../core/guide.dart';
import '../core/location.dart';
import '../core/nearby.dart';
import '../core/notification_links.dart';
import '../core/models.dart';
import '../core/presence.dart';
import '../core/realtime.dart';
import '../ui/theme.dart';
import '../ui/app_icons.dart';
import '../ui/push_setup_card.dart';
import '../ui/screen_guide.dart';
import '../ui/widgets.dart';
import 'court_screens.dart';
import 'game_screens.dart';
import 'notification_routes.dart';
import '../core/l10n.dart';

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

  /// Active sports catalog (loaded once).
  List<Sport>? _sports;

  /// Admin chip: null = All.
  String? _adminSport;

  /// Member chips switched off (all of their sports are on by default).
  Set<String> _sportsOff = const {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _location = context.read<LocationState>();
      _location!.addListener(_onLocation);
    });
    ScreenGuide.maybeShow(context, screen: GuideScreen.play, when: () => widget.tabActive, tips: [
      GuideTip(
        icon: const Icon(Icons.place),
        title: tr('Games near you', 'Les matchs près de vous'),
        body: tr('Live games first, then upcoming ones. Tap a game to join, or create your own.',
            'Les matchs en cours d’abord, puis ceux à venir. Touchez un match pour le rejoindre, ou créez le vôtre.'),
      ),
    ]);
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
    if (_sports == null) {
      final sportsJ = await api.get('/api/sports');
      final sports = [for (final x in sportsJ) Sport.fromJson(x)];
      rememberSports(sports);
      _sports = sports.where((s) => s.active).toList();
    }
    final slugs = playSportSlugs(
      isAdmin: user?.isAdmin ?? false,
      adminSport: _adminSport,
      mySports: sportsForUser(user, _sports!),
      off: _sportsOff,
    );
    // One request per sport, merged (web usePlayGamesNearby).
    final results = await Future.wait([
      for (final slug in slugs)
        api.get(
          '/api/games/nearby?lat=${c.latitude}&lng=${c.longitude}&radius_km=$listNearbyRadiusKm&upcoming_hours=$playUpcomingHours'
          '${slug != null ? '&sport=$slug' : ''}',
        ),
    ]);
    final merged = <String, Game>{};
    for (final j in results) {
      for (final g in j as List) {
        final game = Game.fromJson(g);
        merged[game.id] = game;
      }
    }
    _games = sortPlayable(merged.values.toList());
  }

  void _setSports(void Function() update) {
    setState(update);
    reload(showLoading: true);
  }

  Widget _sportChips() {
    final user = context.watch<AuthState>().user;
    final isAdmin = user?.isAdmin ?? false;
    final sports = _sports ?? const <Sport>[];
    final mine = sportsForUser(user, sports);
    Widget chip(Widget label, bool selected, VoidCallback onTap) => Padding(
          padding: const EdgeInsets.only(right: 8),
          child: ChoiceChip(label: label, selected: selected, onSelected: (_) => onTap(), showCheckmark: false),
        );
    Widget sportLabel(Sport s) => SportInline(s, textStyle: const TextStyle(fontWeight: FontWeight.w700));
    final chips = isAdmin
        ? [
            chip(Text(tr('All', 'Tous'), style: const TextStyle(fontWeight: FontWeight.w700)), _adminSport == null, () {
              if (_adminSport != null) _setSports(() => _adminSport = null);
            }),
            for (final s in sports)
              chip(sportLabel(s), _adminSport == s.slug, () {
                if (_adminSport != s.slug) _setSports(() => _adminSport = s.slug);
              }),
          ]
        : [
            for (final s in mine)
              chip(sportLabel(s), !_sportsOff.contains(s.slug), () {
                final next = togglePlaySport(_sportsOff, s.slug, mine);
                if (!identical(next, _sportsOff)) _setSports(() => _sportsOff = next);
              }),
          ];
    if (chips.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: chips)),
    );
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
      appBar: AppBar(title: Text(tr('PLAY', 'JOUER'))),
      body: RefreshIndicator(
        onRefresh: () => reload(showLoading: true),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: floatingNavListPadding(context),
          children: [
          _sportChips(),
          if (waitingGps)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                tr('Finding your location… Showing games near Grand-Bassam until GPS is ready.',
                    'Recherche de votre position… Affichage des matchs près de Grand-Bassam en attendant le GPS.'),
                style: TextStyle(fontSize: 13, color: Theme.of(context).colorScheme.onSurfaceVariant),
              ),
            )
          else if (!loc.hasFix)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                tr('Location is off — distances use Grand-Bassam. Turn on location to see games near you.',
                    'Localisation désactivée — distances calculées depuis Grand-Bassam. Activez la localisation pour voir les matchs près de vous.'),
                style: TextStyle(fontSize: 13, color: Theme.of(context).colorScheme.onSurfaceVariant),
              ),
            ),
          if (loading) const Center(child: CircularProgressIndicator()),
          ErrorBanner(error),
          if (!loading && _games.isEmpty && error == null)
            EmptyState(
              icon: baseSportIconData(context),
              title: tr('No games nearby yet', 'Aucun match à proximité pour l’instant'),
              body: error != null ? tr('Pull down to try again.', 'Tirez vers le bas pour réessayer.') : tr('Be the first to start one.', 'Lancez le premier match.'),
              action: PrimaryButton(
                onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CreateGameScreen())).then((_) => reload()),
                child: Text(tr('CREATE A GAME', 'CRÉER UN MATCH')),
              ),
            ),
          if (live.isNotEmpty) ...[
            Row(children: [
              Icon(Icons.local_fire_department, color: Theme.of(context).colorScheme.primary),
              const SizedBox(width: 8),
              Text(tr('PLAYING NOW', 'EN COURS'), style: Theme.of(context).textTheme.titleLarge),
            ]),
            const SizedBox(height: 8),
            for (final g in live) Padding(padding: const EdgeInsets.only(bottom: 8), child: GameCard(game: g, onTap: () => openGame(g.id))),
          ],
          if (soon.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(tr('STARTING SOON', 'BIENTÔT'), style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            for (final g in soon) Padding(padding: const EdgeInsets.only(bottom: 8), child: GameCard(game: g, onTap: () => openGame(g.id))),
          ],
          if (upcoming.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(tr('UPCOMING', 'À VENIR'), style: Theme.of(context).textTheme.titleLarge),
            Padding(
              padding: const EdgeInsets.only(top: 4, bottom: 8),
              child: Text(
                tr('Scheduled in the next week near you.', 'Matchs prévus la semaine prochaine près de vous.'),
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
  /// Switches the home shell to the Play tab (empty state's "Find a game").
  final VoidCallback? onOpenPlayTab;
  const MyGamesScreen({super.key, super.tabActive, this.onOpenPlayTab});
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
      appBar: AppBar(title: Text(tr('MY GAMES', 'MES MATCHS'))),
      body: RefreshIndicator(
        onRefresh: reload,
        child: ListView(padding: floatingNavListPadding(context), children: [
          if (presence != null)
            Card(
              color: Palette.live.withValues(alpha: 0.12),
              child: ListTile(
                leading: const Icon(Icons.circle, color: Palette.live, size: 14),
                title: Text(tr('Present at ${presence.courtName}', 'Sur place à ${presence.courtName}'), style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text(tr('Since ${clock(presence.startedAt)} · until ${clock(presence.expiresAt)}',
                    'Depuis ${clock(presence.startedAt)} · jusqu’à ${clock(presence.expiresAt)}')),
                onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => CourtDetailsScreen(courtId: presence.courtId))),
              ),
            ),
          const SizedBox(height: 12),
          if (loading) const Center(child: CircularProgressIndicator()),
          ErrorBanner(error),
          Text(tr('NOW & UPCOMING', 'EN COURS ET À VENIR'), style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          if (!loading && _current.isEmpty)
            EmptyState(
              icon: Icons.event,
              title: tr('No games yet', 'Pas encore de match'),
              body: tr('Find a game near you and join it.', 'Trouvez un match près de vous et rejoignez-le.'),
              action: PrimaryButton(
                onPressed: widget.onOpenPlayTab ??
                    () => Navigator.push(context, MaterialPageRoute(builder: (_) => const PlayScreen())),
                child: Text(tr('FIND A GAME', 'TROUVER UN MATCH')),
              ),
            ),
          for (final g in _current) Padding(padding: const EdgeInsets.only(bottom: 8), child: GameCard(game: g, onTap: () => openGame(g.id))),
          if (_past.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(tr('PAST', 'PASSÉS'), style: Theme.of(context).textTheme.titleLarge),
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
    openNotificationTarget(context, notificationTarget(n.type, n.data));
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
        title: Text(tr('NOTIFICATIONS', 'NOTIFICATIONS')),
        actions: [if (_items.any((n) => !n.read)) TextButton(onPressed: _readAll, child: Text(tr('Mark all read', 'Tout marquer comme lu')))],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _items.isEmpty
                ? ListView(padding: floatingNavListPadding(context, all: 0), children: [
                    const Padding(padding: EdgeInsets.fromLTRB(16, 16, 16, 0), child: PushSetupCard()),
                    EmptyState(
                        icon: Icons.notifications_outlined,
                        title: tr('All quiet', 'Tout est calme'),
                        body: tr('Game reminders, invites and games starting near you show up here.',
                            'Les rappels de match, les invitations et les matchs qui commencent près de vous apparaissent ici.')),
                  ])
                : ListView.separated(
                    padding: floatingNavListPadding(context),
                    itemCount: _items.length + 1,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (_, i) {
                      if (i == 0) return const PushSetupCard();
                      final n = _items[i - 1];
                      return Card(
                        color: n.read ? null : Palette.brand.withValues(alpha: 0.06),
                        child: ListTile(
                          leading: Icon(notificationIconData(n.type, data: n.data), color: Palette.brand),
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
