import 'env.dart';

bool _trustedMediaHost(String host) {
  final h = host.toLowerCase();
  final o = mediaPublicOrigin.trim();
  if (o.isNotEmpty) {
    final u = Uri.tryParse(o);
    if (u != null && u.host.toLowerCase() == h) return true;
  }
  return h.endsWith('.r2.dev');
}

bool _rewritableHost(String host) {
  final h = host.toLowerCase();
  if (h.isEmpty || h == 'localhost' || h.startsWith('127.')) return true;
  if (h.contains('example.com') || h.contains('placeholder') || h.contains('your-api')) return true;
  return RegExp(r'^\d{1,3}(\.\d{1,3}){3}$').hasMatch(h);
}

String? _uploadsPath(String url) {
  final trimmed = url.trim();
  if (trimmed.startsWith('/uploads/')) return trimmed;
  final uri = Uri.tryParse(trimmed);
  if (uri != null && uri.path.startsWith('/uploads/')) {
    return '${uri.path}${uri.hasQuery ? '?${uri.query}' : ''}';
  }
  return null;
}

/// Turn API upload URLs into something reachable on this device (LAN IP, emulator, etc.).
/// Strips bogus absolute hosts from old PUBLIC_BASE_URL values.
String resolveMediaUrl(String url) {
  final trimmed = url.trim();
  if (trimmed.isEmpty) return trimmed;
  final base = apiUrl.replaceAll(RegExp(r'/+$'), '');

  final upload = _uploadsPath(trimmed);
  if (upload != null) return '$base$upload';

  final uri = Uri.tryParse(trimmed);
  if (uri == null) return trimmed;

  if (trimmed.startsWith('/')) return '$base$trimmed';
  if (uri.host.isEmpty) return '$base/${trimmed.replaceFirst(RegExp(r'^/+'), '')}';

  if (uri.scheme == 'https' && _trustedMediaHost(uri.host)) return trimmed;

  if (_rewritableHost(uri.host)) {
    return '$base${uri.path}${uri.hasQuery ? '?${uri.query}' : ''}';
  }

  if (!uri.path.startsWith('/uploads/')) return '';
  return '$base${uri.path}${uri.hasQuery ? '?${uri.query}' : ''}';
}
