import 'package:find_the_game/core/forward_geocode.dart';
import 'package:find_the_game/core/game_join.dart';
import 'package:find_the_game/core/game_share.dart';
import 'package:find_the_game/core/l10n.dart';
import 'package:find_the_game/core/location.dart';
import 'package:find_the_game/core/models.dart';
import 'package:find_the_game/core/my_sport.dart';
import 'package:find_the_game/screens/game_screens.dart';
import 'package:find_the_game/ui/map_search_bar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

const court = LatLng(5.2133, -3.7389);

Sport sport(String id, String slug) => Sport.fromJson({'id': id, 'name': slug, 'slug': slug, 'icon': slug, 'active': true});

Map<String, dynamic> userJson(String id, String username) =>
    {'id': id, 'username': username, 'first_name': '', 'last_name': '', 'created_at': '2026-01-01T00:00:00Z'};

Game game({String status = 'active', List<Map<String, dynamic>> players = const []}) => Game.fromJson({
      'id': 'g1',
      'court_id': 'c1',
      'sport_id': 's1',
      'creator_id': 'u1',
      'start_time': '2026-10-01T18:20:00Z',
      'duration_minutes': 120,
      'max_players': 10,
      'skill_level': 'all_levels',
      'game_type': 'pickup',
      'status': status,
      'player_count': players.length,
      'spots_left': 10 - players.length,
      'court': {'id': 'c1', 'name': 'Terrain IUGB', 'latitude': court.latitude, 'longitude': court.longitude},
      'sport': {'id': 's1', 'name': 'Basketball', 'slug': 'basketball', 'icon': '🏀', 'active': true},
      'players': players,
    });

Court courtNamed(String id, String name) => Court.fromJson({
      'id': id,
      'name': name,
      'latitude': court.latitude,
      'longitude': court.longitude,
      'photos': <String>[],
      'sports': [
        {'id': 's1', 'name': 'Basketball', 'slug': 'basketball', 'icon': '🏀', 'active': true},
      ],
      'player_count': 0,
      'active_game_count': 0,
      'activity': 'inactive',
      'last_activity_at': null,
    });

class FakeLocation extends LocationState {
  final LatLng? fix;
  FakeLocation(this.fix) {
    position = fix;
  }
  @override
  Future<LatLng?> freshFix({Duration timeout = const Duration(seconds: 10)}) async => fix;
}

/// A button that runs [prepareGameJoin] and keeps the result.
class JoinProbe extends StatelessWidget {
  final bool live;
  final void Function(Map<String, dynamic>?) onResult;
  const JoinProbe({super.key, required this.live, required this.onResult});
  @override
  Widget build(BuildContext context) => Scaffold(
        body: TextButton(
          onPressed: () async =>
              onResult(await prepareGameJoin(context, live: live, courtLat: court.latitude, courtLng: court.longitude)),
          child: const Text('join'),
        ),
      );
}

void main() {
  setUp(() => debugLanguageOverride = 'en');
  tearDown(() => debugLanguageOverride = null);

  group('join location', () {
    test('body carries coordinates (null when unknown), like the web', () {
      expect(gameJoinBody(court), {'latitude': court.latitude, 'longitude': court.longitude});
      expect(gameJoinBody(null), {'latitude': null, 'longitude': null});
    });

    test('live games need the player at the court; scheduled ones do not', () {
      const near = LatLng(5.2140, -3.7389); // ~80 m
      const far = LatLng(5.2300, -3.7389); // ~1.9 km
      expect(isAtCourt(near, court.latitude, court.longitude), isTrue);
      expect(isAtCourt(far, court.latitude, court.longitude), isFalse);
      expect(checkJoinLocation(live: true, at: near, courtLat: court.latitude, courtLng: court.longitude), JoinLocationCheck.ok);
      expect(checkJoinLocation(live: true, at: far, courtLat: court.latitude, courtLng: court.longitude), JoinLocationCheck.notAtCourt);
      expect(checkJoinLocation(live: true, at: null, courtLat: court.latitude, courtLng: court.longitude), JoinLocationCheck.locationOff);
      expect(checkJoinLocation(live: false, at: null, courtLat: court.latitude, courtLng: court.longitude), JoinLocationCheck.ok);
      expect(checkJoinLocation(live: false, at: far, courtLat: court.latitude, courtLng: court.longitude), JoinLocationCheck.ok);
    });

    Future<Map<String, dynamic>?> run(WidgetTester t, LatLng? fix, {required bool live}) async {
      Map<String, dynamic>? result = {'unset': true};
      await t.pumpWidget(ChangeNotifierProvider<LocationState>.value(
        value: FakeLocation(fix),
        child: MaterialApp(home: JoinProbe(live: live, onResult: (r) => result = r)),
      ));
      await t.tap(find.text('join'));
      await t.pumpAndSettle();
      return result;
    }

    testWidgets('at the court → join body with the fix', (t) async {
      const near = LatLng(5.2140, -3.7389);
      expect(await run(t, near, live: true), {'latitude': near.latitude, 'longitude': near.longitude});
    });

    testWidgets('far from a live game → "not at the court" warning, no join', (t) async {
      Map<String, dynamic>? result = {'unset': true};
      await t.pumpWidget(ChangeNotifierProvider<LocationState>.value(
        value: FakeLocation(const LatLng(5.30, -3.70)),
        child: MaterialApp(home: JoinProbe(live: true, onResult: (r) => result = r)),
      ));
      await t.tap(find.text('join'));
      await t.pumpAndSettle();
      expect(find.text("You're not at the court"), findsOneWidget);
      await t.tap(find.text('OK'));
      await t.pumpAndSettle();
      expect(result, isNull);
    });

    testWidgets('location off on a live game → location message, no join', (t) async {
      Map<String, dynamic>? result = {'unset': true};
      await t.pumpWidget(ChangeNotifierProvider<LocationState>.value(
        value: FakeLocation(null),
        child: MaterialApp(home: JoinProbe(live: true, onResult: (r) => result = r)),
      ));
      await t.tap(find.text('join'));
      await t.pumpAndSettle();
      expect(find.text('Location needed'), findsOneWidget);
      await t.tap(find.text('OK'));
      await t.pumpAndSettle();
      expect(result, isNull);
    });

    testWidgets('scheduled game joins from anywhere', (t) async {
      expect(await run(t, null, live: false), {'latitude': null, 'longitude': null});
    });

    test('warning is bilingual', () {
      debugLanguageOverride = 'fr';
      expect(notAtCourtTitle(), 'Tu n’es pas au terrain');
      expect(notAtCourtMessage(), contains('500 m'));
    });
  });

  group('share', () {
    test('court link and texts match the web', () {
      expect(courtShareUrl('abc 1'), '$webAppUrl/courts/abc%201');
      expect(gameShareUrlFromToken(' tok '), '$webAppUrl/g/tok');
      expect(gameShareText('Terrain IUGB', 'Pickup'), 'Terrain IUGB · Pickup');
      expect(findTheGameTitle('Terrain IUGB'), 'Terrain IUGB · Find the Game');
      expect(shareMessage('Terrain IUGB', 'https://x/courts/1'), 'Terrain IUGB\nhttps://x/courts/1');
      expect(shareMessage(' ', 'https://x'), 'https://x');
    });
  });

  group('invite', () {
    test('friend chips skip players already in the game', () {
      final friends = [PublicUser.fromJson(userJson('u2', 'ama')), PublicUser.fromJson(userJson('u3', 'kofi'))];
      final g = game(players: [userJson('u1', 'nia'), userJson('u3', 'kofi')]);
      expect(inviteFriends(friends, g).map((f) => f.username), ['ama']);
    });
  });

  group('play sport chips', () {
    final bb = sport('s1', 'basketball'), fb = sport('s2', 'football');

    test('admin: All (no filter) or the picked sport', () {
      expect(playSportSlugs(isAdmin: true, mySports: [bb]), [null]);
      expect(playSportSlugs(isAdmin: true, adminSport: 'football', mySports: [bb]), ['football']);
    });

    test('member: all of their sports by default, toggled off by chips', () {
      expect(playSportSlugs(isAdmin: false, mySports: [bb, fb]), ['basketball', 'football']);
      expect(playSportSlugs(isAdmin: false, mySports: [bb, fb], off: {'football'}), ['basketball']);
      expect(playSportSlugs(isAdmin: false, mySports: const []), [null]);
    });

    test('the last sport left on cannot be switched off', () {
      final off = togglePlaySport(const {}, 'football', [bb, fb]);
      expect(off, {'football'});
      expect(togglePlaySport(off, 'basketball', [bb, fb]), same(off));
      expect(togglePlaySport(off, 'football', [bb, fb]), isEmpty);
    });
  });

  group('map search', () {
    test('courts match by name (2+ chars, max 6)', () {
      final courts = [for (var i = 0; i < 8; i++) courtNamed('c$i', 'Terrain $i'), courtNamed('x', 'Plage')];
      expect(searchCourtsByName(courts, 'p'), isEmpty);
      expect(searchCourtsByName(courts, 'plA').map((c) => c.id), ['x']);
      expect(searchCourtsByName(courts, 'terrain').length, 6);
    });

    test('parses Mapbox places and ranks nearest first', () {
      final places = parseGeocodePlaces({
        'features': [
          {'id': 'far', 'place_name': 'Abidjan', 'center': [-4.0083, 5.3600]},
          {'id': 'near', 'place_name': 'Grand-Bassam', 'center': [-3.7389, 5.2118]},
          {'id': 'bad', 'center': [0, 0]},
        ],
      });
      expect(places.map((p) => p.id), ['far', 'near']);
      expect(places.last.at, const LatLng(5.2118, -3.7389));
      expect(rankPlaces(places, court).map((p) => p.id), ['near', 'far']);
    });

    testWidgets('typing shows court hits; picking one reports it', (t) async {
      Court? picked;
      await t.pumpWidget(MaterialApp(
        home: Scaffold(
          body: MapSearchBar(
            courts: [courtNamed('c1', 'Terrain IUGB')],
            onSelectCourt: (c) => picked = c,
            onSelectPlace: (_) {},
          ),
        ),
      ));
      await t.enterText(find.byType(TextField), 'iugb');
      await t.pump(const Duration(milliseconds: 400));
      expect(find.text('Court on map'), findsOneWidget);
      await t.tap(find.text('Terrain IUGB').last);
      await t.pump();
      expect(picked?.id, 'c1');
    });
  });
}
