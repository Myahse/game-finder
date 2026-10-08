import 'package:flutter/foundation.dart';

import 'account.dart';
import 'api.dart';
import 'env.dart';
import 'apple_auth.dart';
import 'friend_invite.dart';
import 'google_auth.dart';
import 'models.dart';

class AuthState extends ChangeNotifier {
  final Api api;
  AuthState(this.api) {
    api.addListener(notifyListeners); // session cleared by a failed refresh
  }

  Me? get user => api.session == null ? null : Me.fromJson(api.session!.user);

  Future<void> login(String login, String password) async {
    final s = await api.post('/api/auth/login', {'login': login.trim(), 'password': password});
    await api.setSession(Session.fromJson(s));
    await PendingFriendInvite.acceptPending(api); // invite opened before signing in
  }

  /// Checks the signed-in player's password (turning on the fingerprint quick
  /// login) without replacing the current session: the extra session the
  /// check opens is revoked straight away.
  Future<void> verifyPassword(String login, String password) async {
    final s = await api.post('/api/auth/login', {'login': login.trim(), 'password': password});
    final refresh = s is Map ? s['refresh_token'] : null;
    if (refresh is String) {
      try {
        await api.post('/api/auth/logout', {'refresh_token': refresh});
      } catch (_) {}
    }
  }

  /// Creates the account. Returns false when the server wants the email
  /// verified first: no session is kept and the app shows "check your inbox".
  Future<bool> register({
    required String firstName,
    required String lastName,
    required String username,
    required String email,
    required String password,
  }) async {
    final invite = await PendingFriendInvite.peek();
    final s = Session.fromJson(await api.post('/api/auth/register', {
      'first_name': firstName.trim(),
      'last_name': lastName.trim(),
      'username': username.trim(),
      'email': email.trim(),
      'password': password,
      'friend_invite_token': ?invite,
    }));
    if (invite != null) await PendingFriendInvite.clear(); // the server became friends on sign-up
    try {
      await api.getWithToken('/api/me', s.accessToken);
    } catch (e) {
      if (isEmailNotVerified(e)) {
        try {
          await api.post('/api/auth/logout', {'refresh_token': s.refreshToken});
        } catch (_) {}
        return false;
      }
      // Anything else: keep the session, the app retries /api/me itself.
    }
    await api.setSession(s);
    return true;
  }

  /// Signs in with Google. Returns null if the user closed the Google sheet,
  /// otherwise whether a new account was created (onboarding follows).
  Future<bool?> appleSignIn() async {
    final idToken = await AppleAuth.idToken();
    if (idToken == null) return null;
    final s = Session.fromJson(await api.post('/api/auth/firebase', await _oauthBody(idToken)));
    await api.setSession(s);
    await PendingFriendInvite.clear(); // sent with the sign-in
    return s.user['onboarded'] != true;
  }

  Future<bool?> googleSignIn() async {
    final idToken = await GoogleAuth.idToken();
    if (idToken == null) return null;
    final path = firebaseConfigured ? '/api/auth/firebase' : '/api/auth/google';
    final s = Session.fromJson(await api.post(path, await _oauthBody(idToken)));
    await api.setSession(s);
    await PendingFriendInvite.clear(); // sent with the sign-in
    return s.user['onboarded'] != true;
  }

  /// Google / Apple sign-in body; a pending friend invite rides along (web auth.tsx).
  Future<Map<String, dynamic>> _oauthBody(String idToken) async {
    final invite = await PendingFriendInvite.peek();
    return {'id_token': idToken, 'friend_invite_token': ?invite};
  }

  Future<Me> updateMe(Map<String, dynamic> patch) async {
    final j = Map<String, dynamic>.from(await api.patch('/api/me', patch));
    await _storeUser(j);
    return Me.fromJson(j);
  }

  Future<void> refreshMe() async {
    try {
      await _storeUser(Map<String, dynamic>.from(await api.get('/api/me')));
    } catch (_) {}
  }

  Future<void> _storeUser(Map<String, dynamic> j) async {
    final s = api.session;
    if (s != null) await api.setSession(Session(s.accessToken, s.refreshToken, s.accessExpiresAt, j));
  }

  Future<void> logout() async {
    final s = api.session;
    if (s != null) {
      try {
        await api.post('/api/auth/logout', {'refresh_token': s.refreshToken});
      } catch (_) {}
    }
    await api.setSession(null);
    await GoogleAuth.signOut();
    await AppleAuth.signOut();
  }

  @override
  void dispose() {
    api.removeListener(notifyListeners);
    super.dispose();
  }
}
