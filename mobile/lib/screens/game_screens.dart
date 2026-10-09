import 'dart:async';

import 'package:flutter/material.dart';
import '../core/pick_image.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/media_url.dart';
import '../core/auth.dart';
import '../core/format.dart';
import '../core/game_join.dart';
import '../core/game_share.dart';
import '../core/guide.dart';
import '../core/l10n.dart';
import '../core/location.dart';
import '../core/models.dart';
import '../core/map_pause.dart';
import '../core/nearby.dart';
import '../core/my_sport.dart';
import '../core/realtime.dart';
import '../ui/theme.dart';
import '../ui/app_icons.dart';
import '../ui/screen_guide.dart';
import '../ui/share_image.dart';
import '../ui/widgets.dart';
import 'court_move.dart';
import 'court_screens.dart' show AddCourtScreen, CourtDetailsScreen;
import 'game_scoreboard.dart';
import 'game_weather.dart';
import 'profile_screen.dart';

/// Push game detail after routes settle (avoids semantics asserts when closing sheets).
void openGameScreen(BuildContext context, String gameId, {VoidCallback? onReturn}) {
  openGameOnNavigator(
    Navigator.of(context, rootNavigator: true),
    context.read<MapPause>(),
    gameId,
    onReturn: onReturn,
  );
}

void openGameOnNavigator(NavigatorState nav, MapPause pause, String gameId, {VoidCallback? onReturn}) {
  pause.pushOverlay();

  void push() {
    if (!nav.mounted) {
      pause.popOverlay();
      return;
    }
    nav.push<void>(MaterialPageRoute(builder: (_) => GameScreen(gameId: gameId))).whenComplete(() {
      pause.popOverlay();
      if (onReturn != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) => onReturn());
      }
    });
  }

  // One frame lets modal routes (court sheet) finish popping before we push.
  WidgetsBinding.instance.addPostFrameCallback((_) => push());
}

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
  bool _guideQueued = false;
  List<PublicUser> _friends = const [];

  @override
  void initState() {
    super.initState();
    _load();
    _loadFriends();
    // Player count updates live: someone joins → 7/10 becomes 8/10.
    _rt = context.read<Realtime>().events.listen((ev) {
      if (ev['game_id'] != widget.gameId && ev['type'] != 'reconnected') return;
      if (!mounted) return;
      final route = ModalRoute.of(context);
      if (route != null && !route.isCurrent) return;
      _loadDebounce?.cancel();
      _loadDebounce = Timer(const Duration(milliseconds: 500), _load);
    });
  }

  @override
  void dispose() {
    _loadDebounce?.cancel();
    _rt?.cancel();
    _invite.dispose();
    super.dispose();
  }

  void _applyGame(Game? game, {String? error}) {
    if (game != null) {
      _game = game;
      _error = null;
      if (!_guideQueued) {
        _guideQueued = true;
        ScreenGuide.maybeShow(context, screen: GuideScreen.game, tips: [
          GuideTip(
            icon: const Icon(Icons.person_add),
            title: tr('Bring your crew', 'Venez avec votre équipe'),
            body: tr('Invite friends by @username, keep the score and share the result when you’re done.',
                'Invitez vos amis par @pseudo, notez le score et partagez le résultat à la fin.'),
          ),
        ]);
      }
    }
    if (error != null) _error = error;
    _scheduleRebuild();
  }

  void _scheduleRebuild() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() {});
    });
  }

  Future<void> _load() async {
    try {
      final j = await context.read<Api>().get('/api/games/${widget.gameId}?${context.read<LocationState>().query}');
      if (!mounted) return;
      _applyGame(Game.fromJson(j), error: null);
    } catch (e) {
      if (!mounted) return;
      _applyGame(null, error: errorText(e));
    }
  }

  Future<void> _loadFriends() async {
    try {
      final j = await context.read<Api>().get('/api/me/friends');
      final list = [for (final f in j as List) PublicUser.fromJson(Map<String, dynamic>.from(f))];
      if (mounted) setState(() => _friends = list);
    } catch (_) {
      // Friends are a shortcut; typing a @username still works.
    }
  }

  Future<void> _action(String action, {String? reason}) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final g = _game;
      Object? body;
      if (action == 'cancel') {
        body = {'reason': reason};
      } else if (action == 'join' && g != null) {
        body = await prepareGameJoin(context, live: g.isLive, courtLat: g.courtLat, courtLng: g.courtLng);
        if (body == null || !mounted) return;
      }
      final j = await context.read<Api>().post('/api/games/${widget.gameId}/$action', body);
      if (mounted) setState(() => _game = Game.fromJson(j));
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _shareGame(Game g, Rect? origin) async {
    try {
      final copied = await shareGame(context.read<Api>(), g, origin: origin);
      if (copied && mounted) showSnack(context, tr('Game link copied — share it with friends', 'Lien du match copié — partagez-le avec vos amis'));
    } catch (e) {
      if (mounted) showSnack(context, errorText(e));
    }
  }

  Future<void> _sendInvite() async {
    final name = _invite.text.trim().replaceFirst('@', '');
    if (name.isEmpty) return;
    try {
      await context.read<Api>().post('/api/games/${widget.gameId}/invite', {'username': name});
      _invite.clear();
      if (mounted) setState(() {});
      if (mounted) showSnack(context, tr('Invited @$name — they\'ll get a notification.', '@$name est invité — il va recevoir une notification.'));
    } catch (e) {
      if (!mounted) return;
      if (e is ApiException && e.code == 'user_not_found') {
        await showAppAlert(context, title: tr('Player not found', 'Joueur introuvable'), message: apiUserMessage(e));
      } else {
        showSnack(context, errorText(e));
      }
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
      'active' => (gameStatusLabel('active'), Icons.local_fire_department, Palette.live),
      'scheduled' => (gameStatusLabel('scheduled'), Icons.schedule, Palette.idle),
      'completed' => (gameStatusLabel('completed'), Icons.check, Palette.idle),
      _ => (gameStatusLabel('cancelled'), Icons.close, Theme.of(context).colorScheme.error),
    };
    final isCreator = g.creatorId == me?.id;
    final isAdmin = me?.isAdmin == true;

    return Scaffold(
      appBar: AppBar(
        title: Text('${gameTypeLabels[g.gameType]} ${g.sport.name}'.toUpperCase()),
        actions: [
          Builder(
            builder: (btn) => IconButton(
              tooltip: tr('Share game', 'Partager le match'),
              icon: const Icon(Icons.share_outlined),
              onPressed: () => _shareGame(g, shareOriginOfContext(btn)),
            ),
          ),
        ],
      ),
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
                // Web GamePage: the court name links to the court page.
                InkWell(
                  borderRadius: BorderRadius.circular(8),
                  onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => CourtDetailsScreen(courtId: g.courtId))),
                  child: Row(children: [
                    SportIcon(g.sport.slug, size: 28, color: Theme.of(context).colorScheme.primary),
                    const SizedBox(width: 10),
                    Expanded(child: Text(g.courtName.toUpperCase(), style: Theme.of(context).textTheme.headlineMedium)),
                    Icon(Icons.chevron_right, color: Theme.of(context).colorScheme.onSurfaceVariant),
                  ]),
                ),
                if (g.distanceM != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Row(children: [
                      Icon(Icons.place, size: 16, color: Theme.of(context).colorScheme.onSurfaceVariant),
                      const SizedBox(width: 4),
                      Text(tr('${formatDistance(g.distanceM)} away', 'à ${formatDistance(g.distanceM)}')),
                    ]),
                  ),
                const SizedBox(height: 18),
                Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text(gamePlayerCountLabel(g.playerCount, g.maxPlayers),
                      style: const TextStyle(fontSize: 52, fontWeight: FontWeight.w900, height: 1)),
                  const Spacer(),
                  Text(
                    g.unlimitedPlayers
                        ? tr('Open to all', 'Ouvert à tous')
                        : g.spotsLeft == 0
                            ? tr('Full', 'Complet')
                            : g.spotsLeft == 1
                                ? tr('1 spot left', '1 place restante')
                                : tr('${g.spotsLeft} spots left', '${g.spotsLeft} places restantes'),
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: g.unlimitedPlayers || g.spotsLeft > 0
                          ? Palette.live
                          : Theme.of(context).colorScheme.error,
                    ),
                  ),
                ]),
                if (!g.unlimitedPlayers) ...[
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: LinearProgressIndicator(
                      value: g.playerCount / g.maxPlayers,
                      minHeight: 12,
                      color: Palette.live,
                    ),
                  ),
                ],
                const SizedBox(height: 14),
                Wrap(spacing: 12, runSpacing: 6, children: [
                  Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.star, size: 16, color: Theme.of(context).colorScheme.onSurfaceVariant),
                    const SizedBox(width: 4),
                    Text(skillLabels[g.skillLevel] ?? g.skillLevel),
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
                  Text(tr('Reason: ${g.cancelledReason}', 'Raison : ${g.cancelledReason}'), style: TextStyle(color: Theme.of(context).colorScheme.error)),
                const SizedBox(height: 18),
                ErrorBanner(_error),
                if (g.isOpen)
                  g.joined
                      ? OutlinedButton(
                          style: OutlinedButton.styleFrom(foregroundColor: Theme.of(context).colorScheme.error),
                          onPressed: _busy ? null : () => _action('leave'),
                          child: Text(tr('LEAVE GAME', 'QUITTER LE MATCH')),
                        )
                      : FilledButton(
                          style: FilledButton.styleFrom(backgroundColor: Palette.live),
                          onPressed: _busy || !gameHasOpenSpots(g) ? null : () => _action('join'),
                          child: Text(gameHasOpenSpots(g) ? tr('JOIN GAME', 'REJOINDRE LE MATCH') : tr('GAME FULL', 'MATCH COMPLET')),
                        ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: () => openDirections(g.courtLat, g.courtLng),
                  icon: const Icon(Icons.navigation_outlined),
                  label: Text(tr('GET DIRECTIONS', 'ITINÉRAIRE')),
                ),
                if (g.isOpen && (isCreator || isAdmin)) ...[
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    onPressed: () async {
                      final moved = await showMoveCourtSheet(context,
                          kind: 'game', id: g.id, sportId: g.sportId, sportSlug: g.sport.slug,
                          courtId: g.courtId, courtName: g.courtName, lat: g.courtLat, lng: g.courtLng);
                      if (moved == true) _load();
                    },
                    icon: const Icon(Icons.edit_location_alt_outlined),
                    label: Text(tr('CHANGE COURT', 'CHANGER DE TERRAIN')),
                  ),
                ],
                if (g.isOpen && isCreator)
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () async {
                            final reason = await _askReason(context);
                            if (reason != null) _action('cancel', reason: reason);
                          },
                    child: Text(tr('Cancel game', 'Annuler le match')),
                  ),
              ]),
            ),
          ),
          if (g.isOpen) ...[
            const SizedBox(height: 12),
            GameWeather(
              key: ValueKey('weather-${g.id}'),
              game: g,
              isHost: isCreator || isAdmin,
              onCallOff: (reason) => _action('cancel', reason: reason),
              onChanged: _load,
            ),
          ],
          if (g.isOpen && g.joined) ...[
            const SizedBox(height: 12),
            if (inviteFriends(_friends, g).isNotEmpty) ...[
              Text(tr('Friends', 'Amis'), style: const TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Wrap(spacing: 6, runSpacing: 4, children: [
                for (final f in inviteFriends(_friends, g))
                  ChoiceChip(
                    avatar: UserAvatar(f, size: 22),
                    label: Text('@${f.username}'),
                    selected: _invite.text.trim().replaceFirst(RegExp(r'^@'), '') == f.username,
                    onSelected: (_) => setState(() => _invite.text = f.username),
                  ),
              ]),
              const SizedBox(height: 8),
            ],
            Row(children: [
              Expanded(
                child: TextField(
                  controller: _invite,
                  textInputAction: TextInputAction.send,
                  autocorrect: false,
                  onChanged: (_) => setState(() {}),
                  onSubmitted: (_) => _sendInvite(),
                  decoration: InputDecoration(hintText: tr('Invite by @username', 'Inviter par @pseudo'), isDense: true),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton.tonal(
                style: FilledButton.styleFrom(
                  minimumSize: const Size(0, 48),
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                onPressed: _sendInvite,
                child: Text(tr('INVITE', 'INVITER')),
              ),
            ]),
          ],
          if (g.status != 'cancelled') ...[
            const SizedBox(height: 20),
            GameScoreboard(key: ValueKey('scoreboard-${g.id}'), game: g, canEdit: isCreator || g.joined || isAdmin),
          ],
          const SizedBox(height: 20),
          Text(tr('PLAYERS', 'JOUEURS'), style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          for (final p in g.players)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: UserAvatar(p),
              title: Text('@${p.username}', style: const TextStyle(fontWeight: FontWeight.w600)),
              trailing: p.id == g.creatorId ? Text(tr('HOST', 'ORGANISATEUR'), style: const TextStyle(color: Palette.brand, fontWeight: FontWeight.w900)) : null,
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
        title: Text(tr('Cancel this game for everyone?', 'Annuler ce match pour tout le monde ?')),
        content: TextField(controller: c, decoration: InputDecoration(hintText: tr('Reason (shown to players)', 'Raison (visible par les joueurs)'))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(tr('Keep it', 'Le garder'))),
          FilledButton(onPressed: () => Navigator.pop(ctx, c.text), child: Text(tr('Cancel game', 'Annuler le match'))),
        ],
      ),
    );
  }
}

class CreateGameScreen extends StatefulWidget {
  final String? courtId;
  /// Sport picked in the map's top filter; courts follow it.
  final String? sportSlug;
  const CreateGameScreen({super.key, this.courtId, this.sportSlug});
  @override
  State<CreateGameScreen> createState() => _CreateGameScreenState();
}

class _CreateGameScreenState extends State<CreateGameScreen> {
  List<Court> _courts = [];
  List<Sport> _mySports = const [];
  bool _courtsLoading = true;
  String? _courtsError;
  String? _loadedAt;
  String? _courtId;
  String? _sportId;
  bool _now = true;
  DateTime _start = DateTime.now().add(const Duration(hours: 1));
  int _maxSlider = 10;
  String _skill = 'all_levels';
  String _type = 'pickup';
  bool _busy = false;
  bool _uploading = false;
  String? _error;
  Game? _created;
  final List<String> _placePhotos = [];

  @override
  void initState() {
    super.initState();
    _courtId = widget.courtId;
    unawaited(_loadCourts());
  }

  /// Rounded center, so the list reloads when the GPS fix moves us, not on jitter.
  static String _centerKey(LatLng c) => '${c.latitude.toStringAsFixed(2)},${c.longitude.toStringAsFixed(2)}';

  /// Courts for any of my sports (main + extras), nearest first. Admins see all.
  Future<void> _loadCourts() async {
    final api = context.read<Api>();
    final user = context.read<AuthState>().user;
    final c = context.read<LocationState>().center;
    _loadedAt = _centerKey(c);
    setState(() {
      _courtsLoading = true;
      _courtsError = null;
    });
    try {
      final sportsJ = await api.get('/api/sports');
      final catalog = [for (final x in sportsJ) Sport.fromJson(x)];
      final isAdmin = user?.isAdmin ?? false;
      final mine = isAdmin ? catalog.where((s) => s.active).toList() : sportsForUser(user, catalog).where((s) => s.active).toList();
      final slugs = isAdmin ? <String?>[null] : [for (final s in mine) s.slug];
      final base = '/api/courts/nearby?lat=${c.latitude}&lng=${c.longitude}&radius_km=$listNearbyRadiusKm';
      final results = await Future.wait([for (final slug in slugs) api.get(slug == null ? base : '$base&sport=$slug')]);
      if (!mounted) return;
      final byId = <String, Court>{};
      for (final j in results) {
        for (final x in j) {
          final court = Court.fromJson(x);
          byId[court.id] = court;
        }
      }
      final courts = byId.values.toList()..sort((a, b) => (a.distanceM ?? double.infinity).compareTo(b.distanceM ?? double.infinity));
      setState(() {
        _courts = courts;
        _mySports = mine;
        _courtsLoading = false;
        // Same as the map: its filter, else the court I came from, else my main sport.
        if (_sportId == null || !mine.any((s) => s.id == _sportId)) {
          final fromMap = mine.where((s) => s.slug == widget.sportSlug).firstOrNull;
          final fromCourt = courts.where((c) => c.id == widget.courtId).firstOrNull;
          final courtSport = fromCourt == null ? null : mine.where((m) => fromCourt.sports.any((cs) => cs.id == m.id)).firstOrNull;
          final main = mine.where((s) => s.id == user?.preferredSportId).firstOrNull;
          _sportId = (fromMap ?? courtSport ?? main ?? mine.firstOrNull)?.id;
        }
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _courtsLoading = false;
          _courtsError = errorText(e);
        });
      }
    }
  }

  Future<void> _addPlacePhoto() async {
    final api = context.read<Api>();
    final f = await pickImageFile(context, maxWidth: 1600, imageQuality: 85);
    if (f == null) return;
    setState(() {
      _uploading = true;
      _error = null;
    });
    try {
      final bytes = await f.readAsBytes();
      if (bytes.isEmpty) {
        setState(() => _error = tr('Could not read that image. Try another photo.', 'Impossible de lire cette image. Essaie une autre photo.'));
        return;
      }
      final url = await api.upload(bytes, f.name, 'court');
      setState(() {
        if (_placePhotos.isEmpty) _placePhotos.add(url);
      });
    } catch (e) {
      setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
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
      // "Right now" is a live game: like the web (isAtCourt + far modal), get a
      // fresh fix and stop with "You're not at the court" before posting.
      final court = _courts.where((c) => c.id == _courtId).firstOrNull;
      if (_now && court != null) {
        final ok = await prepareGameJoin(context, live: true, courtLat: court.latitude, courtLng: court.longitude);
        if (ok == null || !mounted) return;
      }
      final loc = context.read<LocationState>().position;
      final body = <String, dynamic>{
        'court_id': _courtId,
        'sport_id': sportId,
        'start_time': (_now ? DateTime.now() : _start).toUtc().toIso8601String(),
        'max_players': maxPlayersSliderToApi(_maxSlider),
        'skill_level': _skill,
        'game_type': _type,
        'court_photos': _placePhotos,
      };
      if (_now && loc != null) {
        body['latitude'] = loc.latitude;
        body['longitude'] = loc.longitude;
      }
      final j = await context.read<Api>().post('/api/games', body);
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
      final created = _created!;
      return Scaffold(
        appBar: AppBar(),
        body: Center(
          child: EmptyState(
            icon: sportIconData(created.sport.slug),
            title: tr('Game created successfully.', 'Match créé avec succès.'),
            body: tr("You're in. Players near ${created.courtName} can see it now.",
                'Tu es inscrit. Les joueurs près de ${created.courtName} peuvent le voir dès maintenant.'),
          ),
        ),
        bottomNavigationBar: StickyScreenActions(
          children: [
            PrimaryButton(
              style: FilledButton.styleFrom(backgroundColor: Palette.live),
              onPressed: () {
                final id = created.id;
                final nav = Navigator.of(context, rootNavigator: true);
                final pause = context.read<MapPause>();
                Navigator.pop(context);
                openGameOnNavigator(nav, pause, id);
              },
              child: Text(tr('VIEW GAME', 'VOIR LE MATCH')),
            ),
            const SizedBox(height: 8),
            Builder(
              builder: (btn) => OutlinedButton.icon(
                onPressed: () async {
                  try {
                    final copied = await shareGame(context.read<Api>(), created, origin: shareOriginOfContext(btn));
                    if (copied && context.mounted) showSnack(context, tr('Link copied!', 'Lien copié !'));
                  } catch (e) {
                    if (context.mounted) showSnack(context, errorText(e));
                  }
                },
                icon: const Icon(Icons.share_outlined),
                label: Text(tr('SHARE GAME', 'PARTAGER LE MATCH')),
              ),
            ),
          ],
        ),
      );
    }
    final center = context.watch<LocationState>().center;
    if (_loadedAt != null && _loadedAt != _centerKey(center) && !_courtsLoading) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) unawaited(_loadCourts());
      });
    }
    final sports = _mySports;
    final locked = sports.length == 1 ? sports.first : null;
    final sport = sports.where((s) => s.id == _sportId).firstOrNull ?? sports.firstOrNull;
    // Only courts for the chosen sport, like the map's filter.
    final sportCourts = sport == null ? _courts : _courts.where((c) => c.sports.any((cs) => cs.id == sport.id)).toList();
    final court = sportCourts.where((c) => c.id == _courtId).firstOrNull;
    final courtPhotoCount = court?.photos.where((p) => p.trim().isNotEmpty).length ?? 0;
    final suggestPlacePhoto = court != null && courtPhotoCount == 0 && _placePhotos.isEmpty;

    return Scaffold(
      appBar: AppBar(title: Text(tr('CREATE GAME', 'CRÉER UN MATCH'))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
        children: [
        Text(tr('Sport', 'Sport'), style: const TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        if (locked != null)
          SportInline(locked, iconSize: 20)
        else
          Wrap(spacing: 8, children: [
            for (final s in sports)
              ChoiceTile(
                leading: SportIcon(s.slug, size: 20),
                label: s.name,
                selected: sport?.id == s.id,
                onTap: () => setState(() {
                  _sportId = s.id;
                  final c = _courts.where((x) => x.id == _courtId).firstOrNull;
                  if (c != null && !c.sports.any((cs) => cs.id == s.id)) _courtId = null;
                }),
              ),
          ]),
        const SizedBox(height: 16),
        if (_courtsLoading && _courts.isEmpty)
          const Padding(padding: EdgeInsets.only(bottom: 16), child: LinearProgressIndicator())
        else if (_courtsError != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Row(children: [
              Expanded(child: ErrorBanner(tr('Couldn’t load courts. ', 'Impossible de charger les terrains. ') + _courtsError!)),
              TextButton(onPressed: _loadCourts, child: Text(tr('RETRY', 'RÉESSAYER'))),
            ]),
          )
        else if (sportCourts.isEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Text(
              tr('No ${sport?.name ?? ''} court within $listNearbyRadiusKm km. Pick another sport above, or add a court below.',
                  'Aucun terrain de ${sport?.name ?? ''} à moins de $listNearbyRadiusKm km. Choisis un autre sport ci-dessus, ou ajoute un terrain ci-dessous.'),
              style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
          ),
        DropdownButtonFormField<String>(
          key: ValueKey('courts-${sport?.id}'),
          initialValue: sportCourts.any((c) => c.id == _courtId) ? _courtId : null,
          isExpanded: true,
          decoration: InputDecoration(labelText: tr('Court', 'Terrain')),
          items: [
            for (final c in sportCourts)
              DropdownMenuItem(value: c.id, child: Text('${c.name}  ·  ${formatDistance(c.distanceM)}', overflow: TextOverflow.ellipsis)),
          ],
          onChanged: (v) => setState(() {
            _courtId = v;
            _placePhotos.clear();
          }),
        ),
        // Web CreateGamePage field hint → /courts/new (leaves this form).
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: TextButton(
            style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 4), visualDensity: VisualDensity.compact),
            onPressed: () => Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const AddCourtScreen())),
            child: Text(tr('Court not listed? Add it →', 'Terrain absent de la liste ? Ajoute-le →')),
          ),
        ),
        if (court != null) ...[
          const SizedBox(height: 16),
          Text(
            courtPhotoCount == 0
                ? tr('Photo of the place (recommended)', 'Photo du lieu (recommandée)')
                : tr('Photo of the place (optional)', 'Photo du lieu (facultative)'),
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          Text(
            courtPhotoCount == 0
                ? tr('A photo helps others find the court. You can create the game without one.',
                    'Une photo aide les autres à trouver le terrain. Tu peux quand même créer le match sans photo.')
                : tr('This court already has photos. You can add another.', 'Ce terrain a déjà des photos. Tu peux en ajouter une autre.'),
            style: TextStyle(fontSize: 13, color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final p in court.photos.where((x) => x.trim().isNotEmpty))
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.network(
                    resolveMediaUrl(p),
                    width: 72,
                    height: 72,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => const Icon(Icons.broken_image_outlined),
                  ),
                ),
              for (final p in _placePhotos)
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.network(
                    resolveMediaUrl(p),
                    width: 72,
                    height: 72,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => const Icon(Icons.broken_image_outlined),
                  ),
                ),
              if (courtPhotoCount + _placePhotos.length < 6)
                InkWell(
                  onTap: _uploading ? null : _addPlacePhoto,
                  child: Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      border: Border.all(color: Theme.of(context).dividerColor, width: 2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Center(
                      child: _uploading
                          ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.add_a_photo_outlined),
                    ),
                  ),
                ),
            ],
          ),
        ],
        const SizedBox(height: 16),
        Text(tr('Start time', 'Heure de début'), style: const TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        Row(children: [
          Expanded(
            child: ChoiceTile(
              leading: const Icon(Icons.local_fire_department, size: 18),
              label: tr('Right now', 'Tout de suite'),
              selected: _now,
              onTap: () => setState(() => _now = true),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: ChoiceTile(
              leading: const Icon(Icons.schedule, size: 18),
              label: tr('Later', 'Plus tard'),
              selected: !_now,
              onTap: () => setState(() => _now = false),
            ),
          ),
        ]),
        if (!_now)
          TextButton.icon(onPressed: _pickTime, icon: const Icon(Icons.schedule), label: Text(gameTimeFor(_start))),
        const SizedBox(height: 16),
        Text(tr('Maximum players: ${maxPlayersSliderLabel(_maxSlider)}', 'Nombre max de joueurs : ${maxPlayersSliderLabel(_maxSlider)}'), style: const TextStyle(fontWeight: FontWeight.w700)),
        Slider(
          value: _maxSlider.toDouble(),
          min: maxPlayersSliderMin.toDouble(),
          max: maxPlayersSliderUnlimited.toDouble(),
          divisions: maxPlayersSliderUnlimited - maxPlayersSliderMin,
          label: maxPlayersSliderLabel(_maxSlider),
          onChanged: (v) => setState(() => _maxSlider = v.round()),
        ),
        Text(
          tr('Drag to the end for unlimited players ($maxPlayersSliderCap+).', 'Glissez jusqu’au bout pour un nombre illimité de joueurs ($maxPlayersSliderCap+).'),
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant),
        ),
        // Room for the floating "Skill level" label so it doesn't sit on the helper text.
        const SizedBox(height: 20),
        DropdownButtonFormField<String>(
          initialValue: _skill,
          decoration: InputDecoration(labelText: tr('Skill level', 'Niveau')),
          items: [for (final e in skillLabels.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
          onChanged: (v) => setState(() => _skill = v!),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: _type,
          decoration: InputDecoration(labelText: tr('Game type', 'Type de match')),
          items: [for (final e in gameTypeLabels.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
          onChanged: (v) => setState(() => _type = v!),
        ),
        if (suggestPlacePhoto)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(
              tr('No court photo yet — adding one is recommended but not required.',
                  'Pas encore de photo du terrain — en ajouter une est recommandé, mais pas obligatoire.'),
              style: TextStyle(fontSize: 13, color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
          ),
      ]),
      bottomNavigationBar: StickyScreenActions(
        children: [
          ErrorBanner(_error),
          PrimaryButton(
            onPressed: _busy || _uploading || _courtId == null || sport == null ? null : () => _submit(sport.id),
            child: Text(_busy ? '…' : tr('CREATE GAME', 'CRÉER LE MATCH')),
          ),
        ],
      ),
    );
  }
}

String gameTimeFor(DateTime t) => tr('${t.day}/${t.month} at ${clock(t)}', '${t.day}/${t.month} à ${clock(t)}');

/// Friends that can still be invited: not already in [g].
List<PublicUser> inviteFriends(List<PublicUser> friends, Game g) {
  final inGame = {for (final p in g.players) p.id};
  return [for (final f in friends) if (!inGame.contains(f.id)) f];
}
