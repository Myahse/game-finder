import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/google_auth.dart';

/// "Continue with Google". Signs in, links an existing account with the same
/// email, or creates a new one (RootGate then shows onboarding).
/// Renders nothing when Google Sign-In isn't configured.
class GoogleSignInButton extends StatefulWidget {
  final bool onDark;
  const GoogleSignInButton({super.key, this.onDark = false});

  @override
  State<GoogleSignInButton> createState() => _GoogleSignInButtonState();
}

class _GoogleSignInButtonState extends State<GoogleSignInButton> {
  bool _busy = false;

  Future<void> _go() async {
    setState(() => _busy = true);
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context, rootNavigator: true);
    try {
      final result = await context.read<AuthState>().googleSignIn();
      if (result != null && mounted) navigator.popUntil((r) => r.isFirst);
    } catch (e) {
      messenger.showSnackBar(SnackBar(
        behavior: SnackBarBehavior.floating,
        content: Text(e is ApiException ? e.message : 'Google sign-in failed. Try again.'),
      ));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!GoogleAuth.enabled) return const SizedBox.shrink();
    // Google's brand guidelines: white (or dark) button, the G logo, Roboto-ish label.
    final dark = widget.onDark;
    return OutlinedButton(
      onPressed: _busy ? null : _go,
      style: OutlinedButton.styleFrom(
        backgroundColor: dark ? const Color(0xFF131314) : Colors.white,
        foregroundColor: dark ? const Color(0xFFE3E3E3) : const Color(0xFF1F1F1F),
        side: BorderSide(color: dark ? const Color(0xFF8E918F) : const Color(0xFF747775)),
        shape: const StadiumBorder(),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15, letterSpacing: 0.2),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        _busy
            ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2))
            : const CustomPaint(size: Size.square(20), painter: _GoogleLogo()),
        const SizedBox(width: 12),
        const Text('Continue with Google'),
      ]),
    );
  }
}

/// The four-colour Google "G", drawn so no image asset is needed.
class _GoogleLogo extends CustomPainter {
  const _GoogleLogo();

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width;
    final stroke = s * 0.2;
    final rect = Rect.fromCircle(center: Offset(s / 2, s / 2), radius: (s - stroke) / 2);
    Paint p(Color c) => Paint()
      ..color = c
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke;
    const deg = math.pi / 180;
    canvas.drawArc(rect, -40 * deg, -90 * deg, false, p(const Color(0xFFEA4335))); // red, top
    canvas.drawArc(rect, -130 * deg, -95 * deg, false, p(const Color(0xFFFBBC05))); // yellow, left
    canvas.drawArc(rect, 135 * deg, -95 * deg, false, p(const Color(0xFF34A853))); // green, bottom
    canvas.drawArc(rect, 40 * deg, -40 * deg, false, p(const Color(0xFF4285F4))); // blue, right
    canvas.drawRect(
      Rect.fromLTWH(s / 2, s / 2 - stroke / 2, s / 2 - stroke / 4, stroke),
      Paint()..color = const Color(0xFF4285F4),
    );
  }

  @override
  bool shouldRepaint(_GoogleLogo oldDelegate) => false;
}
