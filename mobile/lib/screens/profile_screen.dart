import 'package:flutter/material.dart';
import '../core/l10n.dart';
import '../ui/progress_card.dart';
import 'challenges_screen.dart';
import '../core/pick_image.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/my_sport.dart';
import '../core/player_avatar.dart';
import '../core/notifications.dart';
import '../ui/theme.dart';
import '../ui/app_icons.dart';
import '../core/avatar_presets.dart';
import 'avatar_builder_screen.dart';
import 'bump_connect.dart';
import 'recap_sheet.dart';
import 'sticker_sheet.dart';
import '../ui/widgets.dart';

class _ProfileCard extends StatelessWidget {
  final PublicUser user;
  final List<Sport> sports;
  const _ProfileCard({required this.user, required this.sports});

  @override
  Widget build(BuildContext context) {
    final sport = sports.where((s) => s.id == user.preferredSportId).firstOrNull;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(children: [
          UserAvatar(user, size: 96),
          const SizedBox(height: 12),
          Text('@${user.username}', textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (sport != null) SportInline(sport, iconSize: 18),
              if (sport != null && user.skillLevel != null) const SizedBox(width: 16),
              if (user.skillLevel != null)
                Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.star, size: 16, color: Theme.of(context).colorScheme.onSurfaceVariant),
                  const SizedBox(width: 4),
                  Text(skillLabels[user.skillLevel] ?? user.skillLevel ?? '', style: const TextStyle(fontWeight: FontWeight.w700)),
                ]),
            ],
          ),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(child: _Stat(value: user.gamesPlayed, label: tr('GAMES PLAYED', 'MATCHS JOUÉS'))),
            const SizedBox(width: 10),
            Expanded(child: _Stat(value: user.gamesCreated, label: tr('GAMES CREATED', 'MATCHS CRÉÉS'))),
          ]),
          const SizedBox(height: 12),
          Text(tr('Joined ${localDateFormat('MMMM y').format(user.createdAt)}', 'Inscrit en ${localDateFormat('MMMM y').format(user.createdAt)}'),
              style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
        ]),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final int value;
  final String label;
  const _Stat({required this.value, required this.label});
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(14)),
        child: Column(children: [
          Text('$value', style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w900, color: Palette.brand)),
          Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
        ]),
      );
}

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  List<Sport> _sports = [];

  @override
  void initState() {
    super.initState();
    context.read<AuthState>().refreshMe();
    context.read<Api>().get('/api/sports').then((j) {
      if (mounted) setState(() => _sports = [for (final s in j) Sport.fromJson(s)]);
    }).catchError((_) {});
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final me = auth.user;
    if (me == null) return const SizedBox.shrink();
    return Scaffold(
      appBar: AppBar(title: Text(tr('PROFILE', 'PROFIL')), actions: [
        TextButton(
          onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => EditProfileScreen(sports: _sports))),
          child: Text(tr('Edit', 'Modifier')),
        ),
      ]),
      body: RefreshIndicator(
        onRefresh: auth.refreshMe,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          _ProfileCard(user: me, sports: _sports),
          if (hasSavedAvatar(avatarUrl: me.avatarUrl, avatarConfig: me.avatarConfig)) ...[
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () async {
                final ok = await Navigator.push<bool>(
                  context,
                  MaterialPageRoute(
                    builder: (_) => AvatarBuilderScreen(initialUrl: me.avatarUrl, initialConfig: me.avatarConfig, seed: me.username),
                  ),
                );
                if (ok == true && context.mounted) await auth.refreshMe();
              },
              child: Text(tr('EDIT PLAYER', 'MODIFIER L’AVATAR')),
            ),
          ],
          const SizedBox(height: 12),
          const ProgressCard(),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ChallengesScreen())),
            icon: const Icon(Icons.sports_kabaddi),
            label: Text(tr('MY CHALLENGES', 'MES DÉFIS')),
          ),
          const SizedBox(height: 8),
          RecapButton(me: me, sport: sportSlugForUser(me, _sports)),
          if (!avatarArtOf(me).isEmpty) ...[
            const SizedBox(height: 8),
            StickerButton(art: avatarArtOf(me), sport: me.playerAvatar?.sport ?? sportSlugForUser(me, _sports)),
          ],
          const SizedBox(height: 8),
          const BumpConnectButton(),
          if (me.isAdmin)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Card(
                  child: ListTile(
                      leading: const Icon(Icons.build_outlined),
                      title: Text(tr('Admin tools are in the web dashboard', 'Les outils admin sont dans le tableau de bord web')))),
            ),
          const SizedBox(height: 16),
          OutlinedButton(
            onPressed: () async {
              await context.read<Notifications>().unregisterDevice();
              await auth.logout();
            },
            child: Text(tr('LOG OUT', 'SE DÉCONNECTER')),
          ),
        ]),
      ),
    );
  }
}

class EditProfileScreen extends StatefulWidget {
  final List<Sport> sports;
  const EditProfileScreen({super.key, required this.sports});
  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  late final Me _me = context.read<AuthState>().user!;
  late final _first = TextEditingController(text: _me.firstName);
  late final _last = TextEditingController(text: _me.lastName);
  late final _username = TextEditingController(text: _me.username);
  late String? _sportId = _me.preferredSportId;
  late String _skill = _me.skillLevel ?? 'all_levels';
  late String? _avatar = _me.avatarUrl;
  bool _busy = false;
  String? _error;
  bool get _sportLocked => !_me.isAdmin && _me.preferredSportId != null;

  Future<void> _photo() async {
    final api = context.read<Api>();
    final auth = context.read<AuthState>();
    final f = await pickImageFile(context, maxWidth: 1024, imageQuality: 85);
    if (f == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final bytes = await f.readAsBytes();
      if (bytes.isEmpty) {
        setState(() => _error = tr('Could not read that image. Try another photo.', 'Impossible de lire cette image. Essayez une autre photo.'));
        return;
      }
      final url = await api.upload(bytes, f.name, 'avatar');
      await auth.updateMe({'avatar_url': url});
      if (mounted) setState(() => _avatar = url);
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final patch = <String, dynamic>{
        'first_name': _first.text.trim(),
        'last_name': _last.text.trim(),
        'username': _username.text.trim().replaceFirst(RegExp(r'^@+'), ''),
        'skill_level': _skill,
      };
      if (!_sportLocked && _sportId != null) patch['preferred_sport_id'] = _sportId;
      if (_avatar != null) patch['avatar_url'] = _avatar;
      await context.read<AuthState>().updateMe(patch);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(tr('EDIT PROFILE', 'MODIFIER LE PROFIL'))),
        body: ListView(padding: const EdgeInsets.all(20), children: [
          Center(
            child: SizedBox(
              width: 88,
              height: 88,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  GestureDetector(
                    onTap: _busy ? null : _photo,
                    child: UserAvatar(context.watch<AuthState>().user ?? _me, size: 88, overrideUrl: _avatar),
                  ),
                  if (_busy)
                    ClipOval(
                      child: ColoredBox(
                        color: const Color(0x99FFFFFF),
                        child: const Center(child: SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 2))),
                      ),
                    ),
                ],
              ),
            ),
          ),
          TextButton(onPressed: _busy ? null : _photo, child: Text(tr('Change photo', 'Changer la photo'))),
          TextField(controller: _first, decoration: InputDecoration(labelText: tr('First name', 'Prénom'))),
          const SizedBox(height: 12),
          TextField(controller: _last, decoration: InputDecoration(labelText: tr('Last name', 'Nom'))),
          const SizedBox(height: 12),
          TextField(controller: _username, decoration: InputDecoration(labelText: tr('Username', 'Nom d’utilisateur'))),
          const SizedBox(height: 12),
          if (_sportLocked) ...[
            Text(tr('Sport', 'Sport'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            if (widget.sports.where((s) => s.id == _me.preferredSportId).firstOrNull case final s?)
              SportInline(s)
            else
              const Text('—'),
            const SizedBox(height: 12),
          ] else
            DropdownButtonFormField<String>(
              initialValue: widget.sports.any((s) => s.id == _sportId) ? _sportId : null,
              decoration: InputDecoration(labelText: tr('Preferred sport', 'Sport préféré')),
              items: [
                for (final s in widget.sports.where((s) => s.active))
                  DropdownMenuItem(value: s.id, child: SportInline(s)),
              ],
              onChanged: (v) => setState(() => _sportId = v),
            ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _skill,
            decoration: InputDecoration(labelText: tr('Skill level', 'Niveau')),
            items: [for (final e in skillLabels.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
            onChanged: (v) => setState(() => _skill = v!),
          ),
          const SizedBox(height: 24),
        ]),
        bottomNavigationBar: StickyScreenActions(
          children: [
            ErrorBanner(_error),
            PrimaryButton(onPressed: _busy ? null : _save, child: Text(_busy ? '…' : tr('SAVE', 'ENREGISTRER'))),
          ],
        ),
      );
}

class UserScreen extends StatefulWidget {
  final String userId;
  const UserScreen({super.key, required this.userId});
  @override
  State<UserScreen> createState() => _UserScreenState();
}

class _UserScreenState extends State<UserScreen> {
  PublicUser? _user;
  List<Sport> _sports = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    final api = context.read<Api>();
    Future.wait([api.get('/api/users/${widget.userId}'), api.get('/api/sports')]).then((r) {
      if (mounted) {
        setState(() {
          _user = PublicUser.fromJson(r[0]);
          _sports = [for (final s in r[1]) Sport.fromJson(s)];
        });
      }
    }).catchError((Object e) {
      if (mounted) setState(() => _error = errorText(e));
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(tr('PLAYER', 'JOUEUR'))),
        body: _user == null
            ? Center(child: _error != null ? Text(_error!) : const CircularProgressIndicator())
            : ListView(padding: const EdgeInsets.all(16), children: [
                _ProfileCard(user: _user!, sports: _sports),
                if (context.watch<AuthState>().user?.id != _user!.id) ...[
                  const SizedBox(height: 12),
                  PlayerChallengeBlock(player: _user!),
                ],
                const SizedBox(height: 12),
                ProgressCard(userId: _user!.id),
              ]),
      );
}
