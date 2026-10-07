import 'package:flutter/material.dart';

import '../core/format.dart';
import '../core/l10n.dart';
import '../core/media_url.dart';
import '../core/models.dart';
import '../core/weather.dart';
import 'app_icons.dart';
import 'theme.dart';

/// Map marker: circle (court photo or sport) + stick pointing at the coordinate.
class CourtMapPin extends StatelessWidget {
  final Court? court;
  final VoidCallback? onTap;
  /// Filter highlight on the main map (ignored in [CourtMapPin.placement]).
  final String? sportSlug;
  final CourtPinTone? pinTone;
  final String? placementSportSlug;
  final String? placementPhotoUrl;
  /// Rain expected in the next hours: small rain-cloud badge on the pin.
  final CourtRain? rain;

  const CourtMapPin({
    super.key,
    required this.court,
    required this.onTap,
    this.sportSlug,
    this.pinTone,
    this.rain,
  })  : placementSportSlug = null,
        placementPhotoUrl = null;

  const CourtMapPin.placement({super.key, this.placementSportSlug, this.placementPhotoUrl})
      : court = null,
        onTap = null,
        sportSlug = null,
        pinTone = null,
        rain = null;

  static const double size = 46;
  static const double totalHeight = 62;

  static String? _photoUrl(Court court) {
    if (court.photos.isEmpty) return null;
    return resolveMediaUrl(court.photos.first);
  }

  @override
  Widget build(BuildContext context) {
    final c = court;
    final activity = c?.activity ?? Activity.inactive;
    final tone = pinTone ??
        switch (activity) {
          Activity.active => CourtPinTone.active,
          Activity.players => CourtPinTone.players,
          Activity.inactive => CourtPinTone.inactive,
        };
    final sport = c != null
        ? c.sports.where((s) => s.slug == sportSlug).firstOrNull ?? c.sports.firstOrNull
        : null;
    final slug = sport?.slug ?? placementSportSlug ?? 'basketball';
    final ring = switch (tone) {
      CourtPinTone.active => Palette.live,
      CourtPinTone.players => Palette.players,
      CourtPinTone.upcoming => Palette.upcoming,
      CourtPinTone.inactive => Theme.of(context).colorScheme.outline,
    };
    final photo = c != null
        ? _photoUrl(c)
        : (placementPhotoUrl != null && placementPhotoUrl!.isNotEmpty ? resolveMediaUrl(placementPhotoUrl!) : null);
    final showCount = c != null && tone != CourtPinTone.inactive && c.playerCount > 0;

    final pin = SizedBox(
      width: size + 8,
      height: totalHeight,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.topCenter,
        children: [
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: size,
                height: size,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2.5),
                  boxShadow: [
                    BoxShadow(
                      blurRadius: tone == CourtPinTone.active ? 12 : 6,
                      color: ring.withValues(alpha: tone == CourtPinTone.active ? 0.55 : 0.35),
                    ),
                  ],
                ),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: ring, width: 3),
                  ),
                  child: ClipOval(
                    child: photo != null
                        ? Image.network(
                            photo,
                            fit: BoxFit.cover,
                            width: size,
                            height: size,
                            errorBuilder: (_, _, _) => _thumb(slug, tone),
                          )
                        : _thumb(slug, tone),
                  ),
                ),
              ),
              CustomPaint(
                size: const Size(14, 12),
                painter: _PinStickPainter(ring),
              ),
            ],
          ),
          if (showCount)
            Positioned(
              top: size - 14,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: ring,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.white, width: 1.5),
                ),
                child: Text(
                  '${c.playerCount}',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 11, height: 1),
                ),
              ),
            ),
          if (rain != null)
            Positioned(
              top: -4,
              left: -2,
              child: Semantics(
                label: rainLabel(rain!),
                child: Container(
                  width: 22,
                  height: 22,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0xFF0EA5E9), width: 2),
                    boxShadow: const [BoxShadow(blurRadius: 4, color: Colors.black26)],
                  ),
                  child: const RainIcon(size: 13, color: Color(0xFF0284C7)),
                ),
              ),
            ),
        ],
      ),
    );

    if (onTap == null) return pin;
    return GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap, child: pin);
  }

  Widget _thumb(String slug, CourtPinTone tone) {
    final bg = switch (tone) {
      CourtPinTone.active => Palette.live.withValues(alpha: 0.12),
      CourtPinTone.players => Palette.players.withValues(alpha: 0.25),
      CourtPinTone.upcoming => Palette.upcoming.withValues(alpha: 0.12),
      CourtPinTone.inactive => const Color(0xFFF0EDE6),
    };
    return ColoredBox(
      color: bg,
      child: Center(
        child: tone == CourtPinTone.players
            ? const Icon(Icons.groups, size: 22, color: Color(0xFF8A6A00))
            : SportIcon(
                slug,
                size: 26,
                color: tone == CourtPinTone.active
                    ? Palette.live
                    : tone == CourtPinTone.upcoming
                        ? Palette.upcoming
                        : const Color(0xFF6B7280),
              ),
      ),
    );
  }
}

class _PinStickPainter extends CustomPainter {
  final Color color;
  _PinStickPainter(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(size.width * 0.5, size.height)
      ..lineTo(0, 0)
      ..lineTo(size.width, 0)
      ..close();
    canvas.drawPath(path, Paint()..color = color);
    canvas.drawPath(
      path,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );
  }

  @override
  bool shouldRepaint(covariant _PinStickPainter old) => old.color != color;
}

/// "Raining now" / "Rain likely around 18:00 (70%)".
String rainLabel(CourtRain r) => r.now
    ? tr('Raining now', 'Il pleut en ce moment')
    : tr('Rain likely around ${clock(r.time)} (${r.rainPct}%)', 'Pluie probable vers ${clock(r.time)} (${r.rainPct} %)');

/// Alias for tests and existing imports.
typedef CourtPin = CourtMapPin;
