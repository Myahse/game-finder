import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import 'env.dart';
import 'l10n.dart';

class ApiException implements Exception {
  final int status;
  final String code, message;
  ApiException(this.status, this.code, this.message);
  @override
  String toString() => message;
}

String apiUserMessage(ApiException e) {
  switch (e.code) {
    case 'browse_location_mismatch':
      return 'This map area is outside your alert zone. Open the map where you play, or check in at a court when you travel.';
    case 'notify_jump_too_far':
      return 'Move your alert zone gradually, or check in at a court first.';
    case 'notify_rate_limited':
      return 'You can change your alert zone again in a few minutes.';
    case 'rate_limited':
      return 'Too many requests. Wait a minute and try again.';
    case 'too_many_pending_courts':
      return 'You already have pending court proposals waiting for review.';
    case 'game_not_started':
      return tr('Scores and stats open once the game starts.', 'Le score et les stats s’ouvrent au début du match.');
    default:
      return e.message;
  }
}

String errorText(Object e) {
  if (e is ApiException) return apiUserMessage(e);
  if (e is TimeoutException || e is http.ClientException) return "Can't reach the server. Check your connection.";
  return 'Something went wrong.';
}

class Session {
  final String accessToken, refreshToken;
  final DateTime accessExpiresAt;
  final Map<String, dynamic> user;
  Session(this.accessToken, this.refreshToken, this.accessExpiresAt, this.user);

  factory Session.fromJson(Map<String, dynamic> j) => Session(
        j['access_token'],
        j['refresh_token'],
        DateTime.parse(j['access_expires_at']),
        Map<String, dynamic>.from(j['user']),
      );

  Map<String, dynamic> toJson() => {
        'access_token': accessToken,
        'refresh_token': refreshToken,
        'access_expires_at': accessExpiresAt.toIso8601String(),
        'user': user,
      };
}

/// HTTP client with token storage and transparent refresh.
class Api extends ChangeNotifier {
  static const _key = 'ftg.session';
  final _storage = const FlutterSecureStorage();
  final _http = http.Client();
  Session? session;
  Future<bool>? _refreshing;

  Future<void> load() async {
    try {
      final raw = await _storage.read(key: _key);
      if (raw != null) session = Session.fromJson(jsonDecode(raw));
    } catch (_) {
      session = null;
    }
  }

  Future<void> setSession(Session? s) async {
    session = s;
    if (s == null) {
      await _storage.delete(key: _key);
    } else {
      await _storage.write(key: _key, value: jsonEncode(s.toJson()));
    }
    notifyListeners();
  }

  Future<String?> accessToken() async {
    final s = session;
    if (s == null) return null;
    if (s.accessExpiresAt.difference(DateTime.now()).inSeconds < 30) await _refresh();
    return session?.accessToken;
  }

  Future<bool> _refresh() {
    return _refreshing ??= () async {
      try {
        final res = await _http
            .post(Uri.parse('$apiUrl/api/auth/refresh'),
                headers: {'Content-Type': 'application/json', 'Accept-Language': deviceLanguage},
                body: jsonEncode({'refresh_token': session!.refreshToken}))
            .timeout(const Duration(seconds: 15));
        if (res.statusCode != 200) {
          await setSession(null);
          return false;
        }
        await setSession(Session.fromJson(jsonDecode(res.body)));
        return true;
      } catch (_) {
        return false;
      } finally {
        _refreshing = null;
      }
    }();
  }

  Future<dynamic> request(String method, String path, {Object? body, bool retry = true}) async {
    final token = await accessToken();
    final req = http.Request(method, Uri.parse('$apiUrl$path'));
    // The server writes notifications and sport names in the device language.
    req.headers['Accept-Language'] = deviceLanguage;
    if (token != null) req.headers['Authorization'] = 'Bearer $token';
    if (body != null) {
      req.headers['Content-Type'] = 'application/json';
      req.body = jsonEncode(body);
    }
    final res = await http.Response.fromStream(await _http.send(req).timeout(const Duration(seconds: 20)));
    if (res.statusCode == 401 && retry && session != null && await _refresh()) {
      return request(method, path, body: body, retry: false);
    }
    return _decode(res);
  }

  dynamic _decode(http.Response res) {
    if (res.statusCode == 204) return null;
    final data = res.body.isEmpty ? null : jsonDecode(utf8.decode(res.bodyBytes));
    if (res.statusCode >= 400) {
      throw ApiException(res.statusCode, data?['error'] ?? 'error', data?['message'] ?? 'Something went wrong.');
    }
    return data;
  }

  Future<dynamic> get(String path) => request('GET', path);
  Future<dynamic> post(String path, [Object? body]) => request('POST', path, body: body);
  Future<dynamic> patch(String path, Object body) => request('PATCH', path, body: body);
  Future<dynamic> put(String path, Object body) => request('PUT', path, body: body);
  Future<dynamic> delete(String path, [Object? body]) => request('DELETE', path, body: body);

  /// Uploads an avatar or court photo; returns its public URL.
  Future<String> upload(List<int> bytes, String filename, String kind) async {
    Future<String> send({bool retry = true}) async {
      final req = http.MultipartRequest('POST', Uri.parse('$apiUrl/api/uploads'))
        ..fields['kind'] = kind
        ..headers['Accept-Language'] = deviceLanguage
        ..files.add(_multipartImage(bytes, filename));
      final token = await accessToken();
      if (token != null) req.headers['Authorization'] = 'Bearer $token';
      final res = await http.Response.fromStream(await _http.send(req).timeout(const Duration(seconds: 90)));
      if (res.statusCode == 401 && retry && session != null && await _refresh()) {
        return send(retry: false);
      }
      final data = _decode(res);
      if (data is! Map || data['url'] is! String) {
        throw ApiException(res.statusCode, 'invalid_response', 'Upload failed — try again.');
      }
      // Store the server URL in the DB; resolve to [apiUrl] only when displaying.
      return data['url'] as String;
    }

    return send();
  }
}

http.MultipartFile _multipartImage(List<int> bytes, String filename) {
  final name = filename.trim().isEmpty ? 'photo.jpg' : filename;
  return http.MultipartFile.fromBytes(
    'file',
    bytes,
    filename: name,
    contentType: _imageMediaType(bytes, name),
  );
}

MediaType _imageMediaType(List<int> bytes, String filename) {
  if (bytes.length >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF) {
    return MediaType('image', 'jpeg');
  }
  if (bytes.length >= 8 &&
      bytes[0] == 0x89 &&
      bytes[1] == 0x50 &&
      bytes[2] == 0x4E &&
      bytes[3] == 0x47) {
    return MediaType('image', 'png');
  }
  if (bytes.length >= 12 &&
      bytes[0] == 0x52 &&
      bytes[1] == 0x49 &&
      bytes[2] == 0x46 &&
      bytes[3] == 0x46) {
    return MediaType('image', 'webp');
  }
  final lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return MediaType('image', 'png');
  if (lower.endsWith('.webp')) return MediaType('image', 'webp');
  return MediaType('image', 'jpeg');
}
