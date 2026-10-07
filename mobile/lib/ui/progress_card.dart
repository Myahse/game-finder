import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/catalog.dart';
import '../core/l10n.dart';
import '../core/progress_models.dart';
import 'widgets.dart';

/// XP + level, streak, ratings, crowns and badges. [userId] null = me.
class ProgressCard extends StatefulWidget {
  final String? userId;
  const ProgressCard({super.key, this.userId});
  @override
  State<ProgressCard> createState() => _ProgressCardState();
}

class _ProgressCardState extends State<ProgressCard> {
  Progress? _p;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    final api = context.read<Api>();
    try {
      final j = await api.get(widget.userId == null ? '/api/me/progress' : '/api/users/${widget.userId}/progress');
      if (!mounted) return;
      final p = Progress.fromJson(Map<String, dynamic>.from(j));
      setState(() => _p = p);
      for (final id in p.newBadges) {
        final b = badgeInfo(id);
        showSnack(context, '${tr('New badge!', 'Nouveau badge !')} ${b.emoji} ${b.name}');
      }
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = _p;
    if (_failed) return const SizedBox.shrink();
    if (p == null) {
      return const Card(child: Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())));
    }
    final mine = widget.userId == null;
    final theme = Theme.of(context);
    final color = tierColors[levelTier(p.level)];
    final muted = theme.colorScheme.onSurfaceVariant;
    final earned = p.badges.where((b) => b.earned).length;
    final streakNote = p.streakCurrent == 0
        ? (mine ? tr('Play this week to start a streak', 'Jouez cette semaine pour lancer une série') : tr('Best: ${p.streakBest} weeks', 'Record : ${p.streakBest} semaines'))
        : p.streakActiveThisWeek
            ? tr('Played this week ✓', 'Joué cette semaine ✓')
            : mine
                ? tr('Play before Sunday to keep it', 'Jouez avant dimanche pour la garder')
                : tr('Best: ${p.streakBest} weeks', 'Record : ${p.streakBest} semaines');

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            SizedBox(
              width: 76,
              height: 76,
              child: Stack(alignment: Alignment.center, children: [
                SizedBox.expand(
                  child: CircularProgressIndicator(
                    value: p.levelProgress,
                    strokeWidth: 7,
                    color: color,
                    backgroundColor: theme.colorScheme.surfaceContainerHighest,
                  ),
                ),
                Text('${p.level}', style: theme.textTheme.headlineMedium),
              ]),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(levelTitle(p.level).toUpperCase(), style: theme.textTheme.headlineMedium?.copyWith(color: color)),
                Text('${tr('Level', 'Niveau')} ${p.level} · ${p.xp} XP', style: const TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: LinearProgressIndicator(value: p.levelProgress, minHeight: 8, color: color, backgroundColor: theme.colorScheme.surfaceContainerHighest),
                ),
                const SizedBox(height: 4),
                Text(
                  tr('${p.nextLevelXp - p.xp} XP to level ${p.level + 1}', '${p.nextLevelXp - p.xp} XP avant le niveau ${p.level + 1}'),
                  style: TextStyle(fontSize: 12, color: muted),
                ),
              ]),
            ),
          ]),
          for (final c in p.crowns)
            Container(
              margin: const EdgeInsets.only(top: 12),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(color: const Color(0xFFF5B301).withValues(alpha: 0.18), borderRadius: BorderRadius.circular(12)),
              child: Text('👑 ${tr('King of the Court at', 'Roi du terrain à')} ${c.name}',
                  style: const TextStyle(fontWeight: FontWeight.w900, color: Color(0xFFA16207))),
            ),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: _Tile(
                label: tr('Streak', 'Série'),
                value: '🔥 ${p.streakCurrent}',
                note: streakNote,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _Tile(
                label: tr('Rating', 'Classement'),
                value: p.ratings.isEmpty ? '—' : '${p.ratings.first.rating}',
                note: p.ratings.isEmpty ? tr('Win a scored game to get rated', 'Gagnez un match avec score pour être classé') : p.ratings.first.sport.name,
              ),
            ),
          ]),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(child: Text(tr('BADGES', 'BADGES'), style: theme.textTheme.titleLarge)),
            Text(tr('$earned/${p.badges.length} unlocked', '$earned/${p.badges.length} débloqués'), style: TextStyle(fontSize: 12, color: muted, fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 8),
          GridView.count(
            crossAxisCount: 4,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 8,
            crossAxisSpacing: 4,
            childAspectRatio: 0.72,
            children: [for (final b in p.badges) _BadgeTile(badge: b, onTap: () => showBadgeSheet(context, b))],
          ),
          if (mine) ...[
            const SizedBox(height: 8),
            Text(
              tr('Game +10 · Win +15 · MVP +25 · Host +5 · Check-in +2 · Badge +20', 'Match +10 · Victoire +15 · MVP +25 · Organiser +5 · Check-in +2 · Badge +20'),
              style: TextStyle(fontSize: 11, color: muted),
            ),
          ],
        ]),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  final String label, value, note;
  const _Tile({required this.label, required this.value, required this.note});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: theme.colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(14)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: theme.colorScheme.onSurfaceVariant)),
        Text(value, style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
        Text(note, style: TextStyle(fontSize: 12, color: theme.colorScheme.onSurfaceVariant)),
      ]),
    );
  }
}

class _BadgeTile extends StatelessWidget {
  final PlayerBadge badge;
  final VoidCallback onTap;
  const _BadgeTile({required this.badge, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final info = badgeInfo(badge.id);
    final theme = Theme.of(context);
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Column(children: [
        Stack(clipBehavior: Clip.none, children: [
          Opacity(
            opacity: badge.earned ? 1 : 0.35,
            child: Container(
              width: 48,
              height: 48,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: badge.earned ? info.color : theme.colorScheme.surfaceContainerHighest,
              ),
              child: Text(info.emoji, style: const TextStyle(fontSize: 24)),
            ),
          ),
          if (badge.isNew)
            Positioned(
              right: -6,
              top: -4,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                decoration: BoxDecoration(color: theme.colorScheme.primary, borderRadius: BorderRadius.circular(6)),
                child: Text(tr('NEW', 'NOUVEAU'), style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.w900)),
              ),
            ),
        ]),
        const SizedBox(height: 4),
        Text(info.name,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: badge.earned ? null : theme.colorScheme.onSurfaceVariant)),
        if (!badge.earned && badge.goal > 1)
          Text('${badge.have}/${badge.goal}', style: TextStyle(fontSize: 10, color: theme.colorScheme.onSurfaceVariant)),
      ]),
    );
  }
}

/// How to get a badge (locked) or how it was earned (unlocked).
Future<void> showBadgeSheet(BuildContext context, PlayerBadge badge) {
  final info = badgeInfo(badge.id);
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (ctx) {
      final theme = Theme.of(ctx);
      final muted = theme.colorScheme.onSurfaceVariant;
      return SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Opacity(
              opacity: badge.earned ? 1 : 0.4,
              child: Container(
                width: 104,
                height: 104,
                alignment: Alignment.center,
                decoration: BoxDecoration(shape: BoxShape.circle, color: badge.earned ? info.color : theme.colorScheme.surfaceContainerHighest),
                child: Text(info.emoji, style: const TextStyle(fontSize: 52)),
              ),
            ),
            const SizedBox(height: 12),
            Text(info.name.toUpperCase(), textAlign: TextAlign.center, style: theme.textTheme.headlineMedium),
            Text(info.desc, textAlign: TextAlign.center, style: TextStyle(color: muted)),
            const SizedBox(height: 8),
            if (badge.earned)
              Text(
                tr('Unlocked on ${_date(badge.earnedAt!)}', 'Débloqué le ${_date(badge.earnedAt!)}'),
                style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF16A34A)),
              )
            else if (badge.goal > 1) ...[
              SizedBox(
                width: 220,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: LinearProgressIndicator(value: (badge.have / badge.goal).clamp(0, 1).toDouble(), minHeight: 10, color: info.color),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                tr('${badge.have}/${badge.goal} · ${badge.goal - badge.have} to go', '${badge.have}/${badge.goal} · Encore ${badge.goal - badge.have}'),
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: muted),
              ),
            ],
            if (info.how.isNotEmpty) ...[
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: theme.colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(16)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(badge.earned ? tr('How you got it', 'Comment vous l’avez obtenu') : tr('How to get it', 'Comment l’obtenir'),
                      style: const TextStyle(fontWeight: FontWeight.w900)),
                  const SizedBox(height: 8),
                  for (var i = 0; i < info.how.length; i++)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        CircleAvatar(
                          radius: 10,
                          backgroundColor: info.color,
                          child: Text('${i + 1}', style: const TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.w900)),
                        ),
                        const SizedBox(width: 8),
                        Expanded(child: Text(info.how[i])),
                      ]),
                    ),
                  if (!badge.earned)
                    Text(tr('+20 XP when unlocked', '+20 XP au déblocage'),
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: theme.colorScheme.primary)),
                ]),
              ),
            ],
          ]),
        ),
      );
    },
  );
}

String _date(DateTime d) {
  const en = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fr = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  return isFrench ? '${d.day} ${fr[d.month - 1]} ${d.year}' : '${en[d.month - 1]} ${d.day}, ${d.year}';
}
