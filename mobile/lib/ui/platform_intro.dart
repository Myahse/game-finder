import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/l10n.dart';
import 'theme.dart';

/// Same key as the web's guest intro (lib/platformIntro.ts).
const kGuestIntroSeenKey = 'ftg_guest_intro_v1';

/// Shows the 3-step guest intro once per install (web PlatformIntroModal, variant guest).
Future<void> maybeShowGuestIntro(BuildContext context) async {
  SharedPreferences prefs;
  try {
    prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(kGuestIntroSeenKey) == true) return;
  } catch (_) {
    return;
  }
  if (!context.mounted) return;
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => const GuestIntroSheet(),
  );
  try {
    await prefs.setBool(kGuestIntroSeenKey, true);
  } catch (_) {}
}

class GuestIntroSheet extends StatelessWidget {
  const GuestIntroSheet({super.key});

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    final steps = [
      (
        icon: Icons.place_outlined,
        title: tr('Explore the map', 'Explorer la carte'),
        body: tr('Courts and live games near you, for every sport you play.', 'Terrains et matchs en direct près de vous, pour tous vos sports.'),
      ),
      (
        icon: Icons.groups_outlined,
        title: tr('Play with locals', 'Jouer avec les locaux'),
        body: tr('Join open games or create one — set skill level and how many can play.',
            'Rejoignez une partie ou créez-en une — niveau et nombre de joueurs.'),
      ),
      (
        icon: Icons.add,
        title: tr('Add courts & show up', 'Ajouter des terrains'),
        body: tr('Missing a spot? Pin it. When you’re there, check in so others see activity.',
            'Un spot manque ? Posez une épingle. Sur place, cochez votre présence.'),
      ),
    ];
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        Text(tr('WELCOME', 'BIENVENUE'),
            style: const TextStyle(color: Palette.brand, fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.6)),
        const SizedBox(height: 4),
        Text(tr('FIND THE GAME', 'TROUVEZ LE MATCH'), style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w900)),
        const SizedBox(height: 8),
        Text(
          tr('Courts, players and live games near you — basketball, football, volleyball, tennis and more, on one map.',
              'Terrains, joueurs et matchs en direct près de vous — basket, foot, volley, tennis et plus, sur une seule carte.'),
          style: TextStyle(color: muted),
        ),
        const SizedBox(height: 20),
        for (var i = 0; i < steps.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(color: Palette.brand.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(12)),
                child: Icon(steps[i].icon, color: Palette.brand, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(tr('STEP ${i + 1}', 'ÉTAPE ${i + 1}'),
                      style: TextStyle(color: muted, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.4)),
                  Text(steps[i].title, style: const TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text(steps[i].body, style: TextStyle(color: muted, fontSize: 13)),
                ]),
              ),
            ]),
          ),
        const SizedBox(height: 8),
        FilledButton(onPressed: () => Navigator.pop(context), child: Text(tr('Got it', 'Compris'))),
      ]),
    );
  }
}
