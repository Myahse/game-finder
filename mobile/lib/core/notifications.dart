import 'dart:async';
import 'dart:io' show Platform;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import 'api.dart';
import 'firebase_bootstrap.dart';
import 'models.dart';

/// Local notifications (the "Are you still playing?" check, scheduled on the
/// device so it works offline) and FCM remote push (reminders, invites,
/// "game active near you"). FCM is optional: without Firebase config files
/// the app still works with in-app notifications.
class Notifications {
  static const presenceId = 1001;
  static const presenceCategory = 'presence_check';
  static const actionStillHere = 'still_here';
  static const actionLeft = 'left';

  final _local = FlutterLocalNotificationsPlugin();
  final Api api;
  final _responses = StreamController<NotificationResponse>.broadcast();
  bool _messagingHooked = false;

  Notifications(this.api);

  /// Taps and action buttons (YES, I'M STILL HERE / I LEFT).
  Stream<NotificationResponse> get responses => _responses.stream;

  static const _channel = AndroidNotificationDetails(
    'game_activity',
    'Games & reminders',
    channelDescription: 'Game reminders, invitations and nearby activity',
    importance: Importance.high,
    priority: Priority.high,
  );

  Future<void> init() async {
    tzdata.initializeTimeZones();
    await _local.initialize(
      settings: InitializationSettings(
        android: const AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(
          requestAlertPermission: false,
          requestBadgePermission: false,
          requestSoundPermission: false,
          notificationCategories: [
            DarwinNotificationCategory(presenceCategory, actions: [
              DarwinNotificationAction.plain(actionStillHere, "Yes, I'm still here",
                  options: {DarwinNotificationActionOption.foreground}),
              DarwinNotificationAction.plain(actionLeft, 'I left',
                  options: {DarwinNotificationActionOption.foreground}),
            ]),
          ],
        ),
      ),
      onDidReceiveNotificationResponse: _responses.add,
    );
    final launch = await _local.getNotificationAppLaunchDetails();
    if (launch?.didNotificationLaunchApp == true && launch!.notificationResponse != null) {
      scheduleMicrotask(() => _responses.add(launch.notificationResponse!));
    }

    await _hookMessaging();
  }

  Future<void> _hookMessaging() async {
    if (_messagingHooked || !await ensureFirebaseApp()) return;
    _messagingHooked = true;
    FirebaseMessaging.onMessage.listen((m) {
      final n = m.notification;
      if (n != null) show(n.title ?? 'Find the Game', n.body ?? '', payload: m.data['game_id'] ?? m.data['court_id']);
    });
  }

  Future<void> requestPermission() async {
    if (Platform.isAndroid) {
      await _local
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.requestNotificationsPermission();
    } else {
      await _local
          .resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>()
          ?.requestPermissions(alert: true, badge: true, sound: true);
    }
  }

  /// Registers this device for remote push after sign-in (mobile only; needs native Firebase config).
  Future<void> registerDevice() async {
    await _hookMessaging();
    if (!firebaseAppReady) {
      if (kDebugMode) debugPrint('FCM: Firebase not initialized (add google-services.json / GoogleService-Info.plist)');
      return;
    }
    try {
      final fm = FirebaseMessaging.instance;
      await fm.requestPermission();
      final token = await fm.getToken();
      if (token != null) {
        await api.post('/api/me/push-tokens', {'token': token, 'platform': Platform.operatingSystem});
        if (kDebugMode) debugPrint('FCM: registered push token');
      } else if (kDebugMode) {
        debugPrint('FCM: getToken() returned null');
      }
      fm.onTokenRefresh.listen((t) => api.post('/api/me/push-tokens', {'token': t, 'platform': Platform.operatingSystem}));
    } catch (e, st) {
      if (kDebugMode) debugPrint('FCM register failed: $e\n$st');
    }
  }

  Future<void> unregisterDevice() async {
    if (!firebaseAppReady) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) await api.delete('/api/me/push-tokens', {'token': token});
    } catch (_) {}
  }

  Future<void> show(String title, String body, {String? payload}) => _local.show(
        id: DateTime.now().millisecondsSinceEpoch ~/ 1000 % 100000,
        title: title,
        body: body,
        notificationDetails: const NotificationDetails(android: _channel, iOS: DarwinNotificationDetails()),
        payload: payload,
      );

  /// "Are you still playing at X?" a few minutes before the check-in expires.
  Future<void> schedulePresenceCheck(Presence p) async {
    await cancelPresenceCheck();
    final when = p.expiresAt.subtract(Duration(minutes: p.warningMinutes));
    if (when.isBefore(DateTime.now())) return;
    await _local.zonedSchedule(
      id: presenceId,
      scheduledDate: tz.TZDateTime.from(when, tz.UTC),
      title: 'Are you still playing?',
      body: 'Are you still playing at ${p.courtName}?',
      payload: 'presence:${p.courtId}',
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          'presence',
          'Check-in reminders',
          channelDescription: 'Asks if you are still at the court',
          importance: Importance.high,
          priority: Priority.high,
          actions: [
            AndroidNotificationAction(actionStillHere, "YES, I'M STILL HERE", showsUserInterface: true),
            AndroidNotificationAction(actionLeft, 'I LEFT', showsUserInterface: true),
          ],
        ),
        iOS: DarwinNotificationDetails(categoryIdentifier: presenceCategory),
      ),
    );
  }

  Future<void> cancelPresenceCheck() => _local.cancel(id: presenceId);
}
