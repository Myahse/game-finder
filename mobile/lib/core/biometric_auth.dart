import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'l10n.dart';

/// The device's fingerprint / Face ID sensor (swapped for a fake in tests).
abstract class BiometricBackend {
  Future<bool> isDeviceSupported();
  Future<bool> canCheckBiometrics();
  Future<List<BiometricType>> availableBiometrics();
  Future<bool> authenticate(String reason);
}

/// [BiometricBackend] on top of `local_auth`.
class LocalAuthBackend implements BiometricBackend {
  final LocalAuthentication _localAuth;
  LocalAuthBackend([LocalAuthentication? localAuth]) : _localAuth = localAuth ?? LocalAuthentication();

  @override
  Future<bool> isDeviceSupported() => _localAuth.isDeviceSupported();

  @override
  Future<bool> canCheckBiometrics() => _localAuth.canCheckBiometrics;

  @override
  Future<List<BiometricType>> availableBiometrics() => _localAuth.getAvailableBiometrics();

  @override
  Future<bool> authenticate(String reason) => _localAuth.authenticate(
        localizedReason: reason,
        // stickyAuth: survives the app being backgrounded mid-prompt.
        // biometricOnly false: the phone's PIN / passcode is the fallback.
        options: const AuthenticationOptions(stickyAuth: true, biometricOnly: false),
      );
}

/// Email/username + password kept for the fingerprint quick login.
class StoredLogin {
  final String login, password;
  const StoredLogin(this.login, this.password);

  /// Saved for this account (its email or username, any case).
  bool belongsTo({required String email, required String username}) {
    final l = login.trim().toLowerCase();
    return l.isNotEmpty && (l == email.trim().toLowerCase() || l == username.trim().toLowerCase());
  }
}

/// Fingerprint / Face ID login (modelled on Mon Peya's BiometricAuth).
///
/// The on/off switch is a device setting (SharedPreferences). The login and
/// password used by the quick login live only in the keychain / Android
/// keystore-backed storage ([FlutterSecureStorage]), never in preferences.
class BiometricAuth {
  BiometricAuth._();

  static const enabledKey = 'ftg.biometric_enabled';
  static const _loginKey = 'ftg.biometric_login';
  static const _passwordKey = 'ftg.biometric_password';

  @visibleForTesting
  static BiometricBackend backend = LocalAuthBackend();

  static const FlutterSecureStorage _storage = FlutterSecureStorage(
    // This phone only: not restored to another device from a backup.
    iOptions: IOSOptions(accessibility: KeychainAccessibility.unlocked_this_device),
  );

  static Future<bool> isEnabledInSettings() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getBool(enabledKey) ?? false;
    } catch (_) {
      return false;
    }
  }

  static Future<void> setEnabledInSettings(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(enabledKey, value);
  }

  /// The phone has a fingerprint sensor / Face ID (or at least a screen lock).
  static Future<bool> canUseBiometrics() async {
    try {
      final supported = await backend.isDeviceSupported();
      if (!supported) return false;
      if (await backend.canCheckBiometrics()) return true;
      final types = await backend.availableBiometrics();
      return types.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  /// iPhone with Face ID and no Touch ID: show a face instead of a fingerprint.
  static Future<bool> prefersFace() async {
    try {
      final types = await backend.availableBiometrics();
      return types.contains(BiometricType.face) && !types.contains(BiometricType.fingerprint);
    } catch (_) {
      return false;
    }
  }

  /// Shows the system fingerprint / Face ID prompt. False when cancelled,
  /// failed or unavailable.
  static Future<bool> authenticate({String? reason}) async {
    try {
      return await backend.authenticate(reason ?? unlockReason());
    } catch (_) {
      return false;
    }
  }

  static String unlockReason() => tr('Unlock Out For Ground', 'Déverrouillez Out For Ground');

  // --- Remembered login (email/username + password accounts only) ---

  static Future<void> rememberCredentials(String login, String password) async {
    final l = login.trim();
    if (l.isEmpty || password.isEmpty) return;
    await _storage.write(key: _loginKey, value: l);
    await _storage.write(key: _passwordKey, value: password);
  }

  static Future<StoredLogin?> storedCredentials() async {
    try {
      final login = await _storage.read(key: _loginKey);
      final password = await _storage.read(key: _passwordKey);
      if (login == null || login.isEmpty || password == null || password.isEmpty) return null;
      return StoredLogin(login, password);
    } catch (_) {
      return null;
    }
  }

  static Future<bool> hasStoredCredentials() async => await storedCredentials() != null;

  /// After a password change: keeps the quick login working.
  static Future<void> updateStoredPassword(String password) async {
    final s = await storedCredentials();
    if (s == null || password.isEmpty) return;
    await _storage.write(key: _passwordKey, value: password);
  }

  static Future<void> clearCredentials() async {
    try {
      await _storage.delete(key: _loginKey);
      await _storage.delete(key: _passwordKey);
    } catch (_) {}
  }

  /// The login sheet offers the fingerprint button: switched on, the sensor
  /// works and a login is remembered.
  static Future<StoredLogin?> quickLogin() async {
    if (!await isEnabledInSettings()) return null;
    final stored = await storedCredentials();
    if (stored == null) return null;
    if (!await canUseBiometrics()) return null;
    return stored;
  }

  /// Turning the switch off forgets the remembered login too.
  static Future<void> disable() async {
    await setEnabledInSettings(false);
    await clearCredentials();
  }
}
