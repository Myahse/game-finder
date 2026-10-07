// Game scoreboard (teams, score, player stats, MVP) and court leaderboard, mirroring the API.

import 'dart:math';

import 'package:flutter/painting.dart' show Color;

import 'l10n.dart';
import 'models.dart';

int _int(dynamic v) => (v as num?)?.toInt() ?? 0;

/// Team colours offered in the editor (same as web).
const teamColorHexes = ['#ff5a1f', '#1f6fff', '#16a34a', '#eab308', '#9333ea', '#12151a', '#e11d48', '#0891b2'];

/// `#rrggbb` → [Color]; falls back to the brand orange.
Color hexColor(String hex) {
  final h = hex.replaceFirst('#', '');
  final v = int.tryParse(h, radix: 16);
  if (h.length != 6 || v == null) return const Color(0xFFFF5A1F);
  return Color(0xFF000000 | v);
}

class ScoreTeam {
  final String? id;
  final int? position;
  String name, color;
  int score;
  List<String> players;

  ScoreTeam({this.id, this.position, required this.name, required this.color, this.score = 0, List<String>? players})
      : players = players ?? [];

  ScoreTeam.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String?,
        position = (j['position'] as num?)?.toInt(),
        name = j['name'] as String? ?? '',
        color = j['color'] as String? ?? teamColorHexes.first,
        score = _int(j['score']),
        players = [for (final p in (j['players'] ?? const [])) p as String];

  ScoreTeam copy() => ScoreTeam(id: id, position: position, name: name, color: color, score: score, players: [...players]);
}

class Scoreboard {
  final String gameId;
  final List<String> statKeys;
  final List<ScoreTeam> teams;
  /// user id → stat key → value.
  final Map<String, Map<String, int>> stats;
  final Map<String, int> ratings;
  final int? winnerPosition;
  final String? mvpUserId;
  final DateTime? updatedAt;
  final PublicUser? updatedBy;

  Scoreboard.fromJson(Map<String, dynamic> j)
      : gameId = j['game_id'] as String? ?? '',
        statKeys = [for (final k in (j['stat_keys'] ?? const [])) k as String],
        teams = [for (final t in (j['teams'] ?? const [])) ScoreTeam.fromJson(Map<String, dynamic>.from(t))],
        stats = {
          for (final e in ((j['stats'] as Map?) ?? const {}).entries)
            e.key as String: {for (final s in (e.value as Map).entries) s.key as String: _int(s.value)}
        },
        ratings = {for (final e in ((j['ratings'] as Map?) ?? const {}).entries) e.key as String: _int(e.value)},
        winnerPosition = (j['winner_position'] as num?)?.toInt(),
        mvpUserId = j['mvp_user_id'] as String?,
        updatedAt = j['updated_at'] == null ? null : DateTime.tryParse(j['updated_at'] as String)?.toLocal(),
        updatedBy = j['updated_by'] is Map ? PublicUser.fromJson(Map<String, dynamic>.from(j['updated_by'])) : null;

  /// Headline stat (points / goals …), or null when the sport has none.
  String? get mainKey => statKeys.firstOrNull;

  bool get isEmpty => teams.isEmpty && stats.isEmpty && mvpUserId == null;

  /// Something worth sharing: a score, a stat or an MVP.
  bool get hasResult => teams.any((t) => t.score > 0) || stats.isNotEmpty || mvpUserId != null;

  bool get anyScore => teams.any((t) => t.score > 0);

  /// Players sorted by the headline stat, best first (only those above zero).
  List<({String userId, int value})> topPerformers([int limit = 3]) {
    final key = mainKey;
    final list = [
      for (final e in stats.entries) (userId: e.key, value: key == null ? 0 : (e.value[key] ?? 0)),
    ].where((p) => p.value > 0).toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    return list.take(limit).toList();
  }

  /// Top players for the result card: the MVP always makes the cut.
  List<({String userId, int value, bool mvp})> resultPlayers([int limit = 3]) {
    final top = topPerformers(limit);
    final mvp = mvpUserId;
    if (mvp != null && !top.any((p) => p.userId == mvp)) {
      top.insert(0, (userId: mvp, value: mainKey == null ? 0 : (stats[mvp]?[mainKey] ?? 0)));
    }
    return [for (final p in top.take(limit)) (userId: p.userId, value: p.value, mvp: p.userId == mvp)];
  }

  /// Team the result card calls the winner (null for a draw / no score).
  ScoreTeam? get winner {
    final w = winnerPosition;
    if (w == null) return null;
    for (var i = 0; i < teams.length; i++) {
      if ((teams[i].position ?? i) == w) return teams[i];
    }
    return null;
  }
}

/// Body for PUT /api/games/{id}/scoreboard. Before the game starts only teams are sent.
Map<String, dynamic> scoreboardInput({
  required List<ScoreTeam> teams,
  required Map<String, Map<String, int>> stats,
  required String? mvpUserId,
  required List<String> playerIds,
  required bool started,
}) {
  final cleanStats = <String, Map<String, int>>{};
  if (started) {
    for (final e in stats.entries) {
      if (!playerIds.contains(e.key)) continue;
      final s = {for (final kv in e.value.entries) if (kv.value > 0) kv.key: kv.value};
      if (s.isNotEmpty) cleanStats[e.key] = s;
    }
  }
  return {
    'teams': [
      for (final t in teams)
        {
          'name': t.name.trim().isEmpty ? tr('Team', 'Équipe') : t.name.trim(),
          'color': t.color,
          'score': started ? t.score : 0,
          'players': t.players,
        }
    ],
    'stats': cleanStats,
    'mvp_user_id': started ? mvpUserId : null,
  };
}

/// Scores and stats open 15 minutes before the start (server rule).
bool scoreboardStarted(DateTime start, [DateTime? now]) =>
    !start.isAfter((now ?? DateTime.now()).add(const Duration(minutes: 15)));

/// Split players into [n] teams of similar strength (rating ≈ 1000 when unknown).
List<List<String>> balancedTeams(List<String> players, Map<String, int> ratings, int n, [Random? random]) {
  final rnd = random ?? Random();
  final noisy = [for (final id in players) (id: id, r: (ratings[id] ?? 1000) + (rnd.nextDouble() - 0.5) * 60)]
    ..sort((a, b) => b.r.compareTo(a.r));
  final ids = List.generate(n, (_) => <String>[]);
  final totals = List.filled(n, 0);
  for (final p in noisy) {
    var best = 0;
    for (var i = 1; i < n; i++) {
      if (ids[i].length < ids[best].length || (ids[i].length == ids[best].length && totals[i] < totals[best])) best = i;
    }
    ids[best].add(p.id);
    totals[best] += ratings[p.id] ?? 1000;
  }
  return ids;
}

String defaultTeamName(int i) => switch (i) {
      0 => tr('Team A', 'Équipe A'),
      1 => tr('Team B', 'Équipe B'),
      2 => tr('Team C', 'Équipe C'),
      _ => tr('Team D', 'Équipe D'),
    };

/// Short column label for a stat key (PTS, REB…).
String statLabel(String key) => switch (key) {
      'points' => 'PTS',
      'rebounds' => 'REB',
      'assists' => tr('AST', 'PD'),
      'steals' => tr('STL', 'INT'),
      'blocks' => tr('BLK', 'CTR'),
      'turnovers' => tr('TO', 'BP'),
      'goals' => tr('Goals', 'Buts'),
      'saves' => tr('Saves', 'Arrêts'),
      'tackles' => tr('Tackles', 'Tacles'),
      'aces' => 'Aces',
      'digs' => tr('Digs', 'Défenses'),
      'winners' => tr('Winners', 'Coups gagnants'),
      'errors' => tr('Errors', 'Fautes'),
      'smashes' => tr('Smashes', 'Smashs'),
      _ => key,
    };

/// Full stat name for the editor.
String statName(String key) => switch (key) {
      'points' => 'Points',
      'rebounds' => tr('Rebounds', 'Rebonds'),
      'assists' => tr('Assists', 'Passes décisives'),
      'steals' => tr('Steals', 'Interceptions'),
      'blocks' => tr('Blocks', 'Contres'),
      'turnovers' => tr('Turnovers', 'Balles perdues'),
      _ => statLabel(key),
    };

class LeaderboardRow {
  final int rank, games, wins, points, mvps, score;
  final PublicUser user;
  LeaderboardRow.fromJson(Map<String, dynamic> j)
      : rank = _int(j['rank']),
        games = _int(j['games']),
        wins = _int(j['wins']),
        points = _int(j['points']),
        mvps = _int(j['mvps']),
        score = _int(j['score']),
        user = PublicUser.fromJson(Map<String, dynamic>.from(j['user']));
}

class Leaderboard {
  final List<LeaderboardRow> players;
  final LeaderboardRow? me;
  Leaderboard.fromJson(Map<String, dynamic> j)
      : players = [for (final r in (j['players'] ?? const [])) LeaderboardRow.fromJson(Map<String, dynamic>.from(r))],
        me = j['me'] is Map ? LeaderboardRow.fromJson(Map<String, dynamic>.from(j['me'])) : null;

  /// My row when I'm ranked but outside the top list (shown after "⋯").
  LeaderboardRow? get meOutside {
    final m = me;
    if (m == null || players.any((r) => r.user.id == m.user.id)) return null;
    return m;
  }
}
