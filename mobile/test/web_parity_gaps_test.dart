import 'package:find_the_game/core/api.dart';
import 'package:find_the_game/core/api_errors.dart';
import 'package:find_the_game/core/auth.dart';
import 'package:find_the_game/core/l10n.dart';
import 'package:find_the_game/core/location.dart';
import 'package:find_the_game/core/models.dart';
import 'package:find_the_game/core/nearby.dart';
import 'package:find_the_game/core/notification_links.dart';
import 'package:find_the_game/core/prompt_dismiss.dart';
import 'package:find_the_game/screens/court_screens.dart';
import 'package:find_the_game/screens/game_screens.dart';
import 'package:find_the_game/screens/home_shell.dart' show showAvatarPrompt;
import 'package:find_the_game/screens/notification_routes.dart';
import 'package:find_the_game/screens/profile_screen.dart';
import 'package:find_the_game/ui/widgets.dart';
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

const _avatar = {'version': 1, 'bodyType': 'body_regular', 'skinTone': 'skin_04', 'sport': 'basketball'};
final _sport = {'id': 's', 'name': 'Basketball', 'slug': 'basketball', 'icon': 'basketball', 'active': true};

Map<String, dynamic> courtJson({String status = 'approved', String? reason, double lat = 5.3, double lng = -4.0}) => {
      'id': 'c1',
      'name': 'Marcory Court',
      'latitude': lat,
      'longitude': lng,
      'status': status,
      'rejection_reason': reason,
      'sports': [_sport],
    };

Map<String, dynamic> gameJson({Map<String, dynamic>? creator}) => {
      'id': 'g1',
      'court_id': 'c1',
      'sport_id': 's',
      'skill_level': 'all_levels',
      'game_type': 'pickup',
      'status': 'scheduled',
      'start_time': '2026-10-08T18:00:00Z',
      'duration_minutes': 90,
      'max_players': 10,
      'player_count': 2,
      'spots_left': 8,
      'court': {'name': 'Marcory Court', 'latitude': 5.3, 'longitude': -4.0},
      'sport': _sport,
      'creator': creator,
    };

/// Answers by path (query ignored) and records the calls.
class FakeApi extends Api {
  final Map<String, dynamic Function()> routes;
  final List<String> calls = [];
  FakeApi(this.routes, {Map<String, dynamic>? me, bool signedIn = true}) {
    if (signedIn) {
      session = Session('t', 'r', DateTime.now().add(const Duration(hours: 1)), {
        ...userJson('me', 'viewer'),
        'email': 'v@x.io',
        'onboarded': true,
        ...?me,
      });
    }
  }

  @override
  Future<dynamic> request(String method, String path, {Object? body, bool retry = true}) async {
    calls.add('$method $path');
    final r = routes['$method ${path.split('?').first}'];
    if (r == null) return null;
    return r();
  }
}

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

void main() {
  setUpAll(() {
    debugLanguageOverride = 'en';
    dotenv.testLoad(fileInput: 'WEB_APP_URL=https://ftg.test/');
  });
  tearDownAll(() => debugLanguageOverride = null);

  group('avatar studio entry (gap 1)', () {
    test('hasPlayerAvatar follows the web rule, not the legacy preset', () {
      expect(PublicUser.fromJson(userJson('u', 'a')).hasPlayerAvatar, isFalse);
      // Legacy preset / uploaded photo is not a player avatar.
      expect(PublicUser.fromJson({...userJson('u', 'a'), 'avatar_url': 'preset:v1.x'}).hasPlayerAvatar, isFalse);
      expect(PublicUser.fromJson({...userJson('u', 'a'), 'player_avatar': _avatar}).hasPlayerAvatar, isTrue);
      expect(PublicUser.fromJson({...userJson('u', 'a'), 'avatar_url': 'avatar:player'}).hasPlayerAvatar, isTrue);
      expect(PublicUser.fromJson({...userJson('u', 'a'), 'player_avatar': {'version': 2}}).hasPlayerAvatar, isFalse);
    });

    test('"Later" holds for 7 days', () {
      final t0 = DateTime(2026, 10, 1);
      expect(promptDismissedSince(null, t0), isFalse);
      final at = t0.millisecondsSinceEpoch;
      expect(promptDismissedSince(at, t0.add(const Duration(days: 6, hours: 23))), isTrue);
      expect(promptDismissedSince(at, t0.add(const Duration(days: 7, minutes: 1))), isFalse);
    });

    test('dismissal is remembered under the web key', () async {
      SharedPreferences.setMockInitialValues({});
      expect(await promptDismissed(PromptKeys.avatar), isFalse);
      await dismissPromptLater(PromptKeys.avatar);
      expect(await promptDismissed(PromptKeys.avatar), isTrue);
      expect(await promptDismissed(PromptKeys.avatar, now: DateTime.now().add(const Duration(days: 8))), isFalse);
      expect(PromptKeys.avatar, 'ftg_prompt_avatar');
    });

    testWidgets('profile: no player avatar → Create your avatar card', (tester) async {
      SharedPreferences.setMockInitialValues({});
      final api = FakeApi({}, me: {'avatar_url': 'preset:v1.x'});
      await tester.pumpWidget(host(api, const ProfileScreen()));
      await tester.pump();
      expect(find.byType(CreateAvatarCard), findsOneWidget);
      expect(find.text('Create your avatar'), findsOneWidget);
      expect(find.text('Create a player avatar so friends recognize you on the map and in games.'), findsOneWidget);
      expect(find.text('EDIT AVATAR'), findsNothing);
    });

    testWidgets('profile: has a player avatar → Edit avatar', (tester) async {
      SharedPreferences.setMockInitialValues({});
      final api = FakeApi({}, me: {'avatar_url': 'avatar:player', 'player_avatar': _avatar});
      await tester.pumpWidget(host(api, const ProfileScreen()));
      await tester.pump();
      expect(find.byType(CreateAvatarCard), findsNothing);
      expect(find.text('EDIT AVATAR'), findsOneWidget);
    });

    testWidgets('prompt: Create / Later', (tester) async {
      bool? result;
      await tester.pumpWidget(MaterialApp(
        home: Builder(
          builder: (context) => TextButton(onPressed: () async => result = await showAvatarPrompt(context), child: const Text('go')),
        ),
      ));
      await tester.tap(find.text('go'));
      await tester.pumpAndSettle();
      expect(find.text('Create your avatar'), findsOneWidget);
      await tester.tap(find.text('Later'));
      await tester.pumpAndSettle();
      expect(result, isFalse);
      await tester.tap(find.text('go'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('CREATE'));
      await tester.pumpAndSettle();
      expect(result, isTrue);
    });
  });

  group('court review + link note (gaps 3, 4)', () {
    test('rejection_reason is parsed', () {
      expect(Court.fromJson(courtJson(status: 'rejected', reason: 'Duplicate')).rejectionReason, 'Duplicate');
      expect(Court.fromJson(courtJson()).rejectionReason, isNull);
    });

    testWidgets('rejected note shows the reason, else plain Rejected', (tester) async {
      Future<void> show(Map<String, dynamic> j) =>
          tester.pumpWidget(MaterialApp(home: Scaffold(body: CourtReviewNote(court: Court.fromJson(j)))));
      await show(courtJson(status: 'rejected', reason: 'Duplicate'));
      expect(find.text('Rejected: Duplicate'), findsOneWidget);
      await show(courtJson(status: 'rejected', reason: '  '));
      expect(find.text('Rejected'), findsOneWidget);
      await show(courtJson(status: 'pending'));
      expect(find.text('Waiting for review. Only you can see this court.'), findsOneWidget);
    });

    test('opened-from-link note only beyond the map radius', () {
      expect(beyondMapRadius(null), isFalse);
      expect(beyondMapRadius(mapNearbyRadiusKm * 1000.0), isFalse);
      expect(beyondMapRadius(mapNearbyRadiusKm * 1000.0 + 1), isTrue);
      expect(openedFromLinkText(), contains('within about $mapNearbyRadiusKm km'));
    });
  });

  group('game host (gap 7)', () {
    test('creator is parsed from the game payload', () {
      expect(Game.fromJson(gameJson(creator: userJson('u2', 'kofi'))).creator?.username, 'kofi');
      expect(Game.fromJson(gameJson()).creator, isNull);
    });

    testWidgets('GameCard shows @host only with showHost', (tester) async {
      final g = Game.fromJson(gameJson(creator: userJson('u2', 'kofi')));
      await tester.pumpWidget(MaterialApp(home: Scaffold(body: GameCard(game: g, showHost: true, onTap: () {}))));
      expect(find.text('@kofi'), findsOneWidget);
      await tester.pumpWidget(MaterialApp(home: Scaffold(body: GameCard(game: g, onTap: () {}))));
      expect(find.text('@kofi'), findsNothing);
    });
  });

  group('create a live game (gaps 6, 9)', () {
    FakeApi createApi() => FakeApi({
          'GET /api/sports': () => [_sport],
          'GET /api/courts/nearby': () => [courtJson()],
          'POST /api/games': () => gameJson(),
        }, me: {'preferred_sport_id': 's'});

    testWidgets('right now, far from the court → warns and does not post', (tester) async {
      final api = createApi();
      // ~11 km away from the court.
      await tester.pumpWidget(host(api, const CreateGameScreen(courtId: 'c1'), location: FakeLocation(const LatLng(5.4, -4.0))));
      await tester.pumpAndSettle();
      expect(find.text('Court not listed? Add it →'), findsOneWidget);
      await tester.tap(find.text('CREATE GAME').last);
      await tester.pumpAndSettle();
      expect(find.text("You're not at the court"), findsOneWidget);
      expect(api.calls.where((c) => c.startsWith('POST /api/games')), isEmpty);
    });

    testWidgets('right now, at the court → posts', (tester) async {
      final api = createApi();
      await tester.pumpWidget(host(api, const CreateGameScreen(courtId: 'c1'), location: FakeLocation(const LatLng(5.3001, -4.0))));
      await tester.pumpAndSettle();
      await tester.tap(find.text('CREATE GAME').last);
      await tester.pumpAndSettle();
      expect(api.calls, contains('POST /api/games'));
    });

    test('too_far_from_court reads right for creating a game too', () {
      final msg = apiErrorCopy('too_far_from_court', 'You need to be at the court to check in.');
      expect(msg, "You're not at the court.");
      expect(msg, isNot(contains('check in')));
    });
  });

  group('signed-out not-found profile (gap 8)', () {
    testWidgets('offers Create account, with Log in below', (tester) async {
      final api = FakeApi({'GET /api/profiles/ghost': () => throw ApiException(404, 'user_not_found', 'nope')}, signedIn: false);
      await tester.pumpWidget(host(api, const UserScreen.byUsername('ghost')));
      await tester.pumpAndSettle();
      expect(find.text('CREATE ACCOUNT'), findsOneWidget);
      expect(find.text('Log in'), findsOneWidget);
      expect(find.text('LOG IN'), findsNothing);
    });
  });

  group('friend request → Profile tab (gap 10)', () {
    testWidgets('uses the home tab instead of pushing a profile', (tester) async {
      bool? focused;
      await tester.pumpWidget(MaterialApp(
        home: HomeTabScope(
          openProfile: ({bool focusFriends = false}) => focused = focusFriends,
          child: Builder(
            builder: (context) => TextButton(
              onPressed: () => openNotificationTarget(context, notificationTarget('friend_request', const {})),
              child: const Text('open'),
            ),
          ),
        ),
      ));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expect(focused, isTrue);
      expect(find.byType(ProfileScreen), findsNothing);
    });
  });
}
