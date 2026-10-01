import 'package:flutter/material.dart';

import '../core/format.dart';
import '../core/models.dart';
import '../screens/game_screens.dart';
import '../screens/lists_screens.dart';
import 'theme.dart';
import 'widgets.dart';

/// Maresi-style docked sheet: handle + header + horizontal game cards.
class MapGamesRail extends StatelessWidget {
  const MapGamesRail({
    super.key,
    required this.games,
    required this.loading,
    required this.navOverlap,
    required this.onGameTap,
  });

  final List<Game> games;
  final bool loading;
  final ValueChanged<Game> onGameTap;
  /// Space under the card rail reserved for the floating bottom nav (sheet extends behind it).
  final double navOverlap;

  /// Height of handle + header + cards (above [navOverlap]).
  static const double contentHeight = 172;

  @override
  Widget build(BuildContext context) {
    final sorted = sortPlayable(games).take(12).toList();
    final scheme = Theme.of(context).colorScheme;
    final cardW = (MediaQuery.sizeOf(context).width * 0.72).clamp(240.0, 300.0);

    return Material(
      elevation: 12,
      shadowColor: Colors.black.withValues(alpha: 0.18),
      color: scheme.surface,
      borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 8),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: scheme.outlineVariant.withValues(alpha: 0.7),
              borderRadius: BorderRadius.circular(99),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Games nearby', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                      if (!loading)
                        Text(
                          sorted.isEmpty ? 'No open games' : '${sorted.length} open',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
                        ),
                    ],
                  ),
                ),
                TextButton.icon(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const CreateGameScreen()),
                  ),
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Create'),
                ),
                if (sorted.isNotEmpty)
                  TextButton(
                    onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const PlayScreen())),
                    child: const Text('See all'),
                  ),
              ],
            ),
          ),
          SizedBox(
            height: 108,
            child: loading && sorted.isEmpty
                ? ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    itemCount: 3,
                    separatorBuilder: (_, __) => const SizedBox(width: 12),
                    itemBuilder: (_, __) => _SkeletonCard(width: cardW),
                  )
                : sorted.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Card(
                          child: InkWell(
                            borderRadius: BorderRadius.circular(18),
                            onTap: () => Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => const CreateGameScreen()),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: Row(
                                children: [
                                  Icon(Icons.sports_basketball, size: 40, color: Palette.brand),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        const Text('No open games yet', style: TextStyle(fontWeight: FontWeight.w700)),
                                        Text(
                                          'Create a game at a court near you.',
                                          style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const Icon(Icons.chevron_right),
                                ],
                              ),
                            ),
                          ),
                        ),
                      )
                    : ListView.separated(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                        itemCount: sorted.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 12),
                        itemBuilder: (_, i) {
                          final g = sorted[i];
                          return SizedBox(
                            width: cardW,
                            child: GameCard(
                              game: g,
                              dense: true,
                              onTap: () => onGameTap(g),
                            ),
                          );
                        },
                      ),
          ),
          SizedBox(height: navOverlap),
        ],
      ),
    );
  }
}

class _SkeletonCard extends StatelessWidget {
  final double width;
  const _SkeletonCard({required this.width});

  @override
  Widget build(BuildContext context) {
    final fill = Theme.of(context).colorScheme.surfaceContainerHighest;
    return Container(
      width: width,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: fill.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Theme.of(context).dividerColor.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(width: 64, height: 64, decoration: BoxDecoration(color: fill, borderRadius: BorderRadius.circular(12))),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(height: 14, width: double.infinity, decoration: BoxDecoration(color: fill, borderRadius: BorderRadius.circular(4))),
                const SizedBox(height: 8),
                Container(height: 12, width: 120, decoration: BoxDecoration(color: fill, borderRadius: BorderRadius.circular(4))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
