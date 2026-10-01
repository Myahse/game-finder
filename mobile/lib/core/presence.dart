import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:latlong2/latlong.dart';

import 'api.dart';
import 'models.dart';
import 'notifications.dart';

/// The user's own "I'M HERE" check-in. Expiry is enforced by the server;
/// this keeps the UI and the on-device reminder in sync with it.
class PresenceState extends ChangeNotifier {
  final Api api;
  final Notifications notifications;
  Presence? current;
  Timer? _tick;
  StreamSubscription? _responses;

  PresenceState(this.api, this.notifications) {
    _responses = notifications.responses.listen((r) async {
      try {
        if (r.actionId == Notifications.actionStillHere) await confirm();
        if (r.actionId == Notifications.actionLeft) await leave();
      } catch (_) {}
    });
  }

  /// True inside the "Are you still playing?" window.
  bool get needsConfirmation {
    final p = current;
    if (p == null) return false;
    final left = p.expiresAt.difference(DateTime.now());
    return left > Duration.zero && left <= Duration(minutes: p.warningMinutes);
  }

  Future<void> refresh() async {
    try {
      final j = await api.get('/api/me/presence');
      _set(j == null ? null : Presence.fromJson(Map<String, dynamic>.from(j)));
    } catch (_) {}
  }

  Future<void> checkIn(String courtId, LatLng? at) async {
    final j = await api.post('/api/presence', {
      'court_id': courtId,
      'latitude': at?.latitude,
      'longitude': at?.longitude,
    });
    _set(Presence.fromJson(Map<String, dynamic>.from(j)));
  }

  Future<void> confirm() async {
    final j = await api.post('/api/presence/confirm');
    _set(Presence.fromJson(Map<String, dynamic>.from(j)));
  }

  Future<void> leave() async {
    await api.delete('/api/presence');
    _set(null);
  }

  void _set(Presence? p) {
    current = p;
    _tick?.cancel();
    if (p == null) {
      notifications.cancelPresenceCheck();
    } else {
      notifications.schedulePresenceCheck(p);
      // Re-evaluate every 15 s so the in-app prompt appears and the
      // check-in disappears on expiry even without a server event.
      _tick = Timer.periodic(const Duration(seconds: 15), (_) {
        if (current != null && DateTime.now().isAfter(current!.expiresAt)) {
          current = null;
          _tick?.cancel();
        }
        notifyListeners();
      });
    }
    notifyListeners();
  }

  void clear() => _set(null);

  @override
  void dispose() {
    _tick?.cancel();
    _responses?.cancel();
    super.dispose();
  }
}
