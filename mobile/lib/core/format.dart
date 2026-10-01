import 'dart:io' show Platform;

import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import 'models.dart';

String formatDistance(double? m) {
  if (m == null) return '';
  if (m < 1000) return '${((m / 10).round() * 10).clamp(10, 990)} m';
  return '${(m / 1000).toStringAsFixed(m < 10000 ? 1 : 0)} km';
}

String timeAgo(DateTime? t, [DateTime? now]) {
  if (t == null) return 'No recent activity';
  final s = (now ?? DateTime.now()).difference(t).inSeconds;
  if (s < 60) return 'just now';
  final m = (s / 60).round();
  if (m < 60) return '$m minute${m == 1 ? '' : 's'} ago';
  final h = (m / 60).round();
  if (h < 24) return '$h hour${h == 1 ? '' : 's'} ago';
  final d = (h / 24).round();
  return '$d day${d == 1 ? '' : 's'} ago';
}

String clock(DateTime t) => DateFormat.Hm().format(t);

String gameTime(Game g) {
  if (g.isLive) return 'Started ${clock(g.startTime)}';
  final now = DateTime.now();
  final sameDay = g.startTime.year == now.year && g.startTime.month == now.month && g.startTime.day == now.day;
  return sameDay ? 'Today ${clock(g.startTime)}' : DateFormat('EEE d MMM, HH:mm').format(g.startTime);
}

const skillLabels = {
  'beginner': 'Beginner',
  'intermediate': 'Intermediate',
  'advanced': 'Advanced',
  'all_levels': 'All levels',
};

const gameTypeLabels = {
  'pickup': 'Pickup',
  'training': 'Training',
  'match': 'Match',
  'tournament': 'Tournament',
};

const reportLabels = {
  'not_exist': "Court doesn't exist",
  'wrong_location': 'Wrong location',
  'closed': 'Closed',
  'wrong_info': 'Wrong information',
  'unsafe': 'Unsafe',
  'duplicate': 'Duplicate',
  'other': 'Other',
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
    return b.spotsLeft.compareTo(a.spotsLeft);
  });
  return list;
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
