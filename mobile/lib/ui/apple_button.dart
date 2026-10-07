import 'package:flutter/material.dart';
import 'theme.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/apple_auth.dart';
import '../core/auth.dart';
import '../core/l10n.dart';

class AppleSignInButton extends StatefulWidget {
  final bool onDark;
  const AppleSignInButton({super.key, this.onDark = false});

  @override
  State<AppleSignInButton> createState() => _AppleSignInButtonState();
}

class _AppleSignInButtonState extends State<AppleSignInButton> {
  bool _busy = false;

  Future<void> _go() async {
    setState(() => _busy = true);
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context, rootNavigator: true);
    try {
      final result = await context.read<AuthState>().appleSignIn();
      if (result != null && mounted) navigator.popUntil((r) => r.isFirst);
    } catch (e) {
      messenger.showSnackBar(SnackBar(
        behavior: SnackBarBehavior.floating,
        content: Text(e is ApiException ? apiUserMessage(e) : tr('Apple sign-in failed. Try again.', 'La connexion Apple a échoué. Réessayez.')),
      ));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!AppleAuth.enabled) return const SizedBox.shrink();
    final dark = widget.onDark;
    return OutlinedButton(
      onPressed: _busy ? null : _go,
      style: OutlinedButton.styleFrom(
        backgroundColor: dark ? Colors.white : Colors.black,
        foregroundColor: dark ? Colors.black : Colors.white,
        side: BorderSide(color: dark ? Colors.white : Colors.black),
        shape: const StadiumBorder(),
        textStyle: const TextStyle(fontFamily: kFontFamily, fontWeight: FontWeight.w600, fontSize: 15, letterSpacing: 0.2),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        _busy
            ? SizedBox.square(
                dimension: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: dark ? Colors.black : Colors.white,
                ),
              )
            : Icon(Icons.apple, size: 22, color: dark ? Colors.black : Colors.white),
        const SizedBox(width: 12),
        Text(tr('Continue with Apple', 'Continuer avec Apple')),
      ]),
    );
  }
}
