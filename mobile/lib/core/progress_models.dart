// Models for challenges (défis) and player progression, mirroring the API.

import 'models.dart';

DateTime? _date(dynamic v) => v == null ? null : DateTime.parse(v as String).toLocal();
int _int(dynamic v) => (v as num?)?.toInt() ?? 0;

class CourtRef {
  final String id, name;
  CourtRef.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        name = j['name'] ?? '';
}

class ChallengePlayer {
  final PublicUser user;
  final String side, status; // side: challenger|opponent · status: invited|accepted
  ChallengePlayer.fromJson(Map<String, dynamic> j)
      : user = PublicUser.fromJson(Map<String, dynamic>.from(j['user'])),
        side = j['side'],
        status = j['status'];
}

class Challenge {
  final String id, format, status;
  final List<ChallengePlayer> players;
  final String? mySide, myStatus;
  final Sport sport;
  final int teamSize;
  final PublicUser challenger;
  final PublicUser? opponent;
  final CourtRef court;
  final DateTime startTime, createdAt;
  final String? message, gameId, winnerId, scoreChallenger, scoreOpponent, reportedBy;
  final bool isOpen;

  Challenge.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        format = j['format'],
        status = j['status'],
        sport = Sport.fromJson(Map<String, dynamic>.from(j['sport'])),
        teamSize = _int(j['team_size']),
        challenger = PublicUser.fromJson(Map<String, dynamic>.from(j['challenger'])),
        opponent = j['opponent'] is Map ? PublicUser.fromJson(Map<String, dynamic>.from(j['opponent'])) : null,
        court = CourtRef.fromJson(Map<String, dynamic>.from(j['court'])),
        startTime = _date(j['start_time'])!,
        createdAt = _date(j['created_at']) ?? DateTime.now(),
        message = j['message'],
        gameId = j['game_id'],
        winnerId = j['winner_id'],
        scoreChallenger = j['score_challenger'],
        scoreOpponent = j['score_opponent'],
        reportedBy = j['reported_by'],
        isOpen = j['is_open'] ?? false,
        players = [for (final p in (j['players'] ?? const [])) ChallengePlayer.fromJson(Map<String, dynamic>.from(p))],
        mySide = j['my_side'],
        myStatus = j['my_status'];

  int acceptedOn(String side) => players.where((p) => p.side == side && p.status == 'accepted').length;
}

class ChallengeList {
  final List<Challenge> incoming, outgoing, active, history;
  final int wins, losses;

  ChallengeList.fromJson(Map<String, dynamic> j)
      : incoming = _list(j['incoming']),
        outgoing = _list(j['outgoing']),
        active = _list(j['active']),
        history = _list(j['history']),
        wins = _int(j['record']?['wins']),
        losses = _int(j['record']?['losses']);

  static List<Challenge> _list(dynamic v) => [for (final c in (v ?? const [])) Challenge.fromJson(Map<String, dynamic>.from(c))];

  bool get isEmpty => incoming.isEmpty && outgoing.isEmpty && active.isEmpty && history.isEmpty;
}

class PlayerBadge {
  final String id;
  final int goal, have;
  final DateTime? earnedAt;
  PlayerBadge.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        goal = _int(j['goal']),
        have = _int(j['have']),
        earnedAt = _date(j['earned_at']);
  bool get earned => earnedAt != null;
  bool get isNew => earnedAt != null && DateTime.now().difference(earnedAt!).inDays < 3;
}

class SportRating {
  final Sport sport;
  final int rating, games;
  SportRating.fromJson(Map<String, dynamic> j)
      : sport = Sport.fromJson(Map<String, dynamic>.from(j['sport'])),
        rating = _int(j['rating']),
        games = _int(j['games']);
}

class Progress {
  final int xp, level, levelXp, nextLevelXp;
  final int streakCurrent, streakBest;
  final bool streakActiveThisWeek;
  final List<SportRating> ratings;
  final List<PlayerBadge> badges;
  final List<CourtRef> crowns;
  final List<String> newBadges;

  Progress.fromJson(Map<String, dynamic> j)
      : xp = _int(j['xp']),
        level = _int(j['level']),
        levelXp = _int(j['level_xp']),
        nextLevelXp = _int(j['next_level_xp']),
        streakCurrent = _int(j['streak']?['current']),
        streakBest = _int(j['streak']?['best']),
        streakActiveThisWeek = j['streak']?['active_this_week'] == true,
        ratings = [for (final r in (j['ratings'] ?? const [])) SportRating.fromJson(Map<String, dynamic>.from(r))],
        badges = [for (final b in (j['badges'] ?? const [])) PlayerBadge.fromJson(Map<String, dynamic>.from(b))],
        crowns = [
          for (final c in (j['crowns'] ?? const []))
            CourtRef.fromJson({'id': c['court_id'], 'name': c['court_name']})
        ],
        newBadges = [for (final b in (j['new_badges'] ?? const [])) b as String];

  double get levelProgress {
    final span = nextLevelXp - levelXp;
    if (span <= 0) return 0;
    return ((xp - levelXp) / span).clamp(0, 1).toDouble();
  }
}
