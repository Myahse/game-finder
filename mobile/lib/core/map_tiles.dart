import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';

import 'env.dart';

String mapboxStyleUri({required bool dark}) =>
    dark ? MapboxStyles.DARK : MapboxStyles.MAPBOX_STREETS;

String mapboxTileUrl({required bool dark}) {
  final style = dark ? 'dark-v11' : 'streets-v12';
  final token = mapboxAccessToken.trim();
  return 'https://api.mapbox.com/styles/v1/mapbox/$style/tiles/256/{z}/{x}/{y}{r}?access_token=$token';
}

bool mapboxConfigured() => mapboxAccessToken.trim().isNotEmpty;
