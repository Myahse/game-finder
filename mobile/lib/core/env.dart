import 'package:flutter_dotenv/flutter_dotenv.dart';

const _defaultApi = 'http://10.0.2.2:8080';

String _apiUrl = _defaultApi;
String _mapboxToken = '';
String _mediaPublicOrigin = '';
String _googleServerClientId = '';
String _googleIosClientId = '';

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
}

void setApiUrl(String url) {
  final t = url.trim().replaceAll(RegExp(r'/+$'), '');
  if (t.isNotEmpty) _apiUrl = t;
}

String get apiUrl => _apiUrl;
String get mapboxAccessToken => _mapboxToken;
String get mediaPublicOrigin => _mediaPublicOrigin;
String get googleServerClientId => _googleServerClientId;
String get googleIosClientId => _googleIosClientId;
