import 'package:flutter/services.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:share_plus/share_plus.dart';

import 'api.dart';
import 'format.dart';
import 'models.dart';

const _defaultWebApp = 'https://www.outforground.com';

String get webAppUrl {
  final raw = dotenv.isInitialized ? dotenv.env['WEB_APP_URL']?.trim() : null;
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

/// Direct link — opens court details even when the pin is outside the map radius
/// (same format as the web's courtShareUrl).
String courtShareUrl(String courtId) => '$webAppUrl/courts/${Uri.encodeComponent(courtId)}';

/// Web: `${court} · ${type}` for a game; the share title adds " · Out For Ground".
String gameShareText(String courtName, String typeLabel) => '$courtName · $typeLabel';

String findTheGameTitle(String name) => '$name · Out For Ground';

/// What goes in the share sheet: the text, then the link on its own line.
String shareMessage(String text, String url) => text.trim().isEmpty ? url : '$text\n$url';

/// Opens the system share sheet with [text] and [url]. Falls back to copying
/// [url] when the sheet can't open; returns true when it was copied instead.
Future<bool> shareLink({required String text, required String url, String? subject, Rect? origin}) async {
  try {
    await SharePlus.instance.share(ShareParams(
      text: shareMessage(text, url),
      subject: subject,
      title: subject,
      sharePositionOrigin: origin,
    ));
    return false;
  } catch (_) {
    await Clipboard.setData(ClipboardData(text: url));
    return true;
  }
}

/// Creates the game's share link and opens the share sheet (web ShareGameButton).
Future<bool> shareGame(Api api, Game g, {Rect? origin}) async {
  final url = await createGameShareUrl(api, g.id);
  final text = gameShareText(g.courtName, gameTypeLabels[g.gameType] ?? g.gameType);
  return shareLink(text: text, url: url, subject: findTheGameTitle(text), origin: origin);
}

/// Shares a court's page (web ShareCourtButton).
Future<bool> shareCourt(String courtId, String courtName, {Rect? origin}) =>
    shareLink(text: courtName, url: courtShareUrl(courtId), subject: findTheGameTitle(courtName), origin: origin);
