import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

/// Grand-Bassam, where the first community launches.
const defaultCenter = LatLng(5.2118, -3.7389);

enum LocationStatus { unknown, granted, denied, serviceOff }

/// Device position. Precise coordinates never leave the device except for
/// distance queries and "I'm here" check-ins.
class LocationState extends ChangeNotifier {
  LatLng? position;
  LocationStatus status = LocationStatus.unknown;
  StreamSubscription<Position>? _sub;

  LatLng get center => position ?? defaultCenter;

  bool get hasFix => position != null;

  Future<void> start() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      status = LocationStatus.serviceOff;
      notifyListeners();
      return;
    }
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
      status = LocationStatus.denied;
      notifyListeners();
      return;
    }
    status = LocationStatus.granted;
    notifyListeners();
    try {
      final fix = await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium));
      position = LatLng(fix.latitude, fix.longitude);
      notifyListeners();
    } catch (_) {
      // Stream below may still deliver a fix.
    }
    _sub?.cancel();
    _sub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 15),
    ).listen((p) {
      position = LatLng(p.latitude, p.longitude);
      notifyListeners();
    });
  }

  String get query => position == null ? '' : 'lat=${position!.latitude}&lng=${position!.longitude}';

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}
