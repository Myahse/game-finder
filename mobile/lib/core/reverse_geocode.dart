import 'dart:convert';

import 'package:http/http.dart' as http;

import 'env.dart';

/// Mapbox reverse geocode — human-readable place name for coordinates.
Future<String?> reverseGeocode(double latitude, double longitude) async {
  final token = mapboxAccessToken;
  if (token.isEmpty) return null;
  final uri = Uri.https(
    'api.mapbox.com',
    '/geocoding/v5/mapbox.places/$longitude,$latitude.json',
    {
      'access_token': token,
      'limit': '1',
      'types': 'address,poi,place,locality,neighborhood',
    },
  );
  try {
    final res = await http.get(uri);
    if (res.statusCode != 200) return null;
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    final features = data['features'] as List<dynamic>?;
    if (features == null || features.isEmpty) return null;
    final name = (features.first as Map<String, dynamic>)['place_name'] as String?;
    final trimmed = name?.trim();
    return (trimmed == null || trimmed.isEmpty) ? null : trimmed;
  } catch (_) {
    return null;
  }
}
