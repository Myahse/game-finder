import 'dart:io' show Platform;

import 'package:google_sign_in/google_sign_in.dart';

import 'env.dart';

/// Thin wrapper over google_sign_in: returns an ID token for our API.
class GoogleAuth {
  static Future<void>? _init;

  /// Hidden unless a client ID is configured (and, on iOS, the iOS client ID).
  static bool get enabled =>
      googleServerClientId.isNotEmpty && (!Platform.isIOS || googleIosClientId.isNotEmpty);

  static Future<void> _ensureInit() => _init ??= GoogleSignIn.instance.initialize(
        clientId: Platform.isIOS ? googleIosClientId : null,
        serverClientId: googleServerClientId,
      );

  /// Shows Google's account picker. Null when the user cancels.
  static Future<String?> idToken() async {
    await _ensureInit();
    try {
      final account = await GoogleSignIn.instance.authenticate();
      final token = account.authentication.idToken;
      if (token == null) throw const GoogleSignInException(code: GoogleSignInExceptionCode.unknownError, description: 'no id token');
      return token;
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled || e.code == GoogleSignInExceptionCode.interrupted) return null;
      rethrow;
    }
  }

  static Future<void> signOut() async {
    if (!enabled || _init == null) return;
    try {
      await GoogleSignIn.instance.signOut();
    } catch (_) {}
  }
}
