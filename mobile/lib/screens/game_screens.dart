import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/format.dart';
import '../core/location.dart';
import '../core/models.dart';
import '../core/realtime.dart';
import '../ui/theme.dart';
import '../ui/app_icons.dart';
import '../ui/widgets.dart';
import 'profile_screen.dart';

class GameScreen extends StatefulWidget {
  final String gameId;
  const GameScreen({super.key, required this.gameId});
  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> {
  Game? _game;
  String? _error;
  bool _busy = false;
  StreamSubscription? _rt;
  Timer? _loadDebounce;
  final _invite = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
    // Player count updates live: someone joins → 7/10 becomes 8/10.
    _rt = context.read<Realtime>().events.listen((ev) {
      if (ev['game_id'] != widget.gameId && ev['type'] != 'reconnected') return;
      _loadDebounce?.cancel();
      _loadDebounce = Timer(const Duration(milliseconds: 350), _load);
    });
  }

  @override
  void dispose() {
    _loadDebounce?.cancel();
    _rt?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final j = await context.read<Api>().get('/api/games/${widget.gameId}?${context.read<LocationState>().query}');
      if (mounted) setState(() => _game = Game.fromJson(j));
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    }
  }

  Future<void> _action(String action, {String? reason}) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final j = await context.read<Api>().post('/api/games/${widget.gameId}/$action', action == 'cancel' ? {'reason': reason} : null);
      if (mounted) setState(() => _game = Game.fromJson(j));
    } catch (e) {
      setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _sendInvite() async {
    final name = _invite.text.trim().replaceFirst('@', '');
    if (name.isEmpty) return;
    try {
      await context.read<Api>().post('/api/games/${widget.gameId}/invite', {'username': name});
      _invite.clear();
      if (mounted) showSnack(context, 'Invited @$name');
    } catch (e) {
      if (mounted) showSnack(context, errorText(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final g = _game;
    final me = context.watch<AuthState>().user;
    if (g == null) {
      return Scaffold(appBar: AppBar(), body: Center(child: _error != null ? Text(_error!) : const CircularProgressIndicator()));
    }
    final (statusLabel, statusIcon, statusColor) = switch (g.status) {
      'active' => ('ACTIVE', Icons.local_fire_department, Palette.live),
      'scheduled' => ('UPCOMING', Icons.schedule, Palette.idle),
      'completed' => ('FINISHED', Icons.check, Palette.idle),
      _ => ('CANCELLED', Icons.close, Theme.of(context).colorScheme.error),
    };
    final isCreator = g.creatorId == me?.id;

    return Scaffold(
      appBar: AppBar(title: Text('${gameTypeLabels[g.gameType]} ${g.sport.name}'.toUpperCase())),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: statusColor, borderRadius: BorderRadius.circular(6)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(statusIcon, size: 16, color: Colors.white),
                    const SizedBox(width: 6),
                    Text(statusLabel, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),
                  ]),
                ),
                const SizedBox(height: 10),
                Row(children: [
                  SportIcon(g.sport.slug, size: 28, color: Theme.of(context).colorScheme.primary),
                  const SizedBox(width: 10),
                  Expanded(child: Text(g.courtName.toUpperCase(), style: Theme.of(context).textTheme.headlineMedium)),
                ]),
                if (g.distanceM != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Row(children: [
                      Icon(Icons.place, size: 16, color: Theme.of(context).colorScheme.onSurfaceVariant),
                      const SizedBox(width: 4),
                      Text('${formatDistance(g.distanceM)} away'),
                    ]),
                  ),
                const SizedBox(height: 18),
                Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text('${g.playerCount}', style: const TextStyle(fontSize: 52, fontWeight: FontWeight.w900, height: 1)),
                  Text(' / ${g.maxPlayers}', style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: Theme.of(context).colorScheme.onSurfaceVariant)),
                  const Spacer(),
                  Text(g.spotsLeft == 0 ? 'Full' : '${g.spotsLeft} spots left',
                      style: TextStyle(fontWeight: FontWeight.w800, color: g.spotsLeft == 0 ? Theme.of(context).colorScheme.error : Palette.live)),
                ]),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: TweenAnimationBuilder<double>(
                    tween: Tween(end: g.playerCount / g.maxPlayers),
                    duration: const Duration(milliseconds: 400),
                    builder: (_, v, _) => LinearProgressIndicator(value: v, minHeight: 12, color: Palette.live),
                  ),
                ),
                const SizedBox(height: 14),
                Wrap(spacing: 12, runSpacing: 6, children: [
                  Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.star, size: 16, color: Theme.of(context).colorScheme.onSurfaceVariant),
                    const SizedBox(width: 4),
                    Text(skillLabels[g.skillLevel]!),
                  ]),
                  Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.schedule, size: 16, color: Theme.of(context).colorScheme.onSurfaceVariant),
                    const SizedBox(width: 4),
                    Text(gameTime(g)),
                  ]),
                  Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.timer_outlined, size: 16, color: Theme.of(context).colorScheme.onSurfaceVariant),
                    const SizedBox(width: 4),
                    Text('${g.durationMinutes} min'),
                  ]),
                ]),
                if (g.cancelledReason != null)
                  Text('Reason: ${g.cancelledReason}', style: TextStyle(color: Theme.of(context).colorScheme.error)),
                const SizedBox(height: 18),
                ErrorBanner(_error),
                if (g.isOpen)
                  g.joined
                      ? OutlinedButton(
                          style: OutlinedButton.styleFrom(foregroundColor: Theme.of(context).colorScheme.error),
                          onPressed: _busy ? null : () => _action('leave'),
                          child: const Text('LEAVE GAME'),
                        )
                      : FilledButton(
                          style: FilledButton.styleFrom(backgroundColor: Palette.live),
                          onPressed: _busy || g.spotsLeft == 0 ? null : () => _action('join'),
                          child: Text(g.spotsLeft == 0 ? 'GAME FULL' : 'JOIN GAME'),
                        ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: () => openDirections(g.courtLat, g.courtLng),
                  icon: const Icon(Icons.navigation_outlined),
                  label: const Text('GET DIRECTIONS'),
                ),
                if (g.isOpen && isCreator)
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () async {
                            final reason = await _askReason(context);
                            if (reason != null) _action('cancel', reason: reason);
                          },
                    child: const Text('Cancel game'),
                  ),
              ]),
            ),
          ),
          if (g.isOpen && g.joined) ...[
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: TextField(controller: _invite, decoration: const InputDecoration(hintText: 'Invite by @username', isDense: true))),
              const SizedBox(width: 8),
              FilledButton.tonal(onPressed: _sendInvite, child: const Text('INVITE')),
            ]),
          ],
          const SizedBox(height: 20),
          Text('PLAYERS', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          for (final p in g.players)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: UserAvatar(p),
              title: Text(p.fullName, style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text('@${p.username}'),
              trailing: p.id == g.creatorId ? const Text('HOST', style: TextStyle(color: Palette.brand, fontWeight: FontWeight.w900)) : null,
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => UserScreen(userId: p.id))),
            ),
        ]),
      ),
    );
  }

  Future<String?> _askReason(BuildContext context) {
    final c = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel this game?'),
        content: TextField(controller: c, decoration: const InputDecoration(hintText: 'Reason (shown to players)')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Keep it')),
          FilledButton(onPressed: () => Navigator.pop(ctx, c.text), child: const Text('Cancel game')),
        ],
      ),
    );
  }
}

class CreateGameScreen extends StatefulWidget {
  final String? courtId;
  const CreateGameScreen({super.key, this.courtId});
  @override
  State<CreateGameScreen> createState() => _CreateGameScreenState();
}

class _CreateGameScreenState extends State<CreateGameScreen> {
  List<Court> _courts = [];
  String? _courtId;
  String? _sportId;
  bool _now = true;
  DateTime _start = DateTime.now().add(const Duration(hours: 1));
  int _max = 10;
  String _skill = 'all_levels';
  String _type = 'pickup';
  bool _busy = false;
  String? _error;
  Game? _created;

  @override
  void initState() {
    super.initState();
    _courtId = widget.courtId;
    final c = context.read<LocationState>().center;
    context.read<Api>().get('/api/courts/nearby?lat=${c.latitude}&lng=${c.longitude}&radius_km=30').then((j) {
      if (mounted) setState(() => _courts = [for (final x in j) Court.fromJson(x)]);
    }).catchError((_) {});
  }

  Future<void> _pickTime() async {
    final d = await showDatePicker(
        context: context, initialDate: _start, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 30)));
    if (d == null || !mounted) return;
    final t = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(_start));
    if (t == null) return;
    setState(() => _start = DateTime(d.year, d.month, d.day, t.hour, t.minute));
  }

  Future<void> _submit(String sportId) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final j = await context.read<Api>().post('/api/games', {
        'court_id': _courtId,
        'sport_id': sportId,
        'start_time': (_now ? DateTime.now() : _start).toUtc().toIso8601String(),
        'max_players': _max,
        'skill_level': _skill,
        'game_type': _type,
      });
      setState(() => _created = Game.fromJson(j));
    } catch (e) {
      setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_created != null) {
      return Scaffold(
        appBar: AppBar(),
        body: EmptyState(
          icon: sportIconData(_created!.sport.slug),
          title: 'Game created successfully.',
          body: "You're in. Players near ${_created!.courtName} can see it now.",
          action: FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Palette.live),
            onPressed: () => Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => GameScreen(gameId: _created!.id))),
            child: const Text('VIEW GAME'),
          ),
        ),
      );
    }
    final court = _courts.where((c) => c.id == _courtId).firstOrNull;
    final sports = court?.sports.where((s) => s.active).toList() ?? const <Sport>[];
    final sport = sports.where((s) => s.id == _sportId).firstOrNull ?? sports.firstOrNull;

    return Scaffold(
      appBar: AppBar(title: const Text('CREATE GAME')),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        DropdownButtonFormField<String>(
          initialValue: _courts.any((c) => c.id == _courtId) ? _courtId : null,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Court'),
          items: [
            for (final c in _courts)
              DropdownMenuItem(value: c.id, child: Text('${c.name}  ·  ${formatDistance(c.distanceM)}', overflow: TextOverflow.ellipsis)),
          ],
          onChanged: (v) => setState(() {
            _courtId = v;
            _sportId = null;
          }),
        ),
        const SizedBox(height: 16),
        const Text('Sport', style: TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        Wrap(spacing: 8, children: [
          for (final s in sports)
            ChoiceTile(
              leading: SportIcon(s.slug, size: 20),
              label: s.name,
              selected: sport?.id == s.id,
              onTap: () => setState(() => _sportId = s.id),
            ),
        ]),
        const SizedBox(height: 16),
        const Text('Start time', style: TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        Row(children: [
          Expanded(
            child: ChoiceTile(
              leading: const Icon(Icons.local_fire_department, size: 18),
              label: 'Right now',
              selected: _now,
              onTap: () => setState(() => _now = true),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: ChoiceTile(
              leading: const Icon(Icons.schedule, size: 18),
              label: 'Later',
              selected: !_now,
              onTap: () => setState(() => _now = false),
            ),
          ),
        ]),
        if (!_now)
          TextButton.icon(onPressed: _pickTime, icon: const Icon(Icons.schedule), label: Text(gameTimeFor(_start))),
        const SizedBox(height: 16),
        Text('Maximum players: $_max', style: const TextStyle(fontWeight: FontWeight.w700)),
        Slider(value: _max.toDouble(), min: 2, max: 30, divisions: 28, label: '$_max', onChanged: (v) => setState(() => _max = v.round())),
        DropdownButtonFormField<String>(
          initialValue: _skill,
          decoration: const InputDecoration(labelText: 'Skill level'),
          items: [for (final e in skillLabels.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
          onChanged: (v) => setState(() => _skill = v!),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: _type,
          decoration: const InputDecoration(labelText: 'Game type'),
          items: [for (final e in gameTypeLabels.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
          onChanged: (v) => setState(() => _type = v!),
        ),
        const SizedBox(height: 20),
        ErrorBanner(_error),
        FilledButton(
          onPressed: _busy || _courtId == null || sport == null ? null : () => _submit(sport.id),
          child: const Text('CREATE GAME'),
        ),
      ]),
    );
  }
}

String gameTimeFor(DateTime t) => '${t.day}/${t.month} at ${clock(t)}';
