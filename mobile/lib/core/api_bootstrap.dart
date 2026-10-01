import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:network_info_plus/network_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'env.dart';

const _prefsApiUrl = 'ftg.api_url';

/// Updated during [ensureApiReachable]; gates the app until true (or user retries).
bool apiReachable = false;

String _normalizeBase(String base) => base.trim().replaceAll(RegExp(r'/+$'), '');

Future<bool> _probeHealthz(String base) async {
  final root = _normalizeBase(base);
  if (root.isEmpty) return false;
  try {
    final res = await http.get(Uri.parse('$root/healthz')).timeout(const Duration(seconds: 2));
    if (res.statusCode != 200) return false;
    final data = jsonDecode(res.body);
    return data is Map && data['ok'] == true;
  } catch (_) {
    return false;
  }
}

Future<String?> _localWifiIPv4() async {
  try {
    for (final iface in await NetworkInterface.list(
      type: InternetAddressType.IPv4,
      includeLinkLocal: false,
    )) {
      for (final addr in iface.addresses) {
        final ip = addr.address;
        if (ip.startsWith('192.168.') || ip.startsWith('10.')) return ip;
      }
    }
  } catch (_) {}

  try {
    final wifi = await NetworkInfo().getWifiIP();
    if (wifi != null && wifi.isNotEmpty && !wifi.startsWith('127.') && !wifi.startsWith('10.0.2.')) {
      return wifi;
    }
  } catch (_) {}
  return null;
}

List<String> _candidateUrls(SharedPreferences prefs) {
  final out = <String>[];
  void add(String? raw) {
    if (raw == null) return;
    final u = _normalizeBase(raw);
    if (u.isEmpty || out.contains(u)) return;
    out.add(u);
  }

  const defineApi = String.fromEnvironment('API_URL');
  add(defineApi.isNotEmpty ? defineApi : null);
  add(prefs.getString(_prefsApiUrl));
  add(apiUrl);
  if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
    add('http://10.0.2.2:8080');
  }
  return out;
}

Future<String?> _discoverOnSubnet(String wifiIp) async {
  final parts = wifiIp.split('.');
  if (parts.length != 4) return null;
  final self = int.tryParse(parts[3]);
  if (self == null) return null;
  final prefix = '${parts[0]}.${parts[1]}.${parts[2]}';

  // Likely DHCP / PC addresses first, then the rest.
  final hosts = <int>[];
  for (var h = 2; h < 256; h++) {
    if (h != self) hosts.add(h);
  }
  hosts.sort((a, b) {
    int score(int h) {
      if (h == 1) return 0;
      if (h >= 100 && h <= 254) return 1;
      return 2;
    }
    return score(a).compareTo(score(b));
  });

  const batch = 32;
  for (var i = 0; i < hosts.length; i += batch) {
    final slice = hosts.skip(i).take(batch);
    final hits = await Future.wait(slice.map((h) async {
      final url = 'http://$prefix.$h:8080';
      return await _probeHealthz(url) ? url : null;
    }));
    for (final hit in hits) {
      if (hit != null) return hit;
    }
  }
  return null;
}

Future<bool> _tryUrl(String url, SharedPreferences prefs) async {
  if (!await _probeHealthz(url)) return false;
  setApiUrl(url);
  await prefs.setString(_prefsApiUrl, url);
  apiReachable = true;
  if (kDebugMode) debugPrint('Find the Game API reachable at $url');
  return true;
}

/// Picks a working API base URL before the UI loads data.
Future<bool> ensureApiReachable({Duration budget = const Duration(seconds: 25)}) async {
  apiReachable = false;
  final prefs = await SharedPreferences.getInstance();
  final deadline = DateTime.now().add(budget);

  while (DateTime.now().isBefore(deadline)) {
    for (final url in _candidateUrls(prefs)) {
      if (await _tryUrl(url, prefs)) return true;
    }

    final wifi = await _localWifiIPv4();
    if (wifi != null && !wifi.startsWith('10.0.2.')) {
      final found = await _discoverOnSubnet(wifi);
      if (found != null && await _tryUrl(found, prefs)) return true;
    }

    await Future.delayed(const Duration(milliseconds: 500));
  }

  if (kDebugMode) {
    debugPrint('Find the Game API not reachable (tried $apiUrl). '
        'On PC: docker compose up -d db api, allow port 8080 in firewall, use run-device.ps1');
  }
  return false;
}
