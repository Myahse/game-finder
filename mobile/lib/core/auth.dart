import 'package:flutter/foundation.dart';

import 'api.dart';
import 'env.dart';
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
  }

  Future<void> register({
    required String firstName,
    required String lastName,
    required String username,
    required String email,
    required String password,
  }) async {
    final s = await api.post('/api/auth/register', {
      'first_name': firstName.trim(),
      'last_name': lastName.trim(),
      'username': username.trim(),
      'email': email.trim(),
      'password': password,
    });
    await api.setSession(Session.fromJson(s));
  }

  /// Signs in with Google. Returns null if the user closed the Google sheet,
  /// otherwise whether a new account was created (onboarding follows).
  Future<bool?> googleSignIn() async {
    final idToken = await GoogleAuth.idToken();
    if (idToken == null) return null;
    final path = firebaseConfigured ? '/api/auth/firebase' : '/api/auth/google';
    final s = Session.fromJson(await api.post(path, {'id_token': idToken}));
    await api.setSession(s);
    return s.user['onboarded'] != true;
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
    await GoogleAuth.signOut(); // show the account picker next time
  }

  @override
  void dispose() {
    api.removeListener(notifyListeners);
    super.dispose();
  }
}
