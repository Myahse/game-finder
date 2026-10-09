import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/models.dart';
import '../core/my_sport.dart';
import 'theme.dart';

IconData sportIconData(String slug) {
  switch (slug) {
    case 'basketball':
      return Icons.sports_basketball;
    case 'football':
      return Icons.sports_soccer;
    case 'volleyball':
      return Icons.sports_volleyball;
    case 'tennis':
      return Icons.sports_tennis;
    case 'badminton':
      return Icons.sports;
    default:
      return Icons.place;
  }
}

IconData sportIconDataOutlined(String slug) {
  switch (slug) {
    case 'basketball':
      return Icons.sports_basketball_outlined;
    case 'football':
      return Icons.sports_soccer_outlined;
    case 'volleyball':
      return Icons.sports_volleyball_outlined;
    case 'tennis':
      return Icons.sports_tennis_outlined;
    default:
      return Icons.sports_outlined;
  }
}

/// Sport-neutral mark (whistle) for logged-out screens and while the player's
/// sport is still unknown.
const kNeutralSportIcon = Icons.sports;

/// Icon of the signed-in player's main sport — the app's sport mark (Play tab,
/// empty states, prompts), like the web's BaseSportIcon. Rebuilds when the
/// user or the sports list changes; works without providers (tests).
IconData baseSportIconData(BuildContext context, {bool outlined = false}) {
  final user = Provider.of<AuthState?>(context)?.user;
  final id = user?.preferredSportId;
  if (id == null) return outlined ? Icons.sports_outlined : kNeutralSportIcon;
  final sports = knownSports.value;
  if (sports.isEmpty) {
    final api = Provider.of<Api?>(context, listen: false);
    if (api != null) ensureKnownSports(api.get);
  }
  final slug = sportSlugForUser(user, sports);
  if (slug == null) return outlined ? Icons.sports_outlined : kNeutralSportIcon;
  return outlined ? sportIconDataOutlined(slug) : sportIconData(slug);
}

class BaseSportIcon extends StatelessWidget {
  final double? size;
  final Color? color;
  final bool outlined;
  const BaseSportIcon({super.key, this.size, this.color, this.outlined = false});

  @override
  Widget build(BuildContext context) => BaseSportBuilder(
        builder: (context, data) => Icon(data(outlined: outlined), size: size, color: color),
      );
}

/// Rebuilds [builder] when the shared sports list arrives; [builder] gets a
/// resolver for the player's base sport icon.
class BaseSportBuilder extends StatelessWidget {
  final Widget Function(BuildContext context, IconData Function({bool outlined}) icon) builder;
  const BaseSportBuilder({super.key, required this.builder});

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<List<Sport>>(
        valueListenable: knownSports,
        builder: (context, _, _) => builder(context, ({bool outlined = false}) => baseSportIconData(context, outlined: outlined)),
      );
}

class SportIcon extends StatelessWidget {
  final String slug;
  final double size;
  final Color? color;
  const SportIcon(this.slug, {super.key, this.size = 20, this.color});

  @override
  Widget build(BuildContext context) {
    return Icon(sportIconData(slug), size: size, color: color);
  }
}

IconData activityIconData(Activity activity) {
  switch (activity) {
    case Activity.active:
      return Icons.local_fire_department;
    case Activity.players:
      return Icons.groups;
    case Activity.inactive:
      return Icons.circle_outlined;
  }
}

class SportInline extends StatelessWidget {
  final Sport sport;
  final double iconSize;
  final TextStyle? textStyle;
  const SportInline(this.sport, {super.key, this.iconSize = 16, this.textStyle});

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SportIcon(sport.slug, size: iconSize),
          const SizedBox(width: 6),
          Text(sport.name, style: textStyle),
        ],
      );
}

class PresenceLiveText extends StatelessWidget {
  final String text;
  final TextAlign? textAlign;
  const PresenceLiveText(this.text, {super.key, this.textAlign});

  @override
  Widget build(BuildContext context) => Row(
        mainAxisAlignment: textAlign == TextAlign.center ? MainAxisAlignment.center : MainAxisAlignment.start,
        children: [
          const Icon(Icons.circle, size: 10, color: Palette.live),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              text,
              textAlign: textAlign,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Palette.live, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      );
}

/// Row icon for a notification; [data] refines a type (a court move arrives
/// as game_activity with kind court_change).
IconData notificationIconData(String type, {Map<String, dynamic> data = const {}}) {
  if (data['kind'] == 'court_change') return Icons.place;
  if (data['kind'] == 'card_tier') return Icons.style_outlined;
  switch (type) {
    case 'game_reminder':
      return Icons.schedule;
    case 'game_invite':
      return Icons.handshake_outlined;
    case 'game_activity':
      return Icons.local_fire_department;
    case 'game_created':
      return Icons.sports;
    case 'court_added':
      return Icons.add_location_alt_outlined;
    case 'presence_check':
      return Icons.place;
    case 'game_cancelled':
      return Icons.close;
    default:
      return Icons.campaign_outlined;
  }
}

/// Icons Material has no (good) match for, drawn from lucide's outlines (24×24 grid,
/// 2px round stroke) so they match the web app.
enum CustomGlyph { crown, swords, cloudRain }

/// One icon of the app's set: a Material glyph or a [CustomGlyph]. Lets data
/// (badges, challenge formats) name an icon without caring how it is drawn.
class AppGlyph {
  final IconData? material;
  final CustomGlyph? custom;
  const AppGlyph(IconData this.material) : custom = null;
  const AppGlyph._custom(CustomGlyph this.custom) : material = null;

  static const crown = AppGlyph._custom(CustomGlyph.crown);
  static const swords = AppGlyph._custom(CustomGlyph.swords);
  static const cloudRain = AppGlyph._custom(CustomGlyph.cloudRain);
}

/// Draws an [AppGlyph]; sized and coloured like [Icon] (IconTheme defaults).
class AppGlyphIcon extends StatelessWidget {
  final AppGlyph glyph;
  final double? size;
  final Color? color;
  final String? semanticLabel;
  const AppGlyphIcon(this.glyph, {super.key, this.size, this.color, this.semanticLabel});

  @override
  Widget build(BuildContext context) {
    final material = glyph.material;
    if (material != null) return Icon(material, size: size, color: color, semanticLabel: semanticLabel);
    return CustomGlyphIcon(glyph.custom!, size: size, color: color, semanticLabel: semanticLabel);
  }
}

/// A [CustomGlyph] as an icon widget.
class CustomGlyphIcon extends StatelessWidget {
  final CustomGlyph glyph;
  final double? size;
  final Color? color;
  final String? semanticLabel;
  const CustomGlyphIcon(this.glyph, {super.key, this.size, this.color, this.semanticLabel});

  @override
  Widget build(BuildContext context) {
    final theme = IconTheme.of(context);
    final s = size ?? theme.size ?? 24;
    var c = color ?? theme.color ?? const Color(0xFF000000);
    final opacity = theme.opacity;
    if (color == null && opacity != null && opacity < 1) c = c.withValues(alpha: c.a * opacity);
    final icon = SizedBox(width: s, height: s, child: Center(child: CustomPaint(size: Size.square(s), painter: _GlyphPainter(glyph, c))));
    final label = semanticLabel;
    return label == null ? ExcludeSemantics(child: icon) : Semantics(label: label, child: ExcludeSemantics(child: icon));
  }
}

class CrownIcon extends CustomGlyphIcon {
  const CrownIcon({super.key, super.size, super.color, super.semanticLabel}) : super(CustomGlyph.crown);
}

class SwordsIcon extends CustomGlyphIcon {
  const SwordsIcon({super.key, super.size, super.color, super.semanticLabel}) : super(CustomGlyph.swords);
}

class _GlyphPainter extends CustomPainter {
  final CustomGlyph glyph;
  final Color color;
  const _GlyphPainter(this.glyph, this.color);

  // Polylines on lucide's 24×24 grid (a line that ends where it starts is closed).
  static const _crown = [
    [Offset(12, 3.2), Offset(16.1, 9.3), Offset(21.6, 5.7), Offset(18.6, 17), Offset(5.4, 17), Offset(2.4, 5.7), Offset(7.9, 9.3), Offset(12, 3.2)],
    [Offset(5, 21), Offset(19, 21)],
  ];
  static const _swords = [
    [Offset(14.5, 17.5), Offset(3, 6), Offset(3, 3), Offset(6, 3), Offset(17.5, 14.5)],
    [Offset(13, 19), Offset(19, 13)],
    [Offset(16, 16), Offset(20, 20)],
    [Offset(19, 21), Offset(21, 19)],
    [Offset(14.5, 6.5), Offset(18, 3), Offset(21, 3), Offset(21, 6), Offset(17.5, 9.5)],
    [Offset(5, 14), Offset(9, 18)],
    [Offset(7, 17), Offset(4, 20)],
    [Offset(3, 19), Offset(5, 21)],
  ];
  static const _rainDrops = [
    [Offset(16, 14), Offset(16, 20)],
    [Offset(8, 14), Offset(8, 20)],
    [Offset(12, 16), Offset(12, 22)],
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final k = size.shortestSide / 24;
    canvas.scale(k);
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final path = Path();
    final lines = switch (glyph) {
      CustomGlyph.crown => _crown,
      CustomGlyph.swords => _swords,
      CustomGlyph.cloudRain => _rainDrops,
    };
    for (final line in lines) {
      path.moveTo(line.first.dx, line.first.dy);
      for (final p in line.skip(1)) {
        path.lineTo(p.dx, p.dy);
      }
      if (line.first == line.last) path.close();
    }
    if (glyph == CustomGlyph.cloudRain) {
      // lucide cloud-rain: M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242
      path
        ..moveTo(4, 14.899)
        ..arcToPoint(const Offset(15.71, 8), radius: const Radius.circular(7), largeArc: true)
        ..lineTo(17.5, 8)
        ..arcToPoint(const Offset(20, 16.242), radius: const Radius.circular(4.5));
    }
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(_GlyphPainter old) => old.glyph != glyph || old.color != color;
}

/// Rain marker used everywhere rain is flagged (tags, pins, alerts, the badge),
/// lucide's CloudRain like the web.
const kRainGlyph = AppGlyph.cloudRain;

/// [kRainGlyph] as an icon widget.
class RainIcon extends CustomGlyphIcon {
  const RainIcon({super.key, super.size, super.color, super.semanticLabel}) : super(CustomGlyph.cloudRain);
}
