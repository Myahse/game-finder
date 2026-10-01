// Data models mirroring the Go API's JSON.

DateTime? _date(dynamic v) => v == null ? null : DateTime.parse(v as String).toLocal();
double? _num(dynamic v) => v == null ? null : (v as num).toDouble();

enum Activity { inactive, players, active }

Activity activityFrom(String? s) => switch (s) {
      'active' => Activity.active,
      'players' => Activity.players,
      _ => Activity.inactive,
    };

class Sport {
  final String id, name, slug, icon;
  final bool active;
  Sport.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        name = j['name'],
        slug = j['slug'],
        icon = j['icon'],
        active = j['active'] ?? false;
}

class PublicUser {
  final String id, firstName, lastName, username;
  final String? avatarUrl, preferredSportId, skillLevel;
  final DateTime createdAt;
  final int gamesPlayed, gamesCreated;

  PublicUser.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        firstName = j['first_name'] ?? '',
        lastName = j['last_name'] ?? '',
        username = j['username'] ?? '',
        avatarUrl = j['avatar_url'],
        preferredSportId = j['preferred_sport_id'],
        skillLevel = j['skill_level'],
        createdAt = _date(j['created_at']) ?? DateTime.now(),
        gamesPlayed = (j['stats']?['games_played'] as num?)?.toInt() ?? 0,
        gamesCreated = (j['stats']?['games_created'] as num?)?.toInt() ?? 0;

  String get fullName => '$firstName $lastName'.trim();
  String get initials => '${firstName.isNotEmpty ? firstName[0] : ''}${lastName.isNotEmpty ? lastName[0] : ''}'.toUpperCase();
}

class Me extends PublicUser {
  final String email, role;
  final bool onboarded;
  Me.fromJson(super.j)
      : email = j['email'] ?? '',
        role = j['role'] ?? 'user',
        onboarded = j['onboarded'] ?? false,
        super.fromJson();
  bool get isAdmin => role == 'admin';
}

class Court {
  final String id, name;
  final double latitude, longitude;
  final String? address, description, openingHours, surface, status;
  final bool? lighting;
  final List<String> photos;
  final List<Sport> sports;
  int playerCount, activeGameCount;
  Activity activity;
  DateTime? lastActivityAt;
  final double? distanceM;

  Court.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        name = j['name'],
        latitude = _num(j['latitude'])!,
        longitude = _num(j['longitude'])!,
        address = j['address'],
        description = j['description'],
        openingHours = j['opening_hours'],
        surface = j['surface'],
        status = j['status'],
        lighting = j['lighting'],
        photos = List<String>.from(j['photos'] ?? const []),
        sports = [for (final s in (j['sports'] ?? const [])) Sport.fromJson(s)],
        playerCount = (j['player_count'] as num?)?.toInt() ?? 0,
        activeGameCount = (j['active_game_count'] as num?)?.toInt() ?? 0,
        activity = activityFrom(j['activity']),
        lastActivityAt = _date(j['last_activity_at']),
        distanceM = _num(j['distance_m']);

  /// Apply a realtime `court_stats` event.
  void applyStats(Map<String, dynamic> ev) {
    playerCount = (ev['player_count'] as num?)?.toInt() ?? playerCount;
    activeGameCount = (ev['active_game_count'] as num?)?.toInt() ?? activeGameCount;
    activity = activityFrom(ev['activity']);
    lastActivityAt = _date(ev['last_activity_at']) ?? lastActivityAt;
  }
}

class CourtDetail extends Court {
  final List<Game> games;
  final DateTime? myPresenceSince;
  CourtDetail.fromJson(super.j)
      : games = [for (final g in (j['games'] ?? const [])) Game.fromJson(g)],
        myPresenceSince = _date(j['my_presence']?['started_at']),
        super.fromJson();
}

class Game {
  final String id, courtId, sportId, skillLevel, gameType, status;
  final String? creatorId, cancelledReason;
  final DateTime startTime;
  final int durationMinutes, maxPlayers, playerCount, spotsLeft;
  final bool joined;
  final String courtName;
  final double courtLat, courtLng;
  final Sport sport;
  final double? distanceM;
  final List<PublicUser> players;

  Game.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        courtId = j['court_id'],
        sportId = j['sport_id'],
        skillLevel = j['skill_level'],
        gameType = j['game_type'],
        status = j['status'],
        creatorId = j['creator_id'],
        cancelledReason = j['cancelled_reason'],
        startTime = _date(j['start_time'])!,
        durationMinutes = (j['duration_minutes'] as num).toInt(),
        maxPlayers = (j['max_players'] as num).toInt(),
        playerCount = (j['player_count'] as num).toInt(),
        spotsLeft = (j['spots_left'] as num).toInt(),
        joined = j['joined'] ?? false,
        courtName = j['court']['name'],
        courtLat = _num(j['court']['latitude'])!,
        courtLng = _num(j['court']['longitude'])!,
        sport = Sport.fromJson(j['sport']),
        distanceM = _num(j['distance_m']),
        players = [for (final p in (j['players'] ?? const [])) PublicUser.fromJson(p)];

  bool get isLive => status == 'active';
  bool get isOpen => status == 'active' || status == 'scheduled';
}

class Presence {
  final String id, courtId, courtName;
  final DateTime startedAt, expiresAt;
  final int warningMinutes;
  Presence.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        courtId = j['court_id'],
        courtName = j['court']?['name'] ?? '',
        startedAt = _date(j['started_at'])!,
        expiresAt = _date(j['expires_at'])!,
        warningMinutes = (j['warning_minutes'] as num?)?.toInt() ?? 5;
}

class AppNotification {
  final String id, type, title, body;
  final Map<String, dynamic> data;
  final bool read;
  final DateTime createdAt;
  AppNotification.fromJson(Map<String, dynamic> j)
      : id = j['id'],
        type = j['type'],
        title = j['title'],
        body = j['body'],
        data = Map<String, dynamic>.from(j['data'] ?? const {}),
        read = j['read'] ?? false,
        createdAt = _date(j['created_at'])!;
}
