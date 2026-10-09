import 'dart:convert';

/// Where tapping a notification goes (web lib/notificationLinks.ts).
/// [card]: the signed-in player's card sheet, for the sport slug in the id.
enum NotificationDest { profileFriends, profile, challenges, court, game, user, card }

class NotificationTarget {
  final NotificationDest dest;
  final String? id;
  const NotificationTarget(this.dest, [this.id]);

  @override
  bool operator ==(Object other) => other is NotificationTarget && other.dest == dest && other.id == id;
  @override
  int get hashCode => Object.hash(dest, id);
  @override
  String toString() => 'NotificationTarget($dest, $id)';
}

String? _str(Object? v) => v is String && v.isNotEmpty ? v : null;

/// [type] is the notification type; [data] its payload (push data has string values).
NotificationTarget? notificationTarget(String? type, Map<String, dynamic> data) {
  final courtId = _str(data['court_id']);
  final gameId = _str(data['game_id']);
  final userId = _str(data['user_id']);
  if (type == 'court_pending_review' && courtId != null) return NotificationTarget(NotificationDest.court, courtId);
  if (type == 'friend_request') return const NotificationTarget(NotificationDest.profileFriends);
  if (type == 'challenge') return const NotificationTarget(NotificationDest.challenges);
  if (data['kind'] == 'court_change' && gameId == null && _str(data['challenge_id']) != null) {
    return const NotificationTarget(NotificationDest.challenges);
  }
  // Card tier up (kind card_tier): open the player's own card for that sport.
  if (data['kind'] == 'card_tier') return NotificationTarget(NotificationDest.card, _str(data['sport']));
  if (type == 'achievement' && data['kind'] == 'king' && courtId != null) return NotificationTarget(NotificationDest.court, courtId);
  if (type == 'achievement') return const NotificationTarget(NotificationDest.profile);
  if (gameId != null) return NotificationTarget(NotificationDest.game, gameId);
  if (courtId != null) return NotificationTarget(NotificationDest.court, courtId);
  if (userId != null) return NotificationTarget(NotificationDest.user, userId);
  return null;
}

/// Local-notification payload for a push: its data (incl. `type`) as JSON.
String pushPayload(Map<String, dynamic> data) => jsonEncode(data);

/// Target for a local-notification payload: JSON push data, or (older
/// payloads) a bare game id. Presence prompts are handled elsewhere.
NotificationTarget? targetFromPayload(String? payload) {
  final p = payload?.trim();
  if (p == null || p.isEmpty || p.startsWith('presence:')) return null;
  if (p.startsWith('{')) {
    try {
      final data = Map<String, dynamic>.from(jsonDecode(p) as Map);
      return notificationTarget(data['type'] as String?, data);
    } catch (_) {
      return null;
    }
  }
  return NotificationTarget(NotificationDest.game, p);
}
