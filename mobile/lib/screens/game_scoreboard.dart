import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/l10n.dart';
import '../core/models.dart';
import '../core/scoreboard_models.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'game_result_share.dart';

const _mvpColor = Color(0xFFD97706);

/// Teams, score, player stats and MVP for a game — editable by the players in it.
class GameScoreboard extends StatefulWidget {
  final Game game;
  final bool canEdit;
  const GameScoreboard({super.key, required this.game, required this.canEdit});

  @override
  State<GameScoreboard> createState() => _GameScoreboardState();
}

class _GameScoreboardState extends State<GameScoreboard> {
  Scoreboard? _sb;
  bool _failed = false;
  bool _editing = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant GameScoreboard old) {
    super.didUpdateWidget(old);
    // The game screen reloads on realtime events: pick up scores saved by other players.
    if (!_editing && old.game != widget.game) _load();
  }

  Future<void> _load() async {
    try {
      final j = await context.read<Api>().get('/api/games/${widget.game.id}/scoreboard');
      if (!mounted || _editing) return;
      setState(() {
        _sb = Scoreboard.fromJson(Map<String, dynamic>.from(j));
        _failed = false;
      });
    } catch (_) {
      if (mounted && _sb == null) setState(() => _failed = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final g = widget.game;
    if (g.status == 'cancelled' || _failed) return const SizedBox.shrink();
    final sb = _sb;
    final title = Text(tr('TEAMS & STATS', 'ÉQUIPES & STATS'), style: Theme.of(context).textTheme.titleLarge);
    if (sb == null) {
      return const Card(child: Padding(padding: EdgeInsets.all(20), child: Center(child: CircularProgressIndicator())));
    }
    if (_editing) {
      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        title,
        const SizedBox(height: 8),
        _ScoreboardEditor(
          sb: sb,
          game: g,
          onDone: (saved) => setState(() {
            if (saved != null) _sb = saved;
            _editing = false;
          }),
        ),
      ]);
    }

    final byId = {for (final p in g.players) p.id: p};
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        Expanded(child: title),
        if (widget.canEdit && !sb.isEmpty)
          TextButton.icon(
            onPressed: () => setState(() => _editing = true),
            icon: const Icon(Icons.edit_outlined, size: 18),
            label: Text(tr('EDIT', 'MODIFIER')),
          ),
      ]),
      const SizedBox(height: 8),
      Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: sb.isEmpty
              ? Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Text(
                    widget.canEdit
                        ? tr('No teams yet. Split the players into teams and keep score.',
                            'Pas encore d’équipes. Répartissez les joueurs et comptez les points.')
                        : tr('No teams or stats yet.', 'Pas encore d’équipes ni de stats.'),
                    style: TextStyle(color: muted),
                  ),
                  if (widget.canEdit && g.players.length >= 2) ...[
                    const SizedBox(height: 12),
                    FilledButton.icon(
                      onPressed: () => setState(() => _editing = true),
                      icon: const Icon(Icons.groups_outlined),
                      label: Text(tr('MAKE TEAMS', 'FAIRE LES ÉQUIPES')),
                    ),
                  ],
                ])
              : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  if (sb.teams.isNotEmpty) ...[_ScoreHeader(sb: sb, byId: byId), const SizedBox(height: 14)],
                  _StatsTable(sb: sb, byId: byId),
                  if (sb.updatedBy != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: Text(
                        tr('Updated by @${sb.updatedBy!.username}', 'Mis à jour par @${sb.updatedBy!.username}'),
                        style: TextStyle(fontSize: 12, color: muted),
                      ),
                    ),
                  if (sb.hasResult) ...[
                    const SizedBox(height: 12),
                    FilledButton.icon(
                      onPressed: () => showResultShareSheet(context, game: g, sb: sb),
                      icon: const Icon(Icons.ios_share),
                      label: Text(tr('SHARE RESULT', 'PARTAGER LE RÉSULTAT')),
                    ),
                  ],
                ]),
        ),
      ),
    ]);
  }
}

/// Coloured strip on top of a team tile.
Widget _teamTile(BuildContext context, Color color, Widget child) => ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: ColoredBox(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Container(height: 4, color: color),
          Padding(padding: const EdgeInsets.all(10), child: child),
        ]),
      ),
    );

/// Two tiles per row.
Widget _pairs(List<Widget> tiles) => LayoutBuilder(builder: (context, c) {
      final w = (c.maxWidth - 8) / 2;
      return Wrap(spacing: 8, runSpacing: 8, children: [for (final t in tiles) SizedBox(width: w, child: t)]);
    });

class _ScoreHeader extends StatelessWidget {
  final Scoreboard sb;
  final Map<String, PublicUser> byId;
  const _ScoreHeader({required this.sb, required this.byId});

  @override
  Widget build(BuildContext context) {
    final anyScore = sb.anyScore;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _pairs([
        for (var i = 0; i < sb.teams.length; i++)
          Builder(builder: (context) {
            final team = sb.teams[i];
            final color = hexColor(team.color);
            final won = sb.winnerPosition != null && sb.winnerPosition == (team.position ?? i);
            return _teamTile(
              context,
              color,
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(
                    child: Text(team.name,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: color)),
                  ),
                  if (won)
                    Tooltip(
                      message: tr('Winner', 'Vainqueur'),
                      child: Container(
                        padding: const EdgeInsets.all(3),
                        decoration: BoxDecoration(color: Palette.brand, borderRadius: BorderRadius.circular(6)),
                        child: const Icon(Icons.emoji_events, size: 16, color: Colors.white),
                      ),
                    ),
                ]),
                if (anyScore) Text('${team.score}', style: const TextStyle(fontSize: 44, fontWeight: FontWeight.w900, height: 1.1)),
                const SizedBox(height: 4),
                Wrap(spacing: 4, runSpacing: 4, children: [
                  for (final id in team.players)
                    if (byId[id] != null) Tooltip(message: '@${byId[id]!.username}', child: UserAvatar(byId[id], size: 28)),
                ]),
              ]),
            );
          }),
      ]),
      if (anyScore && sb.teams.length >= 2 && sb.winnerPosition == null)
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Text(tr('Draw', 'Égalité'),
              textAlign: TextAlign.center,
              style: TextStyle(fontWeight: FontWeight.w700, color: Theme.of(context).colorScheme.onSurfaceVariant)),
        ),
    ]);
  }
}

class _StatsTable extends StatelessWidget {
  final Scoreboard sb;
  final Map<String, PublicUser> byId;
  const _StatsTable({required this.sb, required this.byId});

  @override
  Widget build(BuildContext context) {
    final key = sb.mainKey;
    final rows = sb.stats.entries.where((e) => byId.containsKey(e.key)).map((e) => (id: e.key, s: e.value)).toList()
      ..sort((a, b) => (key == null ? 0 : (b.s[key] ?? 0)).compareTo(key == null ? 0 : (a.s[key] ?? 0)));
    final mvp = sb.mvpUserId;
    if (mvp != null && !sb.stats.containsKey(mvp) && byId.containsKey(mvp)) rows.insert(0, (id: mvp, s: const <String, int>{}));
    if (rows.isEmpty) return const SizedBox.shrink();
    final keys = sb.statKeys.where((k) => rows.any((r) => (r.s[k] ?? 0) > 0)).toList();
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    final head = TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: muted);
    Widget cell(Widget c) => Padding(padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 6), child: c);
    return Table(
      defaultVerticalAlignment: TableCellVerticalAlignment.middle,
      columnWidths: {0: const FlexColumnWidth(), for (var i = 1; i <= keys.length; i++) i: const IntrinsicColumnWidth()},
      children: [
        TableRow(children: [
          cell(Text(tr('Player stats', 'Stats des joueurs'), style: head)),
          for (final k in keys) cell(Tooltip(message: statName(k), child: Text(statLabel(k), textAlign: TextAlign.right, style: head))),
        ]),
        for (final r in rows)
          TableRow(
            decoration: BoxDecoration(border: Border(top: BorderSide(color: Theme.of(context).dividerColor))),
            children: [
              cell(Row(children: [
                UserAvatar(byId[r.id], size: 26),
                const SizedBox(width: 8),
                Flexible(
                  child: Text('@${byId[r.id]!.username}',
                      overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                ),
                if (mvp == r.id) ...[const SizedBox(width: 6), const _MvpTag()],
              ])),
              for (final k in keys)
                cell(Text('${r.s[k] ?? 0}',
                    textAlign: TextAlign.right,
                    style: TextStyle(
                      fontWeight: k == key ? FontWeight.w900 : FontWeight.w500,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ))),
            ],
          ),
      ],
    );
  }
}

class _MvpTag extends StatelessWidget {
  const _MvpTag();
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
        decoration: BoxDecoration(color: const Color(0xFFFBBF24).withValues(alpha: 0.22), borderRadius: BorderRadius.circular(5)),
        child: const Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.star, size: 12, color: _mvpColor),
          SizedBox(width: 2),
          Text('MVP', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: _mvpColor)),
        ]),
      );
}

/// − [value] + with a typed field (big scores are tedious to tap).
class _Stepper extends StatefulWidget {
  final int value;
  final ValueChanged<int> onChanged;
  final String label;
  final bool big;
  const _Stepper({required this.value, required this.onChanged, required this.label, this.big = false});
  @override
  State<_Stepper> createState() => _StepperState();
}

class _StepperState extends State<_Stepper> {
  late final _c = TextEditingController(text: '${widget.value}');

  @override
  void didUpdateWidget(covariant _Stepper old) {
    super.didUpdateWidget(old);
    if (int.tryParse(_c.text) != widget.value) _c.text = '${widget.value}';
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  void _set(int n) => widget.onChanged(n.clamp(0, 999));

  @override
  Widget build(BuildContext context) {
    final fill = Theme.of(context).colorScheme.surface;
    Widget btn(IconData icon, String tip, VoidCallback? onTap) => IconButton.filledTonal(
          tooltip: '${widget.label} $tip',
          visualDensity: VisualDensity.compact,
          iconSize: 18,
          onPressed: onTap,
          icon: Icon(icon),
        );
    return Row(mainAxisSize: MainAxisSize.min, children: [
      btn(Icons.remove, '−1', widget.value <= 0 ? null : () => _set(widget.value - 1)),
      SizedBox(
        width: widget.big ? 60 : 46,
        child: TextField(
          controller: _c,
          textAlign: TextAlign.center,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(3)],
          style: TextStyle(fontSize: widget.big ? 22 : 16, fontWeight: FontWeight.w900),
          decoration: InputDecoration(
            isDense: true,
            filled: true,
            fillColor: fill,
            contentPadding: const EdgeInsets.symmetric(vertical: 8),
            semanticCounterText: widget.label,
          ),
          onChanged: (v) => _set(int.tryParse(v) ?? 0),
        ),
      ),
      btn(Icons.add, '+1', widget.value >= 999 ? null : () => _set(widget.value + 1)),
    ]);
  }
}

class _ScoreboardEditor extends StatefulWidget {
  final Scoreboard sb;
  final Game game;
  final ValueChanged<Scoreboard?> onDone;
  const _ScoreboardEditor({required this.sb, required this.game, required this.onDone});
  @override
  State<_ScoreboardEditor> createState() => _ScoreboardEditorState();
}

class _ScoreboardEditorState extends State<_ScoreboardEditor> {
  late final List<String> _ids = [for (final p in widget.game.players) p.id];
  late final bool _started = scoreboardStarted(widget.game.startTime);
  late List<ScoreTeam> _teams;
  late final Map<String, Map<String, int>> _stats = {
    for (final e in widget.sb.stats.entries) e.key: Map<String, int>.from(e.value),
  };
  late String? _mvp = widget.sb.mvpUserId;
  final List<TextEditingController> _names = [];
  String? _open;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final sb = widget.sb;
    _teams = sb.teams.isNotEmpty
        ? [for (final t in sb.teams) t.copy()..players.removeWhere((id) => !_ids.contains(id))]
        : [
            for (final (i, ps) in balancedTeams(_ids, sb.ratings, 2).indexed)
              ScoreTeam(name: defaultTeamName(i), color: teamColorHexes[i], players: ps),
          ];
    _syncNames();
  }

  @override
  void dispose() {
    for (final c in _names) {
      c.dispose();
    }
    super.dispose();
  }

  void _syncNames() {
    while (_names.length > _teams.length) {
      _names.removeLast().dispose();
    }
    for (var i = 0; i < _teams.length; i++) {
      if (i < _names.length) {
        if (_names[i].text != _teams[i].name) _names[i].text = _teams[i].name;
      } else {
        _names.add(TextEditingController(text: _teams[i].name));
      }
    }
  }

  int _teamOf(String id) => _teams.indexWhere((t) => t.players.contains(id));

  void _assign(String id, int idx) => setState(() {
        for (var i = 0; i < _teams.length; i++) {
          _teams[i].players.remove(id);
          if (i == idx) _teams[i].players.add(id);
        }
      });

  void _shuffle() => setState(() {
        final n = _teams.length < 2 ? 2 : _teams.length;
        final split = balancedTeams(_ids, widget.sb.ratings, n);
        _teams = [
          for (var i = 0; i < split.length; i++)
            (i < _teams.length ? _teams[i] : ScoreTeam(name: defaultTeamName(i), color: teamColorHexes[i]))..players = split[i],
        ];
        _syncNames();
      });

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final body = scoreboardInput(teams: _teams, stats: _stats, mvpUserId: _mvp, playerIds: _ids, started: _started);
      final j = await context.read<Api>().put('/api/games/${widget.game.id}/scoreboard', body);
      if (!mounted) return;
      showSnack(context, tr('Saved', 'Enregistré'));
      widget.onDone(Scoreboard.fromJson(Map<String, dynamic>.from(j)));
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.colorScheme.onSurfaceVariant;
    final ratings = widget.sb.ratings;
    final mainKey = widget.sb.mainKey;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          _pairs([
            for (var i = 0; i < _teams.length; i++)
              _teamTile(
                context,
                hexColor(_teams[i].color),
                Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  TextField(
                    controller: _names[i],
                    maxLength: 24,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                    decoration: InputDecoration(
                      isDense: true,
                      counterText: '',
                      labelText: tr('Team name', 'Nom de l’équipe'),
                    ),
                    onChanged: (v) => setState(() => _teams[i].name = v),
                  ),
                  const SizedBox(height: 8),
                  Wrap(spacing: 6, runSpacing: 6, children: [
                    for (final c in teamColorHexes)
                      Semantics(
                        button: true,
                        selected: _teams[i].color == c,
                        label: c,
                        child: GestureDetector(
                          onTap: () => setState(() => _teams[i].color = c),
                          child: Container(
                            width: 24,
                            height: 24,
                            decoration: BoxDecoration(
                              color: hexColor(c),
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: _teams[i].color == c ? theme.colorScheme.onSurface : Colors.transparent,
                                width: 2.5,
                              ),
                            ),
                          ),
                        ),
                      ),
                  ]),
                  if (_teams[i].players.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      '≈ ${(_teams[i].players.fold<int>(0, (s, id) => s + (ratings[id] ?? 1000)) / _teams[i].players.length).round()}',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: muted),
                    ),
                  ],
                  if (_started) ...[
                    const SizedBox(height: 6),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      child: _Stepper(
                        value: _teams[i].score,
                        big: true,
                        label: '${_teams[i].name} ${tr('score', 'score')}',
                        onChanged: (n) => setState(() => _teams[i].score = n),
                      ),
                    ),
                  ],
                  if (_teams.length > 2)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        style: TextButton.styleFrom(foregroundColor: theme.colorScheme.error, visualDensity: VisualDensity.compact),
                        onPressed: () => setState(() {
                          _teams.removeAt(i);
                          _syncNames();
                        }),
                        icon: const Icon(Icons.delete_outline, size: 16),
                        label: Text(tr('Remove team', 'Retirer l’équipe'), style: const TextStyle(fontSize: 12)),
                      ),
                    ),
                ]),
              ),
          ]),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _shuffle,
                icon: const Icon(Icons.shuffle, size: 18),
                label: Text(tr('SHUFFLE', 'MÉLANGER')),
              ),
            ),
            if (_teams.length < 4) ...[
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => setState(() {
                    final n = _teams.length;
                    _teams.add(ScoreTeam(name: defaultTeamName(n), color: teamColorHexes[n]));
                    _syncNames();
                  }),
                  icon: const Icon(Icons.add, size: 18),
                  label: Text(tr('ADD TEAM', 'AJOUTER'), overflow: TextOverflow.ellipsis),
                ),
              ),
            ],
          ]),
          const SizedBox(height: 4),
          Text(tr('Balanced by rating', 'Équilibré par niveau'), style: TextStyle(fontSize: 12, color: muted)),
          if (!_started)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(tr('Scores and stats open once the game starts.', 'Le score et les stats s’ouvrent au début du match.'),
                  style: TextStyle(color: muted)),
            ),
          const SizedBox(height: 12),
          for (final p in widget.game.players) _playerRow(p, mainKey),
          const SizedBox(height: 4),
          ErrorBanner(_error),
          Row(children: [
            Expanded(
              child: OutlinedButton(
                onPressed: _busy ? null : () => widget.onDone(null),
                child: Text(tr('CANCEL', 'ANNULER')),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: FilledButton(
                onPressed: _busy ? null : _save,
                child: _busy
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(tr('SAVE', 'ENREGISTRER')),
              ),
            ),
          ]),
        ]),
      ),
    );
  }

  Widget _playerRow(PublicUser p, String? mainKey) {
    final theme = Theme.of(context);
    final ti = _teamOf(p.id);
    final s = _stats[p.id] ?? const <String, int>{};
    final expanded = _open == p.id;
    final isMvp = _mvp == p.id;
    Widget chip(String label, bool selected, Color color, VoidCallback onTap) => Material(
          color: selected ? color : theme.colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(8),
          child: InkWell(
            borderRadius: BorderRadius.circular(8),
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              child: Text(label.isEmpty ? '—' : label,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: selected ? Colors.white : theme.colorScheme.onSurfaceVariant,
                  )),
            ),
          ),
        );
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        border: Border.all(color: theme.dividerColor),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          UserAvatar(p, size: 32),
          const SizedBox(width: 8),
          Expanded(child: Text('@${p.username}', overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600))),
          if (_started)
            IconButton(
              tooltip: tr('MVP', 'MVP'),
              isSelected: isMvp,
              style: IconButton.styleFrom(
                backgroundColor: isMvp ? const Color(0xFFFBBF24).withValues(alpha: 0.25) : null,
              ),
              onPressed: () => setState(() => _mvp = isMvp ? null : p.id),
              icon: Icon(isMvp ? Icons.star : Icons.star_border, color: isMvp ? _mvpColor : theme.colorScheme.onSurfaceVariant),
            ),
        ]),
        const SizedBox(height: 6),
        Wrap(spacing: 6, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
          for (var i = 0; i < _teams.length; i++) chip(_teams[i].name, ti == i, hexColor(_teams[i].color), () => _assign(p.id, i)),
          chip(tr('No team', 'Sans équipe'), ti == -1, Palette.idle, () => _assign(p.id, -1)),
          if (_started && mainKey != null)
            ActionChip(
              visualDensity: VisualDensity.compact,
              label: Text('${statLabel(mainKey)} ${s[mainKey] ?? 0} ${expanded ? '▴' : '▾'}',
                  style: const TextStyle(fontWeight: FontWeight.w800)),
              onPressed: () => setState(() => _open = expanded ? null : p.id),
            ),
        ]),
        if (_started && expanded)
          for (final k in widget.sb.statKeys)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(children: [
                Expanded(child: Text(statName(k), style: const TextStyle(fontWeight: FontWeight.w600))),
                _Stepper(
                  value: s[k] ?? 0,
                  label: '@${p.username} ${statName(k)}',
                  onChanged: (n) => setState(() => (_stats[p.id] ??= {})[k] = n),
                ),
              ]),
            ),
      ]),
    );
  }
}
