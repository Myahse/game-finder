import 'dart:async';



import 'package:flutter/material.dart';

import 'package:latlong2/latlong.dart' hide Path;

import 'package:provider/provider.dart';



import '../core/api.dart';
import '../core/auth.dart';
import '../core/my_sport.dart';
import '../core/user_errors.dart';

import '../core/format.dart';

import '../core/location.dart';

import '../core/map_tiles.dart';

import '../core/models.dart';

import '../core/map_pause.dart';
import '../core/realtime.dart';

import '../core/nearby.dart';
import '../core/notify_area_sync.dart';
import '../core/weather.dart';
import '../core/guide.dart';
import '../ui/app_icons.dart';
import '../ui/home_globe_map.dart';
import '../ui/map_games_rail.dart';
import '../ui/map_search_bar.dart';
import '../ui/screen_guide.dart';

import '../ui/theme.dart';

import 'court_screens.dart';
import 'game_screens.dart';
import '../core/l10n.dart';



class MapScreen extends StatefulWidget {

  final VoidCallback? onOpenPlayTab;
  final bool tabActive;

  /// The Play destination in the bottom bar (first-visit tip points at it).
  final GlobalKey? playTabKey;

  const MapScreen({super.key, this.onOpenPlayTab, this.tabActive = true, this.playTabKey});

  @override

  State<MapScreen> createState() => _MapScreenState();

}



class _MapScreenState extends State<MapScreen> {

  HomeGlobeMapController? _globe;

  List<Court> _courts = [];

  List<Game> _games = [];

  List<Sport> _sports = [];

  Map<String, CourtRain> _rain = const {};

  String? _sport;

  /// Sports list fetched (or failed): until then the sport filter is unknown.
  bool _sportsLoaded = false;

  /// Latest map fetch; older responses are dropped (e.g. after a sport switch).
  int _fetchSeq = 0;

  bool _gamesLoading = true;

  LatLng? _loadedAt;

  bool _centered = false;

  final _notifyArea = NotifyAreaSync();

  bool _mapReady = false;

  StreamSubscription? _sub;
  LocationState? _location;
  final Set<String> _pulseGameIds = {};
  Timer? _pulseClear;

  bool _routeReady = false;

  final _sportChipsKey = GlobalKey();

  /// First-visit tips; only while the map is the active tab (waits under sheets/routes).
  void _maybeShowGuide() {
    if (!widget.tabActive) return;
    ScreenGuide.maybeShow(
      context,
      screen: GuideScreen.map,
      when: () => widget.tabActive,
      tips: [
        GuideTip(
          icon: Row(mainAxisSize: MainAxisSize.min, children: [
            for (final (i, slug) in const ['basketball', 'football', 'volleyball', 'tennis', 'badminton'].indexed) ...[
              if (i > 0) const SizedBox(width: 8),
              SportIcon(slug, size: 24),
            ],
          ]),
          title: tr('Every sport, one app', 'Tous les sports, une seule app'),
          body: tr('Basketball, football, volleyball, tennis, badminton… Find people near you to play with, whatever your game.',
              'Basket, foot, volley, tennis, badminton… Trouvez des gens près de chez vous pour jouer, quel que soit votre sport.'),
        ),
        GuideTip(
          target: _sportChipsKey,
          icon: const Icon(Icons.swap_horiz),
          title: tr('Switch sport here', 'Changez de sport ici'),
          body: tr('The map shows courts and games for the sport you pick. Add more sports from your profile.',
              'La carte montre les terrains et les matchs du sport choisi. Ajoutez d’autres sports depuis votre profil.'),
        ),
        GuideTip(
          target: widget.playTabKey,
          icon: const Icon(Icons.groups),
          title: tr('Play together', 'Jouez ensemble'),
          body: tr('Join a game near you or start one in a few taps — players around you get notified.',
              'Rejoignez un match près de vous ou lancez-en un en quelques gestes — les joueurs autour sont prévenus.'),
        ),
      ],
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _routeReady = true;
  }

  /// Map tab is mounted and can hold refreshed court/game data (WebSocket → API).
  bool _mapTabLive() {
    if (!mounted || !widget.tabActive || !_routeReady) return false;
    return true;
  }

  /// Map tiles accept touches (not covered by a route or full-screen game).
  bool _mapSurfaceActive() {
    if (!_mapTabLive()) return false;
    if (context.read<MapPause>().paused) return false;
    final route = ModalRoute.of(context);
    return route == null || route.isCurrent;
  }

  void _schedulePulseClear() {
    _pulseClear?.cancel();
    _pulseClear = Timer(const Duration(seconds: 3), () {
      if (!mounted) return;
      setState(() => _pulseGameIds.clear());
    });
  }

  void _applyMapState(void Function() update) {
    final before = _games.map((g) => g.id).toSet();
    update();
    final added = _games.where((g) => !before.contains(g.id)).map((g) => g.id);
    if (added.isNotEmpty) {
      _pulseGameIds.addAll(added);
      _schedulePulseClear();
    }
    if (_mapTabLive()) setState(() {});
  }

  @override

  void initState() {

    super.initState();

    // The first fetch waits for the sports list so it already uses the
    // player's sport (otherwise a volleyball player saw every sport's games).
    final sportsReady = _loadSports();

    _sub = context.read<Realtime>().events.listen((ev) {
      if (ev['type'] == 'court_stats') {
        if (!_mapSurfaceActive()) return;
        final c = _courts.where((c) => c.id == ev['court_id']);
        if (c.isNotEmpty) _applyMapState(() => c.first.applyStats(ev));
      } else if (ev['type'] == 'game') {
        // Server event → refetch nearby games (not hot reload).
        final id = ev['game_id'] as String?;
        if (ev['kind'] == 'insert' && id != null) {
          _pulseGameIds.add(id);
          _schedulePulseClear();
          if (_mapTabLive()) setState(() {});
        }
        _refreshMapData(silent: true);
      } else if (ev['type'] == 'reconnected') {
        _refreshMapData(silent: true);
      }
    });

    _location = context.read<LocationState>();
    _location!.addListener(_onLocation);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      sportsReady.whenComplete(() {
        if (mounted) _refreshMapData();
      });
      _centerOnUserIfNeeded();
    });
    _maybeShowGuide();
  }

  void _centerOnUserIfNeeded() {
    if (!mounted || !widget.tabActive || !_mapReady || _centered || context.read<MapPause>().paused) return;
    final p = context.read<LocationState>().position;
    if (p == null) return;
    _centered = true;
    _globe?.flyTo(p, 14);
  }

  @override
  void didUpdateWidget(covariant MapScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.tabActive && !oldWidget.tabActive) {
      _syncSportFilterToUser(); // sports may have changed on the profile
      _refreshMapData(silent: true);
      WidgetsBinding.instance.addPostFrameCallback((_) => _centerOnUserIfNeeded());
      _maybeShowGuide();
    }
  }

  @override

  void dispose() {

    _sub?.cancel();
    _pulseClear?.cancel();

    _location?.removeListener(_onLocation);

    super.dispose();

  }



  void _onLocation() {

    final loc = context.read<LocationState>();

    final p = loc.position;

    if (p == null) return;

    if (!_centered && _mapReady && !context.read<MapPause>().paused) {
      _centered = true;
      _globe?.flyTo(p, 14);
    }

    _notifyArea.maybeUpdate(context.read<Api>(), p).catchError((_) {});

    if (_mapSurfaceActive() &&
        (_loadedAt == null || const Distance()(p, _loadedAt!) > 2000)) {
      _refreshMapData(silent: true);
    }

  }



  Future<void> _loadSports() async {

    try {

      final j = await context.read<Api>().get('/api/sports');

      if (!mounted) return;
      final all = [for (final s in j) Sport.fromJson(s)];
      rememberSports(all);
      setState(() {
        _sports = all.where((s) => s.active).toList();
        _syncSportFilterToUser();
      });

    } catch (_) {}

    _sportsLoaded = true;

  }

  /// Members browse one of their own sports (main by default); admins any.
  void _syncSportFilterToUser() {
    final user = context.read<AuthState>().user;
    if (user?.isAdmin ?? false) return;
    final mine = sportsForUser(user, _sports);
    if (mine.isEmpty || mine.any((s) => s.slug == _sport)) return;
    _sport = mine.first.slug;
  }



  Future<void> _refreshMapData({bool silent = false}) async {

    // Realtime/location can fire before the player's sport is known.
    if (!_sportsLoaded) return;

    final seq = ++_fetchSeq;

    final c = context.read<LocationState>().center;

    if (!silent && _mapSurfaceActive()) setState(() => _gamesLoading = true);

    final sportQ = _sport != null ? '&sport=$_sport' : '';

    try {

      final results = await Future.wait([

        context.read<Api>().get('/api/courts/nearby?lat=${c.latitude}&lng=${c.longitude}&radius_km=$mapNearbyRadiusKm$sportQ'),

        context.read<Api>().get(
          '/api/games/nearby?lat=${c.latitude}&lng=${c.longitude}&radius_km=$mapNearbyRadiusKm&upcoming_hours=$playUpcomingHours$sportQ',
        ),

      ]);

      if (!mounted || seq != _fetchSeq) return;

      _applyMapState(() {

        _courts = [for (final x in results[0] as List) Court.fromJson(x)];

        _games = sortPlayable([for (final g in results[1] as List) Game.fromJson(g)]);

        _loadedAt = c;

        _gamesLoading = false;

      });

      unawaited(_refreshRain());

    } catch (e) {
      if (!mounted || seq != _fetchSeq) return;
      _applyMapState(() => _gamesLoading = false);
      if (_mapSurfaceActive()) showApiIssue(context, e);
    }

  }

  /// Rain badges for the nearest courts (cached 15 min; failures leave pins as they are).
  Future<void> _refreshRain() async {
    final api = context.read<Api>();
    if (api.session == null || _courts.isEmpty) return;
    final nearest = [..._courts]..sort((a, b) => (a.distanceM ?? double.infinity).compareTo(b.distanceM ?? double.infinity));
    final rain = await CourtRainCache.instance.lookup(nearest.map((c) => c.id), api.get);
    if (!mounted) return;
    final same = rain.length == _rain.length && rain.entries.every((e) => identical(_rain[e.key], e.value));
    if (!same) _applyMapState(() => _rain = rain);
  }

  void _openGameById(String gameId) => openGameScreen(context, gameId);

  void _openGame(Game g) => _openGameById(g.id);

  void _openCourt(Court c) {
    showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (_) => CourtSheet(courtId: c.id),
    ).then((gameId) {
      if (!mounted) return;
      if (gameId != null) {
        _openGameById(gameId);
        return;
      }
      _refreshMapData(silent: true);
    });
  }



  @override

  Widget build(BuildContext context) {

    final loc = context.watch<LocationState>();
    final mapPaused = context.watch<MapPause>().paused;
    final mapboxOk = mapboxConfigured();

    final dark = Theme.of(context).brightness == Brightness.dark;

    final live = _courts.where((c) => c.activity == Activity.active).length;
    final user = context.watch<AuthState>().user;
    final isAdmin = user?.isAdmin ?? false;
    final mySports = sportsForUser(user, _sports);

    final navOverlap = kFloatingNavClearance + MediaQuery.paddingOf(context).bottom;

    final mapLive = _mapSurfaceActive();
    final surface = Theme.of(context).colorScheme.surfaceContainerHighest;

    return IgnorePointer(
      ignoring: !mapLive,
      child: Stack(children: [

      if (mapPaused)
        ColoredBox(color: surface, child: const SizedBox.expand())
      else if (mapboxOk)
        ExcludeSemantics(
          excluding: true,
          child: HomeGlobeMap(
            initialCenter: loc.center,
            userPosition: loc.position,
            courts: _courts,
            nearbyGames: _games,
            sportSlug: _sport,
            rain: _rain,
            dark: dark,
            onCourtTap: _openCourt,
            onReady: (c) {
              _globe = c;
              _mapReady = true;
              _centerOnUserIfNeeded();
            },
          ),
        )
      else
        ColoredBox(color: surface, child: const SizedBox.expand()),



      SafeArea(

        child: Padding(

          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),

          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

            Row(children: [

              Text.rich(

                TextSpan(children: [

                  TextSpan(text: 'FIND THE ', style: TextStyle(color: Theme.of(context).colorScheme.onSurface)),

                  const TextSpan(text: 'GAME', style: TextStyle(color: Palette.brand)),

                ]),

                style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, letterSpacing: -0.5),

              ),

              const Spacer(),

              Container(

                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),

                decoration: BoxDecoration(color: Palette.live, borderRadius: BorderRadius.circular(20)),

                child: Row(mainAxisSize: MainAxisSize.min, children: [

                  const Icon(Icons.local_fire_department, size: 16, color: Colors.white),

                  const SizedBox(width: 4),

                  Text(tr('$live LIVE', '$live EN DIRECT'), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),

                ]),

              ),

            ]),

            const SizedBox(height: 8),

            MapSearchBar(
              proximity: loc.position ?? loc.center,
              courts: _courts,
              onSelectCourt: (c) {
                _globe?.flyTo(LatLng(c.latitude, c.longitude), 16);
                _openCourt(c);
              },
              onSelectPlace: (p) => _globe?.flyTo(p.at, 15),
            ),

            const SizedBox(height: 8),

            SingleChildScrollView(

              key: _sportChipsKey,

              scrollDirection: Axis.horizontal,

              child: Row(children: [

                if (isAdmin) ...[
                  _filterChip(tr('All', 'Tous'), _sport == null, () => _setSport(null)),
                  for (final s in _sports) _sportChip(s),
                ] else
                  // One chip per sport the player plays (main + extras), like the web.
                  for (final s in mySports) _sportChip(s),

                _filterChip(tr('Add court', 'Ajouter un terrain'), false, () {
                  Navigator.push<Court>(context, MaterialPageRoute(builder: (_) => const AddCourtScreen())).then((court) {
                    if (!mounted) return;
                    _refreshMapData(silent: true);
                    if (court != null) {
                      _globe?.flyTo(LatLng(court.latitude, court.longitude), 16);
                    }
                  });
                }),

              ]),

            ),

            if (loc.status == LocationStatus.denied || loc.status == LocationStatus.serviceOff)

              Container(

                margin: const EdgeInsets.only(top: 8),

                padding: const EdgeInsets.all(10),

                decoration: BoxDecoration(color: Theme.of(context).colorScheme.surface, borderRadius: BorderRadius.circular(10)),

                child: Text(tr('Location is off — showing Grand-Bassam. Turn it on to see games near you.',
                    'Localisation désactivée — affichage de Grand-Bassam. Activez-la pour voir les matchs près de vous.')),

              ),

          ]),

        ),

      ),



      Positioned(

        right: 16,

        bottom: navOverlap + MapGamesRail.contentHeight + 12,

        child: FloatingActionButton.small(

          heroTag: 'locate',
          tooltip: tr('Center on my location', 'Centrer sur ma position'),

          backgroundColor: Theme.of(context).colorScheme.surface,

          onPressed: () => _globe?.flyTo(loc.position ?? loc.center, 14),

          child: const Icon(Icons.my_location),

        ),

      ),



      Positioned(

        left: 0,

        right: 0,

        bottom: 0,

        child: MapGamesRail(
          games: _games,
          loading: _gamesLoading,
          navOverlap: navOverlap,
          pulseGameIds: _pulseGameIds,
          onGameTap: _openGame,
          onSeeAll: widget.onOpenPlayTab,
        ),

      ),

      if (!mapboxOk)
        Positioned.fill(
          child: ColoredBox(
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(28),
                child: Text(
                  tr('Map needs a Mapbox token.\nRun mobile\\sync-env.ps1 from the project root, then restart the app.',
                      'La carte nécessite un jeton Mapbox.\nLancez mobile\\sync-env.ps1 depuis la racine du projet, puis redémarrez l’app.'),
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
                ),
              ),
            ),
          ),
        ),

    ]),
    );

  }

  void _setSport(String? slug) {

    setState(() => _sport = slug);

    _refreshMapData();

  }



  Widget _sportChip(Sport s) => _filterChipWidget(
        SportInline(s, textStyle: const TextStyle(fontWeight: FontWeight.w700)),
        _sport == s.slug,
        () {
          if (_sport != s.slug) _setSport(s.slug);
        },
      );

  Widget _filterChip(String label, bool selected, VoidCallback onTap) => _filterChipWidget(

        Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),

        selected,

        onTap,

      );



  Widget _filterChipWidget(Widget label, bool selected, VoidCallback onTap) => Padding(

        padding: const EdgeInsets.only(right: 8),

        child: ChoiceChip(

          label: label,

          selected: selected,

          onSelected: (_) => onTap(),

          showCheckmark: false,

        ),

      );

}

