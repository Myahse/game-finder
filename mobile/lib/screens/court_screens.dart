import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import '../core/pick_image.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/format.dart';
import '../core/media_url.dart';
import '../core/location.dart';
import '../core/map_tiles.dart';
import '../core/models.dart';
import '../core/opening_hours.dart';
import '../core/reverse_geocode.dart';
import '../core/my_sport.dart';
import '../core/presence.dart';
import '../core/realtime.dart';
import '../ui/app_icons.dart';
import '../ui/court_map_pin.dart';
import '../ui/theme.dart';
import '../ui/court_photo_viewer.dart';
import '../ui/widgets.dart';
import 'game_screens.dart';

/// Close the court bottom sheet and return [gameId] to [showModalBottomSheet]'s future.
void completeCourtSheetWithGame(BuildContext context, String gameId) {
  final sheet = context.findAncestorStateOfType<_CourtSheetState>();
  sheet?._markClosing();
  Navigator.pop(context, gameId);
}

/// Loads a court and keeps it fresh from realtime events.
mixin _CourtLoader<T extends StatefulWidget> on State<T> {
  CourtDetail? court;
  String? loadError;
  StreamSubscription? _rt;
  Timer? _loadDebounce;
  String get courtId;

  bool _closing = false;

  void _markClosing() {
    _closing = true;
    _loadDebounce?.cancel();
  }

  bool _loaderActive() {
    if (!mounted || _closing) return false;
    final route = ModalRoute.of(context);
    return route == null || route.isCurrent;
  }

  void _applyCourt(CourtDetail? next, {String? error}) {
    if (next != null) {
      court = next;
      loadError = null;
    }
    if (error != null) loadError = error;
    if (_loaderActive()) setState(() {});
  }

  void startLoading() {
    load();
    _rt = context.read<Realtime>().events.listen((ev) {
      if (ev['court_id'] != courtId && ev['type'] != 'reconnected') return;
      _loadDebounce?.cancel();
      _loadDebounce = Timer(const Duration(milliseconds: 350), load);
    });
  }

  Future<void> load() async {
    final q = context.read<LocationState>().query;
    try {
      final j = await context.read<Api>().get('/api/courts/$courtId?$q');
      if (!mounted) return;
      _applyCourt(CourtDetail.fromJson(j), error: null);
    } catch (e) {
      if (!mounted) return;
      _applyCourt(null, error: errorText(e));
    }
  }

  @override
  void dispose() {
    _rt?.cancel();
    _loadDebounce?.cancel();
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
    if (c == null) {
      return SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.4,
        child: Center(
          child: loadError != null
              ? Text(loadError!)
              : const CircularProgressIndicator(),
        ),
      );
    }
    final live = c.games.where((g) => g.isLive).toList();
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            c.name.toUpperCase(),
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 4),
          Wrap(
            spacing: 12,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              for (final s in c.sports)
                SportInline(
                  s,
                  iconSize: 14,
                  textStyle: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              if (c.distanceM != null)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.place,
                      size: 14,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '${formatDistance(c.distanceM)} away',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
            ],
          ),
          const SizedBox(height: 14),
          _StatusCard(court: c),
          const SizedBox(height: 14),
          CourtActions(court: c, onChanged: load, popBeforeGame: true),
          if (c.games.isNotEmpty) ...[
            const SizedBox(height: 20),
            Text(
              live.isNotEmpty ? 'GAMES NOW' : 'UPCOMING GAMES',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            for (final g in c.games.take(4))
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: GameCard(
                  game: g,
                  showCourt: false,
                  onTap: () => completeCourtSheetWithGame(context, g.id),
                ),
              ),
          ],
          TextButton(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => CourtDetailsScreen(courtId: c.id),
              ),
            ),
            child: const Text('Court details, photos & hours →'),
          ),
        ],
      ),
    );
  }
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          StatusPill(court.activity),
          const SizedBox(height: 8),
          Text(
            n == 0
                ? 'NOBODY HERE YET'
                : '$n PLAYER${n == 1 ? '' : 'S'} ${court.activity == Activity.active ? 'PLAYING NOW' : 'HERE NOW'}',
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900),
          ),
          Text(
            'Last activity: ${timeAgo(court.lastActivityAt)}',
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

/// JOIN GAME · I'M HERE · GET DIRECTIONS
class CourtActions extends StatefulWidget {
  final CourtDetail court;
  final VoidCallback onChanged;
  final bool popBeforeGame;
  const CourtActions({
    super.key,
    required this.court,
    required this.onChanged,
    this.popBeforeGame = false,
  });
  @override
  State<CourtActions> createState() => _CourtActionsState();
}

class _CourtActionsState extends State<CourtActions> {
  bool _busy = false;
  String? _error;

  Future<void> _run(Future<void> Function() f, {bool refresh = true}) async {
    if (!mounted) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await f();
      if (refresh) widget.onChanged();
      if (mounted && ModalRoute.of(context)?.isCurrent == true) setState(() {});
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _goToGame(String gameId) {
    if (widget.popBeforeGame) {
      completeCourtSheetWithGame(context, gameId);
      return;
    }
    openGameScreen(context, gameId, onReturn: widget.onChanged);
  }

  Future<void> _joinAndOpen(String gameId) async {
    if (!mounted) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    var closing = false;
    try {
      await context.read<Api>().post('/api/games/$gameId/join');
      if (!mounted) return;
      if (widget.popBeforeGame) {
        closing = true;
        completeCourtSheetWithGame(context, gameId);
        return;
      }
      openGameScreen(context, gameId, onReturn: widget.onChanged);
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted && !closing) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.court;
    final presence = context.read<PresenceState>();
    final me = context.read<LocationState>().position;
    final hereNow = presence.current?.courtId == c.id;
    final live = c.games.where((g) => g.isLive);
    final joinable = live
        .where((g) => !g.joined && gameHasOpenSpots(g))
        .firstOrNull;
    final mine = c.games.where((g) => g.joined && g.isOpen).firstOrNull;
    final far =
        me != null &&
        const Distance()(me, LatLng(c.latitude, c.longitude)) > 500;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ErrorBanner(_error),
        if (mine != null)
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Palette.live),
            onPressed: _busy ? null : () => _goToGame(mine.id),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.check_circle_outline),
                const SizedBox(width: 8),
                Text("YOU'RE IN · ${gamePlayerCountLabel(mine.playerCount, mine.maxPlayers)}"),
              ],
            ),
          )
        else
          FilledButton(
            style: joinable != null
                ? FilledButton.styleFrom(backgroundColor: Palette.live)
                : null,
            onPressed: _busy
                ? null
                : () {
                    if (joinable == null) {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => CreateGameScreen(courtId: c.id),
                        ),
                      ).then((_) => widget.onChanged());
                      return;
                    }
                    _joinAndOpen(joinable.id);
                  },
            child: Text(
              joinable != null
                  ? 'JOIN GAME · ${gamePlayerCountLabel(joinable.playerCount, joinable.maxPlayers)}'
                  : live.isNotEmpty
                  ? 'START ANOTHER GAME'
                  : 'CREATE GAME',
            ),
          ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: _busy
                    ? null
                    : () => _run(
                        () => hereNow
                            ? presence.leave()
                            : presence.checkIn(c.id, me),
                      ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (!hereNow) ...[
                      const Icon(Icons.place, size: 18),
                      const SizedBox(width: 6),
                    ],
                    Text(hereNow ? "I'VE LEFT" : "I'M HERE"),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: OutlinedButton(
                onPressed: () => openDirections(c.latitude, c.longitude),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.navigation_outlined, size: 18),
                    SizedBox(width: 6),
                    Text('DIRECTIONS'),
                  ],
                ),
              ),
            ),
          ],
        ),
        if (hereNow && presence.current != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: SizedBox(
              width: double.infinity,
              child: PresenceLiveText(
                "You're present since ${clock(presence.current!.startedAt)}",
                textAlign: TextAlign.center,
              ),
            ),
          ),
        if (far && !hereNow)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              "Check-in works when you're at the court.",
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ),
        TextButton(
          onPressed: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => ReportCourtScreen(courtId: c.id)),
          ),
          child: const Text(
            'Report a problem with this court',
            style: TextStyle(fontSize: 12),
          ),
        ),
      ],
    );
  }
}

class CourtDetailsScreen extends StatefulWidget {
  final String courtId;
  const CourtDetailsScreen({super.key, required this.courtId});
  @override
  State<CourtDetailsScreen> createState() => _CourtDetailsScreenState();
}

class _CourtDetailsScreenState extends State<CourtDetailsScreen>
    with _CourtLoader {
  bool _uploadingPhotos = false;
  String? _photoError;
  TimeOfDay? _opens;
  TimeOfDay? _closes;
  bool _savingInfo = false;
  bool _geocodingInfoAddress = false;
  String? _infoError;
  String? _infoSyncedForCourtId;
  final _address = TextEditingController();
  final _surface = TextEditingController();
  final _description = TextEditingController();
  bool? _lighting;
  Set<String> _sportIds = {};

  @override
  String get courtId => widget.courtId;

  @override
  void initState() {
    super.initState();
    startLoading();
  }

  void _syncInfoFromCourt(Court c) {
    if (_infoSyncedForCourtId == c.id) return;
    _infoSyncedForCourtId = c.id;
    final p = parseOpeningHours(c.openingHours);
    _opens = p != null ? hmToTimeOfDay(p.opens) : null;
    _closes = p != null ? hmToTimeOfDay(p.closes) : null;
    _address.text = c.address ?? '';
    _surface.text = c.surface ?? '';
    _description.text = c.description ?? '';
    _lighting = c.lighting;
    _sportIds = c.sports.map((s) => s.id).toSet();
  }

  @override
  void dispose() {
    _address.dispose();
    _surface.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _fillAddressFromMap() async {
    final c = court;
    if (c == null) return;
    setState(() => _geocodingInfoAddress = true);
    final addr = await reverseGeocode(c.latitude, c.longitude);
    if (mounted && addr != null) _address.text = addr;
    if (mounted) setState(() => _geocodingInfoAddress = false);
  }

  Future<void> _saveCourtInfo() async {
    final c = court;
    if (c == null || _sportIds.isEmpty) return;
    final user = context.read<AuthState>().user;
    var sportIds = _sportIds.toList();
    if (user?.preferredSportId != null && !(user?.isAdmin ?? false)) {
      sportIds = [user!.preferredSportId!];
    }
    setState(() {
      _savingInfo = true;
      _infoError = null;
    });
    try {
      await context.read<Api>().patch('/api/courts/${c.id}/info', {
        'opens_at': _opens != null ? timeOfDayToHm(_opens!) : '',
        'closes_at': _closes != null ? timeOfDayToHm(_closes!) : '',
        'address': _address.text.trim(),
        'surface': _surface.text.trim(),
        'description': _description.text.trim(),
        'lighting': _lighting,
        'sport_ids': sportIds,
      });
      _infoSyncedForCourtId = null;
      await load();
    } catch (e) {
      setState(() => _infoError = errorText(e));
    } finally {
      if (mounted) setState(() => _savingInfo = false);
    }
  }

  Future<void> _removeCourtPhoto(String url) async {
    final c = court;
    if (c == null) return;
    setState(() {
      _uploadingPhotos = true;
      _photoError = null;
    });
    try {
      await context.read<Api>().delete('/api/courts/${c.id}/photos', {
        'photos': [url],
      });
      await load();
    } catch (e) {
      setState(() => _photoError = errorText(e));
    } finally {
      if (mounted) setState(() => _uploadingPhotos = false);
    }
  }

  Future<void> _addCourtPhotos() async {
    final c = court;
    if (c == null || c.photos.length >= 6) return;
    final api = context.read<Api>();
    final f = await pickImageFile(context, maxWidth: 1600, imageQuality: 85);
    if (f == null) return;
    setState(() {
      _uploadingPhotos = true;
      _photoError = null;
    });
    try {
      final url = await api.upload(await f.readAsBytes(), f.name, 'court');
      await api.post('/api/courts/${c.id}/photos', {
        'photos': [url],
      });
      await load();
    } catch (e) {
      setState(() => _photoError = errorText(e));
    } finally {
      if (mounted) setState(() => _uploadingPhotos = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = court;
    final me = context.watch<AuthState>().user;
    final canEditCourt =
        c != null && me != null && (c.createdBy == me.id || me.isAdmin);
    final canAddPhotos = canEditCourt && c != null && c.photos.length < 6;
    if (c != null && canEditCourt) {
      _syncInfoFromCourt(c);
    }
    return Scaffold(
      appBar: AppBar(title: Text(c?.name.toUpperCase() ?? '')),
      body: c == null
          ? Center(
              child: loadError != null
                  ? Text(loadError!)
                  : const CircularProgressIndicator(),
            )
          : RefreshIndicator(
              onRefresh: load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (c.photos.isNotEmpty && !canEditCourt) ...[
                    CourtPhotoStrip(photos: c.photos),
                    const SizedBox(height: 8),
                  ],
                  if (canEditCourt && c.photos.isNotEmpty) ...[
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final p in c.photos)
                          Stack(
                            clipBehavior: Clip.none,
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: Image.network(
                                  resolveMediaUrl(p),
                                  width: 88,
                                  height: 88,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, _, _) =>
                                      const Icon(Icons.broken_image_outlined),
                                ),
                              ),
                              Positioned(
                                right: -4,
                                top: -4,
                                child: Material(
                                  color: Theme.of(context).colorScheme.surface,
                                  shape: const CircleBorder(),
                                  elevation: 2,
                                  child: InkWell(
                                    customBorder: const CircleBorder(),
                                    onTap: _uploadingPhotos
                                        ? null
                                        : () => _removeCourtPhoto(p),
                                    child: const Padding(
                                      padding: EdgeInsets.all(4),
                                      child: Icon(Icons.close, size: 18),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                      ],
                    ),
                    const SizedBox(height: 8),
                  ],
                  if (canAddPhotos) ...[
                    OutlinedButton.icon(
                      onPressed: _uploadingPhotos ? null : _addCourtPhotos,
                      icon: _uploadingPhotos
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.add_a_photo_outlined),
                      label: Text(
                        c.photos.isEmpty
                            ? 'Add court photos'
                            : 'Add more photos',
                      ),
                    ),
                    Text(
                      '${c.photos.length}/6 photos · remove any that don\'t match',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 12,
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                    if (_photoError != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          _photoError!,
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.error,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    const SizedBox(height: 16),
                  ] else if (c.photos.isNotEmpty)
                    const SizedBox(height: 8),
                  if (canEditCourt) ...[
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              'COURT INFO',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: 8),
                            Builder(
                              builder: (context) {
                                final user = context.watch<AuthState>().user;
                                final locked = sportForUser(user, c.sports);
                                if (locked != null &&
                                    !(user?.isAdmin ?? false)) {
                                  return SportInline(locked, iconSize: 20);
                                }
                                return Wrap(
                                  spacing: 8,
                                  runSpacing: 6,
                                  children: [
                                    for (final s in c.sports)
                                      FilterChip(
                                        label: SportInline(s),
                                        selected: _sportIds.contains(s.id),
                                        onSelected: (on) {
                                          setState(() {
                                            if (on) {
                                              _sportIds.add(s.id);
                                            } else if (_sportIds.length > 1) {
                                              _sportIds.remove(s.id);
                                            }
                                          });
                                        },
                                      ),
                                  ],
                                );
                              },
                            ),
                            const SizedBox(height: 12),
                            TextField(
                              controller: _address,
                              decoration: const InputDecoration(
                                labelText: 'Address',
                              ),
                            ),
                            Align(
                              alignment: Alignment.centerLeft,
                              child: TextButton(
                                onPressed: _geocodingInfoAddress
                                    ? null
                                    : _fillAddressFromMap,
                                child: Text(
                                  _geocodingInfoAddress
                                      ? 'Looking up…'
                                      : 'Fill from map location',
                                ),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton(
                                    onPressed: () async {
                                      final t = await showTimePicker(
                                        context: context,
                                        initialTime:
                                            _opens ??
                                            const TimeOfDay(hour: 6, minute: 0),
                                      );
                                      if (t != null) setState(() => _opens = t);
                                    },
                                    child: Text(
                                      _opens == null
                                          ? 'Opens'
                                          : timeOfDayToHm(_opens!),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: OutlinedButton(
                                    onPressed: () async {
                                      final t = await showTimePicker(
                                        context: context,
                                        initialTime:
                                            _closes ??
                                            const TimeOfDay(
                                              hour: 22,
                                              minute: 0,
                                            ),
                                      );
                                      if (t != null) {
                                        setState(() => _closes = t);
                                      }
                                    },
                                    child: Text(
                                      _closes == null
                                          ? 'Closes'
                                          : timeOfDayToHm(_closes!),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            TextField(
                              controller: _surface,
                              decoration: const InputDecoration(
                                labelText: 'Surface',
                              ),
                            ),
                            const SizedBox(height: 8),
                            DropdownButtonFormField<bool?>(
                              // Rebuild with the court's value once it loads.
                              key: ValueKey('lighting-$_infoSyncedForCourtId'),
                              initialValue: _lighting,
                              decoration: const InputDecoration(
                                labelText: 'Lighting',
                              ),
                              items: const [
                                DropdownMenuItem(
                                  value: null,
                                  child: Text('Not specified'),
                                ),
                                DropdownMenuItem(
                                  value: true,
                                  child: Text('Lit at night'),
                                ),
                                DropdownMenuItem(
                                  value: false,
                                  child: Text('No lights'),
                                ),
                              ],
                              onChanged: (v) => setState(() => _lighting = v),
                            ),
                            const SizedBox(height: 8),
                            TextField(
                              controller: _description,
                              maxLines: 3,
                              decoration: const InputDecoration(
                                labelText: 'Description',
                              ),
                            ),
                            const SizedBox(height: 12),
                            PrimaryButton(
                              onPressed: _savingInfo ? null : _saveCourtInfo,
                              child: _savingInfo
                                  ? const SizedBox(
                                      height: 20,
                                      width: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Text('SAVE COURT INFO'),
                            ),
                            if (_infoError != null)
                              Padding(
                                padding: const EdgeInsets.only(top: 8),
                                child: Text(
                                  _infoError!,
                                  style: TextStyle(
                                    color: Theme.of(context).colorScheme.error,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                  if (c.status == 'pending')
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            const Icon(Icons.hourglass_top, size: 20),
                            const SizedBox(width: 10),
                            const Expanded(
                              child: Text(
                                'Waiting for review. Only you can see this court.',
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  _StatusCard(court: c),
                  const SizedBox(height: 14),
                  if (c.status == 'approved')
                    CourtActions(court: c, onChanged: load),
                  const SizedBox(height: 16),
                  Text('GAMES', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  if (c.games.isEmpty)
                    const Text(
                      'No games yet. Create one and players nearby will see it.',
                    ),
                  for (final g in c.games)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: GameCard(
                        game: g,
                        showCourt: false,
                        onTap: () => openGameScreen(context, g.id),
                      ),
                    ),
                  if (!canEditCourt) ...[
                    const SizedBox(height: 16),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'COURT INFO',
                              style: Theme.of(context).textTheme.titleLarge,
                            ),
                            const SizedBox(height: 8),
                            _infoRow(
                              'Sports',
                              Wrap(
                                spacing: 10,
                                runSpacing: 6,
                                children: [
                                  for (final s in c.sports) SportInline(s),
                                ],
                              ),
                            ),
                            _info('Address', c.address),
                            _info('Opening hours', c.openingHours),
                            _info('Surface', c.surface),
                            _infoRow(
                              'Lighting',
                              c.lighting == null
                                  ? const Text('—')
                                  : c.lighting!
                                  ? const Row(
                                      children: [
                                        Icon(Icons.lightbulb_outline, size: 18),
                                        SizedBox(width: 6),
                                        Text('Lit at night'),
                                      ],
                                    )
                                  : const Text('No lights'),
                            ),
                            if (c.description != null) ...[
                              const SizedBox(height: 8),
                              Text(c.description!),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _info(String label, String? value) =>
      _infoRow(label, Text(value ?? '—'));

  Widget _infoRow(String label, Widget value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 120,
          child: Text(
            label,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
        Expanded(child: value),
      ],
    ),
  );
}

class AddCourtScreen extends StatefulWidget {
  const AddCourtScreen({super.key});
  @override
  State<AddCourtScreen> createState() => _AddCourtScreenState();
}

class _AddCourtScreenState extends State<AddCourtScreen> {
  static const _mapMinZoom = 10.0;
  static const _mapMaxZoom = 19.0;

  final _name = TextEditingController();
  final _description = TextEditingController();
  final _address = TextEditingController();
  final _courtMap = MapController();
  LatLng? _where;
  List<Sport> _sports = [];
  final Set<String> _sportIds = {};
  final List<String> _photos = [];
  bool _busy = false,
      _uploading = false,
      _done = false,
      _geocodingAddress = false;
  bool _mapExpanded = false;
  bool _courtMapReady = false;
  Court? _doneCourt;
  bool _reusedNearby = false;
  String? _error;
  TimeOfDay? _opensAt;
  TimeOfDay? _closesAt;
  LocationState? _loc;

  @override
  void initState() {
    super.initState();
    _loc = context.read<LocationState>();
    _loc!.addListener(_onLocationUpdate);
    if (_loc!.status == LocationStatus.unknown) {
      unawaited(_loc!.start());
    }
    context
        .read<Api>()
        .get('/api/sports')
        .then((j) {
          if (!mounted) return;
          final list = [for (final s in j) Sport.fromJson(s)];
          final user = context.read<AuthState>().user;
          final preferred = user?.preferredSportId;
          setState(() {
            _sports = list;
            if (preferred != null && !(user?.isAdmin ?? false)) {
              _sportIds
                ..clear()
                ..add(preferred);
            }
          });
        })
        .catchError((_) {});
  }

  void _onLocationUpdate() {
    final p = _loc?.position;
    if (p == null || _where != null || !mounted) return;
    unawaited(_setCourtPin(p));
  }

  @override
  void dispose() {
    _loc?.removeListener(_onLocationUpdate);
    _name.dispose();
    _description.dispose();
    _address.dispose();
    _courtMap.dispose();
    super.dispose();
  }

  void _zoomCourtMap(double delta) {
    if (!_courtMapReady) return;
    final cam = _courtMap.camera;
    final z = (cam.zoom + delta).clamp(_mapMinZoom, _mapMaxZoom);
    _courtMap.move(cam.center, z);
  }

  void _centerCourtMapOn(LatLng p) {
    if (!_courtMapReady) return;
    final z = _courtMap.camera.zoom.clamp(_mapMinZoom, _mapMaxZoom);
    _courtMap.move(p, z < 14 ? 16 : z);
  }

  Future<void> _setCourtPin(LatLng p) async {
    if (!mounted) return;
    setState(() {
      _where = p;
      _geocodingAddress = true;
    });
    _centerCourtMapOn(p);
    final addr = await reverseGeocode(p.latitude, p.longitude);
    if (!mounted) return;
    if (addr != null) _address.text = addr;
    setState(() => _geocodingAddress = false);
  }

  void _pinMyPosition(LatLng p) => unawaited(_setCourtPin(p));

  String? _placementSportSlug() {
    if (_sportIds.isEmpty) return null;
    final id = _sportIds.first;
    return _sports.where((s) => s.id == id).firstOrNull?.slug;
  }

  Future<void> _addPhoto() async {
    final api = context.read<Api>();
    final f = await pickImageFile(context, maxWidth: 1600, imageQuality: 85);
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
    if (_where == null) {
      return setState(() => _error = 'Tap the map to place the court.');
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      String? openingHours;
      if (_opensAt != null && _closesAt != null) {
        openingHours = formatOpeningHours(
          timeOfDayToHm(_opensAt!),
          timeOfDayToHm(_closesAt!),
        );
      }
      final j = await context.read<Api>().post('/api/courts', {
        'name': _name.text.trim(),
        'latitude': _where!.latitude,
        'longitude': _where!.longitude,
        'sport_ids': _sportIds.toList(),
        'description': _description.text.trim().isEmpty
            ? null
            : _description.text.trim(),
        'photos': _photos,
        'opening_hours': ?openingHours,
        if (_address.text.trim().isNotEmpty) 'address': _address.text.trim(),
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

  Widget _courtMapStack(LocationState loc) {
    final loadingOverlay = Theme.of(context).colorScheme.surface.withValues(alpha: 0.72);
    return Stack(
      children: [
        IgnorePointer(
          ignoring: !_courtMapReady,
          child: FlutterMap(
            key: const ValueKey('add-court-map'),
            mapController: _courtMap,
            options: MapOptions(
              initialCenter: _where ?? loc.position ?? loc.center,
              initialZoom: 16,
              minZoom: _mapMinZoom,
              maxZoom: _mapMaxZoom,
              initialRotation: 0,
              onMapReady: () {
                if (!mounted) return;
                final p = loc.position;
                final autoPin = _where == null && p != null;
                setState(() => _courtMapReady = true);
                if (autoPin) unawaited(_setCourtPin(p));
              },
              onTap: (_, p) => unawaited(_setCourtPin(p)),
              interactionOptions: InteractionOptions(
                flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
                cursorKeyboardRotationOptions: CursorKeyboardRotationOptions.disabled(),
              ),
            ),
            children: [
              TileLayer(
                urlTemplate: mapboxTileUrl(dark: Theme.of(context).brightness == Brightness.dark),
                userAgentPackageName: 'com.findthegame.find_the_game',
                retinaMode: RetinaMode.isHighDensity(context),
              ),
              if (loc.position != null)
                MarkerLayer(
                  markers: [
                    Marker(
                      point: loc.position!,
                      width: 22,
                      height: 22,
                      child: Container(
                        decoration: BoxDecoration(
                          color: const Color(0xFF3B82F6),
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 3),
                          boxShadow: const [BoxShadow(blurRadius: 6, color: Colors.black26)],
                        ),
                      ),
                    ),
                  ],
                ),
              if (_where != null)
                MarkerLayer(
                  markers: [
                    Marker(
                      point: _where!,
                      width: CourtMapPin.size + 12,
                      height: CourtMapPin.totalHeight,
                      alignment: Alignment.topCenter,
                      child: CourtMapPin.placement(
                        placementSportSlug: _placementSportSlug(),
                        placementPhotoUrl: _photos.firstOrNull,
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ),
        if (!_courtMapReady)
          Positioned.fill(
            child: ColoredBox(
              color: loadingOverlay,
              child: const Center(
                child: SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 2)),
              ),
            ),
          ),
        Positioned(
          left: 10,
          bottom: 10,
          child: Material(
            elevation: 2,
            borderRadius: BorderRadius.circular(12),
            color: Theme.of(context).colorScheme.surface,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  tooltip: 'Zoom in',
                  visualDensity: VisualDensity.compact,
                  onPressed: _courtMapReady ? () => _zoomCourtMap(1) : null,
                  icon: const Icon(Icons.add),
                ),
                Divider(height: 1, color: Theme.of(context).dividerColor),
                IconButton(
                  tooltip: 'Zoom out',
                  visualDensity: VisualDensity.compact,
                  onPressed: _courtMapReady ? () => _zoomCourtMap(-1) : null,
                  icon: const Icon(Icons.remove),
                ),
              ],
            ),
          ),
        ),
        if (loc.position != null)
          Positioned(
            right: 10,
            bottom: 10,
            child: Material(
              elevation: 2,
              borderRadius: BorderRadius.circular(12),
              color: Theme.of(context).colorScheme.surface,
              child: IconButton(
                tooltip: 'Pin my position',
                onPressed: () => _pinMyPosition(loc.position!),
                icon: const Icon(Icons.my_location),
              ),
            ),
          ),
      ],
    );
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
          child: Column(
            children: [
              const Spacer(),
              const Icon(
                Icons.check_circle_outline,
                size: 64,
                color: Palette.brand,
              ),
              const SizedBox(height: 16),
              Text(
                _reusedNearby ? 'Court already here' : 'Court on the map',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                _reusedNearby
                    ? 'Nobody was playing at this spot — use this court and start a game for others to join.'
                    : 'It’s on the map now (pending review). Anyone nearby can create a game when the court is quiet.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              const Spacer(flex: 2),
            ],
          ),
        ),
        bottomNavigationBar: StickyScreenActions(
          children: [
            PrimaryButton(
              onPressed: () => Navigator.pushReplacement(
                context,
                MaterialPageRoute(
                  builder: (_) => CreateGameScreen(courtId: c.id),
                ),
              ),
              child: const Text('CREATE A GAME'),
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: () => Navigator.pop(context, c),
              child: const Text('VIEW ON MAP'),
            ),
          ],
        ),
      );
    }

    if (_mapExpanded) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('PLACE COURT'),
          leading: IconButton(
            icon: const Icon(Icons.close),
            onPressed: () => setState(() => _mapExpanded = false),
          ),
        ),
        body: Column(
          children: [
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: _courtMapStack(loc),
                ),
              ),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: PrimaryButton(
                  onPressed: () => setState(() => _mapExpanded = false),
                  child: const Text('DONE'),
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('ADD A COURT')),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
            child: Row(
              children: [
                const Text(
                  'Location',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                const Spacer(),
                TextButton.icon(
                  onPressed: () => setState(() => _mapExpanded = true),
                  icon: const Icon(Icons.fullscreen),
                  label: const Text('Expand map'),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: SizedBox(
                height: 220,
                child: _courtMapStack(loc),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    _where == null
                        ? 'Blue dot = you. Tap the map or pin your position for the court.'
                        : 'Court pin matches the main map. Tap the map to move it.',
                    style: TextStyle(
                      fontSize: 13,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
                if (loc.position != null)
                  TextButton(
                    onPressed: () => _pinMyPosition(loc.position!),
                    child: const Text('Pin my position'),
                  ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                TextField(
                  controller: _name,
                  decoration: const InputDecoration(
                    labelText: 'Name',
                    hintText: 'e.g. Terrain Mockeyville',
                  ),
                ),
                const SizedBox(height: 16),
                Builder(
                  builder: (context) {
                    final user = context.watch<AuthState>().user;
                    final locked = sportForUser(
                      user,
                      _sports.where((s) => s.active).toList(),
                    );
                    if (locked != null && !(user?.isAdmin ?? false)) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Sport',
                            style: TextStyle(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 6),
                          SportInline(locked, iconSize: 20),
                        ],
                      );
                    }
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Sports',
                          style: TextStyle(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            for (final s in _sports)
                              ChoiceTile(
                                leading: SportIcon(s.slug, size: 20),
                                label: s.name,
                                selected: _sportIds.contains(s.id),
                                onTap: () => setState(
                                  () => _sportIds.contains(s.id)
                                      ? _sportIds.remove(s.id)
                                      : _sportIds.add(s.id),
                                ),
                              ),
                          ],
                        ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 16),
                const Text(
                  'Photos (optional)',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final p in _photos)
                      Stack(
                        clipBehavior: Clip.none,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.network(
                              resolveMediaUrl(p),
                              width: 72,
                              height: 72,
                              fit: BoxFit.cover,
                              errorBuilder: (_, _, _) =>
                                  const Icon(Icons.broken_image_outlined),
                            ),
                          ),
                          Positioned(
                            right: -4,
                            top: -4,
                            child: Material(
                              color: Theme.of(context).colorScheme.surface,
                              shape: const CircleBorder(),
                              elevation: 2,
                              child: InkWell(
                                customBorder: const CircleBorder(),
                                onTap: () => setState(
                                  () => _photos.removeWhere((x) => x == p),
                                ),
                                child: const Padding(
                                  padding: EdgeInsets.all(4),
                                  child: Icon(Icons.close, size: 16),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    if (_photos.length < 6)
                      InkWell(
                        onTap: _uploading ? null : _addPhoto,
                        child: Container(
                          width: 72,
                          height: 72,
                          decoration: BoxDecoration(
                            border: Border.all(
                              color: Theme.of(context).dividerColor,
                              width: 2,
                            ),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Center(
                            child: _uploading
                                ? const CircularProgressIndicator()
                                : const Icon(Icons.add_a_photo_outlined),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _address,
                  decoration: InputDecoration(
                    labelText: 'Address (optional)',
                    hintText: _geocodingAddress
                        ? 'Looking up from map…'
                        : 'Filled from the pin — you can edit',
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Opening hours (optional)',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () async {
                          final t = await showTimePicker(
                            context: context,
                            initialTime:
                                _opensAt ?? const TimeOfDay(hour: 6, minute: 0),
                          );
                          if (t != null) setState(() => _opensAt = t);
                        },
                        child: Text(
                          _opensAt == null ? 'Opens' : timeOfDayToHm(_opensAt!),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () async {
                          final t = await showTimePicker(
                            context: context,
                            initialTime:
                                _closesAt ??
                                const TimeOfDay(hour: 22, minute: 0),
                          );
                          if (t != null) setState(() => _closesAt = t);
                        },
                        child: Text(
                          _closesAt == null
                              ? 'Closes'
                              : timeOfDayToHm(_closesAt!),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _description,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Description (optional)',
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: StickyScreenActions(
        children: [
          ErrorBanner(_error),
          PrimaryButton(
            onPressed:
                _busy ||
                    _uploading ||
                    _sportIds.isEmpty ||
                    _name.text.trim().length < 2
                ? null
                : _submit,
            child: Text(_busy ? '…' : 'SUBMIT COURT'),
          ),
        ],
      ),
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
      await context.read<Api>().post('/api/courts/${widget.courtId}/reports', {
        'type': _type,
        'description': _details.text,
      });
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
      return Scaffold(
        appBar: AppBar(),
        body: const EmptyState(
          icon: Icons.check_circle_outline,
          title: 'Thanks for the report',
          body: 'An admin will review it.',
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('REPORT COURT')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
        children: [
          const Text(
            "What's wrong?",
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          for (final e in reportLabels.entries)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: ChoiceTile(
                label: e.value,
                selected: _type == e.key,
                onTap: () => setState(() => _type = e.key),
              ),
            ),
          const SizedBox(height: 8),
          TextField(
            controller: _details,
            maxLines: 3,
            maxLength: 1000,
            decoration: const InputDecoration(labelText: 'Details (optional)'),
          ),
        ],
      ),
      bottomNavigationBar: StickyScreenActions(
        children: [
          ErrorBanner(_error),
          PrimaryButton(
            onPressed: _type == null || _busy ? null : _submit,
            child: Text(_busy ? '…' : 'SEND REPORT'),
          ),
        ],
      ),
    );
  }
}
