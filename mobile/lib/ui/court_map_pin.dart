import 'package:flutter/material.dart';

import '../core/media_url.dart';
import '../core/models.dart';
import 'app_icons.dart';
import 'theme.dart';

/// Map marker: circle (court photo or sport) + stick pointing at the coordinate.
class CourtMapPin extends StatelessWidget {
  final Court? court;
  final VoidCallback? onTap;
  /// Filter highlight on the main map (ignored in [CourtMapPin.placement]).
  final String? sportSlug;
  final String? placementSportSlug;
  final String? placementPhotoUrl;

  const CourtMapPin({super.key, required Court court, required VoidCallback onTap, this.sportSlug})
      : court = court,
        onTap = onTap,
        placementSportSlug = null,
        placementPhotoUrl = null;

  const CourtMapPin.placement({super.key, this.placementSportSlug, this.placementPhotoUrl})
      : court = null,
        onTap = null,
        sportSlug = null;

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
    final sport = c != null
        ? c.sports.where((s) => s.slug == sportSlug).firstOrNull ?? c.sports.firstOrNull
        : null;
    final slug = sport?.slug ?? placementSportSlug ?? 'basketball';
    final ring = switch (activity) {
      Activity.active => Palette.live,
      Activity.players => Palette.players,
      Activity.inactive => Theme.of(context).colorScheme.outline,
    };
    final photo = c != null
        ? _photoUrl(c)
        : (placementPhotoUrl != null && placementPhotoUrl!.isNotEmpty ? resolveMediaUrl(placementPhotoUrl!) : null);
    final showCount = c != null && activity != Activity.inactive && c.playerCount > 0;

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
                      blurRadius: activity == Activity.active ? 12 : 6,
                      color: ring.withValues(alpha: activity == Activity.active ? 0.55 : 0.35),
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
                            errorBuilder: (_, __, ___) => _thumb(slug, activity),
                          )
                        : _thumb(slug, activity),
                  ),
                ),
              ),
              CustomPaint(
                size: const Size(14, 12),
                painter: _PinStickPainter(ring),
              ),
            ],
          ),
          if (showCount && c != null)
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
        ],
      ),
    );

    if (onTap == null) return pin;
    return GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap, child: pin);
  }

  Widget _thumb(String slug, Activity activity) {
    final bg = switch (activity) {
      Activity.active => Palette.live.withValues(alpha: 0.12),
      Activity.players => Palette.players.withValues(alpha: 0.25),
      Activity.inactive => const Color(0xFFF0EDE6),
    };
    return ColoredBox(
      color: bg,
      child: Center(
        child: activity == Activity.players
            ? const Icon(Icons.groups, size: 22, color: Color(0xFF8A6A00))
            : SportIcon(slug, size: 26, color: activity == Activity.active ? Palette.live : const Color(0xFF6B7280)),
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

/// Alias for tests and existing imports.
typedef CourtPin = CourtMapPin;
