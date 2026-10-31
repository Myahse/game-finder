import 'package:find_the_game/core/api.dart';
import 'package:find_the_game/core/auth.dart';
import 'package:find_the_game/core/l10n.dart';
import 'package:find_the_game/screens/delete_account.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

/// Records requests; DELETE /api/me answers with [deleteError] when set.
class _Api extends Api {
  final List<String> calls = [];
  final List<Object?> bodies = [];
  ApiException? deleteError;
  _Api({required bool hasPassword}) {
    session = Session('t', 'r', DateTime.now().add(const Duration(hours: 1)), {
      'id': 'me',
      'username': 'viewer',
      'first_name': 'V',
      'last_name': 'L',
      'email': 'v@x.io',
      'onboarded': true,
      'has_password': hasPassword,
      'created_at': '2026-01-01T00:00:00Z',
    });
  }

  @override
  Future<dynamic> request(String method, String path, {Object? body, bool retry = true}) async {
    calls.add('$method $path');
    bodies.add(body);
    if (method == 'DELETE' && path == '/api/me' && deleteError != null) throw deleteError!;
    return null;
  }
}

Widget _host(_Api api) => MultiProvider(
      providers: [
        ChangeNotifierProvider<Api>.value(value: api),
        ChangeNotifierProvider(create: (_) => AuthState(api)),
      ],
      child: MaterialApp(
        home: Scaffold(
          body: Builder(builder: (context) {
            final me = context.watch<AuthState>().user;
            return me == null ? const Text('signed out') : DeleteAccountButton(me: me);
          }),
        ),
      ),
    );

void main() {
  setUpAll(() => debugLanguageOverride = 'en');
  tearDownAll(() => debugLanguageOverride = null);
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  testWidgets('password account: confirms with the password, then signs out', (tester) async {
    final api = _Api(hasPassword: true);
    await tester.pumpWidget(_host(api));
    await tester.tap(find.text('Delete my account'));
    await tester.pumpAndSettle();
    expect(find.text('Delete your account?'), findsOneWidget);

    // Nothing is sent without the password.
    await tester.tap(find.text('DELETE'));
    await tester.pumpAndSettle();
    expect(find.text('Enter your password to confirm.'), findsOneWidget);
    expect(api.calls, isEmpty);

    // A wrong password keeps the dialog open with the server's message.
    api.deleteError = ApiException(403, 'wrong_password', 'Your current password is wrong.');
    await tester.enterText(find.byType(TextField), 'nope');
    await tester.tap(find.text('DELETE'));
    await tester.pumpAndSettle();
    expect(find.text('Your current password is wrong.'), findsOneWidget);
    expect(find.text('Delete your account?'), findsOneWidget);
    expect(api.session, isNotNull);

    api.deleteError = null;
    await tester.enterText(find.byType(TextField), 'password123');
    await tester.tap(find.text('DELETE'));
    await tester.pumpAndSettle();
    expect(api.calls.last, 'DELETE /api/me');
    expect(api.bodies.last, {'password': 'password123'});
    expect(api.session, isNull);
    expect(find.text('signed out'), findsOneWidget);
    expect(find.text('Your account has been deleted.'), findsOneWidget);
  });

  testWidgets('Google-only account: no password field, nothing to send', (tester) async {
    final api = _Api(hasPassword: false);
    await tester.pumpWidget(_host(api));
    await tester.tap(find.text('Delete my account'));
    await tester.pumpAndSettle();
    expect(find.byType(TextField), findsNothing);

    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(api.calls, isEmpty);

    await tester.tap(find.text('Delete my account'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('DELETE'));
    await tester.pumpAndSettle();
    expect(api.calls, ['DELETE /api/me']);
    expect(api.bodies.single, isNull);
    expect(api.session, isNull);
  });
}
