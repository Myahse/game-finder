import 'package:flutter/material.dart';

import 'theme.dart';

/// Brief scale + glow when a game appears on the map rail via WebSocket.
class LiveEnterHighlight extends StatefulWidget {
  final bool active;
  final Widget child;
  final BorderRadius borderRadius;

  const LiveEnterHighlight({
    super.key,
    required this.active,
    required this.child,
    this.borderRadius = const BorderRadius.all(Radius.circular(18)),
  });

  @override
  State<LiveEnterHighlight> createState() => _LiveEnterHighlightState();
}

class _LiveEnterHighlightState extends State<LiveEnterHighlight> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 750));
  late final Animation<double> _scale = CurvedAnimation(parent: _c, curve: Curves.elasticOut);
  late final Animation<double> _glow = Tween<double>(begin: 0, end: 1).animate(
    CurvedAnimation(parent: _c, curve: const Interval(0, 0.55, curve: Curves.easeOut)),
  );

  @override
  void initState() {
    super.initState();
    if (widget.active) _c.forward();
  }

  @override
  void didUpdateWidget(covariant LiveEnterHighlight oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.active && !oldWidget.active) {
      _c.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.active) return widget.child;
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) {
        final glow = _glow.value;
        return Transform.scale(
          scale: 0.88 + 0.12 * _scale.value,
          child: DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: widget.borderRadius,
              boxShadow: [
                BoxShadow(
                  color: Palette.live.withValues(alpha: 0.35 * (1 - glow * 0.5)),
                  blurRadius: 8 + 14 * glow,
                  spreadRadius: 1 + 3 * glow,
                ),
              ],
            ),
            child: child,
          ),
        );
      },
      child: widget.child,
    );
  }
}
