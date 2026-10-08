import 'dart:io' show Platform;

import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import 'l10n.dart';
import 'models.dart';

/// [DateFormat] in the device language. French symbols are loaded at startup
/// (initializeDateFormatting in main); if they are missing, fall back to the
/// default locale instead of throwing.
DateFormat localDateFormat(String pattern) {
  if (isFrench) {
    try {
      return DateFormat(pattern, 'fr');
    } catch (_) {}
  }
  return DateFormat(pattern);
}

String formatDistance(double? m) {
  if (m == null) return '';
  if (m < 1000) return '${((m / 10).round() * 10).clamp(10, 990)} m';
  return '${(m / 1000).toStringAsFixed(m < 10000 ? 1 : 0)} km';
}

String timeAgo(DateTime? t, [DateTime? now]) {
  if (t == null) return tr('No recent activity', 'Aucune activité récente');
  final s = (now ?? DateTime.now()).difference(t).inSeconds;
  if (s < 60) return tr('just now', 'à l’instant');
  final m = (s / 60).round();
  if (m < 60) return tr('$m minute${m == 1 ? '' : 's'} ago', 'il y a $m minute${m == 1 ? '' : 's'}');
  final h = (m / 60).round();
  if (h < 24) return tr('$h hour${h == 1 ? '' : 's'} ago', 'il y a $h heure${h == 1 ? '' : 's'}');
  final d = (h / 24).round();
  return tr('$d day${d == 1 ? '' : 's'} ago', 'il y a $d jour${d == 1 ? '' : 's'}');
}

String clock(DateTime t) => DateFormat.Hm().format(t);

String gameTime(Game g) => gameTimeLabel(g.status, g.startTime);

/// [gameTime] from a status and start (e.g. a shared-link preview).
String gameTimeLabel(String status, DateTime start) {
  if (status == 'active') return tr('Started ${clock(start)}', 'Commencé à ${clock(start)}');
  final now = DateTime.now();
  final sameDay = start.year == now.year && start.month == now.month && start.day == now.day;
  return sameDay
      ? tr('Today ${clock(start)}', 'Aujourd’hui ${clock(start)}')
      : localDateFormat('EEE d MMM, HH:mm').format(start);
}

const maxPlayersSliderMin = 2;
const maxPlayersSliderCap = 30;
const maxPlayersSliderUnlimited = 31;
const maxPlayersApiUnlimited = 0;

bool isUnlimitedMaxPlayers(int max) => max == maxPlayersApiUnlimited;

int maxPlayersSliderToApi(int slider) =>
    slider >= maxPlayersSliderUnlimited ? maxPlayersApiUnlimited : slider;

String maxPlayersSliderLabel(int slider) =>
    slider >= maxPlayersSliderUnlimited ? tr('Unlimited', 'Illimité') : '$slider';

String gamePlayerCountLabel(int playerCount, int maxPlayers) =>
    isUnlimitedMaxPlayers(maxPlayers) ? '$playerCount/∞' : '$playerCount/$maxPlayers';

bool gameHasOpenSpots(Game g) => g.unlimitedPlayers || g.spotsLeft > 0;

// Getters (not const maps) so tr() runs at use time, in the device language.
Map<String, String> get skillLabels => {
      'beginner': tr('Beginner', 'Débutant'),
      'intermediate': tr('Intermediate', 'Intermédiaire'),
      'advanced': tr('Advanced', 'Avancé'),
      'all_levels': tr('All levels', 'Tous niveaux'),
    };

Map<String, String> get gameTypeLabels => {
      'pickup': tr('Pickup', 'Match libre'),
      'training': tr('Training', 'Entraînement'),
      'match': tr('Match', 'Match'),
      'tournament': tr('Tournament', 'Tournoi'),
    };

Map<String, String> get reportLabels => {
      'not_exist': tr("Court doesn't exist", 'Le terrain n’existe pas'),
      'wrong_location': tr('Wrong location', 'Mauvais emplacement'),
      'closed': tr('Closed', 'Fermé'),
      'wrong_info': tr('Wrong information', 'Informations incorrectes'),
      'unsafe': tr('Unsafe', 'Dangereux'),
      'duplicate': tr('Duplicate', 'Doublon'),
      'other': tr('Other', 'Autre'),
    };

/// Game status chip: ACTIVE, UPCOMING, FINISHED, CANCELLED.
String gameStatusLabel(String status) => switch (status) {
      'active' => tr('ACTIVE', 'EN COURS'),
      'scheduled' => tr('UPCOMING', 'À VENIR'),
      'completed' => tr('FINISHED', 'TERMINÉ'),
      'cancelled' => tr('CANCELLED', 'ANNULÉ'),
      _ => status.toUpperCase(),
    };

/// "I want to play" order: closest (250 m buckets), then live, then most
/// players, then most free spots.
List<Game> sortPlayable(Iterable<Game> games) {
  int bucket(double? m) => m == null ? 1 << 30 : (m / 250).floor();
  final list = games.where((g) => g.isOpen).toList();
  list.sort((a, b) {
    var c = bucket(a.distanceM).compareTo(bucket(b.distanceM));
    if (c != 0) return c;
    c = (b.isLive ? 1 : 0).compareTo(a.isLive ? 1 : 0);
    if (c != 0) return c;
    c = b.playerCount.compareTo(a.playerCount);
    if (c != 0) return c;
    final spotsA = a.unlimitedPlayers ? 999999 : a.spotsLeft;
    final spotsB = b.unlimitedPlayers ? 999999 : b.spotsLeft;
    return spotsB.compareTo(spotsA);
  });
  return list;
}

const _soonMs = 3 * 60 * 60 * 1000;
const soonMs = _soonMs;

bool gameIsUpcomingLater(Game game, [DateTime? now]) {
  if (game.status != 'scheduled') return false;
  final t0 = (now ?? DateTime.now()).millisecondsSinceEpoch;
  return game.startTime.millisecondsSinceEpoch - t0 > _soonMs;
}

/// Map pin ring: live, later-week scheduled (blue), starting-soon scheduled (amber).
enum CourtPinTone { inactive, players, active, upcoming }

CourtPinTone courtPinTone(Court court, List<Game> gamesAtCourt, [DateTime? now]) {
  if (court.activity == Activity.active) return CourtPinTone.active;
  var hasActive = false;
  var hasUpcomingLater = false;
  var hasScheduledSoon = false;
  final t0 = (now ?? DateTime.now()).millisecondsSinceEpoch;
  for (final g in gamesAtCourt) {
    if (g.isLive) {
      hasActive = true;
    } else if (g.status == 'scheduled') {
      if (g.startTime.millisecondsSinceEpoch - t0 > _soonMs) {
        hasUpcomingLater = true;
      } else {
        hasScheduledSoon = true;
      }
    }
  }
  if (hasActive) return CourtPinTone.active;
  if (hasUpcomingLater) return CourtPinTone.upcoming;
  if (hasScheduledSoon) return CourtPinTone.players;
  if (court.activity == Activity.players) return CourtPinTone.players;
  return CourtPinTone.inactive;
}

({List<Game> soon, List<Game> upcoming}) splitScheduledBySoon(List<Game> games, [DateTime? now]) {
  final t0 = (now ?? DateTime.now()).millisecondsSinceEpoch;
  final soon = <Game>[];
  final upcoming = <Game>[];
  for (final g in games) {
    if (g.isLive) continue;
    final start = g.startTime.millisecondsSinceEpoch;
    if (start - t0 <= _soonMs) {
      soon.add(g);
    } else {
      upcoming.add(g);
    }
  }
  upcoming.sort((a, b) => a.startTime.compareTo(b.startTime));
  return (soon: soon, upcoming: upcoming);
}

/// Opens Apple Maps on iOS, Google Maps elsewhere (app if installed, else web).
Future<void> openDirections(double lat, double lng) async {
  final candidates = Platform.isIOS
      ? [Uri.parse('maps://?daddr=$lat,$lng&dirflg=d'), Uri.parse('https://maps.apple.com/?daddr=$lat,$lng')]
      : [Uri.parse('google.navigation:q=$lat,$lng'), Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lng')];
  for (final uri in candidates) {
    if (await canLaunchUrl(uri) && await launchUrl(uri, mode: LaunchMode.externalApplication)) return;
  }
  await launchUrl(candidates.last, mode: LaunchMode.externalApplication);
}
