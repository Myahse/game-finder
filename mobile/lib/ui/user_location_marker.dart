import 'package:flutter/material.dart';

/// Blue dot with expanding ripples (matches web `.ftg-user-loc`).
class UserLocationMarker extends StatefulWidget {
  const UserLocationMarker({super.key});

  static const double dotSize = 20;
  /// MarkerLayer width/height — must fit pulse expansion (dot + ~2× ripple).
  static const double markerSize = 56;

  @override
  State<UserLocationMarker> createState() => _UserLocationMarkerState();
}

class _UserLocationMarkerState extends State<UserLocationMarker> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 1800))..repeat();
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const color = Color(0xFF3B82F6);
    return SizedBox(
      width: UserLocationMarker.markerSize,
      height: UserLocationMarker.markerSize,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [
          for (var i = 0; i < 2; i++)
            AnimatedBuilder(
              animation: _pulse,
              builder: (context, _) {
                final t = ((_pulse.value + i * 0.5) % 1.0);
                final size = UserLocationMarker.dotSize + 28 * t;
                return Container(
                  width: size,
                  height: size,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: color.withValues(alpha: 0.5 * (1 - t)),
                  ),
                );
              },
            ),
          Container(
            width: UserLocationMarker.dotSize,
            height: UserLocationMarker.dotSize,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 3),
              boxShadow: const [BoxShadow(blurRadius: 8, color: Colors.black26)],
            ),
          ),
        ],
      ),
    );
  }
}
