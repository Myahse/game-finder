import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';

import 'env.dart';

/// Call once after [loadAppEnv] so [MapWidget] can load tiles.
void initMapboxAccessToken() {
  final token = mapboxAccessToken.trim();
  if (token.isNotEmpty) {
    MapboxOptions.setAccessToken(token);
  }
}
