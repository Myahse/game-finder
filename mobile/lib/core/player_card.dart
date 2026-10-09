// Player cards (GET /api/users/{id}/card): the model, tiers and the fetch.
// The server computes the rating and tier; parsing stays tolerant so a
// missing or null field shows as 0 / "—" instead of breaking the sheet.

import 'dart:ui' show Color;

import 'api.dart';
import 'l10n.dart';
import 'models.dart';

/// Card tier from the sport's Elo (bronze < 1200 ≤ argent < 1400 ≤ or < 1600 ≤ feu).
enum CardTier { bronze, argent, or, feu }

CardTier cardTierForElo(int elo) {
  if (elo >= 1600) return CardTier.feu;
  if (elo >= 1400) return CardTier.or;
  if (elo >= 1200) return CardTier.argent;
  return CardTier.bronze;
}

/// The API's tier name ("bronze" | "argent" | "or" | "feu"); null when unknown.
CardTier? cardTierFromName(Object? name) => switch (name) {
  'bronze' => CardTier.bronze,
  'argent' => CardTier.argent,
  'or' => CardTier.or,
  'feu' => CardTier.feu,
  _ => null,
};

extension CardTierLook on CardTier {
  /// Frame colour of the card.
  Color get color => switch (this) {
    CardTier.bronze => const Color(0xFFCD7F4B),
    CardTier.argent => const Color(0xFFC9CED6),
    CardTier.or => const Color(0xFFF2B632),
    CardTier.feu => const Color(0xFFFF5A1F),
  };

  /// Label on the card, in the viewer's language.
  String get label => switch (this) {
    CardTier.bronze => 'BRONZE',
    CardTier.argent => tr('SILVER', 'ARGENT'),
    CardTier.or => tr('GOLD', 'OR'),
    CardTier.feu => tr('FIRE', 'FEU'),
  };
}

/// The four approved card designs.
enum CardStyle { card, poster, scoreboard, pass }

extension CardStyleLabel on CardStyle {
  String get label => switch (this) {
    CardStyle.card => tr('Card', 'Carte'),
    CardStyle.poster => tr('Poster', 'Affiche'),
    CardStyle.scoreboard => tr('Scoreboard', 'Tableau'),
    CardStyle.pass => tr('Pass', 'Pass'),
  };
}

/// Same formula as the server (spec), used only when the API leaves it out.
int cardRating({required int elo, int games = 0, double winRate = 0, int winStreak = 0}) {
  final base = 40 + (elo - 900) * 0.075;
  final bonus =
      (games < 0 ? 0 : (games > 40 ? 40 : games)) / 10 +
      (winRate - 0.5 > 0 ? (winRate - 0.5) * 4 : 0) +
      (winStreak < 0 ? 0 : (winStreak > 5 ? 5 : winStreak)) / 5;
  return (base + bonus).round().clamp(40, 99);
}

class CardCourt {
  final String id, name;
  const CardCourt(this.id, this.name);

  static CardCourt? fromJson(Object? j) {
    if (j is! Map) return null;
    final name = j['name'];
    if (name is! String || name.trim().isEmpty) return null;
    return CardCourt(j['id'] is String ? j['id'] as String : '', name.trim());
  }
}

int? _intOrNull(Object? v) => v is num ? v.toInt() : (v is String ? int.tryParse(v) : null);
int _int(Object? v) => _intOrNull(v) ?? 0;
double _double(Object? v) => v is num ? v.toDouble() : (v is String ? double.tryParse(v) ?? 0 : 0);

/// Sport JSON with the fields [Sport.fromJson] requires filled in; null when unusable.
Sport? _sport(Object? j) {
  if (j is! Map) return null;
  final slug = j['slug'];
  if (slug is! String || slug.isEmpty) return null;
  String s(String k, String fallback) => j[k] is String && (j[k] as String).isNotEmpty ? j[k] as String : fallback;
  return Sport.fromJson({
    'id': s('id', slug),
    'name': s('name', slug),
    'slug': slug,
    'icon': s('icon', slug),
    'active': j['active'] ?? true,
  });
}

class PlayerCard {
  final PublicUser user;
  final int serial;

  /// The sport the card is for (null: the player has no sport yet).
  final Sport? sport;

  /// Sports with a rating, most games first (sport switcher).
  final List<Sport> sports;
  final int elo, eloDelta30d, ratedGames, rating, level;
  final CardTier tier;
  final int games, wins, losses, winPct, winStreak;
  final int challengesWon, challengesLost, courts, badges, mvps;
  final int pointsTotal, bestPoints;
  final double pointsPerGame;
  final CardCourt? homeCourt, kingOf;

  /// Show the first and last name (own card, admins); members see @username,
  /// as everywhere else in the app.
  final bool legalName;

  const PlayerCard({
    required this.user,
    this.serial = 0,
    this.sport,
    this.sports = const [],
    this.elo = 1000,
    this.eloDelta30d = 0,
    this.ratedGames = 0,
    this.rating = 48,
    this.level = 1,
    this.tier = CardTier.bronze,
    this.games = 0,
    this.wins = 0,
    this.losses = 0,
    this.winPct = 0,
    this.winStreak = 0,
    this.challengesWon = 0,
    this.challengesLost = 0,
    this.courts = 0,
    this.badges = 0,
    this.mvps = 0,
    this.pointsTotal = 0,
    this.bestPoints = 0,
    this.pointsPerGame = 0,
    this.homeCourt,
    this.kingOf,
    this.legalName = false,
  });

  factory PlayerCard.fromJson(Map<String, dynamic> j, {bool legalName = false}) {
    final rawUser = j['user'] is Map ? Map<String, dynamic>.from(j['user'] as Map) : <String, dynamic>{};
    final user = PublicUser.fromJson({...rawUser, 'id': rawUser['id'] is String ? rawUser['id'] : ''});
    final sport = _sport(j['sport']);
    final sports = <Sport>[for (final s in (j['sports'] is List ? j['sports'] as List : const [])) ?_sport(s)];
    if (sport != null && !sports.any((s) => s.slug == sport.slug)) sports.insert(0, sport);
    final elo = _intOrNull(j['elo']) ?? 1000;
    final games = _int(j['games']);
    final wins = _int(j['wins']);
    final winPct = _intOrNull(j['win_pct']) ?? (games > 0 ? (wins * 100 / games).round() : 0);
    final streak = _int(j['win_streak']);
    return PlayerCard(
      user: user,
      serial: _int(j['serial']),
      sport: sport,
      sports: sports,
      elo: elo,
      eloDelta30d: _int(j['elo_delta_30d']),
      ratedGames: _int(j['rated_games']),
      rating: (_intOrNull(j['rating']) ?? cardRating(elo: elo, games: games, winRate: winPct / 100, winStreak: streak)).clamp(40, 99),
      level: _intOrNull(j['level']) ?? 1,
      tier: cardTierFromName(j['tier']) ?? cardTierForElo(elo),
      games: games,
      wins: wins,
      losses: _intOrNull(j['losses']) ?? (games - wins).clamp(0, games),
      winPct: winPct.clamp(0, 100),
      winStreak: streak,
      challengesWon: _int(j['challenges_won']),
      challengesLost: _int(j['challenges_lost']),
      courts: _int(j['courts']),
      badges: _int(j['badges']),
      mvps: _int(j['mvps']),
      pointsTotal: _int(j['points_total']),
      bestPoints: _int(j['best_points']),
      pointsPerGame: _double(j['points_per_game']),
      homeCourt: CardCourt.fromJson(j['home_court']),
      kingOf: CardCourt.fromJson(j['king_of']),
      legalName: legalName,
    );
  }

  /// "N° 0042" (4 digits, more when needed); "N° —" when unknown.
  String get serialLabel => serial > 0 ? 'N° ${serial.toString().padLeft(4, '0')}' : 'N° —';

  /// First and last name when [legalName] allows it, else @username.
  String get displayName => legalName && user.fullName.isNotEmpty ? user.fullName : user.username;

  /// Sport name for the card ("—" when there is none).
  String get sportName => sport?.name ?? '—';

  /// The ELO tile caption: "ELO +64" / "ELO −12" / "ELO".
  String get eloDeltaLabel => eloDelta30d > 0 ? 'ELO +$eloDelta30d' : (eloDelta30d < 0 ? 'ELO −${-eloDelta30d}' : 'ELO');
}

/// GET /api/users/{id}/card ({id} may be "me"); [sport] is a sport slug.
Future<PlayerCard> fetchPlayerCard(Api api, String userId, {String? sport, bool legalName = false}) async {
  final q = sport == null || sport.isEmpty ? '' : '?sport=${Uri.encodeQueryComponent(sport)}';
  final j = await api.get('/api/users/${Uri.encodeComponent(userId)}/card$q');
  if (j is! Map) throw ApiException(500, 'invalid_response', genericCardError);
  return PlayerCard.fromJson(Map<String, dynamic>.from(j), legalName: legalName);
}

String get genericCardError => tr('Could not load the card.', 'Impossible de charger la carte.');
