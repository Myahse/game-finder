import 'dart:io' show Platform;

import 'package:firebase_auth/firebase_auth.dart';

import 'firebase_bootstrap.dart';

/// Sign in with Apple via Firebase (iOS / iPad; also works on other platforms when configured).
class AppleAuth {
  /// Off unless built with `--dart-define=ENABLE_APPLE_SIGN_IN=true` (needs Apple Developer account).
  static bool get enabled =>
      firebaseConfigured &&
      (Platform.isIOS || Platform.isMacOS) &&
      const bool.fromEnvironment('ENABLE_APPLE_SIGN_IN', defaultValue: false);

  /// Returns a Firebase ID token for `/api/auth/firebase`, or null if the user cancelled.
  static Future<String?> idToken() async {
    if (!enabled) return null;
    if (!await ensureFirebaseApp()) return null;
    try {
      final provider = AppleAuthProvider();
      provider.addScope('email');
      provider.addScope('name');
      final cred = await FirebaseAuth.instance.signInWithProvider(provider);
      return cred.user?.getIdToken();
    } on FirebaseAuthException catch (e) {
      if (e.code == 'canceled' || e.code == 'user-cancelled') return null;
      rethrow;
    }
  }

  static Future<void> signOut() async {
    if (!firebaseAppReady) return;
    try {
      await FirebaseAuth.instance.signOut();
    } catch (_) {}
  }
}
