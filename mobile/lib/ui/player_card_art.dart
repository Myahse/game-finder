// The four player card designs (Trading card, Street poster, Scoreboard,
// Court pass), drawn at the designs' 405×720 and exported ×(1080/405) to
// 1080×1920. Barlow Condensed isn't bundled, so the display type is the app's
// heavy Inter (w900, tightened), and every name / court line shrinks to fit.

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../core/avatar_presets.dart';
import '../core/dicebear_avatar.dart';
import '../core/l10n.dart';
import '../core/media_url.dart';
import '../core/models.dart';
import '../core/player_avatar.dart';
import '../core/player_card.dart';
import 'app_icons.dart';
import 'theme.dart';

/// Design size in logical pixels (9:16).
const kCardArtWidth = 405.0;
const kCardArtHeight = 720.0;

/// Pixel ratio for the 1080×1920 export.
const kCardExportRatio = 1080 / kCardArtWidth;

const _night = Color(0xFF0B0D10);
const _ink = Color(0xFF12151A);
const _panel = Color(0xFF161A20);
const _muted = Color(0xFFC9CED6);
const _rule = Color(0xFF2B313B);
const _grey = Color(0xFF8B939E);
const _tileEdge = Color(0xFF262C36);
const _paper = Color(0xFFF6F3EE);
const _slate = Color(0xFF5B6470);
const _up = Color(0xFF3FD27A);
const _down = Color(0xFFFF6B6B);
const _white = Colors.white;

/// Site shown on the cards.
const kCardSite = 'outforground.com';

TextStyle _display(double size, {Color color = _white, double height = 1, double spacing = -0.02}) => TextStyle(
  fontFamily: kFontFamily,
  fontSize: size,
  fontWeight: FontWeight.w900,
  height: height,
  letterSpacing: size * spacing,
  color: color,
);

TextStyle _caps(double size, {Color color = _white, double spacing = 1.5, FontWeight weight = FontWeight.w800}) =>
    TextStyle(fontFamily: kFontFamily, fontSize: size, fontWeight: weight, letterSpacing: spacing, color: color, height: 1.2);

/// Text drawn as an outline only (CSS -webkit-text-stroke on transparent
/// text). Stroking the glyphs would also trace Inter's overlapping contours,
/// so the ring is the filled text spread around and the glyphs cut back out.
class _OutlineText extends StatelessWidget {
  final String text;
  final TextStyle style;
  final Color color;
  final double width;
  final double opacity;
  const _OutlineText(this.text, this.style, {required this.color, required this.width, this.opacity = 1});

  @override
  Widget build(BuildContext context) {
    final tp = TextPainter(
      text: TextSpan(
        text: text,
        style: style.copyWith(color: color),
      ),
      textDirection: TextDirection.ltr,
      maxLines: 1,
    )..layout();
    final size = Size(tp.width + width * 2, tp.height + width * 2);
    tp.dispose();
    return ExcludeSemantics(
      child: CustomPaint(size: size, painter: _OutlinePainter(text, style, color, width, opacity)),
    );
  }
}

class _OutlinePainter extends CustomPainter {
  final String text;
  final TextStyle style;
  final Color color;
  final double width, opacity;
  const _OutlinePainter(this.text, this.style, this.color, this.width, this.opacity);

  @override
  void paint(Canvas canvas, Size size) {
    TextPainter painter(TextStyle s) => TextPainter(
      text: TextSpan(text: text, style: s),
      textDirection: TextDirection.ltr,
      maxLines: 1,
    )..layout();
    final fill = painter(style.copyWith(color: color));
    final cut = painter(style.copyWith(foreground: Paint()..blendMode = BlendMode.dstOut));
    // Unbounded: with a 0.8 line height the glyphs rise above the box.
    canvas.saveLayer(null, Paint()..color = Color.fromRGBO(0, 0, 0, opacity));
    final origin = Offset(width, width);
    const steps = 24;
    for (var i = 0; i < steps; i++) {
      final a = 2 * math.pi * i / steps;
      fill.paint(canvas, origin + Offset(math.cos(a) * width, math.sin(a) * width));
    }
    cut.paint(canvas, origin);
    canvas.restore();
    fill.dispose();
    cut.dispose();
  }

  @override
  bool shouldRepaint(_OutlinePainter old) =>
      old.text != text || old.style != style || old.color != color || old.width != width || old.opacity != opacity;
}

/// One line that shrinks (never wraps or overflows) to its box.
Widget _fit(String text, TextStyle style, {Alignment alignment = Alignment.centerLeft, TextAlign? align}) => FittedBox(
  fit: BoxFit.scaleDown,
  alignment: alignment,
  child: Text(text, maxLines: 1, softWrap: false, textAlign: align, style: style),
);

/// Where the card's portrait comes from — the same order as [UserAvatar]:
/// studio avatar, preset avatar, uploaded photo. Null: initials.
({String url, bool photo})? cardPortraitSource(PublicUser u) {
  final player = u.playerAvatar;
  if (player != null) return (url: playerAvatarPngUrl(player, size: 256), photo: false);
  final preset = profileAvatarConfig(avatarUrl: u.avatarUrl, avatarConfig: u.avatarConfig);
  if (preset != null) {
    return (url: dicebearAvatarUrl(preset, size: 256, format: 'png', transparent: true), photo: false);
  }
  final raw = u.avatarUrl;
  if (raw != null && raw.isNotEmpty && raw != 'avatar:player' && !raw.startsWith('preset:')) {
    final resolved = resolveMediaUrl(raw);
    if (resolved.isNotEmpty) return (url: resolved, photo: true);
  }
  return null;
}

/// The player's own avatar, filling its box: the transparent portrait sits on
/// the bottom edge; a photo covers the box; initials otherwise.
class CardPortrait extends StatelessWidget {
  final PublicUser user;
  final Color initialsColor;
  const CardPortrait({super.key, required this.user, this.initialsColor = _white});

  @override
  Widget build(BuildContext context) {
    final src = cardPortraitSource(user);
    Widget initials() => LayoutBuilder(
      builder: (_, c) => Center(
        child: Text(
          (user.initials.isNotEmpty ? user.initials : user.username).characters.take(2).toString().toUpperCase(),
          style: _display(c.biggest.shortestSide * 0.4, color: initialsColor),
        ),
      ),
    );
    if (src == null) return initials();
    return Image.network(
      src.url,
      fit: src.photo ? BoxFit.cover : BoxFit.contain,
      alignment: src.photo ? Alignment.center : Alignment.bottomCenter,
      gaplessPlayback: true,
      errorBuilder: (_, _, _) => initials(),
    );
  }
}

/// The number drawn big behind the player: the jersey number, else the serial.
String cardBackNumber(PlayerCard c) {
  final jersey = c.user.playerAvatar == null ? null : jerseyNumber(c.user.playerAvatar!);
  if (jersey != null) return jersey;
  return c.serial > 0 ? '${c.serial}' : '${c.level}';
}

/// "@ama.k" (or "" without a username).
String _handle(PlayerCard c) => c.user.username.isEmpty ? '' : '@${c.user.username}';

String _join(Iterable<String?> parts) => parts.where((p) => p != null && p.isNotEmpty).join(' · ');

/// A player card in one of the four styles, at 405×720.
class PlayerCardArt extends StatelessWidget {
  final PlayerCard card;
  final CardStyle style;

  /// Profile link (the pass's QR code and its caption).
  final String profileUrl;
  const PlayerCardArt({super.key, required this.card, required this.style, required this.profileUrl});

  @override
  Widget build(BuildContext context) {
    final body = switch (style) {
      CardStyle.card => _TradingCard(card),
      CardStyle.poster => _StreetPoster(card),
      CardStyle.scoreboard => _Scoreboard(card),
      CardStyle.pass => _CourtPass(card, profileUrl),
    };
    return MediaQuery(
      // Fixed layout: the phone's text size must not change the image.
      data: MediaQuery.of(context).copyWith(textScaler: TextScaler.noScaling),
      child: Material(
        type: MaterialType.transparency,
        child: DefaultTextStyle(
          style: const TextStyle(fontFamily: kFontFamily, color: _white, decoration: TextDecoration.none),
          child: SizedBox(
            width: kCardArtWidth,
            height: kCardArtHeight,
            child: ClipRect(child: body),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Shapes and marks

/// The card outline: clipped top corners, pin point at the bottom
/// (CSS polygon(c 0, 100%-c 0, 100% c, 100% 100%-t, 50% 100%, 0 100%-t, 0 c)).
class _CardShape extends CustomClipper<Path> {
  final double corner, tail;
  const _CardShape({this.corner = 0, this.tail = 0});
  @override
  Path getClip(Size s) => Path()
    ..moveTo(corner, 0)
    ..lineTo(s.width - corner, 0)
    ..lineTo(s.width, corner)
    ..lineTo(s.width, s.height - tail)
    ..lineTo(tail == 0 ? s.width : s.width / 2, s.height)
    ..lineTo(tail == 0 ? 0 : s.width / 2, s.height)
    ..lineTo(0, s.height - tail)
    ..lineTo(0, corner)
    ..close();
  @override
  bool shouldReclip(_CardShape old) => old.corner != corner || old.tail != tail;
}

/// Map-pin outline filling its box (the designs' avatar frames).
Path _pinPath(Size s) {
  final w = s.width, h = s.height;
  return Path()
    ..moveTo(w / 2, 0)
    ..cubicTo(w * 0.225, 0, 0, h * 0.185, 0, h * 0.415)
    ..cubicTo(0, h * 0.718, w / 2, h, w / 2, h)
    ..cubicTo(w / 2, h, w, h * 0.718, w, h * 0.415)
    ..cubicTo(w, h * 0.185, w * 0.775, 0, w / 2, 0)
    ..close();
}

class _PinClip extends CustomClipper<Path> {
  const _PinClip();
  @override
  Path getClip(Size size) => _pinPath(size);
  @override
  bool shouldReclip(_PinClip old) => false;
}

/// The brand pin with a ring (64×70 design grid).
class _PinMark extends StatelessWidget {
  final Color color, ring;
  final double width, height;
  const _PinMark({required this.color, required this.ring, required this.width, required this.height});
  @override
  Widget build(BuildContext context) => CustomPaint(size: Size(width, height), painter: _PinMarkPainter(color, ring));
}

class _PinMarkPainter extends CustomPainter {
  final Color color, ring;
  const _PinMarkPainter(this.color, this.ring);
  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 64, size.height / 70);
    final pin = Path()
      ..moveTo(32, 4)
      ..cubicTo(20.4, 4, 11, 13.4, 11, 25)
      ..cubicTo(11, 40.8, 32, 60, 32, 60)
      ..cubicTo(32, 60, 53, 40.8, 53, 25)
      ..cubicTo(53, 13.4, 43.6, 4, 32, 4)
      ..close();
    canvas.drawPath(pin, Paint()..color = color);
    canvas.drawCircle(
      const Offset(32, 25),
      10,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..color = ring,
    );
  }

  @override
  bool shouldRepaint(_PinMarkPainter old) => old.color != color || old.ring != ring;
}

/// Court markings as a quiet texture: circles and keys from the designs.
class _CourtLines extends CustomPainter {
  final Color color;
  final double width;
  final List<(Offset, double)> circles;
  final List<List<Offset>> lines;
  const _CourtLines({required this.color, this.width = 3, this.circles = const [], this.lines = const []});
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = width
      ..color = color;
    for (final (c, r) in circles) {
      canvas.drawCircle(c, r, p);
    }
    for (final l in lines) {
      canvas.drawPath(Path()..addPolygon(l, false), p);
    }
  }

  @override
  bool shouldRepaint(_CourtLines old) => old.color != color;
}

/// "OUT FOR GROUND" with GROUND in the brand orange.
Widget _wordmark(double size, {Color color = _white, Color? accent = Palette.brand}) => Text.rich(
  TextSpan(
    children: [
      const TextSpan(text: 'OUT FOR '),
      TextSpan(
        text: 'GROUND',
        style: TextStyle(color: accent ?? color),
      ),
    ],
  ),
  maxLines: 1,
  style: _display(size, color: color, spacing: 0.01),
);

/// Header: wordmark left, tier line right.
Widget _header(Widget mark, String right, Color color) => Row(
  children: [
    Flexible(
      flex: 3,
      child: FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft, child: mark),
    ),
    const SizedBox(width: 12),
    Expanded(
      flex: 2,
      child: _fit(right, _caps(11, color: color, spacing: 2), alignment: Alignment.centerRight),
    ),
  ],
);

// ---------------------------------------------------------------------------
// 1 · Trading card

class _TradingCard extends StatelessWidget {
  final PlayerCard c;
  const _TradingCard(this.c);

  @override
  Widget build(BuildContext context) {
    final frame = c.tier.color;
    final season = tr('SEASON 1', 'SAISON 1');
    final stats = [
      ('${c.games}', tr('GMS', 'MAT')),
      ('${c.winPct}', tr('WIN%', 'VIC%')),
      ('${c.winStreak}', tr('STRK', 'SÉR')),
      ('${c.challengesWon}', tr('CHAL', 'DÉF')),
      ('${c.courts}', tr('CRTS', 'TER')),
      ('${c.elo}', 'ELO'),
    ];
    // The inner panel is 351×600 (design grid).
    const innerW = 351.0;
    final slope = math.tan(4 * math.pi / 180) * innerW / 2;
    return ColoredBox(
      color: _night,
      child: Stack(
        children: [
          Positioned(left: 22, right: 22, top: 26, child: _header(_wordmark(19), '${c.tier.label} · $season', frame)),
          Positioned(
            left: 22,
            top: 63,
            width: 361,
            height: 610,
            child: ClipPath(
              clipper: const _CardShape(corner: 30, tail: 92),
              child: ColoredBox(
                color: frame,
                child: Padding(
                  padding: const EdgeInsets.all(5),
                  child: ClipPath(
                    clipper: const _CardShape(corner: 27, tail: 90),
                    child: ColoredBox(
                      color: _panel,
                      child: Stack(
                        clipBehavior: Clip.hardEdge,
                        children: [
                          Positioned.fill(
                            child: CustomPaint(
                              painter: _CourtLines(
                                color: frame.withValues(alpha: 0.22),
                                circles: const [(Offset(175, -20), 230), (Offset(175, -20), 150), (Offset(175, 150), 60)],
                                lines: const [
                                  [Offset(115, 0), Offset(115, 150), Offset(235, 150), Offset(235, 0)],
                                ],
                              ),
                            ),
                          ),
                          // Big outlined number behind the player.
                          Positioned(
                            right: -14,
                            top: 64,
                            child: _OutlineText(cardBackNumber(c), _display(230, height: 0.8), color: frame, width: 2, opacity: 0.35),
                          ),
                          // Avatar.
                          Positioned(
                            right: 8,
                            top: 40,
                            width: 250,
                            height: 262,
                            child: CardPortrait(user: c.user, initialsColor: frame),
                          ),
                          // Rating column.
                          Positioned(
                            left: 22,
                            top: 22,
                            width: 92,
                            child: Column(
                              children: [
                                SizedBox(
                                  height: 70,
                                  child: _fit('${c.rating}', _display(84, color: frame, height: 0.82), alignment: Alignment.center),
                                ),
                                const SizedBox(height: 4),
                                SizedBox(
                                  height: 20,
                                  child: _fit(c.sportName.toUpperCase(), _display(17, spacing: 0.06), alignment: Alignment.center),
                                ),
                                const SizedBox(height: 4),
                                Container(width: 34, height: 2, color: frame),
                                const SizedBox(height: 4),
                                Icon(c.sport == null ? Icons.sports : sportIconDataOutlined(c.sport!.slug), size: 30, color: _white),
                                const SizedBox(height: 6),
                                _fit('${tr('LVL', 'NIV.')} ${c.level}', _caps(11, color: _muted, spacing: 1), alignment: Alignment.center),
                              ],
                            ),
                          ),
                          // Name band (skewed −4°).
                          Positioned(
                            left: 0,
                            right: 0,
                            top: 300 - slope,
                            height: 58 + slope * 2,
                            child: ClipPath(
                              clipper: _Band(slope),
                              child: ColoredBox(
                                color: frame,
                                child: Padding(
                                  padding: EdgeInsets.fromLTRB(18, slope + 7, 18, slope + 5),
                                  child: _fit(
                                    c.displayName.toUpperCase(),
                                    _display(44, color: _ink, spacing: 0.01),
                                    alignment: Alignment.center,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          Positioned(
                            left: 24,
                            right: 24,
                            top: 372,
                            height: 16,
                            child: _fit(
                              _join([_handle(c), c.homeCourt?.name]),
                              _caps(12, color: _muted, spacing: 0.5, weight: FontWeight.w700),
                              alignment: Alignment.center,
                            ),
                          ),
                          // Stats, two columns.
                          Positioned(
                            left: 26,
                            right: 26,
                            top: 402,
                            child: Column(
                              children: [
                                for (var row = 0; row < 3; row++) ...[
                                  if (row > 0) const SizedBox(height: 6),
                                  Row(
                                    children: [
                                      for (var col = 0; col < 2; col++) ...[
                                        if (col > 0) const SizedBox(width: 22),
                                        Expanded(child: _statCell(stats[row * 2 + col], underline: row < 2)),
                                      ],
                                    ],
                                  ),
                                ],
                              ],
                            ),
                          ),
                          Positioned(
                            left: 0,
                            right: 0,
                            bottom: 34,
                            child: Column(
                              children: [
                                _PinMark(color: frame, ring: _panel, width: 26, height: 30),
                                const SizedBox(height: 4),
                                Text(c.serialLabel, style: _caps(10, color: _grey, spacing: 2)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            left: 22,
            right: 22,
            top: 683,
            height: 18,
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Text.rich(
                TextSpan(
                  children: [
                    TextSpan(text: '${tr('Challenge me on', 'Défie-moi sur')} '),
                    const TextSpan(
                      text: kCardSite,
                      style: TextStyle(color: _white),
                    ),
                  ],
                ),
                style: _caps(13, color: _muted, spacing: 0, weight: FontWeight.w700),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _statCell((String, String) s, {required bool underline}) => Container(
    padding: const EdgeInsets.only(bottom: 4),
    decoration: underline
        ? const BoxDecoration(
            border: Border(bottom: BorderSide(color: _rule)),
          )
        : null,
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        ConstrainedBox(
          constraints: const BoxConstraints(minWidth: 50),
          child: Text(s.$1, maxLines: 1, style: _display(28)),
        ),
        const SizedBox(width: 8),
        Flexible(
          child: Text(
            s.$2,
            maxLines: 1,
            overflow: TextOverflow.clip,
            softWrap: false,
            style: _caps(12, color: _muted),
          ),
        ),
      ],
    ),
  );
}

/// Band skewed −4° (left side lower), [slope] = half the rise across the card.
class _Band extends CustomClipper<Path> {
  final double slope;
  const _Band(this.slope);
  @override
  Path getClip(Size s) => Path()
    ..moveTo(0, slope * 2)
    ..lineTo(s.width, 0)
    ..lineTo(s.width, s.height - slope * 2)
    ..lineTo(0, s.height)
    ..close();
  @override
  bool shouldReclip(_Band old) => old.slope != slope;
}

// ---------------------------------------------------------------------------
// 2 · Street poster

class _StreetPoster extends StatelessWidget {
  final PlayerCard c;
  const _StreetPoster(this.c);

  @override
  Widget build(BuildContext context) {
    final frame = c.tier.color;
    final first = (c.user.firstName.isNotEmpty ? c.user.firstName : c.user.username).toUpperCase();
    final last = c.user.firstName.isNotEmpty ? c.user.lastName.toUpperCase() : '';
    final king = c.kingOf != null;
    return ColoredBox(
      color: frame,
      child: Stack(
        children: [
          Positioned.fill(
            child: CustomPaint(
              painter: _CourtLines(
                color: _ink.withValues(alpha: 0.12),
                width: 4,
                circles: const [(Offset(202, 740), 300), (Offset(202, 740), 200), (Offset(202, 520), 70)],
                lines: const [
                  [Offset(132, 720), Offset(132, 520), Offset(272, 520), Offset(272, 720)],
                ],
              ),
            ),
          ),
          Positioned(
            left: 22,
            right: 22,
            top: 22,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Flexible(flex: 3, child: _fit('OUT FOR GROUND', _display(20, color: _ink, spacing: 0.01))),
                const SizedBox(width: 12),
                Flexible(
                  flex: 2,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
                    decoration: BoxDecoration(color: _ink, borderRadius: BorderRadius.circular(999)),
                    child: _fit('${c.tier.label} · ${c.serialLabel}', _caps(11, color: frame), alignment: Alignment.center),
                  ),
                ),
              ],
            ),
          ),
          // First name solid, last name outlined; both shrink together.
          Positioned(
            left: 18,
            right: 18,
            top: 62,
            height: 196,
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(first, maxLines: 1, softWrap: false, style: _display(128, color: _ink, height: 0.8, spacing: -0.025)),
                  if (last.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    _OutlineText(last, _display(128, height: 0.8, spacing: -0.025), color: _ink, width: 2.5),
                  ],
                ],
              ),
            ),
          ),
          // Avatar in a pin.
          Positioned(
            left: 62,
            top: 262,
            width: 280,
            height: 330,
            child: ClipPath(
              clipper: const _PinClip(),
              child: ColoredBox(
                color: _ink,
                child: Stack(
                  children: [
                    Positioned(
                      left: 20,
                      top: 40,
                      child: _OutlineText(cardBackNumber(c), _display(150, height: 0.8), color: frame, width: 2, opacity: 0.6),
                    ),
                    Positioned(
                      left: 20,
                      right: 0,
                      top: 40,
                      bottom: 36,
                      child: CardPortrait(user: c.user, initialsColor: frame),
                    ),
                  ],
                ),
              ),
            ),
          ),
          // Rating sticker.
          Positioned(
            right: 16,
            top: 300,
            child: Transform.rotate(
              angle: 6 * math.pi / 180,
              child: Container(
                width: 92,
                padding: const EdgeInsets.fromLTRB(10, 8, 10, 6),
                decoration: BoxDecoration(
                  color: _white,
                  border: Border.all(color: _ink, width: 3),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _fit('${c.rating}', _display(56, color: _ink, height: 0.9), alignment: Alignment.center),
                    const SizedBox(height: 2),
                    _fit(c.sportName.toUpperCase(), _caps(10, color: _ink), alignment: Alignment.center),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            left: 14,
            top: 470,
            width: 230,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _tag('${c.winPct}% ${tr('WINS', 'VICTOIRES')}', _ink, _white),
                const SizedBox(height: 6),
                _tag(king ? tr('KING OF THE COURT', 'ROI DU TERRAIN') : '${c.games} ${tr('GAMES', 'MATCHS')}', _white, _ink),
              ],
            ),
          ),
          // Footer bar.
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              color: _ink,
              padding: const EdgeInsets.fromLTRB(22, 14, 22, 18),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _fit(_join([_handle(c), tr('HOME COURT', 'SON TERRAIN')]), _caps(11, color: _muted)),
                        const SizedBox(height: 2),
                        SizedBox(height: 30, child: _fit((c.homeCourt?.name ?? '—').toUpperCase(), _display(26))),
                      ],
                    ),
                  ),
                  const SizedBox(width: 14),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text('${tr('STREAK', 'SÉRIE')} ${c.winStreak}', style: _caps(11, color: _muted)),
                      const SizedBox(height: 2),
                      SizedBox(
                        height: 30,
                        child: Center(
                          child: Text('ELO ${c.elo}', style: _display(26, color: frame)),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _tag(String text, Color bg, Color fg) => Transform.rotate(
    angle: -3 * math.pi / 180,
    child: Container(
      color: bg,
      padding: const EdgeInsets.fromLTRB(10, 3, 10, 3),
      child: _fit(text, _display(22, color: fg, height: 1.1)),
    ),
  );
}

// ---------------------------------------------------------------------------
// 3 · Scoreboard

class _Scoreboard extends StatelessWidget {
  final PlayerCard c;
  const _Scoreboard(this.c);

  @override
  Widget build(BuildContext context) {
    final frame = c.tier.color;
    final deltaColor = c.eloDelta30d > 0 ? _up : (c.eloDelta30d < 0 ? _down : _muted);
    final king = c.kingOf;
    final court = king ?? c.homeCourt;
    return ColoredBox(
      color: _night,
      child: Padding(
        padding: const EdgeInsets.all(22),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _header(_wordmark(20), '${c.tier.label} · ${c.serialLabel}', frame),
            const SizedBox(height: 12),
            // Player plate.
            ClipPath(
              clipper: const _CardShape(corner: 22),
              child: ColoredBox(
                color: frame,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(4, 4, 4, 0),
                  child: ClipPath(
                    clipper: const _CardShape(corner: 19),
                    child: ColoredBox(
                      color: _ink,
                      child: SizedBox(
                        height: 116,
                        child: Stack(
                          clipBehavior: Clip.hardEdge,
                          children: [
                            Positioned(
                              right: -6,
                              top: -18,
                              child: _OutlineText(cardBackNumber(c), _display(140, height: 0.8), color: frame, width: 2, opacity: 0.3),
                            ),
                            Positioned.fill(
                              child: Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                                child: Row(
                                  children: [
                                    SizedBox(
                                      width: 78,
                                      height: 88,
                                      child: ClipPath(
                                        clipper: const _PinClip(),
                                        child: ColoredBox(
                                          color: frame,
                                          child: Padding(
                                            padding: const EdgeInsets.fromLTRB(6, 6, 6, 14),
                                            child: CardPortrait(user: c.user, initialsColor: _ink),
                                          ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 14),
                                    Expanded(
                                      child: Column(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          SizedBox(height: 36, child: _fit(c.displayName.toUpperCase(), _display(36, height: 0.95))),
                                          const SizedBox(height: 4),
                                          _fit(
                                            _join([_handle(c), c.sport?.name, '${tr('Lvl', 'Niv.')} ${c.level}']),
                                            _caps(12, color: _muted, spacing: 0, weight: FontWeight.w700),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            // Wins : losses.
            Container(
              height: 150,
              decoration: BoxDecoration(
                color: _ink,
                border: Border.all(color: _tileEdge, width: 2),
              ),
              child: Stack(
                children: [
                  Positioned.fill(
                    child: CustomPaint(
                      painter: _CourtLines(
                        color: frame.withValues(alpha: 0.14),
                        circles: const [(Offset(180, 73), 42)],
                        lines: const [
                          [Offset(180, 0), Offset(180, 170)],
                          [Offset(0, 30), Offset(46, 30), Offset(46, 120), Offset(0, 120)],
                          [Offset(361, 30), Offset(315, 30), Offset(315, 120), Offset(361, 120)],
                        ],
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                    child: Column(
                      children: [
                        _fit(
                          '${tr('RECORD', 'BILAN')} · ${tr('SEASON 1', 'SAISON 1')}',
                          _caps(11, color: _muted, spacing: 2.5),
                          alignment: Alignment.center,
                        ),
                        const SizedBox(height: 4),
                        Expanded(
                          child: Row(
                            children: [
                              Expanded(child: _bigCount('${c.wins}', tr('WINS', 'VICTOIRES'), frame)),
                              Text(':', style: _display(44, color: const Color(0xFF4A525E))),
                              Expanded(child: _bigCount('${c.losses}', tr('LOSSES', 'DÉFAITES'), _white)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: _tile('${c.rating}', tr('RATING', 'NOTE'), frame, frame, _muted)),
                const SizedBox(width: 8),
                Expanded(child: _tile('${c.elo}', c.eloDeltaLabel, _tileEdge, _white, deltaColor)),
                const SizedBox(width: 8),
                Expanded(child: _tile('${c.winStreak}', tr('STREAK', 'SÉRIE'), _tileEdge, _white, _muted)),
              ],
            ),
            const SizedBox(height: 12),
            // Court block with the pin point.
            Expanded(
              child: ClipPath(
                clipper: const _CardShape(tail: 46),
                child: ColoredBox(
                  color: frame,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(18, 14, 18, 50),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        king != null ? const CrownIcon(size: 28, color: _ink) : const Icon(Icons.place_outlined, size: 28, color: _ink),
                        const SizedBox(height: 2),
                        _fit(
                          court == null
                              ? tr('ON THE COURT', 'SUR LE TERRAIN')
                              : (king != null ? tr('KING OF THE COURT', 'ROI DU TERRAIN') : tr('HOME COURT', 'SON TERRAIN')),
                          _caps(11, color: _ink, spacing: 2),
                          alignment: Alignment.center,
                        ),
                        const SizedBox(height: 2),
                        SizedBox(
                          height: 30,
                          child: _fit((court?.name ?? '—').toUpperCase(), _display(28, color: _ink), alignment: Alignment.center),
                        ),
                        const SizedBox(height: 4),
                        _fit(
                          '${tr('Who wants to beat me?', 'Qui veut me battre ?')} $kCardSite',
                          _caps(12, color: _ink, spacing: 0),
                          alignment: Alignment.center,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _bigCount(String value, String label, Color color) => Column(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      SizedBox(
        height: 88,
        child: _fit(value, _display(96, color: color, height: 0.95), alignment: Alignment.center),
      ),
      _fit(label, _caps(11, spacing: 2), alignment: Alignment.center),
    ],
  );

  Widget _tile(String value, String label, Color edge, Color valueColor, Color labelColor) => Container(
    padding: const EdgeInsets.all(10),
    decoration: BoxDecoration(
      color: _ink,
      border: Border(top: BorderSide(color: edge, width: 3)),
    ),
    child: Column(
      children: [
        SizedBox(
          height: 40,
          child: _fit(value, _display(40, color: valueColor), alignment: Alignment.center),
        ),
        const SizedBox(height: 2),
        _fit(label, _caps(10, color: labelColor), alignment: Alignment.center),
      ],
    ),
  );
}

// ---------------------------------------------------------------------------
// 4 · Court pass

class _CourtPass extends StatelessWidget {
  final PlayerCard c;
  final String url;
  const _CourtPass(this.c, this.url);

  @override
  Widget build(BuildContext context) {
    final frame = c.tier.color;
    final first = (c.user.firstName.isNotEmpty ? c.user.firstName : c.user.username).toUpperCase();
    final last = c.user.firstName.isNotEmpty ? c.user.lastName.toUpperCase() : '';
    final chips = [if (c.sport != null) c.sport!, ...c.sports.where((s) => s.slug != c.sport?.slug)].take(3).toList();
    return ColoredBox(
      color: _ink,
      child: Stack(
        children: [
          Positioned(left: 22, right: 22, top: 24, child: _header(_wordmark(20), 'PASS ${c.tier.label}', frame)),
          Positioned(
            left: 22,
            top: 59,
            width: 361,
            height: 628,
            child: ClipPath(
              clipper: const _CardShape(corner: 30, tail: 92),
              child: ColoredBox(
                color: frame,
                child: Padding(
                  padding: const EdgeInsets.all(5),
                  child: ClipPath(
                    clipper: const _CardShape(corner: 27, tail: 90),
                    child: ColoredBox(
                      color: _paper,
                      child: Stack(
                        children: [
                          Positioned.fill(
                            child: CustomPaint(
                              painter: _CourtLines(
                                color: _ink.withValues(alpha: 0.08),
                                circles: const [(Offset(175, -30), 210), (Offset(175, 140), 56)],
                                lines: const [
                                  [Offset(115, 0), Offset(115, 140), Offset(235, 140), Offset(235, 0)],
                                ],
                              ),
                            ),
                          ),
                          // Player.
                          Positioned(
                            left: 22,
                            right: 22,
                            top: 24,
                            height: 128,
                            child: Row(
                              children: [
                                SizedBox(
                                  width: 108,
                                  height: 128,
                                  child: ClipPath(
                                    clipper: const _PinClip(),
                                    child: ColoredBox(
                                      color: _ink,
                                      child: Padding(
                                        padding: const EdgeInsets.fromLTRB(8, 10, 8, 22),
                                        child: CardPortrait(user: c.user, initialsColor: frame),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      SizedBox(height: 35, child: _fit(first, _display(40, color: _ink, height: 0.86))),
                                      if (last.isNotEmpty) SizedBox(height: 35, child: _fit(last, _display(40, color: _ink, height: 0.86))),
                                      const SizedBox(height: 4),
                                      _fit(
                                        _join([_handle(c), c.serialLabel]),
                                        _caps(12, color: _slate, spacing: 0, weight: FontWeight.w700),
                                      ),
                                      if (chips.isNotEmpty) ...[
                                        const SizedBox(height: 6),
                                        FittedBox(
                                          fit: BoxFit.scaleDown,
                                          alignment: Alignment.centerLeft,
                                          child: Row(
                                            children: [
                                              for (var i = 0; i < chips.length; i++) ...[
                                                if (i > 0) const SizedBox(width: 6),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                                  decoration: BoxDecoration(
                                                    color: i == 0 ? frame : _ink,
                                                    borderRadius: BorderRadius.circular(999),
                                                  ),
                                                  child: Text(
                                                    chips[i].name.toUpperCase(),
                                                    style: _caps(11, color: i == 0 ? _ink : _white, spacing: 0),
                                                  ),
                                                ),
                                              ],
                                            ],
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                          // Tiles.
                          Positioned(
                            left: 22,
                            right: 22,
                            top: 172,
                            child: Row(
                              children: [
                                Expanded(child: _tile('${c.rating}', tr('RATING', 'NOTE'), dark: true, frame: frame)),
                                const SizedBox(width: 8),
                                Expanded(child: _tile('${c.games}', tr('GAMES', 'MATCHS'), frame: frame)),
                                const SizedBox(width: 8),
                                Expanded(child: _tile('${c.elo}', 'ELO', frame: frame)),
                              ],
                            ),
                          ),
                          Positioned(
                            left: 22,
                            right: 22,
                            top: 262,
                            height: 16,
                            child: _fit(
                              _join([c.homeCourt?.name, '${tr('Level', 'Niveau')} ${c.level}']),
                              _caps(12, color: _slate, spacing: 0, weight: FontWeight.w700),
                              alignment: Alignment.center,
                            ),
                          ),
                          // Ticket perforation.
                          Positioned(
                            left: 0,
                            right: 0,
                            top: 296,
                            height: 36,
                            child: Row(
                              children: [
                                Container(
                                  width: 18,
                                  decoration: const BoxDecoration(
                                    color: _ink,
                                    borderRadius: BorderRadius.horizontal(right: Radius.circular(18)),
                                  ),
                                ),
                                const Expanded(
                                  child: CustomPaint(painter: _Dashes(), size: Size(double.infinity, 36)),
                                ),
                                Container(
                                  width: 18,
                                  decoration: const BoxDecoration(
                                    color: _ink,
                                    borderRadius: BorderRadius.horizontal(left: Radius.circular(18)),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          // QR to the profile.
                          Positioned(
                            left: 18,
                            right: 18,
                            top: 338,
                            child: Column(
                              children: [
                                SizedBox(
                                  height: 30,
                                  child: _fit(
                                    tr('SCAN TO PLAY WITH ME', 'SCANNE POUR JOUER AVEC MOI'),
                                    _display(30, color: _ink),
                                    alignment: Alignment.center,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: _white,
                                    border: Border.all(color: _ink, width: 3),
                                  ),
                                  child: QrImageView(
                                    data: url,
                                    size: 132,
                                    padding: EdgeInsets.zero,
                                    backgroundColor: _white,
                                    errorCorrectionLevel: QrErrorCorrectLevel.M,
                                    eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: _ink),
                                    dataModuleStyle: const QrDataModuleStyle(dataModuleShape: QrDataModuleShape.square, color: _ink),
                                    semanticsLabel: tr('QR code to the profile', 'QR code vers le profil'),
                                  ),
                                ),
                                const SizedBox(height: 8),
                                _fit(
                                  url.replaceFirst(RegExp(r'^https?://'), '').replaceFirst(RegExp(r'^www\.'), ''),
                                  _caps(12, color: _ink, spacing: 0),
                                  alignment: Alignment.center,
                                ),
                              ],
                            ),
                          ),
                          Positioned(
                            left: 0,
                            right: 0,
                            bottom: 30,
                            child: Center(
                              child: _PinMark(color: frame, ring: _paper, width: 24, height: 28),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _tile(String value, String label, {bool dark = false, required Color frame}) => Container(
    padding: EdgeInsets.symmetric(horizontal: 6, vertical: dark ? 10 : 8),
    decoration: BoxDecoration(
      color: dark ? _ink : _white,
      border: dark ? null : Border.all(color: _ink, width: 2),
    ),
    child: Column(
      children: [
        SizedBox(
          height: 36,
          child: _fit(value, _display(36, color: dark ? frame : _ink), alignment: Alignment.center),
        ),
        const SizedBox(height: 2),
        _fit(label, _caps(10, color: dark ? _white : _slate), alignment: Alignment.center),
      ],
    ),
  );
}

/// Dashed tear line across the pass.
class _Dashes extends CustomPainter {
  const _Dashes();
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = const Color(0xFFC9C3B8)
      ..strokeWidth = 3;
    final y = size.height / 2;
    for (double x = 4; x < size.width - 4; x += 12) {
      canvas.drawLine(Offset(x, y), Offset(math.min(x + 6, size.width - 4), y), p);
    }
  }

  @override
  bool shouldRepaint(_Dashes old) => false;
}
