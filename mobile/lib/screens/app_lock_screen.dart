import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../core/app_lock.dart';
import '../core/auth.dart';
import '../core/biometric_auth.dart';
import '../core/l10n.dart';
import '../core/notifications.dart';
import '../ui/theme.dart';
import 'auth_screens.dart' show showLoginSheet;
import 'link_router.dart';

/// Logs out and opens the normal login (lock screen "Use password / Log out").
Future<void> signOutToLogin(BuildContext context, AppLock lock) async {
  final auth = context.read<AuthState>();
  final nav = Navigator.of(context, rootNavigator: true);
  try {
    await context.read<Notifications>().unregisterDevice();
  } catch (_) {} // no push setup (tests, Firebase off)
  await auth.logout();
  // A link held by the lock that needs a player opens the login sheet itself.
  final linkShowsLogin = LinkRouter.instance.heldNeedsAuth;
  lock.release();
  nav.popUntil((r) => r.isFirst);
  if (linkShowsLogin) return;
  // RootGate swaps in the welcome screen first; the password form, no auto scan.
  WidgetsBinding.instance.addPostFrameCallback((_) {
    final ctx = nav.overlay?.context;
    if (ctx != null && ctx.mounted) showLoginSheet(ctx, autoBiometric: false);
  });
}

/// Keeps the app behind [AppLockScreen] while [lock] is locked: inline on a
/// cold start (the home isn't built yet), as a full-screen route on top of
/// whatever was open when the app comes back after a while.
class AppLockGate extends StatefulWidget {
  final AppLock lock;
  final Widget child;
  const AppLockGate({super.key, required this.lock, required this.child});

  @override
  State<AppLockGate> createState() => _AppLockGateState();
}

class _AppLockGateState extends State<AppLockGate> with WidgetsBindingObserver {
  Route<void>? _route;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    widget.lock.addListener(_onLock);
    WidgetsBinding.instance.addPostFrameCallback((_) => _onLock());
  }

  @override
  void didUpdateWidget(AppLockGate old) {
    super.didUpdateWidget(old);
    if (!identical(old.lock, widget.lock)) {
      old.lock.removeListener(_onLock);
      widget.lock.addListener(_onLock);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    widget.lock.removeListener(_onLock);
    _dropRoute();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.paused:
      case AppLifecycleState.hidden:
        widget.lock.onPaused();
      case AppLifecycleState.resumed:
        widget.lock.onResumed(signedIn: context.read<AuthState>().user != null);
      default:
        break;
    }
  }

  void _onLock() {
    if (!mounted) return;
    setState(() {});
    final lock = widget.lock;
    if (lock.locked && !lock.lockedAtStart && _route == null) {
      final route = PageRouteBuilder<void>(
        opaque: true,
        fullscreenDialog: true,
        pageBuilder: (_, _, _) => AppLockScreen(lock: lock),
        transitionDuration: Duration.zero,
        reverseTransitionDuration: const Duration(milliseconds: 150),
        transitionsBuilder: (_, a, _, child) => FadeTransition(opacity: a, child: child),
      );
      _route = route;
      Navigator.of(context, rootNavigator: true).push(route);
    } else if (!lock.locked) {
      _dropRoute();
    }
  }

  void _dropRoute() {
    final r = _route;
    _route = null;
    if (r != null && r.isActive) r.navigator?.removeRoute(r);
  }

  @override
  Widget build(BuildContext context) {
    final signedIn = context.watch<AuthState>().user != null;
    if (signedIn && widget.lock.lockedAtStart) return AppLockScreen(lock: widget.lock);
    return widget.child;
  }
}

/// "Out For Ground is locked": fingerprint / Face ID, or log out and use the
/// password. Prompts once on its own, like the login quick unlock.
class AppLockScreen extends StatefulWidget {
  final AppLock lock;
  const AppLockScreen({super.key, required this.lock});

  @override
  State<AppLockScreen> createState() => _AppLockScreenState();
}

class _AppLockScreenState extends State<AppLockScreen> {
  bool _busy = false;
  bool _failed = false;
  bool _face = false;

  @override
  void initState() {
    super.initState();
    BiometricAuth.prefersFace().then((f) {
      if (mounted && f) setState(() => _face = true);
    });
    Future<void>.delayed(const Duration(milliseconds: 400), () {
      if (mounted) _unlock();
    });
  }

  Future<void> _unlock() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _failed = false;
    });
    final ok = await widget.lock.unlock();
    if (!mounted) return;
    setState(() {
      _busy = false;
      _failed = !ok;
    });
  }

  Future<void> _usePassword() async {
    setState(() => _busy = true);
    await signOutToLogin(context, widget.lock);
  }

  @override
  Widget build(BuildContext context) {
    final me = context.watch<AuthState>().user;
    final hasPassword = me?.hasPassword ?? true;
    final icon = _face ? Icons.face : Icons.fingerprint;
    return PopScope(
      canPop: false,
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        value: systemBarsFor(Brightness.dark),
        child: Scaffold(
          backgroundColor: Palette.night,
          body: SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                const Spacer(),
                Center(
                  child: Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(color: Palette.brand.withValues(alpha: 0.14), shape: BoxShape.circle),
                    child: Icon(icon, size: 56, color: Palette.brand),
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  tr('OUT FOR GROUND IS LOCKED', 'OUT FOR GROUND EST VERROUILLÉ'),
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w900, letterSpacing: -0.3),
                ),
                const SizedBox(height: 8),
                Text(
                  me == null
                      ? tr('Unlock with your fingerprint or Face ID.', 'Déverrouillez avec votre empreinte ou Face ID.')
                      : tr('Unlock with your fingerprint or Face ID to continue as @${me.username}.',
                          'Déverrouillez avec votre empreinte ou Face ID pour continuer en tant que @${me.username}.'),
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Color(0xFFC9CED6), fontSize: 15, height: 1.35),
                ),
                if (_failed) ...[
                  const SizedBox(height: 12),
                  Text(
                    tr('Not recognized — try again.', 'Non reconnu — réessayez.'),
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Color(0xFFFCA5A5), fontWeight: FontWeight.w600),
                  ),
                ],
                const Spacer(),
                FilledButton.icon(
                  onPressed: _busy ? null : _unlock,
                  icon: Icon(icon),
                  label: Text(tr('UNLOCK', 'DÉVERROUILLER')),
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white24)),
                  onPressed: _busy ? null : _usePassword,
                  child: Text(hasPassword
                      ? tr('Use password', 'Utiliser le mot de passe')
                      : tr('Log out', 'Se déconnecter')),
                ),
                const SizedBox(height: 8),
                Text(
                  tr('You’ll be logged out and can sign in again.', 'Vous serez déconnecté et pourrez vous reconnecter.'),
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white54, fontSize: 12),
                ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
