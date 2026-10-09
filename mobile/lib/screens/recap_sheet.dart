import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/l10n.dart';
import '../core/models.dart';
import '../core/player_avatar.dart';
import '../core/recap.dart';
import '../ui/share_image.dart';
import '../ui/widgets.dart';

/// Story frame in logical pixels (9:16); captured at 3× → 1080×1920 like the web story.
const _w = 360.0;
const _h = 640.0;
const _ink = Color(0xFF12151A);

/// Story colours per base sport (web index.css: --brand, --sport-deep, --sport-accent).
const _sportColors = {
  'basketball': (Color(0xFFFF5A1F), Color(0xFF7A1F00), Color(0xFFFFB020)),
  'football': (Color(0xFF0F9F4F), Color(0xFF053D22), Color(0xFFB8F13A)),
  'volleyball': (Color(0xFF2563EB), Color(0xFF0B2A6B), Color(0xFFFBBF24)),
  'tennis': (Color(0xFF7C3AED), Color(0xFF2E0F66), Color(0xFFD4F53C)),
  'badminton': (Color(0xFF0D9488), Color(0xFF04403B), Color(0xFFF472B6)),
};

/// "My month" button (profile).
class RecapButton extends StatelessWidget {
  final Me me;
  final String? sport;
  const RecapButton({super.key, required this.me, this.sport});

  @override
  Widget build(BuildContext context) => OutlinedButton.icon(
        onPressed: () => showModalBottomSheet<void>(
          context: context,
          isScrollControlled: true,
          useSafeArea: true,
          showDragHandle: true,
          builder: (_) => RecapSheet(me: me, sport: sport),
        ),
        icon: const Icon(Icons.calendar_month_outlined),
        label: Text(tr('MY MONTH', 'MON MOIS')),
      );
}

/// The monthly recap as a shareable 9:16 story image, with month navigation.
class RecapSheet extends StatefulWidget {
  final Me me;
  final String? sport;
  const RecapSheet({super.key, required this.me, this.sport});
  @override
  State<RecapSheet> createState() => _RecapSheetState();
}

class _RecapSheetState extends State<RecapSheet> {
  final _current = monthKey(DateTime.now());
  late String _month = _current;
  final _recaps = <String, MonthlyRecap>{};
  final _boundary = GlobalKey();
  final _shareButton = GlobalKey();
  final _saveButton = GlobalKey();
  String? _failedMonth;

  /// Month whose story images have been preloaded (ready to capture).
  String? _readyMonth;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load(_month);
  }

  Future<void> _load(String month) async {
    if (_recaps.containsKey(month)) {
      _prepare(month);
      return;
    }
    if (_failedMonth != null) setState(() => _failedMonth = null);
    try {
      final j = await context.read<Api>().get('/api/me/recap?month=$month');
      if (!mounted) return;
      final recap = MonthlyRecap.fromJson(Map<String, dynamic>.from(j as Map));
      setState(() => _recaps[month] = recap);
      _prepare(month);
    } catch (_) {
      if (mounted) setState(() => _failedMonth = month);
    }
  }

  /// Loads the avatars into the image cache so the snapshot isn't missing them.
  Future<void> _prepare(String month) async {
    final recap = _recaps[month]!;
    final urls = [
      avatarArtOf(widget.me).pngUrl(expression: _storyFace),
      if (recap.topTeammate != null) avatarArtOf(recap.topTeammate!.user).pngUrl(expression: _storyFace),
    ].whereType<String>();
    await Future.wait([for (final u in urls) precacheImage(NetworkImage(u), context, onError: (_, _) {})]);
    if (mounted && _month == month) setState(() => _readyMonth = month);
  }

  void _go(int delta) {
    final next = shiftMonth(_month, delta);
    if (next.compareTo(_current) > 0) return;
    setState(() {
      _month = next;
      _readyMonth = null;
    });
    _load(next);
  }

  String get _fileName => 'out-for-ground-${widget.me.username}-$_month.png';

  Future<void> _share({required bool withText}) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final png = await captureBoundaryPng(_boundary, pixelRatio: 3);
      if (png == null) throw StateError('render failed');
      await sharePngs(
        [(bytes: png, name: _fileName)],
        title: withText ? tr('Your month', 'Votre mois') : null,
        text: withText ? '${tr('My month on Out For Ground:', 'Mon mois sur Out For Ground :')} ${monthLabel(_month)}' : null,
        origin: shareOriginOf(withText ? _shareButton : _saveButton),
      );
    } catch (_) {
      if (mounted) showSnack(context, tr('Could not load your recap.', 'Impossible de charger votre bilan.'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.colorScheme.onSurfaceVariant;
    final recap = _recaps[_month];
    final ready = recap != null && _readyMonth == _month;
    final failed = _failedMonth == _month;
    final label = monthLabel(_month);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(tr('YOUR MONTH', 'VOTRE MOIS'), style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 8),
          Row(children: [
            IconButton(tooltip: tr('Previous month', 'Mois précédent'), onPressed: () => _go(-1), icon: const Icon(Icons.chevron_left)),
            Expanded(
              child: Text(
                label[0].toUpperCase() + label.substring(1),
                textAlign: TextAlign.center,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
            IconButton(
              tooltip: tr('Next month', 'Mois suivant'),
              onPressed: _month.compareTo(_current) >= 0 ? null : () => _go(1),
              icon: const Icon(Icons.chevron_right),
            ),
          ]),
          const SizedBox(height: 8),
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 240),
              child: AspectRatio(
                aspectRatio: _w / _h,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: ColoredBox(
                    color: theme.colorScheme.surfaceContainerHighest,
                    child: ready
                        ? FittedBox(
                            child: Semantics(
                              label: tr('Your month', 'Votre mois'),
                              child: RepaintBoundary(
                                key: _boundary,
                                child: RecapStory(
                                  recap: recap,
                                  me: widget.me,
                                  monthLabel: label,
                                  sport: widget.sport,
                                ),
                              ),
                            ),
                          )
                        : Center(
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: failed
                                  ? Text(tr('Could not load your recap.', 'Impossible de charger votre bilan.'),
                                      textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: muted))
                                  : Column(mainAxisSize: MainAxisSize.min, children: [
                                      const CircularProgressIndicator(),
                                      const SizedBox(height: 10),
                                      Text(tr('Crunching your month…', 'On calcule votre mois…'),
                                          textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: muted)),
                                    ]),
                            ),
                          ),
                  ),
                ),
              ),
            ),
          ),
          if (recap != null && recap.isEmpty) ...[
            const SizedBox(height: 12),
            Text(
              tr('No games yet this month — join one and your recap fills up.',
                  'Pas encore de match ce mois-ci — rejoignez-en un et votre bilan se remplit.'),
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: muted),
            ),
          ],
          if (failed) ...[
            const SizedBox(height: 8),
            TextButton(onPressed: () => _load(_month), child: Text(tr('Try again', 'Réessayer'))),
          ],
          const SizedBox(height: 16),
          Row(children: [
            Expanded(
              child: FilledButton.icon(
                key: _shareButton,
                onPressed: ready && !_busy ? () => _share(withText: true) : null,
                icon: _busy
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.ios_share),
                label: Text(tr('SHARE', 'PARTAGER')),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                key: _saveButton,
                onPressed: ready && !_busy ? () => _share(withText: false) : null,
                icon: const Icon(Icons.download_outlined),
                label: Text(tr('SAVE IMAGE', 'ENREGISTRER'), overflow: TextOverflow.ellipsis),
              ),
            ),
          ]),
        ]),
      ),
    );
  }
}

const _storyFace = AvatarExpression(mouth: 'smile', eyes: 'happy');

/// The 9:16 story: month, player, games, hours / courts / show-up tiles,
/// home court and top teammate, in the player's base-sport colours.
class RecapStory extends StatelessWidget {
  final MonthlyRecap recap;
  final PublicUser me;
  final String monthLabel;
  final String? sport;
  const RecapStory({super.key, required this.recap, required this.me, required this.monthLabel, this.sport});

  @override
  Widget build(BuildContext context) {
    final (brand, deep, accent) = _sportColors[sport] ?? _sportColors['basketball']!;
    const white = Colors.white;
    TextStyle display(double size, {Color color = white}) =>
        TextStyle(fontSize: size, fontWeight: FontWeight.w900, height: 1, letterSpacing: -0.5, color: color);
    TextStyle sans(double size, {FontWeight w = FontWeight.w700, Color color = white}) =>
        TextStyle(fontSize: size, fontWeight: w, height: 1.1, color: color);
    Widget fit(Widget child, {Alignment alignment = Alignment.centerLeft}) =>
        FittedBox(fit: BoxFit.scaleDown, alignment: alignment, child: child);

    final tiles = [
      (recap.hoursLabel, tr('hours on court', 'heures sur le terrain')),
      ('${recap.courts}', tr('courts', 'terrains')),
      (recap.showUpLabel, tr('show-up', 'présence')),
    ];
    final teammate = recap.topTeammate;

    return MediaQuery(
      data: MediaQuery.of(context).copyWith(textScaler: TextScaler.noScaling),
      child: Material(
        type: MaterialType.transparency,
        child: Container(
          width: _w,
          height: _h,
          decoration: BoxDecoration(
            gradient: LinearGradient(begin: Alignment.topLeft, end: const Alignment(-0.2, 1), colors: [brand, deep]),
          ),
          child: Stack(children: [
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: const Alignment(0.8, -0.73),
                    radius: 0.7,
                    colors: [accent.withValues(alpha: 0.47), accent.withValues(alpha: 0)],
                  ),
                ),
              ),
            ),
            const Positioned.fill(child: CustomPaint(painter: _CourtLines())),
            // Header: brand + month
            Positioned(
              left: 27,
              top: 32,
              child: Text.rich(
                TextSpan(children: [
                  const TextSpan(text: 'OUT FOR '),
                  TextSpan(text: 'GROUND', style: TextStyle(color: accent)),
                ]),
                style: display(19),
              ),
            ),
            Positioned(left: 27, right: 27, top: 62, height: 50, child: fit(Text(monthLabel.toUpperCase(), style: display(50)))),
            // Player
            Positioned(right: 27, top: 107, child: _Disc(user: me, art: avatarArtOf(me), radius: 50, fill: brand)),
            Positioned(left: 27, right: 140, top: 128, height: 24, child: fit(Text('@${me.username}', style: display(24, color: white.withValues(alpha: 0.9))))),
            // Big number
            Positioned(
              left: 23,
              right: 23,
              top: 185,
              height: 112,
              child: fit(
                Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
                  Text('${recap.games}', style: display(127)),
                  const SizedBox(width: 8),
                  Text(tr('games', 'matchs').toUpperCase(), style: display(28, color: accent)),
                ]),
                alignment: Alignment.bottomLeft,
              ),
            ),
            // Stat tiles
            Positioned(
              left: 27,
              right: 27,
              top: 313,
              height: 77,
              child: Row(children: [
                for (var i = 0; i < tiles.length; i++) ...[
                  if (i > 0) const SizedBox(width: 9),
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(color: white.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(11)),
                      padding: const EdgeInsets.fromLTRB(6, 10, 6, 8),
                      child: Column(children: [
                        Expanded(child: fit(Text(tiles[i].$1, style: display(40)), alignment: Alignment.center)),
                        const SizedBox(height: 4),
                        SizedBox(height: 12, child: fit(Text(tiles[i].$2, style: sans(10, color: white.withValues(alpha: 0.8))), alignment: Alignment.center)),
                      ]),
                    ),
                  ),
                ],
              ]),
            ),
            // Home court + top teammate cards
            Positioned(
              left: 27,
              right: 27,
              top: 410,
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                if (recap.topCourt != null) ...[
                  _Card(
                    height: 57,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
                      Text(tr('Home court', 'Terrain fétiche').toUpperCase(), style: sans(10, w: FontWeight.w800, color: brand)),
                      const SizedBox(height: 4),
                      SizedBox(height: 24, child: fit(Text(recap.topCourt!.name, style: display(24, color: _ink)))),
                    ]),
                  ),
                  const SizedBox(height: 10),
                ],
                if (teammate != null)
                  _Card(
                    height: 63,
                    child: Row(children: [
                      _Disc(user: teammate.user, art: avatarArtOf(teammate.user), radius: 22, fill: brand, background: brand.withValues(alpha: 0.13)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
                          Text(tr('Top teammate', 'Coéquipier n°1').toUpperCase(), style: sans(10, w: FontWeight.w800, color: brand)),
                          const SizedBox(height: 3),
                          SizedBox(height: 21, child: fit(Text('@${teammate.user.username}', style: display(21, color: _ink)))),
                          const SizedBox(height: 2),
                          Text(
                            tr('${teammate.games} games together', '${teammate.games} matchs ensemble'),
                            style: sans(9.5, w: FontWeight.w600, color: const Color(0xFF5B6170)),
                          ),
                        ]),
                      ),
                    ]),
                  ),
              ]),
            ),
            // Footer
            Positioned(
              left: 20,
              right: 20,
              bottom: 22,
              child: Text(
                tr('My month on Out For Ground', 'Mon mois sur Out For Ground'),
                textAlign: TextAlign.center,
                style: sans(11.5, color: white.withValues(alpha: 0.85)),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

class _Card extends StatelessWidget {
  final double height;
  final Widget child;
  const _Card({required this.height, required this.child});
  @override
  Widget build(BuildContext context) => Container(
        height: height,
        padding: const EdgeInsets.symmetric(horizontal: 15),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
        child: child,
      );
}

/// Round avatar with a white ring; initials when there is no avatar art.
class _Disc extends StatelessWidget {
  final PublicUser user;
  final AvatarArt art;
  final double radius;
  final Color fill;
  final Color background;
  const _Disc({required this.user, required this.art, required this.radius, required this.fill, this.background = const Color(0xEBFFFFFF)});

  @override
  Widget build(BuildContext context) {
    final url = art.pngUrl(expression: _storyFace);
    final initials = Center(
      child: Text(
        (user.initials.isNotEmpty ? user.initials : user.username).characters.take(2).toString().toUpperCase(),
        style: TextStyle(color: fill, fontWeight: FontWeight.w900, fontSize: radius * 0.9, height: 1),
      ),
    );
    return Container(
      width: radius * 2,
      height: radius * 2,
      decoration: BoxDecoration(
        color: background,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: radius < 30 ? 2 : 3),
      ),
      clipBehavior: Clip.antiAlias,
      child: url == null
          ? initials
          : Padding(
              padding: EdgeInsets.only(top: radius * 0.18),
              child: Image.network(url, fit: BoxFit.cover, alignment: Alignment.topCenter, errorBuilder: (_, _, _) => initials),
            ),
    );
  }
}

/// Court lines as a quiet texture (centre circle at the bottom, half-way line).
class _CourtLines extends CustomPainter {
  const _CourtLines();
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.7
      ..color = Colors.white.withValues(alpha: 0.08);
    canvas.drawCircle(Offset(size.width / 2, size.height + 40), 207, p);
    canvas.drawLine(Offset(0, size.height - 167), Offset(size.width, size.height - 167), p);
  }

  @override
  bool shouldRepaint(covariant _CourtLines old) => false;
}
