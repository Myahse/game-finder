import 'api.dart';

/// Server rule for passwords (POST /api/me/password, register): 8–72 characters.
const kPasswordMin = 8;
const kPasswordMax = 72;

bool passwordLengthOk(String p) => p.length >= kPasswordMin && p.length <= kPasswordMax;

/// Body for POST /api/me/password: Google/Apple accounts without a password
/// only send the new one.
Map<String, dynamic> passwordPayload({required bool adding, required String current, required String next}) => {
      if (!adding) 'current_password': current,
      'new_password': next,
    };

/// The account exists but its email isn't verified yet (403 email_not_verified).
bool isEmailNotVerified(Object e) => e is ApiException && e.code == 'email_not_verified';

/// Extra sports picker (web profile/onboarding): up to [max] besides the main sport.
List<String> toggleExtraSport(List<String> current, String id, {String? mainSportId, int max = 2}) {
  if (id == mainSportId) return current;
  if (current.contains(id)) return [for (final x in current) if (x != id) x];
  if (current.length >= max) return current;
  return [...current, id];
}
