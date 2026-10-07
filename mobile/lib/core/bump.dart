// "Connect on court": both players tap at the same time, close together → friends.
// POST /api/me/bump {latitude, longitude} is polled while waiting; DELETE cancels.
// Port of web/src/components/BumpConnect.tsx.

import 'models.dart';

/// Keep polling for this long — slightly longer than the server's 12 s match window.
const bumpWait = Duration(seconds: 15);
const bumpPollEvery = Duration(milliseconds: 1200);

/// One poll's answer: still waiting, or matched with [friend].
class BumpResult {
  final bool matched;
  final PublicUser? friend;
  final bool alreadyFriends;
  const BumpResult({required this.matched, this.friend, this.alreadyFriends = false});

  factory BumpResult.fromJson(Map<String, dynamic> j) {
    final friend = j['friend'] is Map ? PublicUser.fromJson(Map<String, dynamic>.from(j['friend'] as Map)) : null;
    return BumpResult(
      matched: j['status'] == 'matched' && friend != null,
      friend: friend,
      alreadyFriends: j['already_friends'] == true,
    );
  }
}

/// Seconds left to show in the countdown (rounded up, never negative).
int bumpSecondsLeft(DateTime until, DateTime now) {
  final ms = until.difference(now).inMilliseconds;
  return ms <= 0 ? 0 : (ms / 1000).ceil();
}
