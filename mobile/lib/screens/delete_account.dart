import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/l10n.dart';
import '../core/models.dart';
import '../ui/widgets.dart';

/// "Delete account" at the bottom of the profile. Google Play (and the App
/// Store) require apps with sign-up to offer account deletion in the app.
class DeleteAccountButton extends StatelessWidget {
  final Me me;
  const DeleteAccountButton({super.key, required this.me});

  @override
  Widget build(BuildContext context) {
    final error = Theme.of(context).colorScheme.error;
    return TextButton.icon(
      style: TextButton.styleFrom(foregroundColor: error),
      onPressed: () => showDialog<void>(
        context: context,
        useRootNavigator: true,
        builder: (_) => _DeleteAccountDialog(me: me),
      ),
      icon: const Icon(Icons.delete_forever_outlined),
      label: Text(tr('Delete my account', 'Supprimer mon compte')),
    );
  }
}

class _DeleteAccountDialog extends StatefulWidget {
  final Me me;
  const _DeleteAccountDialog({required this.me});
  @override
  State<_DeleteAccountDialog> createState() => _DeleteAccountDialogState();
}

class _DeleteAccountDialogState extends State<_DeleteAccountDialog> {
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _password.dispose();
    super.dispose();
  }

  Future<void> _delete() async {
    if (widget.me.hasPassword && _password.text.isEmpty) {
      setState(() => _error = tr('Enter your password to confirm.', 'Entrez votre mot de passe pour confirmer.'));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final auth = context.read<AuthState>();
    final messenger = ScaffoldMessenger.maybeOf(context);
    try {
      await auth.deleteAccount(password: widget.me.hasPassword ? _password.text : null);
      if (!mounted) return;
      Navigator.of(context).pop();
      messenger?.showSnackBar(SnackBar(
        content: Text(tr('Your account has been deleted.', 'Votre compte a été supprimé.')),
        behavior: SnackBarBehavior.floating,
      ));
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final error = Theme.of(context).colorScheme.error;
    return AlertDialog(
      title: Text(tr('Delete your account?', 'Supprimer votre compte ?')),
      content: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(tr(
            'This permanently deletes @${widget.me.username}: your profile, avatar, friends, check-ins, game history, '
                'challenges and notifications. Games you organise that haven\'t finished are cancelled and their players are told. '
                'This can\'t be undone.',
            'Cela supprime définitivement @${widget.me.username} : votre profil, avatar, amis, présences, historique de matchs, '
                'défis et notifications. Les matchs que vous organisez et qui ne sont pas terminés sont annulés et leurs joueurs prévenus. '
                'C\'est irréversible.',
          )),
          if (widget.me.hasPassword) ...[
            const SizedBox(height: 16),
            PasswordTextField(
              controller: _password,
              labelText: tr('Password', 'Mot de passe'),
              autofillHints: const [AutofillHints.password],
            ),
          ],
          const SizedBox(height: 12),
          ErrorBanner(_error),
        ]),
      ),
      actions: [
        TextButton(
          onPressed: _busy ? null : () => Navigator.of(context).pop(),
          child: Text(tr('Cancel', 'Annuler')),
        ),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: error, foregroundColor: Theme.of(context).colorScheme.onError),
          onPressed: _busy ? null : _delete,
          child: _busy
              ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
              : Text(tr('DELETE', 'SUPPRIMER')),
        ),
      ],
    );
  }
}
