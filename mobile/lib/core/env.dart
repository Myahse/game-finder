import 'package:flutter_dotenv/flutter_dotenv.dart';

const _defaultApi = 'http://10.0.2.2:8080';

String _apiUrl = _defaultApi;
String _mapboxToken = '';
String _mediaPublicOrigin = '';
String _googleServerClientId = '';
String _googleIosClientId = '';
String _firebaseApiKey = '';
String _firebaseAppId = '';
String _firebaseMessagingSenderId = '';
String _firebaseProjectId = '';
String _firebaseAuthDomain = '';

/// Load `assets/.env` (sync from repo `.env` via `sync-env.ps1` or `run-device.ps1`).
/// `--dart-define` values override the file when non-empty.
Future<void> loadAppEnv() async {
  try {
    await dotenv.load(fileName: 'assets/.env');
  } catch (_) {
    // Missing asset is OK — use dart-define or defaults.
  }

  const defineApi = String.fromEnvironment('API_URL');
  const defineMapbox = String.fromEnvironment('MAPBOX_ACCESS_TOKEN');

  final fileApi = dotenv.env['API_URL']?.trim() ?? '';
  final fileMapbox = (dotenv.env['MAPBOX_ACCESS_TOKEN'] ?? dotenv.env['VITE_MAPBOX_ACCESS_TOKEN'] ?? '').trim();

  _apiUrl = defineApi.isNotEmpty ? defineApi : (fileApi.isNotEmpty ? fileApi : _defaultApi);
  _mapboxToken = defineMapbox.isNotEmpty ? defineMapbox : fileMapbox;
  _mediaPublicOrigin = (dotenv.env['MEDIA_PUBLIC_ORIGIN'] ?? dotenv.env['R2_PUBLIC_URL'] ?? '').trim();

  // Google Sign-In: the *web* OAuth client ID (tokens are issued for it, so
  // the API can verify them) and, on iOS, the iOS OAuth client ID.
  const defineServer = String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');
  const defineIos = String.fromEnvironment('GOOGLE_IOS_CLIENT_ID');
  _googleServerClientId = defineServer.isNotEmpty
      ? defineServer
      : (dotenv.env['GOOGLE_SERVER_CLIENT_ID'] ?? dotenv.env['VITE_GOOGLE_CLIENT_ID'] ?? '').trim();
  _googleIosClientId = defineIos.isNotEmpty ? defineIos : (dotenv.env['GOOGLE_IOS_CLIENT_ID'] ?? '').trim();

  _firebaseApiKey = (dotenv.env['FIREBASE_API_KEY'] ?? dotenv.env['VITE_FIREBASE_API_KEY'] ?? '').trim();
  _firebaseAppId = (dotenv.env['FIREBASE_APP_ID'] ?? dotenv.env['VITE_FIREBASE_APP_ID'] ?? '').trim();
  _firebaseMessagingSenderId =
      (dotenv.env['FIREBASE_MESSAGING_SENDER_ID'] ?? dotenv.env['VITE_FIREBASE_MESSAGING_SENDER_ID'] ?? '').trim();
  _firebaseProjectId = (dotenv.env['FIREBASE_PROJECT_ID'] ?? dotenv.env['VITE_FIREBASE_PROJECT_ID'] ?? dotenv.env['FCM_PROJECT_ID'] ?? '').trim();
  final domain = (dotenv.env['FIREBASE_AUTH_DOMAIN'] ?? dotenv.env['VITE_FIREBASE_AUTH_DOMAIN'] ?? '').trim();
  _firebaseAuthDomain = domain.isNotEmpty ? domain : (_firebaseProjectId.isNotEmpty ? '$_firebaseProjectId.firebaseapp.com' : '');
}

bool get firebaseConfigured =>
    _firebaseApiKey.isNotEmpty &&
    _firebaseAppId.isNotEmpty &&
    _firebaseMessagingSenderId.isNotEmpty &&
    _firebaseProjectId.isNotEmpty;
String get firebaseApiKey => _firebaseApiKey;
String get firebaseAppId => _firebaseAppId;
String get firebaseMessagingSenderId => _firebaseMessagingSenderId;
String get firebaseProjectId => _firebaseProjectId;
String get firebaseAuthDomain => _firebaseAuthDomain;

void setApiUrl(String url) {
  final t = url.trim().replaceAll(RegExp(r'/+$'), '');
  if (t.isNotEmpty) _apiUrl = t;
}

String get apiUrl => _apiUrl;
String get mapboxAccessToken => _mapboxToken;
String get mediaPublicOrigin => _mediaPublicOrigin;
String get googleServerClientId => _googleServerClientId;
String get googleIosClientId => _googleIosClientId;
