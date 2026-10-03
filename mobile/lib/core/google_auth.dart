import 'dart:io' show Platform;

import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

import 'env.dart';
import 'firebase_bootstrap.dart';

/// Thin wrapper: returns an ID token for our API (Firebase Google or direct GIS).
class GoogleAuth {
  static Future<void>? _init;

  /// Hidden unless Firebase or direct Google client IDs are configured.
  static bool get enabled {
    if (firebaseConfigured) return true;
    return googleServerClientId.isNotEmpty && (!Platform.isIOS || googleIosClientId.isNotEmpty);
  }

  static bool get _useFirebase => firebaseConfigured;

  static Future<void> _ensureDirectInit() => _init ??= GoogleSignIn.instance.initialize(
        clientId: Platform.isIOS ? googleIosClientId : null,
        serverClientId: googleServerClientId,
      );

  /// Shows Google's account picker. Null when the user cancels.
  static Future<String?> idToken() async {
    if (_useFirebase) {
      if (!await ensureFirebaseApp()) return null;
      try {
        final provider = GoogleAuthProvider();
        final cred = await FirebaseAuth.instance.signInWithProvider(provider);
        return cred.user?.getIdToken();
      } on FirebaseAuthException catch (e) {
        if (e.code == 'canceled' || e.code == 'user-cancelled') return null;
        rethrow;
      }
    }

    await _ensureDirectInit();
    try {
      final account = await GoogleSignIn.instance.authenticate();
      final token = account.authentication.idToken;
      if (token == null) {
        throw const GoogleSignInException(code: GoogleSignInExceptionCode.unknownError, description: 'no id token');
      }
      return token;
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled || e.code == GoogleSignInExceptionCode.interrupted) return null;
      rethrow;
    }
  }

  static Future<void> signOut() async {
    if (_useFirebase && firebaseAppReady) {
      try {
        await FirebaseAuth.instance.signOut();
      } catch (_) {}
      return;
    }
    if (!enabled || _init == null) return;
    try {
      await GoogleSignIn.instance.signOut();
    } catch (_) {}
  }
}
