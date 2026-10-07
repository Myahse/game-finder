import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/l10n.dart';
import '../core/scoreboard_models.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'profile_screen.dart';

const _medals = [Color(0xFFF5B301), Color(0xFFB8C2CC), Color(0xFFCD7F32)];

/// Players ranked at a court: wins, MVPs and games played.
class CourtLeaderboard extends StatefulWidget {
  final String courtId;
  const CourtLeaderboard({super.key, required this.courtId});
  @override
  State<CourtLeaderboard> createState() => _CourtLeaderboardState();
}

class _CourtLeaderboardState extends State<CourtLeaderboard> {
  String _period = 'month';
  final Map<String, Leaderboard> _data = {};
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final period = _period;
    if (_data.containsKey(period)) return;
    try {
      final j = await context.read<Api>().get('/api/courts/${widget.courtId}/leaderboard?period=$period');
      if (!mounted) return;
      setState(() {
        _data[period] = Leaderboard.fromJson(Map<String, dynamic>.from(j));
        _failed = false;
      });
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.colorScheme.onSurfaceVariant;
    final me = context.watch<AuthState>().user;
    final data = _data[_period];
    final head = TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: muted);

    Widget body;
    if (data == null) {
      body = _failed
          ? Padding(
              padding: const EdgeInsets.all(8),
              child: Text(tr('Could not load the ranking.', 'Impossible de charger le classement.'), style: TextStyle(color: muted)),
            )
          : const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()));
    } else if (data.players.isEmpty) {
      body = Padding(
        padding: const EdgeInsets.all(8),
        child: Text(
          tr('No games played here yet. Play, keep score and climb the ranking.',
              'Aucun match joué ici. Jouez, notez le score et grimpez au classement.'),
          style: TextStyle(color: muted),
        ),
      );
    } else {
      final meOutside = data.meOutside;
      body = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(8, 0, 8, 4),
          child: Row(children: [
            const Spacer(),
            _num(Text(tr('Games', 'Matchs'), style: head)),
            _num(Text(tr('Wins', 'Vict.'), style: head)),
            _num(Text('Pts', style: head)),
          ]),
        ),
        for (final r in data.players) _LeaderRow(row: r, mine: r.user.id == me?.id),
        if (meOutside != null) ...[
          Center(child: Text('⋯', style: TextStyle(color: muted))),
          _LeaderRow(row: meOutside, mine: true),
        ],
        Padding(
          padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
          child: Text(tr('Win = 3 · MVP = 2 · game played = 1', 'Victoire = 3 · MVP = 2 · match joué = 1'),
              style: TextStyle(fontSize: 12, color: muted)),
        ),
      ]);
    }

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        const Icon(Icons.emoji_events, color: Palette.brand),
        const SizedBox(width: 6),
        Expanded(child: Text(tr('COURT RANKING', 'CLASSEMENT DU TERRAIN'), style: theme.textTheme.titleLarge)),
        SegmentedButton<String>(
          showSelectedIcon: false,
          style: const ButtonStyle(visualDensity: VisualDensity.compact, tapTargetSize: MaterialTapTargetSize.shrinkWrap),
          segments: [
            ButtonSegment(value: 'month', label: Text(tr('30 days', '30 jours'))),
            ButtonSegment(value: 'all', label: Text(tr('All time', 'Toujours'))),
          ],
          selected: {_period},
          onSelectionChanged: (s) {
            setState(() => _period = s.first);
            _load();
          },
        ),
      ]),
      const SizedBox(height: 8),
      Card(child: Padding(padding: const EdgeInsets.all(8), child: body)),
    ]);
  }
}

Widget _num(Widget child) => SizedBox(width: 44, child: Align(alignment: Alignment.centerRight, child: child));

class _LeaderRow extends StatelessWidget {
  final LeaderboardRow row;
  final bool mine;
  const _LeaderRow({required this.row, required this.mine});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final medal = row.rank >= 1 && row.rank <= 3 ? _medals[row.rank - 1] : null;
    const tab = [FontFeature.tabularFigures()];
    return Material(
      color: mine ? Palette.brand.withValues(alpha: 0.1) : Colors.transparent,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => UserScreen(userId: row.user.id))),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          child: Row(children: [
            Container(
              width: 28,
              height: 28,
              alignment: Alignment.center,
              decoration: BoxDecoration(shape: BoxShape.circle, color: medal),
              child: Text('${row.rank}',
                  style: TextStyle(
                    fontWeight: FontWeight.w900,
                    color: medal != null ? Colors.white : theme.colorScheme.onSurfaceVariant,
                  )),
            ),
            const SizedBox(width: 8),
            UserAvatar(row.user, size: 30),
            const SizedBox(width: 8),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('@${row.user.username}', overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
                if (mine || row.mvps > 0)
                  Row(children: [
                    if (mine)
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: Text(tr('You', 'Vous'),
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Palette.brand)),
                      ),
                    if (row.mvps > 0)
                      Text('★ ${row.mvps} MVP',
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFFD97706))),
                  ]),
              ]),
            ),
            _num(Text('${row.games}', style: const TextStyle(fontFeatures: tab))),
            _num(Text('${row.wins}', style: const TextStyle(fontWeight: FontWeight.w900, fontFeatures: tab))),
            _num(Text('${row.points}', style: const TextStyle(fontFeatures: tab))),
          ]),
        ),
      ),
    );
  }
}
