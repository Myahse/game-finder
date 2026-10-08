import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'models.dart';

/// A `/friend/<token>` invite opened while signed out is kept through sign-up
/// and onboarding, then accepted (web lib/friendInvite.ts).
class PendingFriendInvite {
  PendingFriendInvite._();

  static const key = 'ftg.friend_invite_token';

  static Future<void> stash(String token) async {
    final t = token.trim();
    if (t.isEmpty) return;
    try {
      await (await SharedPreferences.getInstance()).setString(key, t);
    } catch (_) {}
  }

  static Future<String?> peek() async {
    try {
      final t = (await SharedPreferences.getInstance()).getString(key)?.trim();
      return t == null || t.isEmpty ? null : t;
    } catch (_) {
      return null;
    }
  }

  static Future<void> clear() async {
    try {
      await (await SharedPreferences.getInstance()).remove(key);
    } catch (_) {}
  }

  /// Accepts the stashed invite (after password login or onboarding). Returns
  /// true when one was accepted; the token is dropped either way once the
  /// server has answered, so a dead invite isn't retried forever.
  static Future<bool> acceptPending(Api api) async {
    final token = await peek();
    if (token == null) return false;
    try {
      await acceptFriendInvite(api, token);
      await clear();
      return true;
    } on ApiException {
      await clear();
      return false;
    } catch (_) {
      return false; // offline: try again next time
    }
  }
}

/// GET /api/friend-invites/{token}.
class FriendInvitePreview {
  final bool valid;
  final PublicUser inviter;
  final DateTime? expiresAt;
  FriendInvitePreview.fromJson(Map<String, dynamic> j)
      : valid = j['valid'] != false,
        inviter = PublicUser.fromJson(Map<String, dynamic>.from(j['inviter'])),
        expiresAt = DateTime.tryParse(j['expires_at']?.toString() ?? '');
}

Future<FriendInvitePreview> fetchFriendInvite(Api api, String token) async =>
    FriendInvitePreview.fromJson(Map<String, dynamic>.from(await api.get('/api/friend-invites/${Uri.encodeComponent(token.trim())}')));

Future<void> acceptFriendInvite(Api api, String token) =>
    api.post('/api/friend-invites/${Uri.encodeComponent(token.trim())}/accept');
