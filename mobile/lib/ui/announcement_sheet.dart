import 'package:flutter/material.dart';

import '../core/announcements.dart';
import '../core/l10n.dart';
import '../core/media_url.dart';
import 'theme.dart';

/// The news pop-up (web AnnouncementModal): flyer, title, text and an optional
/// button. Resolves to true when the button was tapped.
Future<bool> showAnnouncementSheet(BuildContext context, Announcement a) async {
  final res = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => AnnouncementSheet(announcement: a),
  );
  return res == true;
}

class AnnouncementSheet extends StatelessWidget {
  const AnnouncementSheet({super.key, required this.announcement});
  final Announcement announcement;

  @override
  Widget build(BuildContext context) {
    final a = announcement;
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    final maxImage = MediaQuery.sizeOf(context).height * 0.55;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (a.imageUrl != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: ConstrainedBox(
                constraints: BoxConstraints(maxHeight: maxImage),
                child: Image.network(
                  resolveMediaUrl(a.imageUrl!),
                  key: const ValueKey('announcement-image'),
                  fit: BoxFit.contain,
                  errorBuilder: (_, _, _) => const SizedBox.shrink(),
                ),
              ),
            ),
          const SizedBox(height: 16),
          Text(
            tr('NEW ON OUT FOR GROUND', 'NOUVEAU SUR OUT FOR GROUND'),
            style: const TextStyle(color: Palette.brand, fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.6),
          ),
          const SizedBox(height: 4),
          Text(a.title, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
          if (a.body.isNotEmpty) ...[const SizedBox(height: 8), Text(a.body, style: TextStyle(color: muted))],
          const SizedBox(height: 20),
          if (a.linkUrl != null) ...[
            FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(a.ctaLabel ?? tr('See', 'Voir'))),
            const SizedBox(height: 8),
            TextButton(onPressed: () => Navigator.pop(context, false), child: Text(tr('Close', 'Fermer'))),
          ] else
            FilledButton(onPressed: () => Navigator.pop(context, false), child: Text(tr('Close', 'Fermer'))),
        ],
      ),
    );
  }
}
