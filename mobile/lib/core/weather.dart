// Court forecasts (Open-Meteo via our API): game-time weather, rain check and map rain badges.

int _int(dynamic v) => (v as num?)?.toInt() ?? 0;
double _dbl(dynamic v) => (v as num?)?.toDouble() ?? 0;

const _hour = 3600;

/// Rain chance (%) from which we flag a rain check.
const rainCheckPct = 50;

/// A slot counts as "drier" under this rain chance.
const _dryPct = 30;

class WeatherHour {
  /// Unix seconds (UTC), start of the hour.
  final int t;
  final double temp, precipMm, windKmh;
  final int rainPct, code;

  const WeatherHour({required this.t, this.temp = 0, this.rainPct = 0, this.precipMm = 0, this.code = 0, this.windKmh = 0});

  WeatherHour.fromJson(Map<String, dynamic> j)
      : t = _int(j['t']),
        temp = _dbl(j['temp']),
        rainPct = _int(j['rain_pct']),
        precipMm = _dbl(j['precip_mm']),
        code = _int(j['code']),
        windKmh = _dbl(j['wind_kmh']);

  DateTime get time => DateTime.fromMillisecondsSinceEpoch(t * 1000);
}

class Forecast {
  final List<WeatherHour> hours;
  const Forecast(this.hours);
  Forecast.fromJson(Map<String, dynamic> j)
      : hours = [for (final h in (j['hours'] ?? const [])) WeatherHour.fromJson(Map<String, dynamic>.from(h))];
}

enum WeatherKind { clear, partly, cloudy, fog, drizzle, rain, showers, storm }

/// WMO weather code → our coarse kind.
WeatherKind weatherKind(int code) {
  if (code == 0 || code == 1) return WeatherKind.clear;
  if (code == 2) return WeatherKind.partly;
  if (code == 3) return WeatherKind.cloudy;
  if (code == 45 || code == 48) return WeatherKind.fog;
  if (code >= 51 && code <= 57) return WeatherKind.drizzle;
  if ((code >= 61 && code <= 67) || (code >= 71 && code <= 77)) return WeatherKind.rain;
  if (code >= 80 && code <= 86) return WeatherKind.showers;
  if (code >= 95) return WeatherKind.storm;
  return WeatherKind.cloudy;
}

int _secs(DateTime d) => d.millisecondsSinceEpoch ~/ 1000;

/// Forecast hours overlapping [start, start + minutes).
List<WeatherHour> hoursFor(Forecast? f, DateTime start, int minutes) {
  if (f == null) return const [];
  final s = _secs(start);
  final from = (s ~/ _hour) * _hour;
  final to = s + minutes * 60;
  return f.hours.where((h) => h.t >= from && h.t < to).toList();
}

int worstRain(List<WeatherHour> hours) => hours.fold(0, (m, h) => h.rainPct > m ? h.rainPct : m);

bool isRainy(List<WeatherHour> hours) =>
    hours.any((h) => h.rainPct >= rainCheckPct || h.precipMm >= 1 || weatherKind(h.code) == WeatherKind.storm);

/// Nearest start time (on the hour, within -3h…+6h of the original, at least 30 min from now)
/// whose whole game window stays dry.
({DateTime at, int rain})? drierSlot(Forecast? f, DateTime start, int minutes, [DateTime? now]) {
  if (f == null) return null;
  final nowS = _secs(now ?? DateTime.now());
  final base = (_secs(start) / _hour).round() * _hour;
  final candidates = <int>[for (var d = 1; d <= 6; d++) ...[base + d * _hour, base - d * _hour]];
  final need = (minutes / 60).ceil();
  for (final c in candidates) {
    if (c - nowS < 30 * 60 || c < base - 3 * _hour) continue;
    final at = DateTime.fromMillisecondsSinceEpoch(c * 1000);
    final window = hoursFor(f, at, minutes);
    if (window.isEmpty || window.length < need) continue;
    final rain = worstRain(window);
    if (rain < _dryPct && !isRainy(window)) return (at: at, rain: rain);
  }
  return null;
}

/// A court where rain is likely in the next 3 hours (GET /api/courts/rain).
class CourtRain {
  final int rainPct;
  /// Unix seconds of the wettest hour.
  final int at;
  /// Raining in the current hour.
  final bool now;
  const CourtRain({required this.rainPct, required this.at, required this.now});
  CourtRain.fromJson(Map<String, dynamic> j)
      : rainPct = _int(j['rain_pct']),
        at = _int(j['at']),
        now = j['now'] == true;

  DateTime get time => DateTime.fromMillisecondsSinceEpoch(at * 1000);
}

/// Parses the `{courtId: {rain_pct, at, now}}` answer.
Map<String, CourtRain> parseCourtsRain(dynamic j) => {
      if (j is Map)
        for (final e in j.entries)
          if (e.value is Map) e.key as String: CourtRain.fromJson(Map<String, dynamic>.from(e.value as Map)),
    };

/// Caches map rain badges per court for 15 minutes so panning the map doesn't spam the API.
/// Failures are ignored (no badge) and retried after a short pause.
class CourtRainCache {
  CourtRainCache._();
  static final instance = CourtRainCache._();

  /// For tests.
  CourtRainCache.forTest();

  static const ttl = Duration(minutes: 15);
  static const retryAfterFailure = Duration(minutes: 2);
  static const maxIds = 150;

  final Map<String, ({CourtRain? rain, DateTime at})> _items = {};
  DateTime? _failedAt;
  Future<void>? _inflight;

  /// Courts among [ids] expecting rain. [get] performs the API GET and returns decoded JSON.
  Future<Map<String, CourtRain>> lookup(Iterable<String> ids, Future<dynamic> Function(String path) get, {DateTime? now}) async {
    final want = ids.toSet().take(maxIds).toList();
    if (want.isEmpty) return {};
    if (_inflight != null) {
      try {
        await _inflight;
      } catch (_) {}
    }
    final t = now ?? DateTime.now();
    final stale = want.where((id) {
      final e = _items[id];
      return e == null || t.difference(e.at) >= ttl;
    }).toList()
      ..sort();
    final failedRecently = _failedAt != null && t.difference(_failedAt!) < retryAfterFailure;
    if (stale.isNotEmpty && !failedRecently) {
      final fetch = () async {
        try {
          final got = parseCourtsRain(await get('/api/courts/rain?ids=${stale.join(',')}'));
          for (final id in stale) {
            _items[id] = (rain: got[id], at: t);
          }
          _failedAt = null;
        } catch (_) {
          _failedAt = t;
        }
      }();
      _inflight = fetch;
      await fetch;
      _inflight = null;
    }
    return {
      for (final id in want)
        if (_items[id]?.rain != null) id: _items[id]!.rain!,
    };
  }
}
