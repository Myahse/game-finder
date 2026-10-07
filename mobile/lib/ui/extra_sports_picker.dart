import 'package:flutter/material.dart';

import '../core/account.dart';
import '../core/models.dart';
import 'app_icons.dart';
import 'theme.dart';

/// Up to [max] sports besides the main one (web ProfilePage / OnboardingPage
/// "Other sports" chips). The main sport is never offered.
class ExtraSportsPicker extends StatelessWidget {
  final List<Sport> sports;
  final String? mainSportId;
  final List<String> selected;
  final ValueChanged<List<String>> onChanged;
  final String title, hint;
  final int max;

  const ExtraSportsPicker({
    super.key,
    required this.sports,
    required this.mainSportId,
    required this.selected,
    required this.onChanged,
    required this.title,
    required this.hint,
    this.max = 2,
  });

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    final options = sports.where((s) => s.active && s.id != mainSportId).toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
      const SizedBox(height: 2),
      Text(hint, style: TextStyle(fontSize: 12, color: muted)),
      const SizedBox(height: 8),
      Wrap(spacing: 8, runSpacing: 8, children: [
        for (final s in options) _chip(context, s),
      ]),
    ]);
  }

  Widget _chip(BuildContext context, Sport s) {
    final on = selected.contains(s.id);
    final disabled = !on && selected.length >= max;
    final scheme = Theme.of(context).colorScheme;
    return Opacity(
      opacity: disabled ? 0.4 : 1,
      child: Semantics(
        button: true,
        selected: on,
        enabled: !disabled,
        child: InkWell(
          borderRadius: BorderRadius.circular(99),
          onTap: disabled ? null : () => onChanged(toggleExtraSport(selected, s.id, mainSportId: mainSportId, max: max)),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(
              color: on ? Palette.brand.withValues(alpha: 0.1) : scheme.surface,
              borderRadius: BorderRadius.circular(99),
              border: Border.all(color: on ? Palette.brand : Theme.of(context).dividerColor, width: 2),
            ),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              SportIcon(s.slug, size: 16, color: Palette.brand),
              const SizedBox(width: 6),
              Text(s.name, style: const TextStyle(fontWeight: FontWeight.w600)),
            ]),
          ),
        ),
      ),
    );
  }
}
