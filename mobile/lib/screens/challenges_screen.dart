import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/catalog.dart';
import '../core/game_share.dart';
import '../core/guide.dart';
import '../core/l10n.dart';
import '../core/location.dart';
import '../core/models.dart';
import '../core/my_sport.dart';
import '../core/progress_models.dart';
import '../ui/screen_guide.dart';
import '../ui/widgets.dart';
import '../ui/app_icons.dart';
import 'court_move.dart';
import 'court_screens.dart';
import 'game_screens.dart';

/// Incoming, live, outgoing and past challenges + my W–L record.
class ChallengesScreen extends StatefulWidget {
  const ChallengesScreen({super.key});
  @override
  State<ChallengesScreen> createState() => _ChallengesScreenState();
}

class _ChallengesScreenState extends State<ChallengesScreen> {
  ChallengeList? _list;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
    ScreenGuide.maybeShow(context, screen: GuideScreen.challenges, tips: [
      GuideTip(
        icon: const SwordsIcon(),
        title: tr('Challenge your friends', 'Défiez vos amis'),
        body: tr('1v1, 2v2, penalties, rallies… Send a challenge, play it, and win to level up and earn badges.',
            '1v1, 2v2, tirs au but, échanges… Lancez un défi, jouez-le et gagnez pour monter de niveau et débloquer des badges.'),
      ),
    ]);
  }

  Future<void> _load() async {
    try {
      final j = await context.read<Api>().get('/api/challenges');
      if (mounted) setState(() => _list = ChallengeList.fromJson(Map<String, dynamic>.from(j)));
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = _list;
    return Scaffold(
      appBar: AppBar(
        title: Text(tr('CHALLENGES', 'DÉFIS')),
        actions: [
          if (l != null && (l.wins > 0 || l.losses > 0))
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Center(child: Text(tr('${l.wins}W – ${l.losses}L', '${l.wins}V – ${l.losses}D'), style: const TextStyle(fontWeight: FontWeight.w900))),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: l == null
            ? ListView(children: [
                Padding(padding: const EdgeInsets.all(32), child: Center(child: _error != null ? Text(_error!) : const CircularProgressIndicator())),
              ])
            : ListView(padding: const EdgeInsets.all(16), children: [
                if (l.isEmpty)
                  EmptyState(
                    icon: Icons.sports_kabaddi,
                    title: tr('No challenges yet', 'Pas encore de défi'),
                    body: tr('Challenge a friend from their profile or post an open challenge at a court.',
                        'Défiez un ami depuis son profil ou lancez un défi ouvert sur un terrain.'),
                    action: PrimaryButton(
                      onPressed: () async {
                        await showChallengeComposer(context); // open challenge at a nearby court
                        if (mounted) _load();
                      },
                      child: Text(tr('CHALLENGE SOMEONE', 'LANCER UN DÉFI')),
                    ),
                  ),
                ..._section(tr('CHALLENGES FOR YOU', 'DÉFIS REÇUS'), l.incoming),
                ..._section(tr('GAME ON', 'C’EST PARTI'), l.active),
                ..._section(tr('WAITING FOR AN ANSWER', 'EN ATTENTE DE RÉPONSE'), l.outgoing),
                ..._section(tr('HISTORY', 'HISTORIQUE'), l.history),
              ]),
      ),
    );
  }

  List<Widget> _section(String title, List<Challenge> items) {
    if (items.isEmpty) return const [];
    return [
      Padding(padding: const EdgeInsets.only(top: 8, bottom: 8), child: Text(title, style: Theme.of(context).textTheme.titleLarge)),
      for (final c in items) Padding(padding: const EdgeInsets.only(bottom: 10), child: ChallengeCard(challenge: c, onChanged: _load)),
    ];
  }
}

String _statusLabel(Challenge c) {
  if (c.isOpen && c.status == 'pending') return tr('Open', 'Ouvert');
  return switch (c.status) {
    'pending' => tr('Pending', 'En attente'),
    'accepted' => tr('Accepted', 'Accepté'),
    'reported' => tr('To confirm', 'À confirmer'),
    'completed' => tr('Finished', 'Terminé'),
    'declined' => tr('Declined', 'Refusé'),
    'cancelled' => tr('Cancelled', 'Annulé'),
    _ => tr('Expired', 'Expiré'),
  };
}

String _when(DateTime t) {
  final now = DateTime.now();
  if (t.difference(now).inMinutes <= 10 && t.isAfter(now.subtract(const Duration(minutes: 30)))) return tr('Now', 'Maintenant');
  final hh = t.hour.toString().padLeft(2, '0');
  final mm = t.minute.toString().padLeft(2, '0');
  final today = t.year == now.year && t.month == now.month && t.day == now.day;
  if (today) return tr('Today $hh:$mm', 'Aujourd’hui $hh:$mm');
  return '${t.day}/${t.month} $hh:$mm';
}

/// One challenge: VS header, format, place/time, actions for my role.
class ChallengeCard extends StatefulWidget {
  final Challenge challenge;
  final VoidCallback onChanged;
  const ChallengeCard({super.key, required this.challenge, required this.onChanged});
  @override
  State<ChallengeCard> createState() => _ChallengeCardState();
}

class _ChallengeCardState extends State<ChallengeCard> {
  bool _busy = false;

  Future<void> _act(String action) async {
    setState(() => _busy = true);
    try {
      await context.read<Api>().post('/api/challenges/${widget.challenge.id}/$action');
      widget.onChanged();
    } catch (e) {
      if (mounted) showSnack(context, errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _share(Challenge c) async {
    final a = '@${c.challenger.username}';
    final b = c.opponent != null ? '@${c.opponent!.username}' : tr('Open', 'Ouvert');
    final format = formatById(c.format)?.name ?? c.format;
    final url = '$webAppUrl/challenges/${Uri.encodeComponent(c.id)}';
    final text = tr('$a vs $b · $format at ${c.court.name}, ${_when(c.startTime)}. Who you got?',
        '$a contre $b · $format à ${c.court.name}, ${_when(c.startTime)}. Tu paries sur qui ?');
    await Clipboard.setData(ClipboardData(text: '$text $url'));
    if (!mounted) return;
    showSnack(
        context,
        c.isPublic
            ? tr('Challenge link copied — paste it anywhere', 'Lien du défi copié — collez-le où vous voulez')
            : tr('Link copied — it’s private, so only its players can open it.', 'Lien copié — le défi est privé, seuls ses joueurs peuvent l’ouvrir.'));
  }

  Future<void> _setVisibility(Challenge c, bool isPublic) async {
    if (isPublic == c.isPublic) return;
    setState(() => _busy = true);
    try {
      await context.read<Api>().patch('/api/challenges/${c.id}/visibility', {'is_public': isPublic});
      if (mounted) showSnack(context, isPublic ? tr('Challenge is now public.', 'Le défi est maintenant public.') : tr('Challenge is now private.', 'Le défi est maintenant privé.'));
      widget.onChanged();
    } catch (e) {
      if (mounted) showSnack(context, errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _editMessage(Challenge c) async {
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (_) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: _MessageSheet(challenge: c),
      ),
    );
    if (ok == true) widget.onChanged();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.challenge;
    final me = context.watch<AuthState>().user?.id;
    final theme = Theme.of(context);
    final format = formatById(c.format);
    final iAmChallenger = me == c.challenger.id;
    final myAccepted = c.myStatus == 'accepted' || iAmChallenger;
    final mySide = c.mySide ?? (iAmChallenger ? 'challenger' : null);
    final reporterSide = c.players.where((p) => p.user.id == c.reportedBy).map((p) => p.side).firstOrNull;
    final invited = c.myStatus == 'invited';
    final addable = [
      for (final side in const ['challenger', 'opponent'])
        if ((side == 'opponent' || c.teamSize > 1) && c.acceptedOn(side) < c.teamSize && (iAmChallenger || (c.myStatus == 'accepted' && mySide == side))) side
    ];
    final canAdd = (c.status == 'pending' || c.status == 'accepted') && addable.isNotEmpty;
    final canEditMessage = iAmChallenger && (c.status == 'pending' || c.status == 'accepted');
    final won = c.status == 'completed' ? c.winnerId : null;
    final score = (c.scoreChallenger != null || c.scoreOpponent != null) ? '${c.scoreChallenger ?? '–'}–${c.scoreOpponent ?? '–'}' : '';
    PublicUser? reporter = c.reportedBy == c.challenger.id ? c.challenger : c.opponent;
    PublicUser? winner = c.winnerId == c.challenger.id ? c.challenger : c.opponent;

    final actions = <Widget>[];
    if (invited || (c.status == 'pending' && c.isOpen && !iAmChallenger && c.myStatus == null)) {
      actions.add(Expanded(child: FilledButton(onPressed: _busy ? null : () => _act('accept'), child: Text(invited ? tr('ACCEPT', 'ACCEPTER') : tr('TAKE IT', 'RELEVER')))));
      if (invited) {
        actions.add(const SizedBox(width: 8));
        actions.add(Expanded(child: OutlinedButton(onPressed: _busy ? null : () => _act('decline'), child: Text(tr('DECLINE', 'REFUSER')))));
      }
    }
    final canMove = (c.status == 'pending' || c.status == 'accepted') && iAmChallenger && c.court.latitude != null && c.court.longitude != null;
    if ((c.status == 'pending' || c.status == 'accepted') && iAmChallenger) {
      actions.add(Expanded(child: TextButton(onPressed: _busy ? null : () => _act('cancel'), child: Text(tr('CANCEL', 'ANNULER')))));
    }
    if (c.status == 'accepted' && myAccepted) {
      if (actions.isNotEmpty) actions.add(const SizedBox(width: 8));
      actions.add(Expanded(
        child: FilledButton(
          onPressed: _busy
              ? null
              : () async {
                  final ok = await showReportSheet(context, c);
                  if (ok == true) widget.onChanged();
                },
          child: Text(tr('REPORT RESULT', 'SAISIR LE RÉSULTAT')),
        ),
      ));
    }
    if (c.status == 'reported' && myAccepted && reporterSide != mySide) {
      actions.add(Expanded(child: FilledButton(onPressed: _busy ? null : () => _act('confirm'), child: Text(tr('CONFIRM', 'CONFIRMER')))));
      actions.add(const SizedBox(width: 8));
      actions.add(Expanded(child: OutlinedButton(onPressed: _busy ? null : () => _act('dispute'), child: Text(tr('DISPUTE', 'CONTESTER')))));
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Text(format?.emoji ?? '⚔️', style: const TextStyle(fontSize: 18)),
            const SizedBox(width: 6),
            Expanded(child: Text('${c.sport.name} · ${format?.name ?? c.format}', style: const TextStyle(fontWeight: FontWeight.w800), overflow: TextOverflow.ellipsis)),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: theme.colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(8)),
              child: Text(_statusLabel(c), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
            ),
            if (!c.isOpen)
              Padding(
                padding: const EdgeInsets.only(left: 6),
                child: Tooltip(
                  message: c.isPublic ? tr('Public', 'Public') : tr('Private', 'Privé'),
                  child: Icon(c.isPublic ? Icons.public : Icons.lock_outline, size: 18, color: theme.colorScheme.onSurfaceVariant),
                ),
              ),
            IconButton(
              onPressed: () => _share(c),
              icon: const Icon(Icons.share_outlined, size: 20),
              tooltip: tr('Share', 'Partager'),
              visualDensity: VisualDensity.compact,
            ),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: _Side(user: c.challenger, crowned: won == c.challenger.id)),
            Column(children: [
              Text('VS', style: theme.textTheme.headlineMedium?.copyWith(color: theme.colorScheme.primary, fontStyle: FontStyle.italic)),
              if (c.status == 'completed' && score.isNotEmpty) Text(score, style: const TextStyle(fontWeight: FontWeight.w900)),
            ]),
            Expanded(child: _Side(user: c.opponent, crowned: c.opponent != null && won == c.opponent!.id)),
          ]),
          const SizedBox(height: 10),
          Wrap(alignment: WrapAlignment.center, spacing: 12, children: [
            InkWell(
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => CourtDetailsScreen(courtId: c.court.id))),
              child: Text('📍 ${c.court.name}', style: const TextStyle(fontWeight: FontWeight.w700)),
            ),
            Text('🕒 ${_when(c.startTime)}', style: const TextStyle(fontWeight: FontWeight.w700)),
          ]),
          if (c.message != null) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: theme.colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(12)),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Flexible(child: Text('“${c.message}”', textAlign: TextAlign.center, style: const TextStyle(fontStyle: FontStyle.italic))),
                if (canEditMessage)
                  IconButton(
                    onPressed: () => _editMessage(c),
                    icon: const Icon(Icons.edit_outlined, size: 16),
                    tooltip: tr('Edit message', 'Modifier le message'),
                    visualDensity: VisualDensity.compact,
                  ),
              ]),
            ),
          ] else if (canEditMessage)
            TextButton.icon(
              onPressed: () => _editMessage(c),
              icon: const Icon(Icons.edit_outlined, size: 16),
              label: Text(tr('Add a message', 'Ajouter un message')),
            ),
          if (iAmChallenger && !c.isOpen && !const ['declined', 'cancelled', 'expired'].contains(c.status)) ...[
            const SizedBox(height: 10),
            _VisibilityPicker(isPublic: c.isPublic, onChanged: _busy ? null : (v) => _setVisibility(c, v)),
          ],
          if (c.status == 'reported' && reporter != null && winner != null) ...[
            const SizedBox(height: 8),
            Text(
              tr('@${reporter.username} reported: @${winner.username} won ${score.isEmpty ? '' : '($score)'}',
                  '@${reporter.username} a saisi : victoire de @${winner.username} ${score.isEmpty ? '' : '($score)'}'),
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            if (myAccepted && reporterSide == mySide)
              Text(tr('Waiting for the other player to confirm', 'En attente de confirmation de l’adversaire'),
                  textAlign: TextAlign.center, style: TextStyle(color: theme.colorScheme.onSurfaceVariant)),
          ],
          if (c.teamSize > 1 || c.players.length > 2) ...[const SizedBox(height: 10), _Rosters(challenge: c)],
          if (canAdd)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: OutlinedButton.icon(
                onPressed: () async {
                  final ok = await showAddPlayerSheet(context, c, addable, mySide);
                  if (ok == true) widget.onChanged();
                },
                icon: const Icon(Icons.person_add_alt_1),
                label: Text(tr('ADD A PLAYER', 'AJOUTER UN JOUEUR')),
              ),
            ),
          if (canMove)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: OutlinedButton.icon(
                onPressed: () async {
                  final ok = await showMoveCourtSheet(context,
                      kind: 'challenge', id: c.id, sportId: c.sport.id, sportSlug: c.sport.slug,
                      courtId: c.court.id, courtName: c.court.name, lat: c.court.latitude!, lng: c.court.longitude!);
                  if (ok == true) widget.onChanged();
                },
                icon: const Icon(Icons.edit_location_alt_outlined),
                label: Text(tr('CHANGE COURT', 'CHANGER DE TERRAIN')),
              ),
            ),
          if (actions.isNotEmpty) ...[const SizedBox(height: 12), Row(children: actions)],
          if (c.gameId != null && const ['accepted', 'reported', 'completed'].contains(c.status))
            TextButton(onPressed: () => openGameScreen(context, c.gameId!), child: Text(tr('OPEN GAME', 'VOIR LE MATCH'))),
        ]),
      ),
    );
  }
}

class _Side extends StatelessWidget {
  final PublicUser? user;
  final bool crowned;
  const _Side({required this.user, required this.crowned});

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Stack(clipBehavior: Clip.none, children: [
        user == null
            ? CircleAvatar(radius: 26, backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest, child: const Text('?', style: TextStyle(fontSize: 22)))
            : UserAvatar(user, size: 52),
        if (crowned) const Positioned(right: -8, top: -10, child: Text('👑', style: TextStyle(fontSize: 20))),
      ]),
      const SizedBox(height: 4),
      Text(user == null ? tr('Open', 'Ouvert') : '@${user!.username}', overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800)),
    ]);
  }
}

/// Pick the winner (+ optional scores) for an accepted challenge.
Future<bool?> showReportSheet(BuildContext context, Challenge c) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: _ReportSheet(challenge: c),
    ),
  );
}

class _ReportSheet extends StatefulWidget {
  final Challenge challenge;
  const _ReportSheet({required this.challenge});
  @override
  State<_ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends State<_ReportSheet> {
  String? _winner;
  final _a = TextEditingController();
  final _b = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _a.dispose();
    _b.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<Api>().post('/api/challenges/${widget.challenge.id}/result', {
        'winner_id': _winner,
        'score_challenger': _a.text.trim(),
        'score_opponent': _b.text.trim(),
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.challenge;
    final unit = formatById(c.format)?.unit ?? '';
    final sides = [c.challenger, c.opponent!];
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(tr('WHO WON?', 'QUI A GAGNÉ ?'), textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          Row(children: [
            for (final u in sides)
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: ChoiceChip(
                    label: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Column(children: [UserAvatar(u, size: 40), const SizedBox(height: 4), Text('@${u.username}', overflow: TextOverflow.ellipsis)]),
                    ),
                    selected: _winner == u.id,
                    onSelected: (_) => setState(() => _winner = u.id),
                  ),
                ),
              ),
          ]),
          const SizedBox(height: 12),
          Text('${tr('Score (optional)', 'Score (facultatif)')} · $unit', textAlign: TextAlign.center, style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: TextField(controller: _a, maxLength: 12, textAlign: TextAlign.center, decoration: InputDecoration(labelText: '@${c.challenger.username}', counterText: ''))),
            const SizedBox(width: 12),
            Expanded(child: TextField(controller: _b, maxLength: 12, textAlign: TextAlign.center, decoration: InputDecoration(labelText: '@${c.opponent!.username}', counterText: ''))),
          ]),
          if (_error != null) Padding(padding: const EdgeInsets.only(top: 8), child: ErrorBanner(_error!)),
          const SizedBox(height: 16),
          FilledButton(onPressed: _winner == null || _busy ? null : _submit, child: Text(tr('SUBMIT RESULT', 'VALIDER LE RÉSULTAT'))),
        ]),
      ),
    );
  }
}

/// Send a challenge to [opponent], or an open challenge at [court].
Future<void> showChallengeComposer(BuildContext context, {PublicUser? opponent, CourtRef? court}) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: _Composer(opponent: opponent, court: court),
    ),
  );
}

class _Composer extends StatefulWidget {
  final PublicUser? opponent;
  final CourtRef? court;
  const _Composer({this.opponent, this.court});
  @override
  State<_Composer> createState() => _ComposerState();
}

class _ComposerState extends State<_Composer> {
  Sport? _sport;
  String? _format;
  bool _live = true;
  bool _public = false;
  DateTime _when = DateTime.now().add(const Duration(hours: 1));
  List<Court> _courts = [];
  String? _courtId;
  final _message = TextEditingController();
  bool _busy = false, _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _courtId = widget.court?.id;
    _init();
  }

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  Future<void> _init() async {
    final api = context.read<Api>();
    final me = context.read<AuthState>().user;
    final center = context.read<LocationState>().center;
    try {
      final sports = [for (final s in await api.get('/api/sports')) Sport.fromJson(s)];
      final sport = sportForUser(me, sports);
      List<Court> courts = [];
      if (widget.court == null && sport != null) {
        final j = await api.get('/api/courts/nearby?lat=${center.latitude}&lng=${center.longitude}&radius_km=15&sport=${sport.slug}');
        courts = [for (final c in j) Court.fromJson(c)].take(8).toList();
      }
      if (!mounted) return;
      setState(() {
        _sport = sport;
        final fs = formatsForSport(sport?.slug);
        _format = fs.isNotEmpty ? fs.first.id : null;
        _courts = courts;
        _courtId ??= courts.isNotEmpty ? courts.first.id : null;
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = errorText(e);
          _loading = false;
        });
      }
    }
  }

  Future<void> _pickTime() async {
    final d = await showDatePicker(context: context, initialDate: _when, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 14)));
    if (d == null || !mounted) return;
    final t = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(_when));
    if (t == null) return;
    setState(() => _when = DateTime(d.year, d.month, d.day, t.hour, t.minute));
  }

  Future<void> _send() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<Api>().post('/api/challenges', {
        'opponent_id': widget.opponent?.id,
        'sport_id': _sport!.id,
        'format': _format,
        'court_id': _courtId,
        if (!_live) 'start_time': _when.toUtc().toIso8601String(),
        if (_message.text.trim().isNotEmpty) 'message': _message.text.trim(),
        if (widget.opponent != null) 'is_public': _public,
      });
      if (!mounted) return;
      Navigator.pop(context);
      showSnack(context, tr('Challenge sent!', 'Défi envoyé !'));
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final me = context.watch<AuthState>().user;
    final formats = formatsForSport(_sport?.slug);
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          Text(widget.opponent != null ? tr('SEND A CHALLENGE', 'LANCER UN DÉFI') : tr('OPEN CHALLENGE', 'DÉFI OUVERT'),
              style: theme.textTheme.headlineMedium),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: theme.colorScheme.primary, borderRadius: BorderRadius.circular(18)),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
              if (me != null) _BannerAvatar(me),
              Text('VS', style: theme.textTheme.headlineMedium?.copyWith(color: Colors.white, fontStyle: FontStyle.italic)),
              widget.opponent != null
                  ? _BannerAvatar(widget.opponent!)
                  : const CircleAvatar(radius: 29, backgroundColor: Colors.white24, child: Text('?', style: TextStyle(fontSize: 22, color: Colors.white))),
            ]),
          ),
          if (widget.opponent == null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(tr('Anyone at this court or among your friends can take it.', 'N’importe qui sur ce terrain ou parmi vos amis peut le relever.'),
                  textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: theme.colorScheme.onSurfaceVariant)),
            ),
          const SizedBox(height: 14),
          if (_loading)
            const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator()))
          else if (_sport == null)
            Text(tr('Pick your sport in your profile first.', 'Choisissez d’abord votre sport dans votre profil.'))
          else ...[
            Text(tr('Format', 'Format'), style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final f in formats)
                ChoiceChip(
                  label: Text('${f.emoji} ${f.name}${f.teamSize > 1 ? ' · ${f.teamSize}/${tr('side', 'équipe')}' : ''}'),
                  selected: _format == f.id,
                  onSelected: (_) => setState(() => _format = f.id),
                ),
            ]),
            if (formatById(_format ?? '') != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(formatById(_format!)!.desc, style: TextStyle(fontSize: 12, color: theme.colorScheme.onSurfaceVariant)),
              ),
            const SizedBox(height: 14),
            Text(tr('When', 'Quand'), style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            SegmentedButton<bool>(
              segments: [
                ButtonSegment(value: true, label: Text(tr('Live — now', 'En direct')), icon: const Icon(Icons.bolt)),
                ButtonSegment(value: false, label: Text(tr('Later', 'Plus tard')), icon: const Icon(Icons.schedule)),
              ],
              selected: {_live},
              onSelectionChanged: (s) => setState(() => _live = s.first),
            ),
            if (!_live)
              TextButton.icon(
                onPressed: _pickTime,
                icon: const Icon(Icons.event),
                label: Text('${_when.day}/${_when.month} ${_when.hour.toString().padLeft(2, '0')}:${_when.minute.toString().padLeft(2, '0')}'),
              ),
            const SizedBox(height: 14),
            Text(tr('Court', 'Terrain'), style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            if (widget.court != null)
              Text(widget.court!.name, style: const TextStyle(fontWeight: FontWeight.w800))
            else if (_courts.isEmpty)
              Text(tr('No court nearby for this sport.', 'Aucun terrain proche pour ce sport.'))
            else
              for (final c in _courts)
                ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  onTap: () => setState(() => _courtId = c.id),
                  leading: Icon(_courtId == c.id ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                      color: _courtId == c.id ? theme.colorScheme.primary : null),
                  title: Text(c.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: c.distanceM == null ? null : Text(c.distanceM! < 1000 ? '${c.distanceM!.round()} m' : '${(c.distanceM! / 1000).toStringAsFixed(1)} km'),
                ),
            const SizedBox(height: 10),
            TextField(
              controller: _message,
              maxLength: 140,
              decoration: InputDecoration(labelText: tr('Message (optional)', 'Message (facultatif)'), hintText: tr('Trash talk welcome 😤', 'Le chambrage est permis 😤')),
            ),
            Wrap(spacing: 6, runSpacing: 4, children: [
              for (final idea in _messageIdeas())
                ChoiceChip(
                  label: Text(idea),
                  selected: _message.text == idea,
                  onSelected: (_) => setState(() => _message.text = idea),
                ),
            ]),
          ],
          if (widget.opponent != null) ...[
            const SizedBox(height: 10),
            _VisibilityPicker(isPublic: _public, onChanged: (v) => setState(() => _public = v)),
          ],
          if (_error != null) ErrorBanner(_error!),
          const SizedBox(height: 10),
          FilledButton.icon(
            onPressed: _busy || _sport == null || _format == null || _courtId == null ? null : _send,
            icon: const Icon(Icons.sports_kabaddi),
            label: Text(widget.opponent != null ? tr('SEND CHALLENGE', 'ENVOYER LE DÉFI') : tr('POST CHALLENGE', 'PUBLIER LE DÉFI')),
          ),
        ]),
      ),
    );
  }
}

/// On another player's profile: challenge button + our head-to-head.
class PlayerChallengeBlock extends StatefulWidget {
  final PublicUser player;
  const PlayerChallengeBlock({super.key, required this.player});
  @override
  State<PlayerChallengeBlock> createState() => _PlayerChallengeBlockState();
}

class _PlayerChallengeBlockState extends State<PlayerChallengeBlock> {
  Map<String, dynamic>? _h2h;

  @override
  void initState() {
    super.initState();
    context.read<Api>().get('/api/users/${widget.player.id}/head-to-head').then((j) {
      if (mounted) setState(() => _h2h = Map<String, dynamic>.from(j));
    }).catchError((_) {});
  }

  @override
  Widget build(BuildContext context) {
    final name = '@${widget.player.username}';
    final h = _h2h;
    final played = (h?['played'] as num?)?.toInt() ?? 0;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      FilledButton.icon(
        onPressed: () => showChallengeComposer(context, opponent: widget.player),
        icon: const Icon(Icons.sports_kabaddi),
        label: Text(tr('CHALLENGE', 'DÉFIER')),
      ),
      if (h != null)
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text(
            played > 0
                ? tr('You vs $name: ${h['wins']}–${h['losses']}', 'Vous contre $name : ${h['wins']}–${h['losses']}')
                : tr('You and $name have never played a challenge.', 'Vous et $name ne vous êtes jamais défiés.'),
            textAlign: TextAlign.center,
            style: TextStyle(fontWeight: FontWeight.w700, color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
        ),
    ]);
  }
}

/// Open challenges at a court + a button to post one.
class CourtChallenges extends StatefulWidget {
  final CourtRef court;
  const CourtChallenges({super.key, required this.court});
  @override
  State<CourtChallenges> createState() => _CourtChallengesState();
}

class _CourtChallengesState extends State<CourtChallenges> {
  List<Challenge> _open = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final j = await context.read<Api>().get('/api/courts/${widget.court.id}/challenges');
      if (mounted) setState(() => _open = [for (final c in j) Challenge.fromJson(Map<String, dynamic>.from(c))]);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (_open.isNotEmpty) ...[
        Text(tr('OPEN CHALLENGES HERE', 'DÉFIS OUVERTS ICI'), style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        for (final c in _open) Padding(padding: const EdgeInsets.only(bottom: 8), child: ChallengeCard(challenge: c, onChanged: _load)),
      ],
      OutlinedButton.icon(
        onPressed: () async {
          await showChallengeComposer(context, court: widget.court);
          _load();
        },
        icon: const Icon(Icons.sports_kabaddi),
        label: Text(tr('POST AN OPEN CHALLENGE', 'LANCER UN DÉFI OUVERT')),
      ),
    ]);
  }
}

class _Rosters extends StatelessWidget {
  final Challenge challenge;
  const _Rosters({required this.challenge});

  @override
  Widget build(BuildContext context) {
    final c = challenge;
    final theme = Theme.of(context);
    Widget side(String side) {
      final list = c.players.where((p) => p.side == side).toList();
      final head = side == 'challenger' ? '@${c.challenger.username}' : (c.opponent != null ? '@${c.opponent!.username}' : tr('Opponents', 'Adversaires'));
      return Expanded(
        child: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(color: theme.colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(12)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('$head · ${c.acceptedOn(side)}/${c.teamSize}', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: theme.colorScheme.onSurfaceVariant)),
            const SizedBox(height: 4),
            for (final p in list)
              Opacity(
                opacity: p.status == 'invited' ? 0.5 : 1,
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(children: [
                    UserAvatar(p.user, size: 22),
                    const SizedBox(width: 6),
                    Expanded(child: Text('@${p.user.username}', overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700))),
                    if (p.status == 'invited') Text(tr('INVITED', 'INVITÉ'), style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w900)),
                  ]),
                ),
              ),
          ]),
        ),
      );
    }

    return Column(children: [
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [side('challenger'), const SizedBox(width: 8), side('opponent')]),
      if (c.teamSize == 1 && c.status == 'pending')
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text(tr('First invited player to accept plays.', 'Le premier invité qui accepte joue.'),
              style: TextStyle(fontSize: 12, color: theme.colorScheme.onSurfaceVariant)),
        ),
    ]);
  }
}

/// Invite @username to a side of the challenge.
Future<bool?> showAddPlayerSheet(BuildContext context, Challenge c, List<String> sides, String? mySide) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: _AddPlayerSheet(challenge: c, sides: sides, mySide: mySide),
    ),
  );
}

class _AddPlayerSheet extends StatefulWidget {
  final Challenge challenge;
  final List<String> sides;
  final String? mySide;
  const _AddPlayerSheet({required this.challenge, required this.sides, required this.mySide});
  @override
  State<_AddPlayerSheet> createState() => _AddPlayerSheetState();
}

class _AddPlayerSheetState extends State<_AddPlayerSheet> {
  final _username = TextEditingController();
  late String _side = widget.sides.contains('opponent') && widget.mySide != 'opponent' ? 'opponent' : widget.sides.first;
  bool _busy = false;
  String? _error;
  List<PublicUser> _friends = const [];

  @override
  void initState() {
    super.initState();
    _loadFriends();
  }

  Future<void> _loadFriends() async {
    try {
      final j = await context.read<Api>().get('/api/me/friends');
      final c = widget.challenge;
      final taken = {c.challenger.id, for (final p in c.players) p.user.id};
      final list = [for (final f in j as List) PublicUser.fromJson(Map<String, dynamic>.from(f))].where((f) => !taken.contains(f.id)).toList();
      if (mounted) setState(() => _friends = list);
    } catch (_) {
      // Friends are a shortcut; typing a @username still works.
    }
  }

  @override
  void dispose() {
    _username.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<Api>().post('/api/challenges/${widget.challenge.id}/players', {
        'username': _username.text.trim().replaceFirst(RegExp(r'^@'), ''),
        'side': _side,
      });
      if (!mounted) return;
      Navigator.pop(context, true);
      showSnack(context, tr('Player added — they’ve been notified.', 'Joueur ajouté — il a été prévenu.'));
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    String label(String s) => s == widget.mySide ? tr('My team', 'Mon équipe') : tr('Opponents', 'Adversaires');
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(tr('ADD A PLAYER', 'AJOUTER UN JOUEUR'), style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          if (widget.sides.length > 1) ...[
            SegmentedButton<String>(
              segments: [for (final s in widget.sides) ButtonSegment(value: s, label: Text(label(s)))],
              selected: {_side},
              onSelectionChanged: (v) => setState(() => _side = v.first),
            ),
            const SizedBox(height: 12),
          ],
          if (_friends.isNotEmpty) ...[
            Text(tr('Friends', 'Amis'), style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Wrap(spacing: 6, runSpacing: 4, children: [
              for (final f in _friends)
                ChoiceChip(
                  avatar: UserAvatar(f, size: 22),
                  label: Text('@${f.username}'),
                  selected: _username.text.trim().replaceFirst(RegExp(r'^@'), '') == f.username,
                  onSelected: (_) => setState(() => _username.text = f.username),
                ),
            ]),
            const SizedBox(height: 12),
          ],
          TextField(
            controller: _username,
            autocorrect: false,
            textInputAction: TextInputAction.done,
            decoration: InputDecoration(labelText: tr('@username', '@pseudo'), prefixIcon: const Icon(Icons.alternate_email)),
            onChanged: (_) => setState(() {}),
            onSubmitted: (_) => _username.text.trim().length >= 3 && !_busy ? _submit() : null,
          ),
          if (_error != null) Padding(padding: const EdgeInsets.only(top: 8), child: ErrorBanner(_error!)),
          const SizedBox(height: 16),
          FilledButton(onPressed: _busy || _username.text.trim().length < 3 ? null : _submit, child: Text(tr('ADD', 'AJOUTER'))),
        ]),
      ),
    );
  }
}

/// Avatar on the brand-orange VS banner: white ring + white backing so the
/// orange initials fallback (and transparent art) stays visible.
class _BannerAvatar extends StatelessWidget {
  final PublicUser user;
  const _BannerAvatar(this.user);

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(3),
        decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
        child: ClipOval(child: ColoredBox(color: Colors.white, child: UserAvatar(user, size: 52))),
      );
}

List<String> _messageIdeas() => [
      tr('You ready? 🔥', 'T’es prêt ? 🔥'),
      tr('Loser buys the drinks 🥤', 'Le perdant paie les boissons 🥤'),
      tr('Rematch time 😤', 'C’est l’heure de la revanche 😤'),
      tr('Bring your A game', 'Viens avec ton meilleur jeu'),
    ];

/// Challenger rewrites (or clears) the challenge message.
class _MessageSheet extends StatefulWidget {
  final Challenge challenge;
  const _MessageSheet({required this.challenge});
  @override
  State<_MessageSheet> createState() => _MessageSheetState();
}

class _MessageSheetState extends State<_MessageSheet> {
  late final _message = TextEditingController(text: widget.challenge.message ?? '');
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<Api>().patch('/api/challenges/${widget.challenge.id}/message', {'message': _message.text.trim()});
      if (!mounted) return;
      Navigator.pop(context, true);
      showSnack(context, tr('Message updated.', 'Message modifié.'));
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final unchanged = _message.text.trim() == (widget.challenge.message ?? '');
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(tr('CHALLENGE MESSAGE', 'MESSAGE DU DÉFI'), style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          TextField(
            controller: _message,
            autofocus: true,
            maxLength: 140,
            decoration: InputDecoration(hintText: tr('Trash talk welcome 😤', 'Le chambrage est permis 😤')),
            onChanged: (_) => setState(() {}),
          ),
          Wrap(spacing: 6, runSpacing: 4, children: [
            for (final idea in _messageIdeas())
              ChoiceChip(label: Text(idea), selected: _message.text == idea, onSelected: (_) => setState(() => _message.text = idea)),
          ]),
          if (_error != null) Padding(padding: const EdgeInsets.only(top: 8), child: ErrorBanner(_error!)),
          const SizedBox(height: 16),
          FilledButton(onPressed: _busy || unchanged ? null : _save, child: Text(tr('SAVE', 'ENREGISTRER'))),
        ]),
      ),
    );
  }
}

/// Public (anyone with the link can follow) or private (players only).
class _VisibilityPicker extends StatelessWidget {
  final bool isPublic;
  final ValueChanged<bool>? onChanged;
  const _VisibilityPicker({required this.isPublic, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(tr('Who can see it', 'Qui peut le voir'), style: const TextStyle(fontWeight: FontWeight.w700)),
      const SizedBox(height: 6),
      SegmentedButton<bool>(
        segments: [
          ButtonSegment(value: false, icon: const Icon(Icons.lock_outline), label: Text(tr('Private', 'Privé'))),
          ButtonSegment(value: true, icon: const Icon(Icons.public), label: Text(tr('Public', 'Public'))),
        ],
        selected: {isPublic},
        onSelectionChanged: onChanged == null ? null : (v) => onChanged!(v.first),
      ),
      const SizedBox(height: 4),
      Text(
        isPublic
            ? tr('Anyone with the link can follow it. Only invited players can play.', 'Tout le monde avec le lien peut le suivre. Seuls les invités jouent.')
            : tr('Only the players and people invited can see it.', 'Seuls les joueurs et les invités peuvent le voir.'),
        style: TextStyle(fontSize: 12, color: theme.colorScheme.onSurfaceVariant),
      ),
    ]);
  }
}
