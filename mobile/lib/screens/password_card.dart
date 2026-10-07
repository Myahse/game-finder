import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/account.dart';
import '../core/api.dart';
import '../core/auth.dart';
import '../core/l10n.dart';
import '../core/models.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

/// Google/Apple accounts can add a password (username login); others can
/// change it (web components/PasswordCard.tsx).
class PasswordCard extends StatefulWidget {
  final Me me;
  const PasswordCard({super.key, required this.me});
  @override
  State<PasswordCard> createState() => _PasswordCardState();
}

class _PasswordCardState extends State<PasswordCard> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  late bool _open = _adding;
  bool _busy = false;
  String? _error;

  bool get _adding => !widget.me.hasPassword;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final adding = _adding;
    final user = widget.me.username;
    setState(() {
      _busy = true;
      _error = null;
    });
    final auth = context.read<AuthState>();
    try {
      await context.read<Api>().post('/api/me/password', passwordPayload(adding: adding, current: _current.text, next: _next.text));
      _current.clear();
      _next.clear();
      if (!mounted) return;
      showSnack(
          context,
          adding
              ? tr('Password added — you can now log in with @$user.', 'Mot de passe ajouté — vous pouvez vous connecter avec @$user.')
              : tr('Password changed.', 'Mot de passe modifié.'));
      setState(() => _open = false);
      await auth.refreshMe();
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final adding = _adding;
    if (!_open) {
      return OutlinedButton.icon(
        onPressed: () => setState(() => _open = true),
        icon: const Icon(Icons.key_outlined),
        label: Text(tr('Change password', 'Changer le mot de passe')),
      );
    }
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Icon(Icons.key_outlined, color: Palette.brand),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(adding ? tr('Sign in with your username too', 'Connectez-vous aussi avec votre pseudo') : tr('Password', 'Mot de passe'),
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                if (adding)
                  Text(
                    tr('Your account uses Google. Add a password to also log in with @${widget.me.username} or your email.',
                        'Votre compte utilise Google. Ajoutez un mot de passe pour vous connecter aussi avec @${widget.me.username} ou votre e-mail.'),
                    style: TextStyle(color: muted, fontSize: 13),
                  ),
              ]),
            ),
          ]),
          const SizedBox(height: 12),
          if (!adding) ...[
            PasswordTextField(
              controller: _current,
              labelText: tr('Current password', 'Mot de passe actuel'),
              autofillHints: const [AutofillHints.password],
            ),
            const SizedBox(height: 12),
          ],
          ListenableBuilder(
            listenable: Listenable.merge([_current, _next]),
            builder: (context, _) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              PasswordTextField(
                controller: _next,
                labelText: tr('New password', 'Nouveau mot de passe'),
                helperText: tr('8 characters minimum', '8 caractères minimum'),
                autofillHints: const [AutofillHints.newPassword],
              ),
              const SizedBox(height: 12),
              ErrorBanner(_error),
              Row(children: [
                if (!adding) ...[
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _busy ? null : () => setState(() => _open = false),
                      child: Text(tr('Cancel', 'Annuler')),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                Expanded(
                  child: FilledButton(
                    onPressed: _busy || !passwordLengthOk(_next.text) || (!adding && _current.text.isEmpty) ? null : _submit,
                    child: Text(_busy ? '…' : tr('Save password', 'Enregistrer')),
                  ),
                ),
              ]),
            ]),
          ),
        ]),
      ),
    );
  }
}
