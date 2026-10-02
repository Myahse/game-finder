import 'package:find_the_game/core/format.dart';
import 'package:find_the_game/core/models.dart';
import 'package:find_the_game/ui/court_map_pin.dart';
import 'package:find_the_game/ui/widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> gameJson(String id, {double distance = 1000, int players = 4, int max = 10, String status = 'active'}) => {
      'id': id,
      'court_id': 'c1',
      'sport_id': 's1',
      'creator_id': 'u1',
      'start_time': '2026-10-01T18:20:00Z',
      'duration_minutes': 120,
      'max_players': max,
      'skill_level': 'intermediate',
      'game_type': 'pickup',
      'status': status,
      'player_count': players,
      'spots_left': max - players,
      'joined': false,
      'court': {'id': 'c1', 'name': 'Terrain IUGB', 'latitude': 5.2133, 'longitude': -3.7389},
      'sport': {'id': 's1', 'name': 'Basketball', 'slug': 'basketball', 'icon': '🏀', 'active': true},
      'distance_m': distance,
    };

Court court({String activity = 'active', int players = 8}) => Court.fromJson({
      'id': 'c1',
      'name': 'Terrain IUGB',
      'latitude': 5.2133,
      'longitude': -3.7389,
      'photos': <String>[],
      'sports': [
        {'id': 's1', 'name': 'Basketball', 'slug': 'basketball', 'icon': '🏀', 'active': true},
      ],
      'player_count': players,
      'active_game_count': activity == 'active' ? 1 : 0,
      'activity': activity,
      'last_activity_at': null,
      'distance_m': 1200,
    });

void main() {
  group('format', () {
    test('distance', () {
      expect(formatDistance(1234), '1.2 km');
      expect(formatDistance(430), '430 m');
      expect(formatDistance(15400), '15 km');
      expect(formatDistance(null), '');
    });

    test('timeAgo', () {
      final now = DateTime.utc(2026, 10, 1, 18, 22);
      expect(timeAgo(DateTime.utc(2026, 10, 1, 18, 20), now), '2 minutes ago');
      expect(timeAgo(DateTime.utc(2026, 10, 1, 18, 21, 50), now), 'just now');
      expect(timeAgo(null, now), 'No recent activity');
    });
  });

  group('sortPlayable', () {
    test('distance, then activity, then spots', () {
      final games = [
        Game.fromJson(gameJson('far', distance: 2100, players: 6)),
        Game.fromJson(gameJson('near-small', distance: 1200, players: 2)),
        Game.fromJson(gameJson('near-big', distance: 1210, players: 8)),
        Game.fromJson(gameJson('near-scheduled', distance: 1100, players: 9, status: 'scheduled')),
        Game.fromJson(gameJson('done', distance: 10, status: 'completed')),
      ];
      expect(sortPlayable(games).map((g) => g.id), ['near-big', 'near-small', 'near-scheduled', 'far']);
    });
  });

  group('models', () {
    test('court applies realtime stats', () {
      final c = court(activity: 'inactive', players: 0);
      c.applyStats({'player_count': 3, 'active_game_count': 0, 'activity': 'players', 'last_activity_at': '2026-10-01T18:22:00Z'});
      expect(c.activity, Activity.players);
      expect(c.playerCount, 3);
      expect(c.lastActivityAt, isNotNull);
    });
  });

  group('widgets', () {
    Widget wrap(Widget w) => MaterialApp(home: Scaffold(body: Center(child: w)));

    testWidgets('active pin shows sport and player count', (t) async {
      await t.pumpWidget(wrap(CourtPin(court: court(), onTap: () {})));
      expect(find.byIcon(Icons.sports_basketball), findsOneWidget);
      expect(find.text('8'), findsOneWidget);
    });

    testWidgets('players-present pin shows groups icon and count', (t) async {
      await t.pumpWidget(wrap(CourtPin(court: court(activity: 'players', players: 4), onTap: () {})));
      expect(find.byIcon(Icons.groups), findsOneWidget);
      expect(find.text('4'), findsOneWidget);
    });

    testWidgets('inactive pin shows only the sport', (t) async {
      await t.pumpWidget(wrap(CourtPin(court: court(activity: 'inactive', players: 0), onTap: () {})));
      expect(find.byIcon(Icons.sports_basketball), findsOneWidget);
      expect(find.text('0'), findsNothing);
    });

    testWidgets('status pill labels', (t) async {
      await t.pumpWidget(wrap(const StatusPill(Activity.active)));
      expect(find.text('GAME ACTIVE'), findsOneWidget);
    });

    testWidgets('game card shows count, distance and spots', (t) async {
      await t.pumpWidget(wrap(GameCard(game: Game.fromJson(gameJson('g', players: 8)), onTap: () {})));
      expect(find.text('8/10'), findsOneWidget);
      expect(find.text('1.0 km'), findsOneWidget);
      expect(find.text('2 spots'), findsOneWidget);
    });
  });
}
