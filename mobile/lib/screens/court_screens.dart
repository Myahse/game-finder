import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:image_picker/image_picker.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/location.dart';
import '../core/map_tiles.dart';
import '../core/models.dart';
import '../core/presence.dart';
import '../core/realtime.dart';
import '../ui/app_icons.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'game_screens.dart';

/// Loads a court and keeps it fresh from realtime events.
mixin _CourtLoader<T extends StatefulWidget> on State<T> {
  CourtDetail? court;
  String? loadError;
  StreamSubscription? _rt;
  String get courtId;

  void startLoading() {
    load();
    _rt = context.read<Realtime>().events.listen((ev) {
      if (ev['court_id'] == courtId || ev['type'] == 'reconnected') load();
    });
  }

  Future<void> load() async {
    final q = context.read<LocationState>().query;
    try {
      final j = await context.read<Api>().get('/api/courts/$courtId?$q');
      if (mounted) setState(() => court = CourtDetail.fromJson(j));
    } catch (e) {
      if (mounted) setState(() => loadError = errorText(e));
    }
  }

  @override
  void dispose() {
    _rt?.cancel();
    super.dispose();
  }
}

/// Bottom sheet shown when a marker is tapped.
class CourtSheet extends StatefulWidget {
  final String courtId;
  const CourtSheet({super.key, required this.courtId});
  @override
  State<CourtSheet> createState() => _CourtSheetState();
}

class _CourtSheetState extends State<CourtSheet> with _CourtLoader {
  @override
  String get courtId => widget.courtId;

  @override
  void initState() {
    super.initState();
    startLoading();
  }

  @override
  Widget build(BuildContext context) {
    final c = court;
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.62,
      maxChildSize: 0.95,
      builder: (context, scroll) {
        if (c == null) {
          return Center(child: loadError != null ? Text(loadError!) : const CircularProgressIndicator());
        }
        final live = c.games.where((g) => g.isLive).toList();
        return ListView(controller: scroll, padding: const EdgeInsets.fromLTRB(20, 0, 20, 24), children: [
          Text(c.name.toUpperCase(), style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 4),
          Wrap(
            spacing: 12,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              for (final s in c.sports) SportInline(s, iconSize: 14, textStyle: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
              if (c.distanceM != null)
                Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.place, size: 14, color: Theme.of(context).colorScheme.onSurfaceVariant),
                  const SizedBox(width: 4),
                  Text('${formatDistance(c.distanceM)} away', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                ]),
            ],
          ),
          const SizedBox(height: 14),
          _StatusCard(court: c),
          const SizedBox(height: 14),
          CourtActions(court: c, onChanged: load),
          if (c.games.isNotEmpty) ...[
            const SizedBox(height: 20),
            Text(live.isNotEmpty ? 'GAMES NOW' : 'UPCOMING GAMES', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            for (final g in c.games.take(4))
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: GameCard(game: g, showCourt: false, onTap: () => _openGame(g.id)),
              ),
          ],
          TextButton(
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => CourtDetailsScreen(courtId: c.id))),
            child: const Text('Court details, photos & hours →'),
          ),
        ]);
      },
    );
  }

  void _openGame(String id) =>
      Navigator.push(context, MaterialPageRoute(builder: (_) => GameScreen(gameId: id))).then((_) => load());
}

class _StatusCard extends StatelessWidget {
  final Court court;
  const _StatusCard({required this.court});
  @override
  Widget build(BuildContext context) {
    final n = court.playerCount;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        StatusPill(court.activity),
        const SizedBox(height: 8),
        Text(
          n == 0
              ? 'NOBODY HERE YET'
              : '$n PLAYER${n == 1 ? '' : 'S'} ${court.activity == Activity.active ? 'PLAYING NOW' : 'HERE NOW'}',
          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900),
        ),
        Text('Last activity: ${timeAgo(court.lastActivityAt)}',
            style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
      ]),
    );
  }
}

/// JOIN GAME · I'M HERE · GET DIRECTIONS
class CourtActions extends StatefulWidget {
  final CourtDetail court;
  final VoidCallback onChanged;
  const CourtActions({super.key, required this.court, required this.onChanged});
  @override
  State<CourtActions> createState() => _CourtActionsState();
}

class _CourtActionsState extends State<CourtActions> {
  bool _busy = false;
  String? _error;

  Future<void> _run(Future<void> Function() f) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await f();
      widget.onChanged();
    } catch (e) {
      setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.court;
    final presence = context.watch<PresenceState>();
    final me = context.watch<LocationState>().position;
    final hereNow = presence.current?.courtId == c.id;
    final live = c.games.where((g) => g.isLive);
    final joinable = live.where((g) => !g.joined && g.spotsLeft > 0).firstOrNull;
    final mine = c.games.where((g) => g.joined && g.isOpen).firstOrNull;
    final far = me != null && const Distance()(me, LatLng(c.latitude, c.longitude)) > 500;

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      ErrorBanner(_error),
      if (mine != null)
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: Palette.live),
          onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => GameScreen(gameId: mine.id))),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Icon(Icons.check_circle_outline),
            const SizedBox(width: 8),
            Text("YOU'RE IN · ${mine.playerCount}/${mine.maxPlayers}"),
          ]),
        )
      else
        FilledButton(
          style: joinable != null ? FilledButton.styleFrom(backgroundColor: Palette.live) : null,
          onPressed: _busy
              ? null
              : () {
                  if (joinable == null) {
                    Navigator.push(context, MaterialPageRoute(builder: (_) => CreateGameScreen(courtId: c.id)))
                        .then((_) => widget.onChanged());
                    return;
                  }
                  _run(() async {
                    await context.read<Api>().post('/api/games/${joinable.id}/join');
                    if (context.mounted) {
                      Navigator.push(context, MaterialPageRoute(builder: (_) => GameScreen(gameId: joinable.id)));
                    }
                  });
                },
          child: Text(joinable != null
              ? 'JOIN GAME · ${joinable.playerCount}/${joinable.maxPlayers}'
              : live.isNotEmpty
                  ? 'START ANOTHER GAME'
                  : 'CREATE GAME'),
        ),
      const SizedBox(height: 10),
      Row(children: [
        Expanded(
          child: OutlinedButton(
            onPressed: _busy
                ? null
                : () => _run(() => hereNow ? presence.leave() : presence.checkIn(c.id, me)),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              if (!hereNow) ...[const Icon(Icons.place, size: 18), const SizedBox(width: 6)],
              Text(hereNow ? "I'VE LEFT" : "I'M HERE"),
            ]),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: OutlinedButton(
            onPressed: () => openDirections(c.latitude, c.longitude),
            child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(Icons.navigation_outlined, size: 18),
              SizedBox(width: 6),
              Text('DIRECTIONS'),
            ]),
          ),
        ),
      ]),
      if (hereNow)
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: PresenceLiveText("You're present since ${clock(presence.current!.startedAt)}", textAlign: TextAlign.center),
        ),
      if (far && !hereNow)
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text("Check-in works when you're at the court.",
              textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
        ),
      TextButton(
        onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ReportCourtScreen(courtId: c.id))),
        child: const Text('Report a problem with this court', style: TextStyle(fontSize: 12)),
      ),
    ]);
  }
}

class CourtDetailsScreen extends StatefulWidget {
  final String courtId;
  const CourtDetailsScreen({super.key, required this.courtId});
  @override
  State<CourtDetailsScreen> createState() => _CourtDetailsScreenState();
}

class _CourtDetailsScreenState extends State<CourtDetailsScreen> with _CourtLoader {
  @override
  String get courtId => widget.courtId;

  @override
  void initState() {
    super.initState();
    startLoading();
  }

  @override
  Widget build(BuildContext context) {
    final c = court;
    return Scaffold(
      appBar: AppBar(title: Text(c?.name.toUpperCase() ?? '')),
      body: c == null
          ? Center(child: loadError != null ? Text(loadError!) : const CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: load,
              child: ListView(padding: const EdgeInsets.all(16), children: [
                if (c.photos.isNotEmpty)
                  SizedBox(
                    height: 190,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: c.photos.length,
                      separatorBuilder: (_, _) => const SizedBox(width: 8),
                      itemBuilder: (_, i) => ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: Image.network(c.photos[i], width: 280, fit: BoxFit.cover),
                      ),
                    ),
                  ),
                if (c.photos.isNotEmpty) const SizedBox(height: 16),
                if (c.status == 'pending')
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Row(children: [
                        const Icon(Icons.hourglass_top, size: 20),
                        const SizedBox(width: 10),
                        const Expanded(child: Text('Waiting for review. Only you can see this court.')),
                      ]),
                    ),
                  ),
                _StatusCard(court: c),
                const SizedBox(height: 14),
                if (c.status == 'approved') CourtActions(court: c, onChanged: load),
                const SizedBox(height: 16),
                Text('GAMES', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                if (c.games.isEmpty) const Text('No games yet. Create one and players nearby will see it.'),
                for (final g in c.games)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: GameCard(
                      game: g,
                      showCourt: false,
                      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => GameScreen(gameId: g.id))),
                    ),
                  ),
                const SizedBox(height: 16),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('COURT INFO', style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 8),
                      _infoRow(
                        'Sports',
                        Wrap(spacing: 10, runSpacing: 6, children: [for (final s in c.sports) SportInline(s)]),
                      ),
                      _info('Address', c.address),
                      _info('Opening hours', c.openingHours),
                      _info('Surface', c.surface),
                      _infoRow(
                        'Lighting',
                        c.lighting == null
                            ? const Text('—')
                            : c.lighting!
                                ? const Row(children: [Icon(Icons.lightbulb_outline, size: 18), SizedBox(width: 6), Text('Lit at night')])
                                : const Text('No lights'),
                      ),
                      if (c.description != null) ...[const SizedBox(height: 8), Text(c.description!)],
                    ]),
                  ),
                ),
              ]),
            ),
    );
  }

  Widget _info(String label, String? value) => _infoRow(label, Text(value ?? '—'));

  Widget _infoRow(String label, Widget value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 120, child: Text(label, style: const TextStyle(fontWeight: FontWeight.w700))),
          Expanded(child: value),
        ]),
      );
}

class AddCourtScreen extends StatefulWidget {
  const AddCourtScreen({super.key});
  @override
  State<AddCourtScreen> createState() => _AddCourtScreenState();
}

class _AddCourtScreenState extends State<AddCourtScreen> {
  final _name = TextEditingController();
  final _description = TextEditingController();
  LatLng? _where;
  List<Sport> _sports = [];
  final Set<String> _sportIds = {};
  final List<String> _photos = [];
  bool _busy = false, _uploading = false, _done = false;
  Court? _doneCourt;
  bool _reusedNearby = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    context.read<Api>().get('/api/sports').then((j) {
      if (mounted) setState(() => _sports = [for (final s in j) Sport.fromJson(s)]);
    }).catchError((_) {});
  }

  Future<void> _addPhoto() async {
    final api = context.read<Api>();
    final f = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1600, imageQuality: 85);
    if (f == null) return;
    setState(() => _uploading = true);
    try {
      final url = await api.upload(await f.readAsBytes(), f.name, 'court');
      setState(() => _photos.add(url));
    } catch (e) {
      setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _submit() async {
    if (_where == null) return setState(() => _error = 'Tap the map to place the court.');
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final j = await context.read<Api>().post('/api/courts', {
        'name': _name.text.trim(),
        'latitude': _where!.latitude,
        'longitude': _where!.longitude,
        'sport_ids': _sportIds.toList(),
        'description': _description.text.trim().isEmpty ? null : _description.text.trim(),
        'photos': _photos,
      });
      final court = Court.fromJson(j as Map<String, dynamic>);
      setState(() {
        _doneCourt = court;
        _reusedNearby = j['reused_nearby'] == true;
        _done = true;
      });
    } catch (e) {
      setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final loc = context.watch<LocationState>();
    if (_done && _doneCourt != null) {
      final c = _doneCourt!;
      return Scaffold(
        appBar: AppBar(),
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Icon(Icons.check_circle_outline, size: 64, color: Palette.brand),
            const SizedBox(height: 16),
            Text(_reusedNearby ? 'Court already here' : 'Court on the map',
                textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 12),
            Text(
              _reusedNearby
                  ? 'Nobody was playing at this spot — use this court and start a game for others to join.'
                  : 'It’s on the map now (pending review). Anyone nearby can create a game when the court is quiet.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () => Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => CreateGameScreen(courtId: c.id))),
              child: const Text('CREATE A GAME'),
            ),
            const SizedBox(height: 10),
            OutlinedButton(
              onPressed: () => Navigator.popUntil(context, (r) => r.isFirst),
              child: const Text('VIEW ON MAP'),
            ),
          ]),
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('ADD A COURT')),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        TextField(controller: _name, decoration: const InputDecoration(labelText: 'Name', hintText: 'e.g. Terrain Mockeyville')),
        const SizedBox(height: 16),
        const Text('Location', style: TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: SizedBox(
            height: 240,
            child: FlutterMap(
              options: MapOptions(
                initialCenter: loc.center,
                initialZoom: 16,
                onTap: (_, p) => setState(() => _where = p),
              ),
              children: [
                TileLayer(
                  urlTemplate: mapboxTileUrl(dark: Theme.of(context).brightness == Brightness.dark),
                  userAgentPackageName: 'com.findthegame.find_the_game',
                  retinaMode: RetinaMode.isHighDensity(context),
                ),
                if (_where != null)
                  MarkerLayer(markers: [
                    Marker(
                      point: _where!,
                      width: 40,
                      height: 40,
                      alignment: Alignment.topCenter,
                      child: Icon(Icons.place, size: 36, color: Palette.brand),
                    ),
                  ]),
              ],
            ),
          ),
        ),
        Row(children: [
          Text(_where == null ? 'Tap the map where the court is' : 'Pin placed',
              style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
          const Spacer(),
          if (loc.position != null)
            TextButton(onPressed: () => setState(() => _where = loc.position), child: const Text("I'm at the court")),
        ]),
        const SizedBox(height: 8),
        const Text('Sports', style: TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final s in _sports)
            ChoiceTile(
              leading: SportIcon(s.slug, size: 20),
              label: s.name,
              selected: _sportIds.contains(s.id),
              onTap: () => setState(() => _sportIds.contains(s.id) ? _sportIds.remove(s.id) : _sportIds.add(s.id)),
            ),
        ]),
        const SizedBox(height: 16),
        const Text('Photos (optional)', style: TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final p in _photos)
            ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.network(p, width: 72, height: 72, fit: BoxFit.cover)),
          if (_photos.length < 6)
            InkWell(
              onTap: _uploading ? null : _addPhoto,
              child: Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(border: Border.all(color: Theme.of(context).dividerColor, width: 2), borderRadius: BorderRadius.circular(12)),
                child: Center(child: _uploading ? const CircularProgressIndicator() : const Icon(Icons.add_a_photo_outlined)),
              ),
            ),
        ]),
        const SizedBox(height: 16),
        TextField(controller: _description, maxLines: 3, decoration: const InputDecoration(labelText: 'Description (optional)')),
        const SizedBox(height: 16),
        ErrorBanner(_error),
        FilledButton(
          onPressed: _busy || _uploading || _sportIds.isEmpty || _name.text.trim().length < 2 ? null : _submit,
          child: const Text('SUBMIT COURT'),
        ),
      ]),
    );
  }
}

class ReportCourtScreen extends StatefulWidget {
  final String courtId;
  const ReportCourtScreen({super.key, required this.courtId});
  @override
  State<ReportCourtScreen> createState() => _ReportCourtScreenState();
}

class _ReportCourtScreenState extends State<ReportCourtScreen> {
  String? _type;
  final _details = TextEditingController();
  bool _busy = false, _sent = false;
  String? _error;

  Future<void> _submit() async {
    setState(() => _busy = true);
    try {
      await context.read<Api>().post('/api/courts/${widget.courtId}/reports', {'type': _type, 'description': _details.text});
      setState(() => _sent = true);
    } catch (e) {
      setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_sent) {
      return Scaffold(appBar: AppBar(), body: const EmptyState(icon: Icons.check_circle_outline, title: 'Thanks for the report', body: 'An admin will review it.'));
    }
    return Scaffold(
      appBar: AppBar(title: const Text('REPORT COURT')),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        const Text("What's wrong?", style: TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        for (final e in reportLabels.entries)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: ChoiceTile(label: e.value, selected: _type == e.key, onTap: () => setState(() => _type = e.key)),
          ),
        const SizedBox(height: 8),
        TextField(controller: _details, maxLines: 3, maxLength: 1000, decoration: const InputDecoration(labelText: 'Details (optional)')),
        ErrorBanner(_error),
        FilledButton(onPressed: _type == null || _busy ? null : _submit, child: const Text('SEND REPORT')),
      ]),
    );
  }
}
