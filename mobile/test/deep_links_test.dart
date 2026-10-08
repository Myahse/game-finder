import 'package:find_the_game/core/api.dart';
import 'package:find_the_game/core/auth.dart';
import 'package:find_the_game/core/deep_links.dart';
import 'package:find_the_game/core/friend_invite.dart';
import 'package:find_the_game/core/l10n.dart';
import 'package:find_the_game/core/location.dart';
import 'package:find_the_game/screens/challenges_screen.dart';
import 'package:find_the_game/screens/link_router.dart';
import 'package:find_the_game/screens/link_screens.dart';
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

Map<String, dynamic> userJson(String id, String username) => {
      'id': id,
      'username': username,
      'first_name': 'F',
      'last_name': 'L',
      'created_at': '2026-01-01T00:00:00Z',
    };

final _sport = {'id': 's', 'name': 'Basketball', 'slug': 'basketball', 'icon': 'basketball', 'active': true};

/// Api that answers from canned routes and records what was sent.
class FakeApi extends Api {
  final Map<String, dynamic Function()> routes;
  final List<String> calls = [];
  final List<Object?> bodies = [];
  FakeApi(this.routes, {bool signedIn = true, bool onboarded = true}) {
    if (signedIn) {
      session = Session('t', 'r', DateTime.now().add(const Duration(hours: 1)), {
        ...userJson('me', 'viewer'),
        'email': 'v@x.io',
        'onboarded': onboarded,
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

/// Location fixed at a point; never touches the platform plugin.
class FakeLocation extends LocationState {
  final LatLng? at;
  FakeLocation(this.at) {
    position = at;
  }
  @override
  Future<LatLng?> freshFix({Duration timeout = const Duration(seconds: 10)}) async => at;
}

Widget host(FakeApi api, Widget child, {LocationState? location}) => MultiProvider(
      providers: [
        ChangeNotifierProvider<Api>.value(value: api),
        ChangeNotifierProvider(create: (_) => AuthState(api)),
        ChangeNotifierProvider<LocationState>.value(value: location ?? FakeLocation(null)),
      ],
      child: MaterialApp(home: child),
    );

const _hosts = ['ftg.test', 'out4ground.com', 'www.out4ground.com'];
DeepLink p(String url) => parseAppLink(Uri.parse(url), hosts: _hosts);

void main() {
  setUpAll(() {
    debugLanguageOverride = 'en';
    dotenv.testLoad(fileInput: 'WEB_APP_URL=https://ftg.test/');
  });
  tearDownAll(() => debugLanguageOverride = null);

  group('parseAppLink', () {
    test('every web path maps to its screen', () {
      expect(p('https://ftg.test/g/abc123'), const GameShareLink('abc123'));
      expect(p('https://out4ground.com/friend/tok9'), const FriendInviteLink('tok9'));
      expect(p('https://www.out4ground.com/u/ana'), const UsernameLink('ana'));
      expect(p('https://ftg.test/u/@ana'), const UsernameLink('ana'));
      expect(p('https://ftg.test/challenges/c1'), const ChallengeLink('c1'));
      expect(p('https://ftg.test/challenges'), const ChallengesLink());
      expect(p('https://ftg.test/challenges/'), const ChallengesLink());
      expect(p('https://ftg.test/games/g1'), const GameLink('g1'));
      expect(p('https://ftg.test/courts/k1'), const CourtLink('k1'));
      expect(p('https://ftg.test/?court=k2'), const CourtLink('k2'));
      expect(p('https://ftg.test/users/u1'), const UserLink('u1'));
      expect(p('https://ftg.test/verify-email?token=v1'), const VerifyEmailLink('v1'));
      expect(p('https://ftg.test/'), const HomeLink());
      expect(p('https://ftg.test'), const HomeLink());
    });

    test('custom scheme uses the same paths', () {
      expect(p('findthegame://g/abc'), const GameShareLink('abc'));
      expect(p('findthegame:///friend/t1'), const FriendInviteLink('t1'));
      expect(p('findthegame://courts/k1'), const CourtLink('k1'));
    });

    test('unknown paths, missing args and foreign hosts go home', () {
      expect(p('https://ftg.test/settings'), const HomeLink());
      expect(p('https://ftg.test/g/'), const HomeLink());
      expect(p('https://ftg.test/friend'), const HomeLink());
      expect(p('https://ftg.test/u/@'), const HomeLink());
      expect(p('https://ftg.test/games/new'), const HomeLink());
      expect(p('https://ftg.test/courts/new'), const HomeLink());
      expect(p('https://evil.example/g/abc'), const HomeLink());
      expect(p('mailto:a@b.c'), const HomeLink());
      expect(isAppLink(Uri.parse('https://evil.example/g/abc'), hosts: _hosts), isFalse);
    });

    test('verify-email without a token keeps an empty token (screen explains)', () {
      expect(p('https://ftg.test/verify-email'), const VerifyEmailLink(''));
    });

    test('share landings work signed out; the rest need a player', () {
      for (final l in [const HomeLink(), const GameShareLink('a'), const FriendInviteLink('a'), const UsernameLink('a'), const VerifyEmailLink('a')]) {
        expect(l.needsAuth, isFalse, reason: '$l');
      }
      for (final l in [const ChallengesLink(), const ChallengeLink('c'), const GameLink('g'), const CourtLink('k'), const UserLink('u')]) {
        expect(l.needsAuth, isTrue, reason: '$l');
      }
    });

    test('hosts: web app host from config plus out4ground', () {
      final hosts = appLinkHosts;
      expect(hosts, containsAll(['ftg.test', 'out4ground.com', 'www.out4ground.com']));
      expect(parseAppLink(Uri.parse('https://ftg.test/g/x')), const GameShareLink('x'));
      expect(parseAppLink(Uri.parse('https://OUT4GROUND.com/g/x')), const GameShareLink('x'));
    });
  });

  group('pending friend invite', () {
    setUp(() => SharedPreferences.setMockInitialValues({}));

    test('stash / peek / clear', () async {
      expect(await PendingFriendInvite.peek(), isNull);
      await PendingFriendInvite.stash('  tok1 ');
      expect(await PendingFriendInvite.peek(), 'tok1');
      await PendingFriendInvite.clear();
      expect(await PendingFriendInvite.peek(), isNull);
    });

    test('accepted after sign-in, then forgotten', () async {
      await PendingFriendInvite.stash('tok1');
      final api = FakeApi({'POST /api/friend-invites/tok1/accept': () => {'ok': true}});
      expect(await PendingFriendInvite.acceptPending(api), isTrue);
      expect(api.calls, ['POST /api/friend-invites/tok1/accept']);
      expect(await PendingFriendInvite.peek(), isNull);
      expect(await PendingFriendInvite.acceptPending(api), isFalse);
      expect(api.calls, hasLength(1));
    });

    test('a dead invite is dropped; a network error keeps it', () async {
      await PendingFriendInvite.stash('dead');
      final dead = FakeApi({'POST /api/friend-invites/dead/accept': () => throw ApiException(404, 'not_found', 'gone')});
      expect(await PendingFriendInvite.acceptPending(dead), isFalse);
      expect(await PendingFriendInvite.peek(), isNull);

      await PendingFriendInvite.stash('later');
      final offline = FakeApi({'POST /api/friend-invites/later/accept': () => throw Exception('offline')});
      expect(await PendingFriendInvite.acceptPending(offline), isFalse);
      expect(await PendingFriendInvite.peek(), 'later');
    });

    test('password login accepts the stashed invite', () async {
      await PendingFriendInvite.stash('tok2');
      final api = _LoginApi({'POST /api/friend-invites/tok2/accept': () => {'ok': true}});
      await AuthState(api).login('viewer', 'pw');
      expect(api.calls, ['POST /api/auth/login', 'POST /api/friend-invites/tok2/accept']);
      expect(await PendingFriendInvite.peek(), isNull);
    });

    testWidgets('invite screen signed out keeps the token for sign-up', (tester) async {
      final api = FakeApi({
        'GET /api/friend-invites/t5': () => {'valid': true, 'inviter': userJson('u9', 'kofi')},
      }, signedIn: false);
      await tester.pumpWidget(host(api, const FriendInviteScreen(token: 't5')));
      await tester.pumpAndSettle();
      expect(find.text('@kofi'), findsOneWidget);
      expect(find.text('CREATE ACCOUNT'), findsOneWidget);
      expect(await PendingFriendInvite.peek(), 't5');
    });

    testWidgets('invite screen signed in accepts', (tester) async {
      var accepted = false;
      final api = FakeApi({
        'GET /api/friend-invites/t6': () => {'valid': true, 'inviter': userJson('u9', 'kofi')},
        'POST /api/friend-invites/t6/accept': () => accepted = true,
      });
      await tester.pumpWidget(host(
          api,
          FriendInviteScreen(
            token: 't6',
            onAccepted: (ctx) => Navigator.of(ctx).pushReplacement(
                MaterialPageRoute(builder: (_) => const Scaffold(body: Text('friends')))),
          )));
      await tester.pumpAndSettle();
      await tester.tap(find.text('ACCEPT FRIEND REQUEST'));
      await tester.pumpAndSettle();
      expect(accepted, isTrue);
      expect(find.text('friends'), findsOneWidget);
    });

    testWidgets('invalid invite', (tester) async {
      final api = FakeApi({
        'GET /api/friend-invites/bad': () => throw ApiException(404, 'not_found', 'nope'),
      });
      await tester.pumpWidget(host(api, const FriendInviteScreen(token: 'bad')));
      await tester.pumpAndSettle();
      expect(find.text('This invite link is invalid or has expired.'), findsOneWidget);
    });
  });

  group('game link landing', () {
    final start = DateTime.now().add(const Duration(days: 2)).toUtc().toIso8601String();
    Map<String, dynamic> preview({String status = 'scheduled'}) => {
          'valid': true,
          'game_id': 'g1',
          'status': status,
          'start_time': start,
          'court_name': 'Terrain IUGB',
          'sport_name': 'Basketball',
          'sport_slug': 'basketball',
          'game_type': 'pickup',
        };
    Map<String, dynamic> game({String status = 'scheduled', bool joined = false, int players = 3, int max = 10}) => {
          'id': 'g1',
          'court_id': 'k1',
          'sport_id': 's',
          'skill_level': 'all',
          'game_type': 'pickup',
          'status': status,
          'creator_id': 'u2',
          'start_time': start,
          'duration_minutes': 90,
          'max_players': max,
          'player_count': players,
          'spots_left': max - players,
          'joined': joined,
          'court': {'name': 'Terrain IUGB', 'latitude': 5.3, 'longitude': -4.0},
          'sport': _sport,
        };

    testWidgets('invalid or expired link', (tester) async {
      final api = FakeApi({'GET /api/game-links/dead': () => throw ApiException(404, 'not_found', 'gone')});
      await tester.pumpWidget(host(api, const GameLinkScreen(token: 'dead')));
      await tester.pumpAndSettle();
      expect(find.text('This game link isn’t valid anymore.'), findsOneWidget);
      expect(find.text('BACK TO MAP'), findsOneWidget);
    });

    testWidgets('valid: false is invalid too', (tester) async {
      final api = FakeApi({'GET /api/game-links/old': () => {...preview(), 'valid': false}}, signedIn: false);
      await tester.pumpWidget(host(api, const GameLinkScreen(token: 'old')));
      await tester.pumpAndSettle();
      expect(find.text('This game link isn’t valid anymore.'), findsOneWidget);
      expect(find.text('OPEN FIND THE GAME'), findsOneWidget);
    });

    testWidgets('signed out: preview, then sign in / create account', (tester) async {
      final api = FakeApi({'GET /api/game-links/tok': preview}, signedIn: false);
      await tester.pumpWidget(host(api, const GameLinkScreen(token: 'tok')));
      await tester.pumpAndSettle();
      expect(find.text('Terrain IUGB'), findsOneWidget);
      expect(find.text('SIGN IN'), findsOneWidget);
      expect(find.text('Create account'), findsOneWidget);
      expect(api.calls, ['GET /api/game-links/tok']); // no game fetch signed out
    });

    testWidgets('signed in: join a scheduled game, then open it', (tester) async {
      String? opened;
      final api = FakeApi({
        'GET /api/game-links/tok': preview,
        'GET /api/games/g1': game,
        'POST /api/games/g1/join': () => {'ok': true},
      });
      await tester.pumpWidget(host(api, GameLinkScreen(token: 'tok', onOpenGame: (_, id) => opened = id)));
      await tester.pumpAndSettle();
      expect(find.text('3/10 players'), findsOneWidget);
      await tester.tap(find.widgetWithText(FilledButton, 'JOIN GAME'));
      await tester.pumpAndSettle();
      expect(api.calls, contains('POST /api/games/g1/join'));
      expect(opened, 'g1');
    });

    testWidgets('live game: join sends my location', (tester) async {
      String? opened;
      final api = FakeApi({
        'GET /api/game-links/tok': () => preview(status: 'active'),
        'GET /api/games/g1': () => game(status: 'active'),
        'POST /api/games/g1/join': () => {'ok': true},
      });
      await tester.pumpWidget(host(api, GameLinkScreen(token: 'tok', onOpenGame: (_, id) => opened = id),
          location: FakeLocation(const LatLng(5.3001, -4.0001))));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'JOIN GAME'));
      await tester.pumpAndSettle();
      final body = api.bodies[api.calls.indexOf('POST /api/games/g1/join')] as Map;
      expect(body['latitude'], closeTo(5.3001, 1e-9));
      expect(body['longitude'], closeTo(-4.0001, 1e-9));
      expect(opened, 'g1');
    });

    testWidgets('already in: open game', (tester) async {
      final api = FakeApi({
        'GET /api/game-links/tok': preview,
        'GET /api/games/g1': () => game(joined: true),
      });
      await tester.pumpWidget(host(api, GameLinkScreen(token: 'tok', onOpenGame: (_, _) {})));
      await tester.pumpAndSettle();
      expect(find.text('OPEN GAME'), findsOneWidget);
    });

    testWidgets('full game', (tester) async {
      final api = FakeApi({
        'GET /api/game-links/tok': preview,
        'GET /api/games/g1': () => game(players: 10, max: 10),
      });
      await tester.pumpWidget(host(api, GameLinkScreen(token: 'tok', onOpenGame: (_, _) {})));
      await tester.pumpAndSettle();
      expect(find.text('This game is full.'), findsOneWidget);
      expect(find.text('VIEW GAME'), findsOneWidget);
    });
  });

  group('challenge detail', () {
    Map<String, dynamic> challenge() => {
          'id': 'c1',
          'sport': _sport,
          'format': 'bball_1v1_11',
          'team_size': 1,
          'challenger': userJson('u1', 'kofi'),
          'opponent': userJson('u2', 'ama'),
          'court': {'id': 'k1', 'name': 'Terrain IUGB'},
          'start_time': DateTime.now().add(const Duration(days: 1)).toUtc().toIso8601String(),
          'status': 'pending',
          'is_open': false,
          'created_at': '2026-10-06T17:00:00Z',
        };

    testWidgets('loads the challenge and shows its card', (tester) async {
      final api = FakeApi({'GET /api/challenges/c1': challenge});
      await tester.pumpWidget(host(api, const ChallengeDetailScreen(challengeId: 'c1')));
      await tester.pumpAndSettle();
      expect(api.calls, contains('GET /api/challenges/c1'));
      expect(find.byType(ChallengeCard), findsOneWidget);
      expect(find.text('All my challenges'), findsOneWidget);
    });

    testWidgets('missing or private: not available', (tester) async {
      final api = FakeApi({'GET /api/challenges/zz': () => throw ApiException(404, 'not_found', 'nope')});
      await tester.pumpWidget(host(api, const ChallengeDetailScreen(challengeId: 'zz')));
      await tester.pumpAndSettle();
      expect(find.byType(ChallengeCard), findsNothing);
      expect(find.text('This challenge isn’t available.'), findsOneWidget);
    });
  });

  testWidgets('router: holds links until boot, resumes after onboarding', (tester) async {
    final api = _LoginApi({
      'GET /api/challenges/c9': () => throw ApiException(404, 'not_found', 'nope'),
      'GET /api/game-links/tok': () => throw ApiException(404, 'not_found', 'gone'),
    });
    await api.setSession(Session('t', 'r', DateTime.now().add(const Duration(hours: 1)),
        {...userJson('me', 'viewer'), 'onboarded': false}));
    final auth = AuthState(api);
    final router = LinkRouter.instance;
    await tester.pumpWidget(MultiProvider(
      providers: [
        ChangeNotifierProvider<Api>.value(value: api),
        ChangeNotifierProvider<AuthState>.value(value: auth),
        ChangeNotifierProvider<LocationState>.value(value: FakeLocation(null)),
      ],
      child: MaterialApp(navigatorKey: router.navigatorKey, home: const Scaffold(body: Text('root'))),
    ));

    // Before boot: held, then opened on attach (a share landing works without a player).
    router.open(const GameShareLink('tok'));
    await tester.pumpAndSettle();
    expect(find.byType(GameLinkScreen), findsNothing);
    router.attach(auth);
    await tester.pumpAndSettle();
    expect(find.byType(GameLinkScreen), findsOneWidget);
    router.navigatorKey.currentState!.pop();
    await tester.pumpAndSettle();

    // Needs a player: waits for onboarding, then opens.
    router.open(const ChallengeLink('c9'));
    await tester.pumpAndSettle();
    expect(find.byType(ChallengeDetailScreen), findsNothing);
    expect(router.waitingForSignIn, const ChallengeLink('c9'));
    await api.setSession(Session('t', 'r', DateTime.now().add(const Duration(hours: 1)),
        {...userJson('me', 'viewer'), 'onboarded': true}));
    await tester.pumpAndSettle();
    expect(find.byType(ChallengeDetailScreen), findsOneWidget);
    expect(router.waitingForSignIn, isNull);
    router.detach();
  });
}

/// Password login that hands back a session, then answers [routes].
class _LoginApi extends FakeApi {
  _LoginApi(super.routes) : super(signedIn: false);
  @override
  Future<dynamic> request(String method, String path, {Object? body, bool retry = true}) async {
    if ('$method $path' == 'POST /api/auth/login') {
      calls.add('$method $path');
      return {
        'access_token': 't',
        'refresh_token': 'r',
        'access_expires_at': DateTime.now().add(const Duration(hours: 1)).toUtc().toIso8601String(),
        'user': {...userJson('me', 'viewer'), 'onboarded': true},
      };
    }
    return super.request(method, path, body: body, retry: retry);
  }

  @override
  Future<void> setSession(Session? s) async {
    session = s; // no secure storage in tests
    notifyListeners();
  }
}
