import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_map_marker_cluster/flutter_map_marker_cluster.dart';
import 'package:latlong2/latlong.dart' hide Path;
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/location.dart';
import '../core/models.dart';
import '../core/realtime.dart';
import '../ui/theme.dart';
import 'court_screens.dart';

/// Tiles: Carto basemaps by default (light/dark). Override with
/// --dart-define=TILE_URL_LIGHT=... / TILE_URL_DARK=... for your provider.
const _tilesLight = String.fromEnvironment('TILE_URL_LIGHT',
    defaultValue: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png');
const _tilesDark = String.fromEnvironment('TILE_URL_DARK',
    defaultValue: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png');

class MapScreen extends StatefulWidget {
  final VoidCallback onOpenPlay;
  const MapScreen({super.key, required this.onOpenPlay});
  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final _map = MapController();
  List<Court> _courts = [];
  List<Sport> _sports = [];
  String? _sport;
  bool _loading = true;
  LatLng? _loadedAt;
  bool _centered = false;
  bool _areaSent = false;
  StreamSubscription? _sub;

  @override
  void initState() {
    super.initState();
    _loadSports();
    _load();
    _sub = context.read<Realtime>().events.listen((ev) {
      if (ev['type'] == 'court_stats') {
        final c = _courts.where((c) => c.id == ev['court_id']);
        if (c.isNotEmpty) setState(() => c.first.applyStats(ev));
      } else if (ev['type'] == 'reconnected') {
        _load();
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
      _areaSent = true; // coarse area for "game active near you" alerts
      context.read<Api>().post('/api/me/notify-area', {'latitude': p.latitude, 'longitude': p.longitude}).catchError((_) {});
    }
    // Reload when the user has moved more than ~2 km.
    if (_loadedAt == null || const Distance()(p, _loadedAt!) > 2000) _load();
  }

  Future<void> _loadSports() async {
    try {
      final j = await context.read<Api>().get('/api/sports');
      if (mounted) setState(() => _sports = [for (final s in j) Sport.fromJson(s)].where((s) => s.active).toList());
    } catch (_) {}
  }

  Future<void> _load() async {
    final c = context.read<LocationState>().center;
    try {
      final j = await context.read<Api>().get(
          '/api/courts/nearby?lat=${c.latitude}&lng=${c.longitude}&radius_km=30${_sport != null ? '&sport=$_sport' : ''}');
      if (!mounted) return;
      setState(() {
        _courts = [for (final x in j) Court.fromJson(x)];
        _loadedAt = c;
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openCourt(Court c) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (_) => CourtSheet(courtId: c.id),
    ).whenComplete(_load);
  }

  @override
  Widget build(BuildContext context) {
    final loc = context.watch<LocationState>();
    final dark = Theme.of(context).brightness == Brightness.dark;
    final live = _courts.where((c) => c.activity == Activity.active).length;

    return Stack(children: [
      FlutterMap(
        mapController: _map,
        options: MapOptions(initialCenter: loc.center, initialZoom: 13, minZoom: 4, maxZoom: 18),
        children: [
          TileLayer(
            urlTemplate: dark ? _tilesDark : _tilesLight,
            subdomains: const ['a', 'b', 'c', 'd'],
            userAgentPackageName: 'com.findthegame.find_the_game',
            retinaMode: RetinaMode.isHighDensity(context),
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
          const RichAttributionWidget(attributions: [
            TextSourceAttribution('OpenStreetMap contributors'),
            TextSourceAttribution('CARTO'),
          ]),
        ],
      ),

      // Header + filters
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
                child: Text('🔥 $live LIVE', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),
              ),
            ]),
            const SizedBox(height: 8),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(children: [
                _filterChip('All', _sport == null, () => _setSport(null)),
                for (final s in _sports) _filterChip('${s.icon} ${s.name}', _sport == s.slug, () => _setSport(s.slug)),
                _filterChip('＋ Add court', false, () {
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
            if (_loading) const Padding(padding: EdgeInsets.only(top: 8), child: LinearProgressIndicator()),
          ]),
        ),
      ),

      Positioned(
        right: 16,
        bottom: 96,
        child: FloatingActionButton.small(
          heroTag: 'locate',
          backgroundColor: Theme.of(context).colorScheme.surface,
          onPressed: () => _map.move(loc.center, 14),
          child: const Icon(Icons.my_location),
        ),
      ),

      // I WANT TO PLAY
      Positioned(
        left: 16,
        right: 16,
        bottom: 20,
        child: FilledButton.icon(
          style: FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(60),
            textStyle: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, letterSpacing: 0.5),
            elevation: 6,
          ),
          onPressed: widget.onOpenPlay,
          icon: const Text('🏀', style: TextStyle(fontSize: 22)),
          label: const Text('I WANT TO PLAY'),
        ),
      ),
    ]);
  }

  void _setSport(String? slug) {
    setState(() => _sport = slug);
    _load();
  }

  Widget _filterChip(String label, bool selected, VoidCallback onTap) => Padding(
        padding: const EdgeInsets.only(right: 8),
        child: ChoiceChip(
          label: Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
          selected: selected,
          onSelected: (_) => onTap(),
          showCheckmark: false,
        ),
      );
}

/// 🏀 8 (green) · 👥 4 (yellow) · 🏀 (gray)
class CourtPin extends StatelessWidget {
  final Court court;
  final String? sportSlug;
  final VoidCallback onTap;
  const CourtPin({super.key, required this.court, required this.onTap, this.sportSlug});

  @override
  Widget build(BuildContext context) {
    final sport = court.sports.where((s) => s.slug == sportSlug).firstOrNull ?? court.sports.firstOrNull;
    final icon = court.activity == Activity.players ? '👥' : (sport?.icon ?? '📍');
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
              Text(icon, style: const TextStyle(fontSize: 16)),
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
