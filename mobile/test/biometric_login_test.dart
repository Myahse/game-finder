import 'package:find_the_game/core/api.dart';
import 'package:find_the_game/core/app_lock.dart';
import 'package:find_the_game/core/auth.dart';
import 'package:find_the_game/core/biometric_auth.dart';
import 'package:find_the_game/core/l10n.dart';
import 'package:find_the_game/core/models.dart';
import 'package:find_the_game/screens/app_lock_screen.dart';
import 'package:find_the_game/screens/auth_screens.dart';
import 'package:find_the_game/screens/biometric_card.dart';
import 'package:find_the_game/screens/password_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:local_auth/local_auth.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Fingerprint sensor that answers [result] and counts prompts.
class FakeBiometrics implements BiometricBackend {
  bool supported = true;
  bool result = true;
  int prompts = 0;

  @override
  Future<bool> isDeviceSupported() async => supported;
  @override
  Future<bool> canCheckBiometrics() async => supported;
  @override
  Future<List<BiometricType>> availableBiometrics() async => supported ? [BiometricType.fingerprint] : [];
  @override
  Future<bool> authenticate(String reason) async {
    prompts++;
    return result;
  }
}

Map<String, dynamic> userJson({bool hasPassword = true}) => {
      'id': 'me',
      'username': 'viewer',
      'first_name': 'F',
      'last_name': 'L',
      'created_at': '2026-01-01T00:00:00Z',
      'email': 'v@x.io',
      'onboarded': true,
      'has_password': hasPassword,
    };

Map<String, dynamic> sessionJson({String refresh = 'r2'}) => {
      'access_token': 'a2',
      'refresh_token': refresh,
      'access_expires_at': DateTime.now().add(const Duration(hours: 1)).toIso8601String(),
      'user': userJson(),
    };

/// Api answering canned routes; records calls and bodies.
class FakeApi extends Api {
  final Map<String, dynamic Function(Object? body)> routes;
  final List<String> calls = [];
  final List<Object?> bodies = [];
  FakeApi(this.routes, {bool signedIn = true, bool hasPassword = true}) {
    if (signedIn) {
      session = Session('t', 'r', DateTime.now().add(const Duration(hours: 1)), userJson(hasPassword: hasPassword));
    }
  }

  @override
  Future<dynamic> request(String method, String path, {Object? body, bool retry = true}) async {
    calls.add('$method $path');
    bodies.add(body);
    final r = routes['$method $path'];
    if (r == null) return null;
    return r(body);
  }

  @override
  Future<void> setSession(Session? s) async {
    session = s;
    notifyListeners();
  }
}

Widget host(FakeApi api, Widget child) => MultiProvider(
      providers: [
        ChangeNotifierProvider<Api>.value(value: api),
        ChangeNotifierProvider(create: (_) => AuthState(api)),
      ],
      child: MaterialApp(home: child),
    );

/// A screen with a button that opens the login sheet.
class LoginOpener extends StatelessWidget {
  const LoginOpener({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
        body: Center(child: TextButton(onPressed: () => showLoginSheet(context), child: const Text('open login'))),
      );
}

void main() {
  late FakeBiometrics bio;

  setUpAll(() {
    debugLanguageOverride = 'en';
    dotenv.testLoad(fileInput: '');
  });
  tearDownAll(() => debugLanguageOverride = null);

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
    bio = FakeBiometrics();
    BiometricAuth.backend = bio;
    AppLock.instance.debugReset();
  });

  group('BiometricAuth', () {
    test('credentials live in secure storage, never in SharedPreferences', () async {
      await BiometricAuth.setEnabledInSettings(true);
      await BiometricAuth.rememberCredentials(' v@x.io ', 'secret123');
      final stored = await BiometricAuth.storedCredentials();
      expect(stored?.login, 'v@x.io');
      expect(stored?.password, 'secret123');
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getKeys(), {BiometricAuth.enabledKey});
      expect(await BiometricAuth.quickLogin(), isNotNull);
      await BiometricAuth.updateStoredPassword('newpass123');
      expect((await BiometricAuth.storedCredentials())?.password, 'newpass123');
      await BiometricAuth.disable();
      expect(await BiometricAuth.storedCredentials(), isNull);
      expect(await BiometricAuth.isEnabledInSettings(), isFalse);
    });

    test('no quick login without a sensor', () async {
      await BiometricAuth.setEnabledInSettings(true);
      await BiometricAuth.rememberCredentials('v@x.io', 'secret123');
      bio.supported = false;
      expect(await BiometricAuth.canUseBiometrics(), isFalse);
      expect(await BiometricAuth.quickLogin(), isNull);
    });

    test('StoredLogin.belongsTo matches email or username, any case', () {
      const s = StoredLogin('Viewer', 'x');
      expect(s.belongsTo(email: 'v@x.io', username: 'viewer'), isTrue);
      expect(s.belongsTo(email: 'o@x.io', username: 'other'), isFalse);
    });
  });

  group('Profile switch', () {
    Widget card(FakeApi api) => host(
          api,
          Builder(builder: (context) {
            final me = context.watch<AuthState>().user!;
            return Scaffold(body: ListView(children: [BiometricCard(me: me)]));
          }),
        );

    testWidgets('hidden when the phone has no fingerprint / Face ID', (tester) async {
      bio.supported = false;
      await tester.pumpWidget(card(FakeApi({})));
      await tester.pumpAndSettle();
      expect(find.text('Unlock with fingerprint / Face ID'), findsNothing);
    });

    testWidgets('turning on needs a successful scan', (tester) async {
      bio.result = false;
      await tester.pumpWidget(card(FakeApi({})));
      await tester.pumpAndSettle();
      expect(find.text('Unlock with fingerprint / Face ID'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('biometric-switch')));
      await tester.pumpAndSettle();
      expect(bio.prompts, 1);
      expect(await BiometricAuth.isEnabledInSettings(), isFalse);
      expect(tester.widget<SwitchListTile>(find.byKey(const ValueKey('biometric-switch'))).value, isFalse);
      expect(find.textContaining('Not recognized'), findsOneWidget);
    });

    testWidgets('password account: scan, confirm password once, remembered', (tester) async {
      final api = FakeApi({'POST /api/auth/login': (_) => sessionJson(refresh: 'check-token')});
      await tester.pumpWidget(card(api));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('biometric-switch')));
      await tester.pumpAndSettle();
      expect(bio.prompts, 1);
      expect(await BiometricAuth.isEnabledInSettings(), isTrue);
      expect(find.text('Quick login'), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'secret123');
      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();
      expect(api.calls, ['POST /api/auth/login', 'POST /api/auth/logout']);
      expect(api.bodies.first, {'login': 'v@x.io', 'password': 'secret123'});
      expect(api.bodies.last, {'refresh_token': 'check-token'}); // the check's session, not ours
      expect(api.session?.refreshToken, 'r');
      final stored = await BiometricAuth.storedCredentials();
      expect(stored?.login, 'v@x.io');
      expect(stored?.password, 'secret123');
      expect(find.text('Fingerprint / Face ID on'), findsOneWidget);
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();
      expect(find.text('Saved login: v@x.io'), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('biometric-remove-login')));
      await tester.pumpAndSettle();
      expect(await BiometricAuth.storedCredentials(), isNull);
      expect(await BiometricAuth.isEnabledInSettings(), isTrue); // switch stays on
    });

    testWidgets('wrong password is not remembered', (tester) async {
      final api = FakeApi({
        'POST /api/auth/login': (_) => throw ApiException(401, 'invalid_credentials', 'Wrong'),
      });
      await tester.pumpWidget(card(api));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('biometric-switch')));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'nope');
      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();
      expect(find.text('Wrong password.'), findsOneWidget);
      expect(await BiometricAuth.storedCredentials(), isNull);
    });

    testWidgets('Google account: switch on (app lock) but nothing stored', (tester) async {
      final api = FakeApi({}, hasPassword: false);
      await tester.pumpWidget(card(api));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('biometric-switch')));
      await tester.pumpAndSettle();
      expect(bio.prompts, 1);
      expect(await BiometricAuth.isEnabledInSettings(), isTrue);
      expect(find.text('Quick login'), findsNothing); // no password to confirm
      expect(find.text('Fingerprint / Face ID on'), findsOneWidget);
      expect(await BiometricAuth.storedCredentials(), isNull);
      expect(api.calls, isEmpty);

      await AppLock.instance.lockOnStartIfNeeded(signedIn: true);
      expect(AppLock.instance.lockedAtStart, isTrue);
    });

    testWidgets('turning off forgets the saved login', (tester) async {
      await BiometricAuth.setEnabledInSettings(true);
      await BiometricAuth.rememberCredentials('v@x.io', 'secret123');
      await tester.pumpWidget(card(FakeApi({})));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('biometric-switch')));
      await tester.pumpAndSettle();
      expect(bio.prompts, 0);
      expect(await BiometricAuth.isEnabledInSettings(), isFalse);
      expect(await BiometricAuth.storedCredentials(), isNull);
      expect(find.text('Fingerprint / Face ID off'), findsOneWidget);
    });
  });

  group('Login sheet quick login', () {
    Future<void> openSheet(WidgetTester tester, FakeApi api) async {
      await tester.pumpWidget(host(api, const LoginOpener()));
      await tester.tap(find.text('open login'));
      await tester.pumpAndSettle();
    }

    final quickButton = find.byKey(const ValueKey('biometric-login'));

    testWidgets('no button when switched on but nothing remembered', (tester) async {
      await BiometricAuth.setEnabledInSettings(true);
      await openSheet(tester, FakeApi({}, signedIn: false));
      await tester.pump(const Duration(seconds: 1));
      expect(quickButton, findsNothing);
      expect(bio.prompts, 0);
    });

    testWidgets('no button when remembered but switched off', (tester) async {
      await BiometricAuth.rememberCredentials('v@x.io', 'secret123');
      await openSheet(tester, FakeApi({}, signedIn: false));
      await tester.pump(const Duration(seconds: 1));
      expect(quickButton, findsNothing);
      expect(bio.prompts, 0);
    });

    testWidgets('prompts once on its own, scan logs in with the stored login', (tester) async {
      await BiometricAuth.setEnabledInSettings(true);
      await BiometricAuth.rememberCredentials('v@x.io', 'secret123');
      bio.result = false; // first auto prompt cancelled
      final api = FakeApi({'POST /api/auth/login': (_) => sessionJson()}, signedIn: false);
      await openSheet(tester, api);
      expect(quickButton, findsOneWidget);
      expect(find.text('as v@x.io'), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 450));
      await tester.pumpAndSettle();
      expect(bio.prompts, 1);
      await tester.pump(const Duration(seconds: 2));
      expect(bio.prompts, 1); // once only
      expect(api.calls, isEmpty);

      bio.result = true;
      await tester.tap(quickButton);
      await tester.pumpAndSettle();
      expect(bio.prompts, 2);
      expect(api.calls, ['POST /api/auth/login']);
      expect(api.bodies.single, {'login': 'v@x.io', 'password': 'secret123'});
      expect(api.session?.accessToken, 'a2');
      expect(quickButton, findsNothing); // sheet closed
    });

    testWidgets('failed login (password changed) clears the saved login', (tester) async {
      await BiometricAuth.setEnabledInSettings(true);
      await BiometricAuth.rememberCredentials('v@x.io', 'old-pass');
      final api = FakeApi({
        'POST /api/auth/login': (_) => throw ApiException(401, 'invalid_credentials', 'Wrong'),
      }, signedIn: false);
      await openSheet(tester, api);
      await tester.pump(const Duration(milliseconds: 450));
      await tester.pumpAndSettle();
      expect(bio.prompts, 1);
      expect(api.calls, ['POST /api/auth/login']);
      expect(await BiometricAuth.storedCredentials(), isNull);
      expect(quickButton, findsNothing);
      expect(find.textContaining('saved login no longer works'), findsOneWidget);
      expect(api.session, isNull);
    });

    testWidgets('password login with the switch on remembers it', (tester) async {
      await BiometricAuth.setEnabledInSettings(true);
      final api = FakeApi({'POST /api/auth/login': (_) => sessionJson()}, signedIn: false);
      await openSheet(tester, api);
      await tester.enterText(find.byType(TextField).at(0), 'viewer');
      await tester.enterText(find.byType(TextField).at(1), 'secret123');
      await tester.tap(find.widgetWithText(FilledButton, 'LOG IN'));
      await tester.pumpAndSettle();
      final stored = await BiometricAuth.storedCredentials();
      expect(stored?.login, 'viewer');
      expect(stored?.password, 'secret123');
    });

    testWidgets('password login with the switch off stores nothing', (tester) async {
      final api = FakeApi({'POST /api/auth/login': (_) => sessionJson()}, signedIn: false);
      await openSheet(tester, api);
      await tester.enterText(find.byType(TextField).at(0), 'viewer');
      await tester.enterText(find.byType(TextField).at(1), 'secret123');
      await tester.tap(find.widgetWithText(FilledButton, 'LOG IN'));
      await tester.pumpAndSettle();
      expect(api.session, isNotNull);
      expect(await BiometricAuth.storedCredentials(), isNull);
    });
  });

  group('App lock', () {
    test('locks on start only with a session and the switch on', () async {
      final lock = AppLock();
      await lock.lockOnStartIfNeeded(signedIn: true);
      expect(lock.locked, isFalse); // switch off
      await BiometricAuth.setEnabledInSettings(true);
      await lock.lockOnStartIfNeeded(signedIn: false);
      expect(lock.locked, isFalse);
      await lock.lockOnStartIfNeeded(signedIn: true);
      expect(lock.lockedAtStart, isTrue);
    });

    test('locks after more than 5 minutes in the background', () async {
      await BiometricAuth.setEnabledInSettings(true);
      var now = DateTime(2026, 1, 1, 12);
      final lock = AppLock(clock: () => now);
      lock.onPaused();
      now = now.add(const Duration(minutes: 4));
      await lock.onResumed(signedIn: true);
      expect(lock.locked, isFalse);
      lock.onPaused();
      now = now.add(const Duration(minutes: 6));
      await lock.onResumed(signedIn: false);
      expect(lock.locked, isFalse); // signed out: nothing to lock
      lock.onPaused();
      now = now.add(const Duration(minutes: 6));
      await lock.onResumed(signedIn: true);
      expect(lock.locked, isTrue);
      expect(lock.lockedAtStart, isFalse);
    });

    Widget gate(FakeApi api, AppLock lock) => host(api, AppLockGate(lock: lock, child: const Scaffold(body: Text('HOME'))));

    testWidgets('shown on start with a session; unlocks on a successful scan', (tester) async {
      await BiometricAuth.setEnabledInSettings(true);
      final lock = AppLock();
      await lock.lockOnStartIfNeeded(signedIn: true);
      bio.result = false;
      await tester.pumpWidget(gate(FakeApi({}), lock));
      expect(find.text('OUT FOR GROUND IS LOCKED'), findsOneWidget);
      expect(find.text('HOME'), findsNothing);
      await tester.pump(const Duration(milliseconds: 450));
      await tester.pumpAndSettle();
      expect(bio.prompts, 1);
      expect(find.text('Not recognized — try again.'), findsOneWidget);
      expect(lock.locked, isTrue);

      bio.result = true;
      await tester.tap(find.text('UNLOCK'));
      await tester.pumpAndSettle();
      expect(bio.prompts, 2);
      expect(lock.locked, isFalse);
      expect(find.text('HOME'), findsOneWidget);
      expect(find.text('OUT FOR GROUND IS LOCKED'), findsNothing);
    });

    testWidgets('coming back after a while covers the open screens', (tester) async {
      await BiometricAuth.setEnabledInSettings(true);
      var now = DateTime(2026, 1, 1, 12);
      final lock = AppLock(clock: () => now);
      await tester.pumpWidget(gate(FakeApi({}), lock));
      await tester.pumpAndSettle();
      expect(find.text('HOME'), findsOneWidget);
      lock.onPaused();
      now = now.add(const Duration(minutes: 10));
      await lock.onResumed(signedIn: true);
      await tester.pump();
      await tester.pump();
      expect(find.text('OUT FOR GROUND IS LOCKED'), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 450));
      await tester.pumpAndSettle();
      expect(bio.prompts, 1);
      expect(lock.locked, isFalse);
      expect(find.text('OUT FOR GROUND IS LOCKED'), findsNothing);
      expect(find.text('HOME'), findsOneWidget);
    });

    testWidgets('"Use password" logs out to the login form without a scan', (tester) async {
      await BiometricAuth.setEnabledInSettings(true);
      await BiometricAuth.rememberCredentials('v@x.io', 'secret123');
      final lock = AppLock();
      await lock.lockOnStartIfNeeded(signedIn: true);
      bio.result = false;
      final api = FakeApi({});
      await tester.pumpWidget(gate(api, lock));
      await tester.pump(const Duration(milliseconds: 450));
      await tester.pumpAndSettle();
      expect(bio.prompts, 1);
      await tester.tap(find.text('Use password'));
      await tester.pumpAndSettle();
      expect(api.calls, contains('POST /api/auth/logout'));
      expect(api.session, isNull);
      expect(lock.locked, isFalse);
      // The login sheet, with the fingerprint button but no automatic prompt.
      expect(find.text('Pick up where you left off on the map.'), findsOneWidget);
      expect(find.byKey(const ValueKey('biometric-login')), findsOneWidget);
      await tester.pump(const Duration(seconds: 1));
      expect(bio.prompts, 1);
      // Logging out keeps the switch and the saved login for the quick login.
      expect(await BiometricAuth.isEnabledInSettings(), isTrue);
      expect(await BiometricAuth.storedCredentials(), isNotNull);
    });

    testWidgets('Google account: "Log out" instead of "Use password"', (tester) async {
      await BiometricAuth.setEnabledInSettings(true);
      final lock = AppLock();
      await lock.lockOnStartIfNeeded(signedIn: true);
      bio.result = false;
      await tester.pumpWidget(gate(FakeApi({}, hasPassword: false), lock));
      await tester.pump(const Duration(milliseconds: 450));
      await tester.pumpAndSettle();
      expect(find.text('Log out'), findsOneWidget);
      expect(find.text('Use password'), findsNothing);
    });
  });

  testWidgets('changing the password updates the remembered one', (tester) async {
    await BiometricAuth.setEnabledInSettings(true);
    await BiometricAuth.rememberCredentials('viewer', 'old-pass1');
    final api = FakeApi({});
    await tester.pumpWidget(host(
      api,
      Builder(builder: (context) {
        final me = context.watch<AuthState>().user!;
        return Scaffold(body: ListView(children: [PasswordCard(me: me)]));
      }),
    ));
    await tester.tap(find.text('Change password'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).at(0), 'old-pass1');
    await tester.enterText(find.byType(TextField).at(1), 'new-pass12');
    await tester.pump();
    await tester.tap(find.text('Save password'));
    await tester.pumpAndSettle();
    expect(api.calls, contains('POST /api/me/password'));
    expect((await BiometricAuth.storedCredentials())?.password, 'new-pass12');
  });

  test('Me.hasPassword drives the Google/Apple path', () {
    expect(Me.fromJson(userJson(hasPassword: false)).hasPassword, isFalse);
  });
}
