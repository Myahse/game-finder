import 'package:flutter_dotenv/flutter_dotenv.dart';

import 'api.dart';

const _defaultWebApp = 'https://game-finder-swart.vercel.app';

String get webAppUrl {
  final raw = dotenv.env['WEB_APP_URL']?.trim();
  if (raw != null && raw.isNotEmpty) return raw.replaceAll(RegExp(r'/+$'), '');
  return _defaultWebApp;
}

String gameShareUrlFromToken(String token) =>
    '$webAppUrl/g/${Uri.encodeComponent(token.trim())}';

Future<String> createGameShareUrl(Api api, String gameId) async {
  final j = await api.post('/api/games/$gameId/share-link', null);
  final token = j['token'] as String;
  return gameShareUrlFromToken(token);
}
