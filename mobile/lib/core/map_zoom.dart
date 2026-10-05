/// Mapbox supports roughly 0 (world) through 22 (building detail).
const double mapMinZoom = 0;
const double mapMaxZoom = 22;

double clampMapZoom(double zoom) => zoom.clamp(mapMinZoom, mapMaxZoom);
