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
import 'notification_links.dart';
import '../core/l10n.dart';

enum PushStatus { on, off, blocked, unsupported }

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
  final _pushTaps = StreamController<Map<String, dynamic>>.broadcast();
  Map<String, dynamic>? _initialPushTap;
  bool _messagingHooked = false;

  Notifications(this.api);

  /// Taps and action buttons (YES, I'M STILL HERE / I LEFT).
  Stream<NotificationResponse> get responses => _responses.stream;

  /// Data of remote pushes tapped while the app was in the background.
  Stream<Map<String, dynamic>> get pushTaps => _pushTaps.stream;

  /// The push that launched the app (once), for the home screen to open.
  Map<String, dynamic>? takeInitialPushTap() {
    final t = _initialPushTap;
    _initialPushTap = null;
    return t;
  }

  static final _channel = AndroidNotificationDetails(
    'game_activity',
    tr('Games & reminders', 'Matchs et rappels'),
    channelDescription: tr('Game reminders, invitations and nearby activity', 'Rappels de match, invitations et activité à proximité'),
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
              DarwinNotificationAction.plain(actionStillHere, tr("Yes, I'm still here", 'Oui, je suis toujours là'),
                  options: {DarwinNotificationActionOption.foreground}),
              DarwinNotificationAction.plain(actionLeft, tr('I left', 'Je suis parti'),
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
      // The whole data map (with `type`) so a tap opens the right screen.
      if (n != null) show(n.title ?? 'Find the Game', n.body ?? '', payload: pushPayload(m.data));
    });
    FirebaseMessaging.onMessageOpenedApp.listen((m) => _pushTaps.add(Map<String, dynamic>.from(m.data)));
    try {
      final initial = await FirebaseMessaging.instance.getInitialMessage();
      if (initial != null) _initialPushTap = Map<String, dynamic>.from(initial.data);
    } catch (_) {}
  }

  /// Whether this device shows push notifications (Notifications tab card).
  Future<PushStatus> pushStatus() async {
    if (kIsWeb) return PushStatus.unsupported;
    try {
      if (firebaseAppReady) {
        final st = await FirebaseMessaging.instance.getNotificationSettings();
        return switch (st.authorizationStatus) {
          AuthorizationStatus.authorized || AuthorizationStatus.provisional => PushStatus.on,
          AuthorizationStatus.deniedPermanently => PushStatus.blocked,
          AuthorizationStatus.denied => Platform.isIOS ? PushStatus.blocked : PushStatus.off,
          AuthorizationStatus.notDetermined => PushStatus.off,
        };
      }
      if (Platform.isAndroid) {
        final on = await _local
            .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
            ?.areNotificationsEnabled();
        return on == true ? PushStatus.on : PushStatus.off;
      }
      final opts = await _local.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>()?.checkPermissions();
      return opts?.isEnabled == true ? PushStatus.on : PushStatus.off;
    } catch (_) {
      return PushStatus.unsupported;
    }
  }

  /// "Turn on": asks for permission and registers this device. Returns the
  /// new status; still not on after asking means the OS blocks it.
  Future<PushStatus> enablePush() async {
    await requestPermission();
    await registerDevice();
    final st = await pushStatus();
    return st == PushStatus.off ? PushStatus.blocked : st;
  }

  Future<void> requestPermission() async {
    if (kIsWeb) return; // dart:io Platform throws on web; no local plugin there
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
        notificationDetails: NotificationDetails(android: _channel, iOS: const DarwinNotificationDetails()),
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
      title: tr('Are you still playing?', 'Vous jouez encore ?'),
      body: tr('Are you still playing at ${p.courtName}?', 'Vous jouez encore à ${p.courtName} ?'),
      payload: 'presence:${p.courtId}',
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          'presence',
          tr('Check-in reminders', 'Rappels de présence'),
          channelDescription: tr('Asks if you are still at the court', 'Vous demande si vous êtes toujours sur le terrain'),
          importance: Importance.high,
          priority: Priority.high,
          actions: [
            AndroidNotificationAction(actionStillHere, tr("YES, I'M STILL HERE", 'OUI, JE SUIS TOUJOURS LÀ'), showsUserInterface: true),
            AndroidNotificationAction(actionLeft, tr('I LEFT', 'JE SUIS PARTI'), showsUserInterface: true),
          ],
        ),
        iOS: const DarwinNotificationDetails(categoryIdentifier: presenceCategory),
      ),
    );
  }

  Future<void> cancelPresenceCheck() => _local.cancel(id: presenceId);
}
