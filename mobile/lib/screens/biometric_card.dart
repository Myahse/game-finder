import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/biometric_auth.dart';
import '../core/l10n.dart';
import '../core/models.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

/// Profile → "Unlock with fingerprint / Face ID" (Mon Peya's settings switch).
/// Shown only on phones with a fingerprint sensor / Face ID. Turning it on
/// needs a successful scan; password accounts confirm their password once so
/// the login sheet can offer the quick login. Every account gets the app lock.
class BiometricCard extends StatefulWidget {
  final Me me;
  const BiometricCard({super.key, required this.me});

  @override
  State<BiometricCard> createState() => _BiometricCardState();
}

class _BiometricCardState extends State<BiometricCard> {
  bool _available = false;
  bool _enabled = false;
  bool _face = false;
  bool _busy = false;
  StoredLogin? _stored;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final available = await BiometricAuth.canUseBiometrics();
    if (!available) return;
    final enabled = await BiometricAuth.isEnabledInSettings();
    final stored = await BiometricAuth.storedCredentials();
    final face = await BiometricAuth.prefersFace();
    if (!mounted) return;
    setState(() {
      _available = true;
      _enabled = enabled;
      _stored = stored;
      _face = face;
    });
  }

  bool get _hasMyLogin => _stored?.belongsTo(email: widget.me.email, username: widget.me.username) ?? false;

  Future<void> _toggle(bool on) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      if (on) {
        await _turnOn();
      } else {
        await BiometricAuth.disable();
        if (!mounted) return;
        setState(() {
          _enabled = false;
          _stored = null;
        });
        await showAppAlert(
          context,
          title: tr('Fingerprint / Face ID off', 'Empreinte / Face ID désactivée'),
          message: tr('You turned off fingerprint / Face ID unlock on this phone. Your saved login was removed.',
              'Vous avez désactivé le déverrouillage par empreinte / Face ID sur ce téléphone. Votre connexion enregistrée a été supprimée.'),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _turnOn() async {
    final ok = await BiometricAuth.authenticate(
        reason: tr('Confirm to turn on fingerprint / Face ID', 'Confirmez pour activer l’empreinte / Face ID'));
    if (!mounted) return;
    if (!ok) {
      showSnack(context, tr('Not recognized — fingerprint / Face ID stays off.', 'Non reconnu — l’empreinte / Face ID reste désactivée.'));
      return;
    }
    await BiometricAuth.setEnabledInSettings(true);
    if (!mounted) return;
    setState(() => _enabled = true);
    var saved = _hasMyLogin;
    if (widget.me.hasPassword && !saved) saved = await _confirmPassword();
    if (!mounted) return;
    await showAppAlert(
      context,
      title: tr('Fingerprint / Face ID on', 'Empreinte / Face ID activée'),
      message: saved
          ? tr('Out For Ground asks for your fingerprint or Face ID when it opens, and you can log in with a scan instead of your password.',
              'Out For Ground demande votre empreinte ou Face ID à l’ouverture, et vous pouvez vous connecter d’un scan au lieu du mot de passe.')
          : tr('Out For Ground asks for your fingerprint or Face ID when it opens.',
              'Out For Ground demande votre empreinte ou Face ID à l’ouverture.'),
    );
  }

  /// Asks the password once; true when it was checked and remembered.
  Future<bool> _confirmPassword() async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => _ConfirmPasswordDialog(me: widget.me),
    );
    if (saved == true) {
      final stored = await BiometricAuth.storedCredentials();
      if (mounted) setState(() => _stored = stored);
      return true;
    }
    return false;
  }

  Future<void> _removeSavedLogin() async {
    await BiometricAuth.clearCredentials();
    if (!mounted) return;
    setState(() => _stored = null);
    showSnack(context, tr('Saved login removed.', 'Connexion enregistrée supprimée.'));
  }

  @override
  Widget build(BuildContext context) {
    if (!_available) return const SizedBox.shrink();
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    final stored = _stored;
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          SwitchListTile(
            key: const ValueKey('biometric-switch'),
            value: _enabled,
            onChanged: _busy ? null : _toggle,
            activeThumbColor: Colors.white,
            activeTrackColor: Palette.brand,
            contentPadding: const EdgeInsets.fromLTRB(16, 6, 12, 6),
            secondary: Icon(_face ? Icons.face : Icons.fingerprint, color: Palette.brand),
            title: Text(tr('Unlock with fingerprint / Face ID', 'Déverrouiller avec l’empreinte / Face ID'),
                style: const TextStyle(fontWeight: FontWeight.w800)),
            subtitle: Text(
              tr('Asked when the app opens. Password accounts can also log in with a scan.',
                  'Demandé à l’ouverture de l’app. Les comptes avec mot de passe peuvent aussi se connecter d’un scan.'),
              style: TextStyle(color: muted, fontSize: 13),
            ),
          ),
          if (_enabled && stored != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 8, 8),
              child: Row(children: [
                Icon(Icons.key_outlined, size: 18, color: muted),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(tr('Saved login: ${stored.login}', 'Connexion enregistrée : ${stored.login}'),
                      style: TextStyle(color: muted, fontSize: 13), overflow: TextOverflow.ellipsis),
                ),
                TextButton(
                  key: const ValueKey('biometric-remove-login'),
                  onPressed: _busy ? null : _removeSavedLogin,
                  child: Text(tr('Remove saved login', 'Supprimer la connexion')),
                ),
              ]),
            )
          else if (_enabled && widget.me.hasPassword)
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: _busy ? null : _confirmPassword,
                  icon: const Icon(Icons.key_outlined, size: 18),
                  label: Text(tr('Save my login for quick login', 'Enregistrer ma connexion rapide')),
                ),
              ),
            ),
        ]),
      ),
    );
  }
}

/// "Confirm your password": checked with the server, then kept in the
/// keychain / Android keystore for the fingerprint quick login.
class _ConfirmPasswordDialog extends StatefulWidget {
  final Me me;
  const _ConfirmPasswordDialog({required this.me});

  @override
  State<_ConfirmPasswordDialog> createState() => _ConfirmPasswordDialogState();
}

class _ConfirmPasswordDialogState extends State<_ConfirmPasswordDialog> {
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  String get _login => widget.me.email.isNotEmpty ? widget.me.email : widget.me.username;

  @override
  void dispose() {
    _password.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_password.text.isEmpty) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<AuthState>().verifyPassword(_login, _password.text);
      await BiometricAuth.rememberCredentials(_login, _password.text);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _error = e is ApiException && e.code == 'invalid_credentials'
            ? tr('Wrong password.', 'Mot de passe incorrect.')
            : errorText(e));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(tr('Quick login', 'Connexion rapide')),
        content: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(
              tr('Confirm your password once to log in with a scan next time. It stays on this phone, protected by your fingerprint / Face ID.',
                  'Confirmez votre mot de passe une fois pour vous connecter d’un scan la prochaine fois. Il reste sur ce téléphone, protégé par votre empreinte / Face ID.'),
            ),
            const SizedBox(height: 16),
            PasswordTextField(
              controller: _password,
              labelText: tr('Password', 'Mot de passe'),
              autofillHints: const [AutofillHints.password],
              onSubmitted: (_) => _save(),
            ),
            const SizedBox(height: 8),
            ErrorBanner(_error),
          ]),
        ),
        actions: [
          TextButton(onPressed: _busy ? null : () => Navigator.pop(context, false), child: Text(tr('Not now', 'Plus tard'))),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
            onPressed: _busy ? null : _save,
            child: Text(_busy ? '…' : tr('Save', 'Enregistrer')),
          ),
        ],
      );
}
