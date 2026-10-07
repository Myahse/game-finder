import 'package:flutter/foundation.dart';

import 'models.dart';

Sport? sportForUser(Me? user, List<Sport> sports) {
  final id = user?.preferredSportId;
  if (id == null) return null;
  return sports.where((s) => s.id == id).firstOrNull;
}

String? sportSlugForUser(Me? user, List<Sport> sports) => sportForUser(user, sports)?.slug;

/// Main sport first, then the extra ones — same as the web's useMySports().
List<Sport> sportsForUser(PublicUser? user, List<Sport> sports) {
  if (user == null) return const [];
  final ids = [?user.preferredSportId, ...user.extraSportIds];
  final out = <Sport>[];
  for (final id in ids) {
    final s = sports.where((x) => x.id == id).firstOrNull;
    if (s != null && !out.contains(s)) out.add(s);
  }
  return out;
}

/// Sports list shared by widgets that only need a slug (e.g. [BaseSportIcon]).
final knownSports = ValueNotifier<List<Sport>>(const []);
bool _knownSportsLoading = false;

void rememberSports(List<Sport> sports) {
  if (sports.isNotEmpty) knownSports.value = sports;
}

/// Fetches /api/sports once (retried later after a failure) via [get].
void ensureKnownSports(Future<dynamic> Function(String path) get) {
  if (knownSports.value.isNotEmpty || _knownSportsLoading) return;
  _knownSportsLoading = true;
  get('/api/sports').then((j) {
    rememberSports([for (final x in j as List) Sport.fromJson(Map<String, dynamic>.from(x as Map))]);
    _knownSportsLoading = false;
  }).catchError((_) {
    Future<void>.delayed(const Duration(seconds: 30), () => _knownSportsLoading = false);
  });
}
