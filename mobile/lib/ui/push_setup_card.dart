import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/l10n.dart';
import '../core/notifications.dart';
import 'theme.dart';

/// Whether this phone gets push notifications, with "Turn on" when it doesn't
/// (web components/PushSetupCard.tsx).
class PushSetupCard extends StatefulWidget {
  const PushSetupCard({super.key});
  @override
  State<PushSetupCard> createState() => _PushSetupCardState();
}

class _PushSetupCardState extends State<PushSetupCard> with WidgetsBindingObserver {
  PushStatus? _status;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _check();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // Back from the system settings: show the new state.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _check(keepBlocked: true);
  }

  Future<void> _check({bool keepBlocked = false}) async {
    final st = await context.read<Notifications>().pushStatus();
    if (!mounted) return;
    setState(() => _status = keepBlocked && _status == PushStatus.blocked && st == PushStatus.off ? PushStatus.blocked : st);
  }

  Future<void> _enable() async {
    setState(() => _busy = true);
    try {
      final st = await context.read<Notifications>().enablePush();
      if (mounted) setState(() => _status = st);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// iOS opens this app's page in Settings; Android has no URL for it.
  bool get _canOpenSettings => !kIsWeb && Platform.isIOS;

  @override
  Widget build(BuildContext context) {
    final st = _status;
    if (st == null) return const SizedBox.shrink();
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    final text = switch (st) {
      PushStatus.on => tr('On for this device.', 'Activées sur cet appareil.'),
      PushStatus.off => tr('Get challenges, invites and reminders even when the app is closed.',
          'Recevez défis, invitations et rappels même quand l’app est fermée.'),
      PushStatus.blocked => tr(
          'Blocked in your phone settings. Open Settings → Find the Game → Notifications, allow them, then come back.',
          'Bloquées dans les réglages du téléphone. Ouvrez Réglages → Find the Game → Notifications, autorisez-les, puis revenez.'),
      PushStatus.unsupported => tr('This device can’t receive notifications.', 'Cet appareil ne peut pas recevoir de notifications.'),
    };
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(Icons.notifications_active_outlined, color: st == PushStatus.on ? Palette.live : Palette.brand),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr('Phone notifications', 'Notifications sur le téléphone'), style: const TextStyle(fontWeight: FontWeight.w800)),
              const SizedBox(height: 2),
              Text(text, style: TextStyle(color: muted, fontSize: 13)),
              if (st == PushStatus.off) ...[
                const SizedBox(height: 8),
                FilledButton(
                  style: FilledButton.styleFrom(minimumSize: const Size(0, 40)),
                  onPressed: _busy ? null : _enable,
                  child: Text(_busy ? '…' : tr('Turn on', 'Activer')),
                ),
              ],
              if (st == PushStatus.blocked && _canOpenSettings) ...[
                const SizedBox(height: 8),
                OutlinedButton(
                  style: OutlinedButton.styleFrom(minimumSize: const Size(0, 40)),
                  onPressed: () => launchUrl(Uri.parse('app-settings:')),
                  child: Text(tr('Open settings', 'Ouvrir les réglages')),
                ),
              ],
            ]),
          ),
        ]),
      ),
    );
  }
}
