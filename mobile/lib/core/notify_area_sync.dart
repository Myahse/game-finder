import 'package:latlong2/latlong.dart';

import 'api.dart';

const _distance = Distance();

/// Keeps the server alert/browse zone aligned when the user moves (travel).
class NotifyAreaSync {
  LatLng? _lastSent;
  DateTime? _lastAttempt;

  /// Update notify area when moved ≥ ~1.5 km; backs off on rate limits.
  Future<void> maybeUpdate(Api api, LatLng point) async {
    if (_lastSent != null && _distance(_lastSent!, point) < 1500) return;
    final now = DateTime.now();
    if (_lastAttempt != null && now.difference(_lastAttempt!) < const Duration(minutes: 2)) return;
    _lastAttempt = now;
    try {
      await api.post('/api/me/notify-area', {'latitude': point.latitude, 'longitude': point.longitude});
      _lastSent = point;
    } on ApiException catch (e) {
      if (e.code == 'notify_rate_limited' || e.code == 'notify_jump_too_far') return;
      rethrow;
    }
  }
}
