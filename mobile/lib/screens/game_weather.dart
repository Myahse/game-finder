import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/l10n.dart';
import '../core/models.dart';
import '../core/weather.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'court_move.dart';

const _sky = Color(0xFF0EA5E9);
const _skyDeep = Color(0xFF0369A1);

IconData weatherIcon(WeatherKind k) => switch (k) {
      WeatherKind.clear => Icons.wb_sunny_outlined,
      WeatherKind.partly => Icons.wb_cloudy_outlined,
      WeatherKind.cloudy => Icons.cloud_outlined,
      WeatherKind.fog => Icons.foggy,
      WeatherKind.drizzle => Icons.grain,
      WeatherKind.rain => Icons.umbrella,
      WeatherKind.showers => Icons.umbrella,
      WeatherKind.storm => Icons.thunderstorm_outlined,
    };

String weatherLabel(WeatherKind k) => switch (k) {
      WeatherKind.clear => tr('Clear', 'Ensoleillé'),
      WeatherKind.partly => tr('Partly cloudy', 'Éclaircies'),
      WeatherKind.cloudy => tr('Cloudy', 'Nuageux'),
      WeatherKind.fog => tr('Fog', 'Brouillard'),
      WeatherKind.drizzle => tr('Drizzle', 'Bruine'),
      WeatherKind.rain => tr('Rain', 'Pluie'),
      WeatherKind.showers => tr('Showers', 'Averses'),
      WeatherKind.storm => tr('Thunderstorm', 'Orage'),
    };

/// Forecast for the game window + a "rain check" when rain is likely.
class GameWeather extends StatefulWidget {
  final Game game;
  /// Host or admin: may move or call off the game.
  final bool isHost;
  /// Calls the existing cancel action with [reason].
  final Future<void> Function(String reason) onCallOff;
  /// The game changed (new start time or court): reload it.
  final VoidCallback onChanged;
  const GameWeather({super.key, required this.game, required this.isHost, required this.onCallOff, required this.onChanged});

  @override
  State<GameWeather> createState() => _GameWeatherState();
}

class _GameWeatherState extends State<GameWeather> {
  Forecast? _forecast;
  bool _failed = false;
  bool _moving = false;
  String? _error, _note;

  bool get _open => widget.game.isOpen;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant GameWeather old) {
    super.didUpdateWidget(old);
    if (old.game.courtId != widget.game.courtId) {
      _forecast = null;
      _load();
    }
  }

  Future<void> _load() async {
    if (!_open) return;
    try {
      final j = await context.read<Api>().get('/api/courts/${widget.game.courtId}/weather');
      if (mounted) setState(() => _forecast = Forecast.fromJson(Map<String, dynamic>.from(j)));
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    }
  }

  Future<void> _moveTo(DateTime at) async {
    setState(() {
      _moving = true;
      _error = null;
    });
    try {
      await context.read<Api>().patch('/api/games/${widget.game.id}', {'start_time': at.toUtc().toIso8601String()});
      if (!mounted) return;
      setState(() => _note = tr('Game moved to ${clock(at)}.', 'Match décalé à ${clock(at)}.'));
      widget.onChanged();
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _moving = false);
    }
  }

  Future<void> _callOff() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        content: Text(tr('Call off this game because of the rain? Players will be notified.',
            'Annuler ce match à cause de la pluie ? Les joueurs seront prévenus.')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(tr('Keep it', 'Le garder'))),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Theme.of(ctx).colorScheme.error),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(tr('Call it off', 'Annuler le match')),
          ),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _error = null);
    await widget.onCallOff(tr('Rain check — called off because of the weather', 'Annulé à cause de la pluie'));
  }

  Future<void> _moveCourt() async {
    final g = widget.game;
    final moved = await showMoveCourtSheet(context,
        kind: 'game', id: g.id, sportId: g.sportId, sportSlug: g.sport.slug,
        courtId: g.courtId, courtName: g.courtName, lat: g.courtLat, lng: g.courtLng, rain: true);
    if (moved == true) widget.onChanged();
  }

  @override
  Widget build(BuildContext context) {
    final g = widget.game;
    final f = _forecast;
    if (!_open || _failed || f == null) return const SizedBox.shrink();
    final window = hoursFor(f, g.startTime, g.durationMinutes);
    if (window.isEmpty) return const SizedBox.shrink();

    final theme = Theme.of(context);
    final muted = theme.colorScheme.onSurfaceVariant;
    final main = window.first;
    final kind = weatherKind(main.code);
    final rainy = isRainy(window);
    final rain = worstRain(window);
    final slot = rainy && g.status == 'scheduled' ? drierSlot(f, g.startTime, g.durationMinutes) : null;

    return Card(
      shape: rainy
          ? RoundedRectangleBorder(borderRadius: BorderRadius.circular(18), side: BorderSide(color: _sky.withValues(alpha: 0.6), width: 2))
          : null,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(tr('WEATHER AT GAME TIME', 'MÉTÉO À L’HEURE DU MATCH'),
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900, color: muted)),
          const SizedBox(height: 8),
          Row(children: [
            Icon(weatherIcon(kind), size: 52, color: rainy ? _sky : const Color(0xFFF59E0B)),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${main.temp.round()}°', style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w900, height: 1)),
                Text(weatherLabel(kind), style: const TextStyle(fontWeight: FontWeight.w700)),
              ]),
            ),
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Icon(Icons.water_drop_outlined, size: 16, color: muted),
                const SizedBox(width: 4),
                Text('$rain% ${tr('rain', 'pluie')}', style: TextStyle(color: muted)),
              ]),
              const SizedBox(height: 4),
              Row(children: [
                Icon(Icons.air, size: 16, color: muted),
                const SizedBox(width: 4),
                Text('${main.windKmh.round()} km/h', style: TextStyle(color: muted)),
              ]),
            ]),
          ]),
          if (window.length > 1) ...[
            const SizedBox(height: 12),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(children: [
                for (final h in window.take(6))
                  Container(
                    width: 64,
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    decoration: BoxDecoration(color: theme.colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(12)),
                    child: Column(children: [
                      Text(clock(h.time), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: muted)),
                      Padding(padding: const EdgeInsets.symmetric(vertical: 2), child: Icon(weatherIcon(weatherKind(h.code)), size: 20)),
                      Text('${h.temp.round()}°', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900)),
                      Text('${h.rainPct}%',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: h.rainPct >= rainCheckPct ? FontWeight.w900 : FontWeight.w500,
                            color: h.rainPct >= rainCheckPct ? _skyDeep : muted,
                          )),
                    ]),
                  ),
              ]),
            ),
          ],
          const SizedBox(height: 12),
          if (rainy)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: _sky.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Row(children: [
                  const Icon(Icons.umbrella, size: 20, color: _skyDeep),
                  const SizedBox(width: 6),
                  Text(tr('RAIN CHECK', 'ALERTE PLUIE'),
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: _skyDeep)),
                ]),
                const SizedBox(height: 4),
                Text(tr('$rain% chance of rain around game time.', '$rain % de risque de pluie à l’heure du match.')),
                if (slot != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      tr('Drier at ${clock(slot.at)} (${slot.rain}% rain)', 'Plus sec à ${clock(slot.at)} (${slot.rain} % de pluie)'),
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                if (widget.isHost) ...[
                  const SizedBox(height: 10),
                  if (slot != null) ...[
                    FilledButton(
                      onPressed: _moving ? null : () => _moveTo(slot.at),
                      child: _moving
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : Text(tr('MOVE TO ${clock(slot.at)}', 'DÉCALER À ${clock(slot.at)}')),
                    ),
                    const SizedBox(height: 8),
                  ],
                  OutlinedButton.icon(
                    onPressed: _moveCourt,
                    icon: const Icon(Icons.edit_location_alt_outlined),
                    label: Text(tr('MOVE TO A DRY COURT', 'DÉPLACER VERS UN TERRAIN AU SEC')),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(foregroundColor: theme.colorScheme.error),
                    onPressed: _callOff,
                    child: Text(tr('CALL IT OFF', 'ANNULER LE MATCH')),
                  ),
                ] else
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(tr('The host can move or call off the game.', 'L’organisateur peut décaler ou annuler le match.'),
                        style: TextStyle(fontSize: 12, color: muted)),
                  ),
              ]),
            )
          else
            Text(tr('Looks good for playing.', 'Bonne météo pour jouer.'), style: TextStyle(color: muted)),
          if (_error != null) ...[const SizedBox(height: 8), ErrorBanner(_error)],
          if (_note != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(_note!, style: const TextStyle(fontWeight: FontWeight.w700, color: Palette.live)),
            ),
          Align(
            alignment: Alignment.centerRight,
            child: InkWell(
              onTap: () => launchUrl(Uri.parse('https://open-meteo.com/'), mode: LaunchMode.externalApplication),
              child: Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(tr('Weather data by Open-Meteo.com', 'Données météo : Open-Meteo.com'),
                    style: TextStyle(fontSize: 10, color: muted, decoration: TextDecoration.underline)),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}
