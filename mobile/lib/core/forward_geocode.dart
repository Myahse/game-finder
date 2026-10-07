import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';

import 'env.dart';
import 'models.dart';

/// A place from Mapbox forward geocoding.
class GeocodePlace {
  final String id, name;
  final LatLng at;
  const GeocodePlace(this.id, this.name, this.at);
}

/// Parses a Mapbox `mapbox.places` response (center is [lng, lat]).
List<GeocodePlace> parseGeocodePlaces(Map<String, dynamic> data) {
  final out = <GeocodePlace>[];
  for (final f in (data['features'] as List? ?? const [])) {
    if (f is! Map) continue;
    final center = f['center'];
    final name = (f['place_name'] as String?)?.trim();
    if (center is! List || center.length < 2 || name == null || name.isEmpty) continue;
    final lng = (center[0] as num).toDouble(), lat = (center[1] as num).toDouble();
    out.add(GeocodePlace('${f['id'] ?? name}', name, LatLng(lat, lng)));
  }
  return out;
}

/// Nearest first when the player's position is known (web rankFeatures).
List<GeocodePlace> rankPlaces(List<GeocodePlace> places, LatLng? proximity) {
  if (proximity == null) return places;
  const d = Distance();
  return [...places]..sort((a, b) => d(proximity, a.at).compareTo(d(proximity, b.at)));
}

/// Courts whose name contains [query] (2+ characters), at most 6 — web MapSearchBar.
List<Court> searchCourtsByName(List<Court> courts, String query) {
  final q = query.trim().toLowerCase();
  if (q.length < 2) return const [];
  return courts.where((c) => c.name.toLowerCase().contains(q)).take(6).toList();
}

/// Mapbox forward geocode — biased to the player's position (web forwardGeocode).
Future<List<GeocodePlace>> forwardGeocode(String query, {LatLng? proximity}) async {
  final token = mapboxAccessToken;
  final q = query.trim();
  if (token.isEmpty || q.length < 2) return const [];
  final uri = Uri.https('api.mapbox.com', '/geocoding/v5/mapbox.places/${q.replaceAll('/', ' ')}.json', {
    'access_token': token,
    'limit': '8',
    'autocomplete': 'true',
    'types': 'address,poi,place,locality,neighborhood',
    if (proximity != null) 'proximity': '${proximity.longitude},${proximity.latitude}',
  });
  try {
    final res = await http.get(uri);
    if (res.statusCode != 200) return const [];
    final places = parseGeocodePlaces(jsonDecode(res.body) as Map<String, dynamic>);
    return rankPlaces(places, proximity).take(6).toList();
  } catch (_) {
    return const [];
  }
}
