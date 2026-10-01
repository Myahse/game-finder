import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import 'env.dart';

class ApiException implements Exception {
  final int status;
  final String code, message;
  ApiException(this.status, this.code, this.message);
  @override
  String toString() => message;
}

String errorText(Object e) {
  if (e is ApiException) return e.message;
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
                headers: {'Content-Type': 'application/json'},
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
  Future<dynamic> delete(String path, [Object? body]) => request('DELETE', path, body: body);

  /// Uploads an avatar or court photo; returns its public URL.
  Future<String> upload(List<int> bytes, String filename, String kind) async {
    final req = http.MultipartRequest('POST', Uri.parse('$apiUrl/api/uploads'))
      ..fields['kind'] = kind
      ..files.add(http.MultipartFile.fromBytes('file', bytes, filename: filename));
    final token = await accessToken();
    if (token != null) req.headers['Authorization'] = 'Bearer $token';
    final res = await http.Response.fromStream(await req.send().timeout(const Duration(seconds: 60)));
    return (_decode(res) as Map)['url'] as String;
  }
}
