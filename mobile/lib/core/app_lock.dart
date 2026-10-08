import 'package:flutter/foundation.dart';

import 'biometric_auth.dart';

/// Asks for fingerprint / Face ID before showing the app, for players who
/// switched "Unlock with fingerprint / Face ID" on: when the app starts with a
/// saved session, and when it comes back after [timeout] in the background.
/// Works for Google / Apple accounts too (nothing is stored for them).
class AppLock extends ChangeNotifier {
  AppLock({DateTime Function()? clock, this.timeout = const Duration(minutes: 5)}) : _clock = clock ?? DateTime.now;

  static final instance = AppLock();

  final DateTime Function() _clock;
  final Duration timeout;

  bool _locked = false;

  /// Locked on a cold start: the home screen and its services wait for the unlock.
  bool _atStart = false;
  DateTime? _backgroundAt;
  bool _unlocking = false;

  bool get locked => _locked;
  bool get lockedAtStart => _locked && _atStart;

  /// Cold start with a saved session.
  Future<void> lockOnStartIfNeeded({required bool signedIn}) async {
    if (!signedIn || !await _wanted()) return;
    _locked = true;
    _atStart = true;
    notifyListeners();
  }

  /// The app went to the background.
  void onPaused() => _backgroundAt ??= _clock();

  /// Back in the foreground: locks after more than [timeout] away.
  Future<void> onResumed({required bool signedIn}) async {
    final since = _backgroundAt;
    _backgroundAt = null;
    if (since == null || _locked || !signedIn) return;
    if (_clock().difference(since) <= timeout) return;
    if (!await _wanted()) return;
    _locked = true;
    _atStart = false;
    notifyListeners();
  }

  /// Shows the system prompt; unlocks on success.
  Future<bool> unlock() async {
    if (!_locked) return true;
    if (_unlocking) return false;
    _unlocking = true;
    try {
      final ok = await BiometricAuth.authenticate();
      if (ok) release();
      return ok;
    } finally {
      _unlocking = false;
    }
  }

  /// Unlocked (or signed out from the lock screen).
  void release() {
    if (!_locked) return;
    _locked = false;
    _atStart = false;
    _backgroundAt = null;
    notifyListeners();
  }

  Future<bool> _wanted() async => await BiometricAuth.isEnabledInSettings() && await BiometricAuth.canUseBiometrics();

  @visibleForTesting
  void debugReset() {
    _locked = false;
    _atStart = false;
    _backgroundAt = null;
    _unlocking = false;
  }
}
