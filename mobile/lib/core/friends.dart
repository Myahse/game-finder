import 'api.dart';
import 'game_share.dart' show webAppUrl;
import 'models.dart';

/// One pending friend request (GET /api/me/friend-requests → incoming/outgoing).
class FriendRequest {
  final String id;
  final PublicUser user;
  final DateTime? createdAt;
  FriendRequest.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        user = PublicUser.fromJson(Map<String, dynamic>.from(j['user'] as Map)),
        createdAt = j['created_at'] is String ? DateTime.tryParse(j['created_at'] as String)?.toLocal() : null;
}

class FriendRequests {
  final List<FriendRequest> incoming, outgoing;
  const FriendRequests({this.incoming = const [], this.outgoing = const []});

  factory FriendRequests.fromJson(dynamic j) {
    List<FriendRequest> list(dynamic v) => [
          for (final r in (v as List? ?? const []))
            if (r is Map) FriendRequest.fromJson(Map<String, dynamic>.from(r)),
        ];
    if (j is! Map) return const FriendRequests();
    return FriendRequests(incoming: list(j['incoming']), outgoing: list(j['outgoing']));
  }
}

/// How the viewer relates to a profile (web ProfileFriendActions).
enum FriendRelation { self, guest, friends, incoming, outgoing, none }

({FriendRelation relation, String? incomingId}) friendRelation({
  required String? viewerId,
  required String targetId,
  required List<PublicUser> friends,
  required FriendRequests requests,
}) {
  if (viewerId == null) return (relation: FriendRelation.guest, incomingId: null);
  if (viewerId == targetId) return (relation: FriendRelation.self, incomingId: null);
  if (friends.any((f) => f.id == targetId)) return (relation: FriendRelation.friends, incomingId: null);
  for (final r in requests.incoming) {
    if (r.user.id == targetId) return (relation: FriendRelation.incoming, incomingId: r.id);
  }
  if (requests.outgoing.any((r) => r.user.id == targetId)) return (relation: FriendRelation.outgoing, incomingId: null);
  return (relation: FriendRelation.none, incomingId: null);
}

/// "@Ana " → "Ana" (the add-friend field accepts a leading @).
String normalizeUsername(String raw) => raw.trim().replaceFirst(RegExp(r'^@+'), '').trim();

String friendInviteUrl(String token) => '$webAppUrl/friend/${Uri.encodeComponent(token.trim())}';

/// Public profile link (web lib/profileShare.ts).
String profileShareUrl(String username) => '$webAppUrl/u/${Uri.encodeComponent(normalizeUsername(username))}';

Future<List<PublicUser>> fetchFriends(Api api) async {
  final j = await api.get('/api/me/friends');
  return [for (final u in (j as List? ?? const [])) if (u is Map) PublicUser.fromJson(Map<String, dynamic>.from(u))];
}

Future<FriendRequests> fetchFriendRequests(Api api) async => FriendRequests.fromJson(await api.get('/api/me/friend-requests'));

Future<void> sendFriendRequest(Api api, String username) =>
    api.post('/api/me/friend-requests', {'username': normalizeUsername(username)});

Future<void> respondFriendRequest(Api api, String id, {required bool accept}) =>
    api.post('/api/me/friend-requests/${Uri.encodeComponent(id)}/${accept ? 'accept' : 'reject'}');

Future<String> createFriendInviteUrl(Api api) async {
  final j = await api.post('/api/me/friend-invite-link');
  return friendInviteUrl(j['token'] as String);
}
