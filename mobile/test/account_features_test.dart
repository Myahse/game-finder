import 'package:find_the_game/core/account.dart';
import 'package:find_the_game/core/api.dart';
import 'package:find_the_game/core/auth.dart';
import 'package:find_the_game/core/friends.dart';
import 'package:find_the_game/core/kings.dart';
import 'package:find_the_game/core/l10n.dart';
import 'package:find_the_game/core/models.dart';
import 'package:find_the_game/core/notification_links.dart';
import 'package:find_the_game/screens/friends_panel.dart';
import 'package:find_the_game/ui/app_icons.dart';
import 'package:find_the_game/ui/widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

Map<String, dynamic> userJson(String id, String username) => {
      'id': id,
      'username': username,
      'first_name': 'F',
      'last_name': 'L',
      'created_at': '2026-01-01T00:00:00Z',
    };

/// Api that answers from canned routes and records what was sent.
class FakeApi extends Api {
  final Map<String, dynamic Function()> routes;
  final List<String> calls = [];
  final List<Object?> bodies = [];
  FakeApi(this.routes, {bool signedIn = true}) {
    if (signedIn) {
      session = Session('t', 'r', DateTime.now().add(const Duration(hours: 1)), {
        ...userJson('me', 'viewer'),
        'email': 'v@x.io',
        'onboarded': true,
      });
    }
  }

  @override
  Future<dynamic> request(String method, String path, {Object? body, bool retry = true}) async {
    calls.add('$method $path');
    bodies.add(body);
    final r = routes['$method $path'];
    if (r == null) return null;
    return r();
  }
}

Widget host(FakeApi api, Widget child) => MultiProvider(
      providers: [
        ChangeNotifierProvider<Api>.value(value: api),
        ChangeNotifierProvider(create: (_) => AuthState(api)),
      ],
      child: MaterialApp(home: Scaffold(body: SingleChildScrollView(child: child))),
    );

void main() {
  setUpAll(() {
    debugLanguageOverride = 'en';
    dotenv.testLoad(fileInput: 'WEB_APP_URL=https://ftg.test/');
  });
  tearDownAll(() => debugLanguageOverride = null);

  group('friends models', () {
    test('parses incoming/outgoing requests', () {
      final r = FriendRequests.fromJson({
        'incoming': [
          {'id': 'fr1', 'user': userJson('u1', 'ana'), 'created_at': '2026-02-01T10:00:00Z'},
        ],
        'outgoing': [
          {'id': 'fr2', 'user': userJson('u2', 'bob'), 'created_at': '2026-02-02T10:00:00Z'},
        ],
      });
      expect(r.incoming.single.id, 'fr1');
      expect(r.incoming.single.user.username, 'ana');
      expect(r.outgoing.single.user.id, 'u2');
      expect(FriendRequests.fromJson(null).incoming, isEmpty);
      expect(FriendRequests.fromJson({'incoming': null}).outgoing, isEmpty);
    });

    test('relation to a profile', () {
      final friends = [PublicUser.fromJson(userJson('f1', 'fifi'))];
      final req = FriendRequests.fromJson({
        'incoming': [
          {'id': 'in1', 'user': userJson('i1', 'inco')},
        ],
        'outgoing': [
          {'id': 'out1', 'user': userJson('o1', 'outo')},
        ],
      });
      FriendRelation rel(String? viewer, String target) =>
          friendRelation(viewerId: viewer, targetId: target, friends: friends, requests: req).relation;
      expect(rel(null, 'f1'), FriendRelation.guest);
      expect(rel('me', 'me'), FriendRelation.self);
      expect(rel('me', 'f1'), FriendRelation.friends);
      expect(rel('me', 'i1'), FriendRelation.incoming);
      expect(friendRelation(viewerId: 'me', targetId: 'i1', friends: friends, requests: req).incomingId, 'in1');
      expect(rel('me', 'o1'), FriendRelation.outgoing);
      expect(rel('me', 'x'), FriendRelation.none);
    });

    test('usernames and links', () {
      expect(normalizeUsername('  @@Ana_B '), 'Ana_B');
      expect(profileShareUrl('@ana.b'), 'https://ftg.test/u/ana.b');
      expect(friendInviteUrl(' tok en '), 'https://ftg.test/friend/tok%20en');
    });
  });

  group('notification routing', () {
    NotificationTarget? t(String type, Map<String, dynamic> data) => notificationTarget(type, data);

    test('matches the web notificationLink order', () {
      expect(t('friend_request', {'user_id': 'u1'}), const NotificationTarget(NotificationDest.profileFriends));
      expect(t('achievement', {'kind': 'king', 'court_id': 'c1'}), const NotificationTarget(NotificationDest.court, 'c1'));
      expect(t('achievement', {'kind': 'badge'}), const NotificationTarget(NotificationDest.profile));
      expect(t('game_update', {'kind': 'court_change', 'challenge_id': 'ch1', 'court_id': 'c2'}),
          const NotificationTarget(NotificationDest.challenges));
      expect(t('game_update', {'kind': 'court_change', 'challenge_id': 'ch1', 'game_id': 'g1'}),
          const NotificationTarget(NotificationDest.game, 'g1'));
      expect(t('challenge', {'game_id': 'g1'}), const NotificationTarget(NotificationDest.challenges));
      expect(t('court_pending_review', {'court_id': 'c3', 'game_id': 'g9'}), const NotificationTarget(NotificationDest.court, 'c3'));
      expect(t('game_invite', {'game_id': 'g1', 'court_id': 'c1'}), const NotificationTarget(NotificationDest.game, 'g1'));
      expect(t('nearby', {'court_id': 'c1'}), const NotificationTarget(NotificationDest.court, 'c1'));
      expect(t('friend_accepted', {'user_id': 'u7'}), const NotificationTarget(NotificationDest.user, 'u7'));
      expect(t('system', {}), isNull);
      expect(t('system', {'game_id': ''}), isNull);
    });

    test('push payloads', () {
      expect(targetFromPayload(pushPayload({'type': 'friend_request', 'notification_id': 'n1'})),
          const NotificationTarget(NotificationDest.profileFriends));
      expect(targetFromPayload('g42'), const NotificationTarget(NotificationDest.game, 'g42'));
      expect(targetFromPayload('presence:c1'), isNull);
      expect(targetFromPayload(null), isNull);
      expect(targetFromPayload('{broken'), isNull);
    });
  });

  group('kings cache', () {
    test('fetches once per ttl and answers isKing', () async {
      var now = DateTime(2026, 10, 7, 12);
      var fetches = 0;
      final cache = KingsCache(clock: () => now)
        ..fetcher = () async {
          fetches++;
          return [
            {'user_id': 'k1', 'court_id': 'c1', 'court_name': 'A'},
          ];
        };
      var notified = 0;
      cache.addListener(() => notified++);
      expect(cache.isKing('k1'), isFalse); // first call starts the fetch
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);
      expect(cache.isKing('k1'), isTrue);
      expect(cache.isKing('x'), isFalse);
      expect(cache.isKing(null), isFalse);
      expect(fetches, 1);
      expect(notified, 1);

      now = now.add(const Duration(minutes: 9));
      cache.isKing('k1');
      await Future<void>.delayed(Duration.zero);
      expect(fetches, 1);

      now = now.add(const Duration(minutes: 2));
      cache.isKing('k1');
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);
      expect(fetches, 2);
      expect(notified, 1); // same kings → no rebuild
    });

    test('no fetcher (signed out) and failures', () async {
      final cache = KingsCache();
      expect(cache.isKing('k1'), isFalse);
      var fetches = 0;
      cache.fetcher = () async {
        fetches++;
        throw Exception('offline');
      };
      cache.isKing('k1');
      cache.isKing('k1');
      await Future<void>.delayed(Duration.zero);
      expect(fetches, 1); // a failure doesn't retry on every build
      expect(cache.isKing('k1'), isFalse);
    });

    testWidgets('UserAvatar wears a crown for kings', (tester) async {
      final kings = KingsCache.instance;
      addTearDown(() {
        kings.fetcher = null;
        kings.reset();
      });
      kings.fetcher = () async => [
            {'user_id': 'k1'},
          ];
      kings.reset();
      await tester.pumpWidget(MaterialApp(
        home: Column(children: [
          UserAvatar(PublicUser.fromJson(userJson('k1', 'king')), size: 40),
          UserAvatar(PublicUser.fromJson(userJson('p1', 'pawn')), size: 40),
        ]),
      ));
      await tester.pump(const Duration(milliseconds: 10));
      await tester.pump(const Duration(milliseconds: 10));
      expect(find.byType(CrownIcon), findsNWidgets(2)); // gold crown + its shadow, on one avatar
      expect(find.bySemanticsLabel('King of the Court'), findsOneWidget);
    });
  });

  group('account rules', () {
    test('password length and payload', () {
      expect(passwordLengthOk('1234567'), isFalse);
      expect(passwordLengthOk('12345678'), isTrue);
      expect(passwordLengthOk('x' * 72), isTrue);
      expect(passwordLengthOk('x' * 73), isFalse);
      expect(passwordPayload(adding: true, current: 'old', next: 'newpassword'), {'new_password': 'newpassword'});
      expect(passwordPayload(adding: false, current: 'old', next: 'newpassword'),
          {'current_password': 'old', 'new_password': 'newpassword'});
    });

    test('has_password and email verification', () {
      expect(Me.fromJson({...userJson('a', 'a'), 'has_password': false}).hasPassword, isFalse);
      expect(Me.fromJson({...userJson('a', 'a'), 'has_password': true}).hasPassword, isTrue);
      expect(Me.fromJson(userJson('a', 'a')).hasPassword, isTrue);
      expect(isEmailNotVerified(ApiException(403, 'email_not_verified', '')), isTrue);
      expect(isEmailNotVerified(ApiException(403, 'suspended', '')), isFalse);
    });

    test('extra sports: up to 2, never the main sport', () {
      expect(toggleExtraSport([], 'a', mainSportId: 'main'), ['a']);
      expect(toggleExtraSport(['a'], 'main', mainSportId: 'main'), ['a']);
      expect(toggleExtraSport(['a', 'b'], 'c', mainSportId: 'main'), ['a', 'b']);
      expect(toggleExtraSport(['a', 'b'], 'a', mainSportId: 'main'), ['b']);
    });
  });

  group('friend flows', () {
    testWidgets('profile actions: add friend → request sent', (tester) async {
      var sent = false;
      final api = FakeApi({
        'GET /api/me/friends': () => <dynamic>[],
        'GET /api/me/friend-requests': () => {
              'incoming': <dynamic>[],
              'outgoing': [
                if (sent) {'id': 'r1', 'user': userJson('u2', 'bob')},
              ],
            },
        'POST /api/me/friend-requests': () {
          sent = true;
          return {'id': 'r1'};
        },
      });
      await tester.pumpWidget(host(api, ProfileFriendActions(user: PublicUser.fromJson(userJson('u2', 'bob')))));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Add friend'));
      await tester.pumpAndSettle();
      expect(api.calls, contains('POST /api/me/friend-requests'));
      expect(api.bodies[api.calls.indexOf('POST /api/me/friend-requests')], {'username': 'bob'});
      expect(find.text('Friend request sent.'), findsOneWidget);
    });

    testWidgets('profile actions: incoming request can be accepted', (tester) async {
      var accepted = false;
      final api = FakeApi({
        'GET /api/me/friends': () => [if (accepted) userJson('u3', 'cara')],
        'GET /api/me/friend-requests': () => {
              'incoming': [
                if (!accepted) {'id': 'in9', 'user': userJson('u3', 'cara')},
              ],
              'outgoing': <dynamic>[],
            },
        'POST /api/me/friend-requests/in9/accept': () {
          accepted = true;
          return null;
        },
      });
      await tester.pumpWidget(host(api, ProfileFriendActions(user: PublicUser.fromJson(userJson('u3', 'cara')))));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Accept friend request'));
      await tester.pumpAndSettle();
      expect(api.calls, contains('POST /api/me/friend-requests/in9/accept'));
      expect(find.text('Friends'), findsOneWidget);
    });

    testWidgets('profile actions: signed out asks to log in', (tester) async {
      final api = FakeApi({}, signedIn: false);
      await tester.pumpWidget(host(api, ProfileFriendActions(user: PublicUser.fromJson(userJson('u2', 'bob')))));
      await tester.pumpAndSettle();
      expect(find.text('Log in'), findsOneWidget);
      expect(find.text(' to add @bob as a friend.'), findsOneWidget);
      expect(api.calls, isEmpty);
    });

    testWidgets('friends panel lists, adds and declines', (tester) async {
      final api = FakeApi({
        'GET /api/me/friends': () => [userJson('f1', 'fifi')],
        'GET /api/me/friend-requests': () => {
              'incoming': [
                {'id': 'in1', 'user': userJson('u5', 'eve')},
              ],
              'outgoing': [
                {'id': 'out1', 'user': userJson('u6', 'dan')},
              ],
            },
      });
      await tester.pumpWidget(host(api, const FriendsPanel()));
      await tester.pumpAndSettle();
      expect(find.text('Your friends (1)'), findsOneWidget);
      expect(find.text('@fifi'), findsOneWidget);
      expect(find.text('Requests for you'), findsOneWidget);
      expect(find.text('Waiting: @dan'), findsOneWidget);

      await tester.enterText(find.byType(TextField), '@zoe ');
      await tester.pump();
      await tester.tap(find.text('Add friend'));
      await tester.pumpAndSettle();
      expect(api.bodies[api.calls.indexOf('POST /api/me/friend-requests')], {'username': 'zoe'});

      await tester.tap(find.text('Decline'));
      await tester.pumpAndSettle();
      expect(api.calls, contains('POST /api/me/friend-requests/in1/reject'));
    });
  });
}
