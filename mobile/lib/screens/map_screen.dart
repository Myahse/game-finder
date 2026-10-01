import 'dart:async';



import 'package:flutter/material.dart';

import 'package:flutter_map/flutter_map.dart';

import 'package:flutter_map_marker_cluster/flutter_map_marker_cluster.dart';

import 'package:latlong2/latlong.dart' hide Path;

import 'package:provider/provider.dart';



import '../core/api.dart';

import '../core/format.dart';

import '../core/location.dart';

import '../core/map_tiles.dart';

import '../core/models.dart';

import '../core/realtime.dart';

import '../ui/app_icons.dart';

import '../ui/map_games_rail.dart';

import '../ui/theme.dart';

import 'court_screens.dart';
import 'game_screens.dart';



class MapScreen extends StatefulWidget {

  const MapScreen({super.key});

  @override

  State<MapScreen> createState() => _MapScreenState();

}



class _MapScreenState extends State<MapScreen> {

  final _map = MapController();

  List<Court> _courts = [];

  List<Game> _games = [];

  List<Sport> _sports = [];

  String? _sport;

  bool _gamesLoading = true;

  LatLng? _loadedAt;

  bool _centered = false;

  bool _areaSent = false;

  StreamSubscription? _sub;

  bool _mapSurfaceActive() => mounted && ModalRoute.of(context)?.isCurrent == true;

  void _applyMapState(void Function() update) {
    update();
    if (_mapSurfaceActive()) setState(() {});
  }

  @override

  void initState() {

    super.initState();

    _loadSports();

    _refreshMapData();

    _sub = context.read<Realtime>().events.listen((ev) {

      if (!_mapSurfaceActive()) return;

      if (ev['type'] == 'court_stats') {

        final c = _courts.where((c) => c.id == ev['court_id']);

        if (c.isNotEmpty) _applyMapState(() => c.first.applyStats(ev));

      } else if (ev['type'] == 'game' || ev['type'] == 'reconnected') {

        _refreshMapData(silent: true);

      }

    });

    context.read<LocationState>().addListener(_onLocation);

  }



  @override

  void dispose() {

    _sub?.cancel();

    context.read<LocationState>().removeListener(_onLocation);

    super.dispose();

  }



  void _onLocation() {

    final loc = context.read<LocationState>();

    final p = loc.position;

    if (p == null) return;

    if (!_centered) {

      _centered = true;

      _map.move(p, 14);

    }

    if (!_areaSent) {

      _areaSent = true;

      context.read<Api>().post('/api/me/notify-area', {'latitude': p.latitude, 'longitude': p.longitude}).catchError((_) {});

    }

    if (_mapSurfaceActive() &&
        (_loadedAt == null || const Distance()(p, _loadedAt!) > 2000)) {
      _refreshMapData(silent: true);
    }

  }



  Future<void> _loadSports() async {

    try {

      final j = await context.read<Api>().get('/api/sports');

      if (mounted) setState(() => _sports = [for (final s in j) Sport.fromJson(s)].where((s) => s.active).toList());

    } catch (_) {}

  }



  Future<void> _refreshMapData({bool silent = false}) async {

    final c = context.read<LocationState>().center;

    if (!silent && _mapSurfaceActive()) setState(() => _gamesLoading = true);

    final sportQ = _sport != null ? '&sport=$_sport' : '';

    try {

      final results = await Future.wait([

        context.read<Api>().get('/api/courts/nearby?lat=${c.latitude}&lng=${c.longitude}&radius_km=30$sportQ'),

        context.read<Api>().get('/api/games/nearby?lat=${c.latitude}&lng=${c.longitude}$sportQ'),

      ]);

      if (!mounted) return;

      _applyMapState(() {

        _courts = [for (final x in results[0] as List) Court.fromJson(x)];

        _games = sortPlayable([for (final g in results[1] as List) Game.fromJson(g)]);

        _loadedAt = c;

        _gamesLoading = false;

      });

    } catch (_) {

      if (mounted) _applyMapState(() => _gamesLoading = false);

    }

  }

  void _openGame(Game g) {
    Navigator.of(context)
        .push<void>(MaterialPageRoute(builder: (_) => GameScreen(gameId: g.id)))
        .then((_) {
      if (mounted) _refreshMapData(silent: true);
    });
  }



  void _openCourt(Court c) {

    showModalBottomSheet<void>(

      context: context,

      isScrollControlled: true,

      showDragHandle: true,

      useSafeArea: true,

      builder: (_) => CourtSheet(courtId: c.id),

    ).whenComplete(() => _refreshMapData(silent: true));

  }



  @override

  Widget build(BuildContext context) {

    final loc = context.watch<LocationState>();

    final dark = Theme.of(context).brightness == Brightness.dark;

    final live = _courts.where((c) => c.activity == Activity.active).length;

    final navOverlap = kFloatingNavClearance + MediaQuery.paddingOf(context).bottom;



    return Stack(children: [

      FlutterMap(

        mapController: _map,

        options: MapOptions(

          initialCenter: loc.center,

          initialZoom: 13,

          minZoom: 4,

          maxZoom: 18,

          cameraConstraint: CameraConstraint.containCenter(

            bounds: LatLngBounds(const LatLng(-85, -180), const LatLng(85, 180)),

          ),

        ),

        children: [

          TileLayer(

            urlTemplate: mapboxTileUrl(dark: dark),

            userAgentPackageName: 'com.findthegame.find_the_game',

            retinaMode: RetinaMode.isHighDensity(context),

            panBuffer: 2,

            keepBuffer: 8,

          ),

          if (loc.position != null)

            MarkerLayer(markers: [

              Marker(

                point: loc.position!,

                width: 22,

                height: 22,

                child: Container(

                  decoration: BoxDecoration(

                    color: const Color(0xFF3B82F6),

                    shape: BoxShape.circle,

                    border: Border.all(color: Colors.white, width: 3),

                    boxShadow: const [BoxShadow(blurRadius: 6, color: Colors.black26)],

                  ),

                ),

              ),

            ]),

          MarkerClusterLayerWidget(

            options: MarkerClusterLayerOptions(

              maxClusterRadius: 56,

              size: const Size(52, 52),

              markers: [

                for (final c in _courts)

                  Marker(

                    key: ValueKey('${c.id}-${c.activity.name}-${c.playerCount}'),

                    point: LatLng(c.latitude, c.longitude),

                    width: 84,

                    height: 52,

                    alignment: Alignment.topCenter,

                    child: CourtPin(court: c, sportSlug: _sport, onTap: () => _openCourt(c)),

                  ),

              ],

              builder: (context, markers) {

                final courts = markers

                    .map((m) => _courts.where((c) => LatLng(c.latitude, c.longitude) == m.point).firstOrNull)

                    .whereType<Court>();

                final anyLive = courts.any((c) => c.activity == Activity.active);

                final anyPlayers = courts.any((c) => c.activity == Activity.players);

                return Container(

                  decoration: BoxDecoration(

                    color: anyLive ? Palette.live : anyPlayers ? Palette.players : Palette.idle,

                    shape: BoxShape.circle,

                    border: Border.all(color: Colors.white, width: 3),

                    boxShadow: const [BoxShadow(blurRadius: 8, color: Colors.black26)],

                  ),

                  alignment: Alignment.center,

                  child: Text('${markers.length}',

                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18)),

                );

              },

            ),

          ),

          RichAttributionWidget(attributions: [

            TextSourceAttribution('© Mapbox'),

          ]),

        ],

      ),



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

                  Text('$live LIVE', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),

                ]),

              ),

            ]),

            const SizedBox(height: 8),

            SingleChildScrollView(

              scrollDirection: Axis.horizontal,

              child: Row(children: [

                _filterChip('All', _sport == null, () => _setSport(null)),

                for (final s in _sports)

                  _filterChipWidget(

                    Row(mainAxisSize: MainAxisSize.min, children: [

                      SportIcon(s.slug, size: 18),

                      const SizedBox(width: 6),

                      Text(s.name),

                    ]),

                    _sport == s.slug,

                    () => _setSport(s.slug),

                  ),

                _filterChipWidget(const Row(mainAxisSize: MainAxisSize.min, children: [

                  Icon(Icons.add, size: 18),

                  SizedBox(width: 4),

                  Text('Add court'),

                ]), false, () {

                  Navigator.push(context, MaterialPageRoute(builder: (_) => const AddCourtScreen()));

                }),

              ]),

            ),

            if (loc.status == LocationStatus.denied || loc.status == LocationStatus.serviceOff)

              Container(

                margin: const EdgeInsets.only(top: 8),

                padding: const EdgeInsets.all(10),

                decoration: BoxDecoration(color: Theme.of(context).colorScheme.surface, borderRadius: BorderRadius.circular(10)),

                child: const Text('Location is off — showing Grand-Bassam. Turn it on to see games near you.'),

              ),

          ]),

        ),

      ),



      Positioned(

        right: 16,

        bottom: navOverlap + MapGamesRail.contentHeight + 12,

        child: FloatingActionButton.small(

          heroTag: 'locate',

          backgroundColor: Theme.of(context).colorScheme.surface,

          onPressed: () => _map.move(loc.center, 14),

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
          onGameTap: _openGame,
        ),

      ),

    ]);

  }



  void _setSport(String? slug) {

    setState(() => _sport = slug);

    _refreshMapData();

  }



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



class CourtPin extends StatelessWidget {

  final Court court;

  final String? sportSlug;

  final VoidCallback onTap;

  const CourtPin({super.key, required this.court, required this.onTap, this.sportSlug});



  @override

  Widget build(BuildContext context) {

    final sport = court.sports.where((s) => s.slug == sportSlug).firstOrNull ?? court.sports.firstOrNull;

    final bg = switch (court.activity) {

      Activity.active => Palette.live,

      Activity.players => Palette.players,

      Activity.inactive => Theme.of(context).colorScheme.surface,

    };

    final fg = court.activity == Activity.active ? Colors.white : const Color(0xFF1A1A1A);

    return Semantics(

      button: true,

      label: court.activity == Activity.inactive ? '${court.name}, inactive' : '${court.name}, ${court.playerCount} players',

      child: GestureDetector(

        onTap: onTap,

        child: Column(mainAxisSize: MainAxisSize.min, children: [

          Container(

            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),

            decoration: BoxDecoration(

              color: bg,

              borderRadius: BorderRadius.circular(20),

              border: Border.all(color: Colors.white, width: 2),

              boxShadow: [

                BoxShadow(

                  blurRadius: court.activity == Activity.active ? 14 : 6,

                  color: court.activity == Activity.active ? Palette.live.withValues(alpha: 0.6) : Colors.black26,

                ),

              ],

            ),

            child: Row(mainAxisSize: MainAxisSize.min, children: [

              if (court.activity == Activity.players)

                Icon(Icons.groups, size: 18, color: fg)

              else

                SportIcon(sport?.slug ?? 'basketball', size: 18, color: fg),

              if (court.activity != Activity.inactive) ...[

                const SizedBox(width: 4),

                Text('${court.playerCount}', style: TextStyle(color: fg, fontWeight: FontWeight.w900, fontSize: 17)),

              ],

            ]),

          ),

          CustomPaint(size: const Size(12, 7), painter: _Tail(bg)),

        ]),

      ),

    );

  }

}



class _Tail extends CustomPainter {

  final Color color;

  _Tail(this.color);

  @override

  void paint(Canvas canvas, Size s) {

    final path = Path()

      ..moveTo(0, 0)

      ..lineTo(s.width, 0)

      ..lineTo(s.width / 2, s.height)

      ..close();

    canvas.drawPath(path, Paint()..color = color);

  }



  @override

  bool shouldRepaint(_Tail old) => old.color != color;

}


