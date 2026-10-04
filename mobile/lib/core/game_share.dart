import 'package:flutter_dotenv/flutter_dotenv.dart';

const _defaultWebApp = 'https://game-finder-swart.vercel.app';

String get webAppUrl {
  final raw = dotenv.env['WEB_APP_URL']?.trim();
  if (raw != null && raw.isNotEmpty) return raw.replaceAll(RegExp(r'/+$'), '');
  return _defaultWebApp;
}

String gameShareUrl(String gameId) => '$webAppUrl/games/${Uri.encodeComponent(gameId)}';
