import 'models.dart';

Sport? sportForUser(Me? user, List<Sport> sports) {
  final id = user?.preferredSportId;
  if (id == null) return null;
  return sports.where((s) => s.id == id).firstOrNull;
}

String? sportSlugForUser(Me? user, List<Sport> sports) => sportForUser(user, sports)?.slug;
