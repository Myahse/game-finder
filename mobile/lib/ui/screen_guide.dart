import 'dart:async';

import 'package:flutter/material.dart';
import 'theme.dart';
import 'package:flutter/scheduler.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/guide.dart';
import '../core/l10n.dart';

/// One card of a screen's first-visit tips. With a [target], everything but
/// that widget is dimmed; without one the card sits in the middle.
class GuideTip {
  final GlobalKey? target;
  final String emoji, title, body;
  const GuideTip({this.target, required this.emoji, required this.title, required this.body});
}

/// First-visit tips for one screen (port of web/src/components/ScreenGuide.tsx):
/// shown once per screen to new players; "Skip tips" stops them everywhere.
class ScreenGuide {
  ScreenGuide._();

  static final Set<String> _pending = {};
  static bool _showing = false;

  /// Clock for the "new player" check (tests).
  @visibleForTesting
  static DateTime Function() clock = DateTime.now;

  /// Shows [tips] for [screen] after [delay], if this player should see them.
  /// Call from initState (no need to wait for the first frame). Waits while
  /// another route (sheet, dialog, pushed screen) or guide covers this one;
  /// gives up when [when] turns false (e.g. the tab is no longer active) or the
  /// screen goes away — it will be offered again next time.
  static Future<void> maybeShow(
    BuildContext context, {
    required String screen,
    required List<GuideTip> tips,
    Duration delay = const Duration(milliseconds: 700),
    bool Function()? when,
  }) async {
    if (tips.isEmpty || _pending.contains(screen)) return;
    final String uid;
    try {
      final user = context.read<Api>().session?.user;
      if (!guideEligible(user, clock())) return;
      uid = user!['id'] as String;
    } catch (_) {
      return;
    }
    _pending.add(screen);
    try {
      if (await guideSeen(uid, screen)) return;
      await Future<void>.delayed(delay);
      NavigatorState nav;
      while (true) {
        if (!context.mounted) return;
        if (when != null && !when()) return;
        if (context.read<Api>().session?.user['id'] != uid) return; // signed out / switched
        final route = ModalRoute.of(context);
        if (!_showing && (route == null || route.isCurrent)) {
          nav = Navigator.of(context, rootNavigator: true);
          break;
        }
        await Future<void>.delayed(const Duration(milliseconds: 500));
      }
      _showing = true;
      String? exit;
      try {
        exit = await nav.push<String>(_guideRoute(tips));
      } finally {
        _showing = false;
      }
      await markGuideSeen(uid, screen);
      if (exit == _skip) await turnOffGuide(uid);
    } finally {
      _pending.remove(screen);
    }
  }
}

const _skip = 'skip';
const _pad = 6.0;

PageRoute<String> _guideRoute(List<GuideTip> tips) => PageRouteBuilder<String>(
      opaque: false,
      transitionDuration: const Duration(milliseconds: 220),
      reverseTransitionDuration: const Duration(milliseconds: 160),
      pageBuilder: (context, animation, secondaryAnimation) => _GuideOverlay(tips: tips),
      transitionsBuilder: (context, animation, secondaryAnimation, child) =>
          FadeTransition(opacity: CurvedAnimation(parent: animation, curve: Curves.easeOut), child: child),
    );

class _GuideOverlay extends StatefulWidget {
  final List<GuideTip> tips;
  const _GuideOverlay({required this.tips});
  @override
  State<_GuideOverlay> createState() => _GuideOverlayState();
}

class _GuideOverlayState extends State<_GuideOverlay> with SingleTickerProviderStateMixin {
  int _index = 0;
  Rect? _rect;
  late final Ticker _ticker = createTicker(_onTick);

  GuideTip get _tip => widget.tips[_index];

  @override
  void initState() {
    super.initState();
    _track();
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  /// Follow the target for a moment (route fade, scroll into view, late layout).
  void _track() {
    _ticker
      ..stop()
      ..start();
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollIntoView());
  }

  void _onTick(Duration elapsed) {
    _measure();
    if (elapsed > const Duration(milliseconds: 1500)) _ticker.stop();
  }

  Rect? _targetRect() {
    final ctx = _tip.target?.currentContext;
    final box = ctx?.findRenderObject();
    if (box is! RenderBox || !box.attached || !box.hasSize || box.size.isEmpty) return null;
    var topLeft = box.localToGlobal(Offset.zero);
    final self = context.findRenderObject();
    if (self is RenderBox && self.hasSize) {
      topLeft = self.globalToLocal(topLeft);
      final r = topLeft & box.size;
      // Entirely off screen (and not scrollable into view): centred card instead.
      if (!r.overlaps(Offset.zero & self.size)) return null;
      return r;
    }
    return topLeft & box.size;
  }

  void _measure() {
    if (!mounted) return;
    final r = _targetRect();
    if (r != _rect) setState(() => _rect = r);
  }

  void _scrollIntoView() {
    if (!mounted) return;
    final ctx = _tip.target?.currentContext;
    if (ctx == null || !ctx.mounted) return;
    final r = _targetRect();
    final h = MediaQuery.sizeOf(context).height;
    if (r != null && r.top >= 0 && r.bottom <= h) return;
    unawaited(Scrollable.ensureVisible(ctx, alignment: 0.5, duration: const Duration(milliseconds: 300)).catchError((_) {}));
  }

  void _next() {
    if (_index + 1 < widget.tips.length) {
      setState(() => _index++);
      _track();
    } else {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    // Re-measure after rotation / keyboard / text-scale changes.
    MediaQuery.sizeOf(context);
    WidgetsBinding.instance.addPostFrameCallback((_) => _measure());

    final scheme = Theme.of(context).colorScheme;
    final rect = _rect;
    final height = MediaQuery.sizeOf(context).height;
    // Card goes on the side away from the spotlight.
    final cardOnTop = rect != null && rect.center.dy > height / 2;
    final reduceMotion = MediaQuery.of(context).disableAnimations;

    return Material(
      type: MaterialType.transparency,
      child: Stack(children: [
        Positioned.fill(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () {}, // the dimmed screen is not tappable
            // No target yet (or none): plain dimmed screen. A tween needs an end rect.
            child: rect == null
                ? CustomPaint(painter: SpotlightPainter(hole: null, ring: scheme.primary))
                : TweenAnimationBuilder<Rect?>(
                    tween: RectTween(end: rect),
                    duration: reduceMotion ? Duration.zero : const Duration(milliseconds: 260),
                    curve: Curves.easeOutCubic,
                    builder: (context, hole, _) => CustomPaint(
                      painter: SpotlightPainter(hole: hole ?? rect, ring: scheme.primary),
                    ),
                  ),
          ),
        ),
        Positioned.fill(
          child: SafeArea(
            minimum: const EdgeInsets.all(16),
            child: Align(
              alignment: rect == null ? Alignment.center : (cardOnTop ? Alignment.topCenter : Alignment.bottomCenter),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 448),
                child: Semantics(
                  scopesRoute: true,
                  namesRoute: true,
                  explicitChildNodes: true,
                  label: _tip.title,
                  child: _card(context),
                ),
              ),
            ),
          ),
        ),
      ]),
    );
  }

  Widget _card(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final tips = widget.tips;
    final tip = _tip;
    final last = _index == tips.length - 1;
    final eyebrow = tips.length > 1
        ? tr('Tip ${_index + 1} of ${tips.length}', 'Astuce ${_index + 1} sur ${tips.length}')
        : tr('Quick tip', 'Astuce');

    return Card(
      elevation: 8,
      shadowColor: Colors.black.withValues(alpha: 0.35),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 12, 16),
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 180),
          child: Column(
            key: ValueKey(_index),
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Expanded(
                  child: Text(
                    eyebrow.toUpperCase(),
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 0.8, color: scheme.primary),
                  ),
                ),
                TextButton(
                  onPressed: () => Navigator.of(context).pop(_skip),
                  style: TextButton.styleFrom(
                    foregroundColor: scheme.onSurfaceVariant,
                    textStyle: const TextStyle(fontFamily: kFontFamily, fontSize: 13, fontWeight: FontWeight.w700),
                  ),
                  child: Text(tr('Skip tips', 'Passer les astuces')),
                ),
              ]),
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  ExcludeSemantics(child: Text(tip.emoji, style: const TextStyle(fontSize: 32, height: 1.1))),
                  const SizedBox(height: 10),
                  Text(tip.title.toUpperCase(), style: theme.textTheme.headlineMedium?.copyWith(height: 1.05)),
                  const SizedBox(height: 6),
                  Text(tip.body, style: theme.textTheme.bodyMedium?.copyWith(color: scheme.onSurfaceVariant, height: 1.35)),
                  const SizedBox(height: 18),
                  Row(children: [
                    if (tips.length > 1)
                      ExcludeSemantics(
                        child: Row(children: [
                          for (var i = 0; i < tips.length; i++)
                            Container(
                              width: 8,
                              height: 8,
                              margin: const EdgeInsets.only(right: 6),
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: i == _index ? scheme.primary : scheme.outlineVariant,
                              ),
                            ),
                        ]),
                      ),
                    const Spacer(),
                    FilledButton(
                      autofocus: true,
                      onPressed: _next,
                      style: FilledButton.styleFrom(minimumSize: const Size(0, 48), padding: const EdgeInsets.symmetric(horizontal: 24)),
                      child: Text((last ? tr('Got it', 'Compris') : tr('Next', 'Suivant')).toUpperCase()),
                    ),
                  ]),
                ]),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Dims the screen except a rounded cut-out around [hole], ringed in [ring].
class SpotlightPainter extends CustomPainter {
  final Rect? hole;
  final Color ring;
  const SpotlightPainter({required this.hole, required this.ring});

  static const dim = Color(0x8C000000); // rgba(0,0,0,.55)

  @override
  void paint(Canvas canvas, Size size) {
    final full = Offset.zero & size;
    final paint = Paint()..color = dim;
    final h = hole;
    if (h == null) {
      canvas.drawRect(full, paint);
      return;
    }
    final cut = RRect.fromRectAndRadius(h.inflate(_pad), const Radius.circular(16));
    canvas.drawPath(
      Path()
        ..fillType = PathFillType.evenOdd
        ..addRect(full)
        ..addRRect(cut),
      paint,
    );
    canvas.drawRRect(
      cut,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..color = ring,
    );
  }

  @override
  bool shouldRepaint(SpotlightPainter old) => old.hole != hole || old.ring != ring;
}
