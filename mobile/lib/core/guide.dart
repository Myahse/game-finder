import 'package:shared_preferences/shared_preferences.dart';

/// First-time screen tips: shown once per screen, per player, on this device.
/// Same rules and keys as the web (web/src/lib/guide.ts).
class GuideScreen {
  static const avatar = 'avatar';
  static const map = 'map';
  static const play = 'play';
  static const game = 'game';
  static const challenges = 'challenges';
  static const profile = 'profile';
}

const _prefix = 'ftg_guide_v1_';

/// Players who joined before this long ago already know the app — no tips.
const newPlayerWindow = Duration(days: 30);

String guideSeenKey(String userId, String screen) => '$_prefix${userId}_$screen';
String guideOffKey(String userId) => '$_prefix${userId}_off';

/// Account created less than [newPlayerWindow] ago (`created_at` from /api/me).
bool isNewPlayer(String? createdAt, DateTime now) {
  if (createdAt == null || createdAt.isEmpty) return false;
  final t = DateTime.tryParse(createdAt);
  if (t == null) return false;
  return now.difference(t) < newPlayerWindow;
}

/// Signed-in, onboarded, new player: the only ones who get tips.
bool guideEligible(Map<String, dynamic>? user, DateTime now) {
  if (user == null) return false;
  final id = user['id'];
  if (id is! String || id.isEmpty || user['onboarded'] != true) return false;
  final created = user['created_at'];
  return isNewPlayer(created is String ? created : null, now);
}

/// True when this screen's tips were shown, or the player turned tips off.
Future<bool> guideSeen(String userId, String screen) async {
  try {
    final p = await SharedPreferences.getInstance();
    return p.getBool(guideOffKey(userId)) == true || p.getBool(guideSeenKey(userId, screen)) == true;
  } catch (_) {
    return true;
  }
}

Future<void> markGuideSeen(String userId, String screen) async {
  try {
    await (await SharedPreferences.getInstance()).setBool(guideSeenKey(userId, screen), true);
  } catch (_) {}
}

/// "Skip tips": no more tips on any screen.
Future<void> turnOffGuide(String userId) async {
  try {
    await (await SharedPreferences.getInstance()).setBool(guideOffKey(userId), true);
  } catch (_) {}
}
