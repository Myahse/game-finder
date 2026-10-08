import 'package:shared_preferences/shared_preferences.dart';

/// Gentle prompts ("Later" = ask again in a week), like web/src/lib/promptDismiss.ts.
const promptDismissFor = Duration(days: 7);

/// Same keys as the web.
class PromptKeys {
  static const avatar = 'ftg_prompt_avatar';
}

/// True while a "Later" stored at [dismissedAtMs] still holds at [now].
bool promptDismissedSince(int? dismissedAtMs, DateTime now) {
  if (dismissedAtMs == null) return false;
  return now.millisecondsSinceEpoch - dismissedAtMs < promptDismissFor.inMilliseconds;
}

Future<bool> promptDismissed(String key, {DateTime? now}) async {
  try {
    final p = await SharedPreferences.getInstance();
    return promptDismissedSince(p.getInt(key), now ?? DateTime.now());
  } catch (_) {
    return false;
  }
}

Future<void> dismissPromptLater(String key, {DateTime? now}) async {
  try {
    await (await SharedPreferences.getInstance()).setInt(key, (now ?? DateTime.now()).millisecondsSinceEpoch);
  } catch (_) {}
}
