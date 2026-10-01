import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/notifications.dart';
import '../ui/theme.dart';
import '../ui/app_icons.dart';
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
          Text(user.fullName.toUpperCase(), textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineMedium),
          Text('@${user.username}', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
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
                  Text(skillLabels[user.skillLevel]!, style: const TextStyle(fontWeight: FontWeight.w700)),
                ]),
            ],
          ),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(child: _Stat(value: user.gamesPlayed, label: 'GAMES PLAYED')),
            const SizedBox(width: 10),
            Expanded(child: _Stat(value: user.gamesCreated, label: 'GAMES CREATED')),
          ]),
          const SizedBox(height: 12),
          Text('Joined ${DateFormat.yMMMM().format(user.createdAt)}',
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
      appBar: AppBar(title: const Text('PROFILE'), actions: [
        TextButton(
          onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => EditProfileScreen(sports: _sports))),
          child: const Text('Edit'),
        ),
      ]),
      body: RefreshIndicator(
        onRefresh: auth.refreshMe,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          _ProfileCard(user: me, sports: _sports),
          if (me.isAdmin)
            const Padding(
              padding: EdgeInsets.only(top: 12),
              child: Card(child: ListTile(leading: const Icon(Icons.build_outlined), title: Text('Admin tools are in the web dashboard'))),
            ),
          const SizedBox(height: 16),
          OutlinedButton(
            onPressed: () async {
              await context.read<Notifications>().unregisterDevice();
              await auth.logout();
            },
            child: const Text('LOG OUT'),
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

  Future<void> _photo() async {
    final api = context.read<Api>();
    final f = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1024, imageQuality: 85);
    if (f == null) return;
    setState(() => _busy = true);
    try {
      final url = await api.upload(await f.readAsBytes(), f.name, 'avatar');
      setState(() => _avatar = url);
    } catch (e) {
      setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _save() async {
    setState(() => _busy = true);
    try {
      await context.read<AuthState>().updateMe({
        'first_name': _first.text,
        'last_name': _last.text,
        'username': _username.text.trim(),
        'preferred_sport_id': _sportId,
        'skill_level': _skill,
        'avatar_url': _avatar ?? '',
      });
      if (mounted) Navigator.pop(context);
    } catch (e) {
      setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('EDIT PROFILE')),
        body: ListView(padding: const EdgeInsets.all(20), children: [
          Center(
            child: GestureDetector(onTap: _busy ? null : _photo, child: UserAvatar(_me, size: 88, overrideUrl: _avatar)),
          ),
          TextButton(onPressed: _busy ? null : _photo, child: const Text('Change photo')),
          TextField(controller: _first, decoration: const InputDecoration(labelText: 'First name')),
          const SizedBox(height: 12),
          TextField(controller: _last, decoration: const InputDecoration(labelText: 'Last name')),
          const SizedBox(height: 12),
          TextField(controller: _username, decoration: const InputDecoration(labelText: 'Username')),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: widget.sports.any((s) => s.id == _sportId) ? _sportId : null,
            decoration: const InputDecoration(labelText: 'Preferred sport'),
            items: [
              for (final s in widget.sports.where((s) => s.active))
                DropdownMenuItem(value: s.id, child: SportInline(s)),
            ],
            onChanged: (v) => setState(() => _sportId = v),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _skill,
            decoration: const InputDecoration(labelText: 'Skill level'),
            items: [for (final e in skillLabels.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
            onChanged: (v) => setState(() => _skill = v!),
          ),
          const SizedBox(height: 20),
          ErrorBanner(_error),
          FilledButton(onPressed: _busy ? null : _save, child: const Text('SAVE')),
        ]),
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
        appBar: AppBar(title: const Text('PLAYER')),
        body: _user == null
            ? Center(child: _error != null ? Text(_error!) : const CircularProgressIndicator())
            : ListView(padding: const EdgeInsets.all(16), children: [_ProfileCard(user: _user!, sports: _sports)]),
      );
}
