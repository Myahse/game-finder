import 'dart:async';

import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';

import '../core/map_tiles.dart';
import '../core/models.dart';
import 'court_map_pin.dart';

/// Imperative camera control for [HomeGlobeMap].
class HomeGlobeMapController {
  HomeGlobeMapController(this._map);
  final MapboxMap _map;

  Future<void> flyTo(LatLng target, double zoom) async {
    await _map.easeTo(
      CameraOptions(
        center: Point(coordinates: Position(target.longitude, target.latitude)),
        zoom: zoom,
        bearing: 0,
        pitch: 0,
      ),
      MapAnimationOptions(duration: 700),
    );
  }
}

/// Mapbox GL map with globe projection (same feel as web) + Flutter court pins on top.
class HomeGlobeMap extends StatefulWidget {
  const HomeGlobeMap({
    super.key,
    required this.initialCenter,
    required this.userPosition,
    required this.courts,
    required this.sportSlug,
    required this.onCourtTap,
    required this.onReady,
    required this.dark,
  });

  final LatLng initialCenter;
  final LatLng? userPosition;
  final List<Court> courts;
  final String? sportSlug;
  final ValueChanged<Court> onCourtTap;
  final ValueChanged<HomeGlobeMapController> onReady;
  final bool dark;

  @override
  State<HomeGlobeMap> createState() => _HomeGlobeMapState();
}

class _HomeGlobeMapState extends State<HomeGlobeMap> {
  MapboxMap? _map;
  final Map<String, Offset> _pinPos = {};
  Timer? _pinDebounce;
  bool _styleReady = false;

  static const double _pinW = CourtMapPin.size + 8;
  static const double _pinH = CourtMapPin.totalHeight;

  @override
  void dispose() {
    _pinDebounce?.cancel();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant HomeGlobeMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.userPosition != oldWidget.userPosition) {
      _updateLocationPuck();
    }
    if (widget.courts != oldWidget.courts || widget.sportSlug != oldWidget.sportSlug) {
      _schedulePinSync();
    }
    if (widget.dark != oldWidget.dark) {
      _styleReady = false;
    }
  }

  Future<void> _configureMap(MapboxMap map) async {
    _map = map;
    await map.gestures.updateSettings(GesturesSettings(rotateEnabled: false, pitchEnabled: false));
    await map.scaleBar.updateSettings(ScaleBarSettings(enabled: false));
    await map.compass.updateSettings(CompassSettings(enabled: false));
    await map.setBounds(CameraBoundsOptions(minZoom: 2, maxZoom: 18));
    await _applyGlobe();
    await _updateLocationPuck();
    widget.onReady(HomeGlobeMapController(map));
    _schedulePinSync(immediate: true);
  }

  Future<void> _applyGlobe() async {
    final map = _map;
    if (map == null || !_styleReady) return;
    try {
      await map.setProjection(StyleProjection(name: StyleProjectionName.globe));
    } catch (_) {
      // Older native SDK builds may ignore projection.
    }
  }

  Future<void> _updateLocationPuck() async {
    final map = _map;
    if (map == null) return;
    final on = widget.userPosition != null;
    await map.location.updateSettings(
      LocationComponentSettings(
        enabled: on,
        pulsingEnabled: true,
        pulsingColor: 0xFF3B82F6,
        pulsingMaxRadius: 24,
        showAccuracyRing: true,
      ),
    );
  }

  void _schedulePinSync({bool immediate = false}) {
    _pinDebounce?.cancel();
    if (immediate) {
      _syncPins();
      return;
    }
    _pinDebounce = Timer(const Duration(milliseconds: 32), _syncPins);
  }

  Future<void> _syncPins() async {
    final map = _map;
    if (map == null || !mounted) return;
    final next = <String, Offset>{};
    for (final c in widget.courts) {
      try {
        final sc = await map.pixelForCoordinate(
          Point(coordinates: Position(c.longitude, c.latitude)),
        );
        next[c.id] = Offset(sc.x, sc.y);
      } catch (_) {
        // Off-globe or not yet laid out.
      }
    }
    if (mounted) setState(() => _pinPos..clear()..addAll(next));
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        MapWidget(
          key: ValueKey(widget.dark),
          styleUri: mapboxStyleUri(dark: widget.dark),
          viewport: CameraViewportState(
            center: Point(
              coordinates: Position(widget.initialCenter.longitude, widget.initialCenter.latitude),
            ),
            zoom: 13,
            bearing: 0,
            pitch: 0,
          ),
          onMapCreated: _configureMap,
          onStyleLoadedListener: (_) async {
            _styleReady = true;
            await _applyGlobe();
            _schedulePinSync(immediate: true);
          },
          onCameraChangeListener: (_) => _schedulePinSync(),
        ),
        ...widget.courts.map((c) {
          final o = _pinPos[c.id];
          if (o == null) return const SizedBox.shrink();
          return Positioned(
            left: o.dx - _pinW / 2,
            top: o.dy - _pinH,
            width: _pinW,
            height: _pinH,
            child: CourtMapPin(
              court: c,
              sportSlug: widget.sportSlug,
              onTap: () => widget.onCourtTap(c),
            ),
          );
        }),
      ],
    );
  }
}
