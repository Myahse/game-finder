import 'dart:math';

import 'package:find_the_game/core/api.dart';
import 'package:find_the_game/core/models.dart';
import 'package:find_the_game/core/scoreboard_models.dart';
import 'package:find_the_game/core/weather.dart';
import 'package:find_the_game/screens/game_result_share.dart';
import 'package:find_the_game/screens/game_scoreboard.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

class FakeApi extends Api {
  final Map<String, dynamic> scoreboard;
  Object? lastPut;
  FakeApi(this.scoreboard);
  @override
  Future<dynamic> get(String path) async => scoreboard;
  @override
  Future<dynamic> put(String path, Object body) async {
    lastPut = body;
    return scoreboard;
  }
}

Map<String, dynamic> user(String id, String username) =>
    {'id': id, 'username': username, 'first_name': username, 'last_name': '', 'created_at': '2026-01-01T00:00:00Z'};

Map<String, dynamic> scoreboardJson({int? winner = 0, String? mvp = 'u3'}) => {
      'game_id': 'g1',
      'stat_keys': ['points', 'rebounds', 'assists'],
      'teams': [
        {'id': 't1', 'position': 0, 'name': 'Team A', 'color': '#ff5a1f', 'score': 21, 'players': ['u1', 'u2']},
        {'id': 't2', 'position': 1, 'name': 'Team B', 'color': '#1f6fff', 'score': 17, 'players': ['u3', 'u4']},
      ],
      'stats': {
        'u1': {'points': 9, 'rebounds': 2},
        'u2': {'points': 12},
        'u4': {'assists': 3},
      },
      'ratings': {'u1': 1100, 'u2': 980},
      'winner_position': winner,
      'mvp_user_id': mvp,
      'updated_at': '2026-10-06T19:00:00Z',
      'updated_by': user('u1', 'kofi'),
    };

Game game() => Game.fromJson({
      'id': 'g1234567890',
      'court_id': 'c1',
      'sport_id': 's1',
      'creator_id': 'u1',
      'start_time': '2026-10-06T18:00:00Z',
      'duration_minutes': 90,
      'max_players': 10,
      'skill_level': 'all_levels',
      'game_type': 'pickup',
      'status': 'completed',
      'player_count': 4,
      'spots_left': 6,
      'joined': true,
      'court': {'id': 'c1', 'name': 'Terrain IUGB de Grand-Bassam', 'latitude': 5.2, 'longitude': -3.7},
      'sport': {'id': 's1', 'name': 'Basketball', 'slug': 'basketball', 'icon': '🏀', 'active': true},
      'players': [user('u1', 'kofi'), user('u2', 'ama'), user('u3', 'yao'), user('u4', 'awa')],
    });

void main() {
  group('scoreboard', () {
    test('parses and computes result helpers', () {
      final sb = Scoreboard.fromJson(scoreboardJson());
      expect(sb.teams.length, 2);
      expect(sb.teams.first.players, ['u1', 'u2']);
      expect(sb.stats['u1']!['points'], 9);
      expect(sb.ratings['u1'], 1100);
      expect(sb.updatedBy!.username, 'kofi');
      expect(sb.mainKey, 'points');
      expect(sb.isEmpty, isFalse);
      expect(sb.hasResult, isTrue);
      expect(sb.winner!.name, 'Team A');
      expect([for (final p in sb.topPerformers()) p.userId], ['u2', 'u1']);
      // MVP without stats still makes the card, first.
      final card = sb.resultPlayers();
      expect(card.first.userId, 'u3');
      expect(card.first.mvp, isTrue);
      expect(card.length, 3);
    });

    test('empty scoreboard and draw', () {
      final empty = Scoreboard.fromJson({'game_id': 'g', 'stat_keys': ['goals'], 'teams': [], 'stats': {}, 'winner_position': null, 'mvp_user_id': null});
      expect(empty.isEmpty, isTrue);
      expect(empty.hasResult, isFalse);
      final draw = Scoreboard.fromJson(scoreboardJson(winner: null, mvp: null));
      expect(draw.winner, isNull);
    });

    test('input drops scores and stats before the game starts', () {
      final sb = Scoreboard.fromJson(scoreboardJson());
      final before = scoreboardInput(teams: sb.teams, stats: sb.stats, mvpUserId: 'u1', playerIds: ['u1', 'u2', 'u3', 'u4'], started: false);
      expect((before['teams'] as List).first['score'], 0);
      expect(before['stats'], isEmpty);
      expect(before['mvp_user_id'], isNull);
      final after = scoreboardInput(
        teams: [ScoreTeam(name: '  ', color: '#16a34a', score: 5, players: ['u1'])],
        stats: {
          'u1': {'points': 4, 'rebounds': 0},
          'u2': {'points': 0},
          'gone': {'points': 3},
        },
        mvpUserId: 'u1',
        playerIds: ['u1', 'u2'],
        started: true,
      );
      expect((after['teams'] as List).single['name'], 'Team');
      expect((after['teams'] as List).single['score'], 5);
      expect(after['stats'], {
        'u1': {'points': 4}
      });
      expect(after['mvp_user_id'], 'u1');
    });

    test('scores open 15 minutes before the start', () {
      final now = DateTime(2026, 10, 6, 18);
      expect(scoreboardStarted(DateTime(2026, 10, 6, 18, 14), now), isTrue);
      expect(scoreboardStarted(DateTime(2026, 10, 6, 18, 16), now), isFalse);
    });

    test('balanced teams split everyone evenly', () {
      final ids = ['a', 'b', 'c', 'd', 'e'];
      final teams = balancedTeams(ids, {'a': 1400, 'b': 1300}, 2, Random(1));
      expect(teams.length, 2);
      expect(teams.expand((t) => t).toSet(), ids.toSet());
      expect((teams[0].length - teams[1].length).abs(), lessThanOrEqualTo(1));
      // The two strongest players end up apart.
      expect(teams.any((t) => t.contains('a') && t.contains('b')), isFalse);
    });

    test('hex colours', () {
      expect(hexColor('#1f6fff'), const Color(0xFF1F6FFF));
      expect(hexColor('nope'), const Color(0xFFFF5A1F));
    });

    test('leaderboard parses and finds me outside the top', () {
      Map<String, dynamic> row(int rank, String id) =>
          {'rank': rank, 'user': user(id, id), 'games': 4, 'wins': 2, 'points': 30, 'mvps': 1, 'score': 12};
      final l = Leaderboard.fromJson({
        'players': [row(1, 'u1'), row(2, 'u2')],
        'me': row(25, 'me'),
      });
      expect(l.players.first.wins, 2);
      expect(l.meOutside!.rank, 25);
      final inTop = Leaderboard.fromJson({'players': [row(1, 'u1')], 'me': row(1, 'u1')});
      expect(inTop.meOutside, isNull);
      expect(Leaderboard.fromJson({'players': [], 'me': null}).players, isEmpty);
    });
  });

  group('weather', () {
    // 2026-10-07 12:00 UTC
    const t0 = 1791374400;
    Forecast forecast(List<int> rain) => Forecast.fromJson({
          'hours': [
            for (var i = 0; i < rain.length; i++)
              {'t': t0 + i * 3600, 'temp': 27.4, 'rain_pct': rain[i], 'precip_mm': 0, 'code': rain[i] >= 50 ? 61 : 1, 'wind_kmh': 12}
          ]
        });
    DateTime at(int hour, [int minute = 0]) => DateTime.fromMillisecondsSinceEpoch((t0 + hour * 3600 + minute * 60) * 1000);

    test('weather codes', () {
      expect(weatherKind(0), WeatherKind.clear);
      expect(weatherKind(2), WeatherKind.partly);
      expect(weatherKind(45), WeatherKind.fog);
      expect(weatherKind(53), WeatherKind.drizzle);
      expect(weatherKind(63), WeatherKind.rain);
      expect(weatherKind(81), WeatherKind.showers);
      expect(weatherKind(95), WeatherKind.storm);
    });

    test('game window hours, rain check and drier slot', () {
      final f = forecast([0, 10, 80, 70, 10, 5, 0, 0, 0, 0]);
      expect(f.hours.first.temp, 27.4);
      // 14:30 for 90 min → hours 14:00 and 15:00.
      final w = hoursFor(f, at(2, 30), 90);
      expect(w.map((h) => h.t), [t0 + 2 * 3600, t0 + 3 * 3600]);
      expect(worstRain(w), 80);
      expect(isRainy(w), isTrue);
      expect(isRainy(hoursFor(f, at(5), 60)), isFalse);
      // Storm or heavy precipitation counts even with a low chance.
      expect(isRainy([const WeatherHour(t: 0, code: 95)]), isTrue);
      expect(isRainy([const WeatherHour(t: 0, precipMm: 1.2)]), isTrue);

      final slot = drierSlot(f, at(2, 30), 90, at(0));
      expect(slot, isNotNull);
      expect(slot!.at, at(4));
      expect(slot.rain, lessThan(30));
      // Rain all day: no drier slot.
      expect(drierSlot(forecast([0, 90, 90, 90, 90, 90, 90, 90, 90, 90]), at(2), 60, at(0)), isNull);
    });

    test('courts rain parses', () {
      final r = parseCourtsRain({
        'c1': {'rain_pct': 70, 'at': t0, 'now': false},
        'c2': {'rain_pct': 90, 'at': t0, 'now': true},
      });
      expect(r['c1']!.rainPct, 70);
      expect(r['c2']!.now, isTrue);
      expect(parseCourtsRain(null), isEmpty);
    });

    test('rain cache: one request per 15 minutes, failures ignored', () async {
      final cache = CourtRainCache.forTest();
      final calls = <String>[];
      Future<dynamic> get(String path) async {
        calls.add(path);
        return {
          'b': {'rain_pct': 60, 'at': t0, 'now': false}
        };
      }

      final now = DateTime(2026, 10, 7, 12);
      final r1 = await cache.lookup(['b', 'a', 'b'], get, now: now);
      expect(r1.keys, ['b']);
      expect(calls, ['/api/courts/rain?ids=a,b']);
      await cache.lookup(['a', 'b'], get, now: now.add(const Duration(minutes: 10)));
      expect(calls.length, 1);
      // A new court only asks for that one.
      await cache.lookup(['a', 'b', 'c'], get, now: now.add(const Duration(minutes: 11)));
      expect(calls.last, '/api/courts/rain?ids=c');
      // Expired → refetched.
      await cache.lookup(['a'], get, now: now.add(const Duration(minutes: 16)));
      expect(calls.last, '/api/courts/rain?ids=a');

      final failing = CourtRainCache.forTest();
      var n = 0;
      Future<dynamic> boom(String _) async {
        n++;
        throw Exception('offline');
      }

      expect(await failing.lookup(['x'], boom, now: now), isEmpty);
      expect(await failing.lookup(['x'], boom, now: now.add(const Duration(minutes: 1))), isEmpty);
      expect(n, 1);
      await failing.lookup(['x'], boom, now: now.add(const Duration(minutes: 3)));
      expect(n, 2);
    });
  });

  testWidgets('result card lays out without overflow', (tester) async {
    for (final sb in [
      Scoreboard.fromJson(scoreboardJson()),
      Scoreboard.fromJson(scoreboardJson(winner: null)),
      Scoreboard.fromJson({
        ...scoreboardJson(),
        'teams': [
          for (var i = 0; i < 4; i++) {'position': i, 'name': 'Team $i', 'color': '#16a34a', 'score': 10 - i, 'players': []}
        ],
      }),
    ]) {
      await tester.pumpWidget(MaterialApp(
        home: Center(child: GameResultCard(game: game(), sb: sb, url: 'https://example.com/g/abc')),
      ));
      expect(tester.takeException(), isNull);
      expect(find.text('TERRAIN IUGB DE GRAND-BASSAM'), findsOneWidget);
      expect(find.textContaining('MVP'), findsWidgets);
    }
  });

  testWidgets('scoreboard shows teams and stats, editor opens and saves', (tester) async {
    tester.view.physicalSize = const Size(360 * 3, 2400 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final api = FakeApi(scoreboardJson());
    await tester.pumpWidget(ChangeNotifierProvider<Api>.value(
      value: api,
      child: MaterialApp(
        home: Scaffold(body: ListView(padding: const EdgeInsets.all(16), children: [GameScoreboard(game: game(), canEdit: true)])),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Team A'), findsOneWidget);
    expect(find.text('21'), findsOneWidget);
    expect(find.text('@ama'), findsOneWidget);
    expect(find.text('MVP'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.tap(find.text('EDIT'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text('SAVE'), findsOneWidget);
    await tester.tap(find.text('SAVE'));
    await tester.pumpAndSettle();
    final body = api.lastPut as Map<String, dynamic>;
    expect((body['teams'] as List).length, 2);
    expect(find.text('EDIT'), findsOneWidget);
  });
}
