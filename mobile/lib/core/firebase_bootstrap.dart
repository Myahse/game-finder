import 'package:firebase_core/firebase_core.dart';

import 'env.dart';

bool _firebaseReady = false;

/// True when [Firebase.initializeApp] succeeded with env-based options.
bool get firebaseAppReady => _firebaseReady;

/// Initializes Firebase from `assets/.env` (no `google-services.json` required).
Future<bool> ensureFirebaseApp() async {
  if (_firebaseReady) return true;
  if (!firebaseConfigured) return false;
  try {
    await Firebase.initializeApp(
      options: FirebaseOptions(
        apiKey: firebaseApiKey,
        appId: firebaseAppId,
        messagingSenderId: firebaseMessagingSenderId,
        projectId: firebaseProjectId,
        authDomain: firebaseAuthDomain,
      ),
    );
    _firebaseReady = true;
    return true;
  } catch (_) {
    return false;
  }
}
