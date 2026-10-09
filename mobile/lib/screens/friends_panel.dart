import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/friends.dart';
import '../core/l10n.dart';
import '../core/models.dart';
import '../core/realtime.dart';
import '../ui/share_image.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'auth_screens.dart' show showLoginSheet;
import 'bump_connect.dart';
import 'profile_screen.dart' show UserScreen;

/// Friends on the profile (web components/FriendsPanel.tsx): add by @username,
/// requests for you, pending requests, your friends and the invite link.
class FriendsPanel extends StatefulWidget {
  const FriendsPanel({super.key});
  @override
  State<FriendsPanel> createState() => FriendsPanelState();
}

class FriendsPanelState extends State<FriendsPanel> {
  final _username = TextEditingController();
  final _inviteButton = GlobalKey();
  List<PublicUser>? _friends;
  FriendRequests _requests = const FriendRequests();
  String? _error;
  bool _sending = false;
  bool _inviting = false;
  final Set<String> _responding = {};
  StreamSubscription? _rt;

  @override
  void initState() {
    super.initState();
    reload();
    try {
      // A new request or an accepted one arrives as a notification.
      _rt = context.read<Realtime>().ofType('notification').listen((_) => reload());
    } catch (_) {}
  }

  @override
  void dispose() {
    _rt?.cancel();
    _username.dispose();
    super.dispose();
  }

  Future<void> reload() async {
    final api = context.read<Api>();
    try {
      final r = await Future.wait([fetchFriends(api), fetchFriendRequests(api)]);
      if (!mounted) return;
      setState(() {
        _friends = r[0] as List<PublicUser>;
        _requests = r[1] as FriendRequests;
      });
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    }
  }

  Future<void> _send() async {
    if (normalizeUsername(_username.text).isEmpty) return;
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await sendFriendRequest(context.read<Api>(), _username.text);
      _username.clear();
      await reload();
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _respond(FriendRequest r, bool accept) async {
    setState(() {
      _responding.add(r.id);
      _error = null;
    });
    try {
      await respondFriendRequest(context.read<Api>(), r.id, accept: accept);
      await reload();
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _responding.remove(r.id));
    }
  }

  Future<void> _shareInvite() async {
    setState(() {
      _inviting = true;
      _error = null;
    });
    String? url;
    try {
      url = await createFriendInviteUrl(context.read<Api>());
      await SharePlus.instance.share(ShareParams(
        text: '${tr('Play with me on Out For Ground:', 'Viens jouer avec moi sur Out For Ground :')} $url',
        subject: tr('Friend invite', 'Invitation d’ami'),
        sharePositionOrigin: shareOriginOf(_inviteButton),
      ));
    } catch (e) {
      if (url != null) {
        await Clipboard.setData(ClipboardData(text: url));
        if (mounted) showSnack(context, tr('Link copied!', 'Lien copié !'));
      } else if (mounted) {
        setState(() => _error = errorText(e));
      }
    } finally {
      if (mounted) setState(() => _inviting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    final friends = _friends ?? const <PublicUser>[];
    final incoming = _requests.incoming;
    final outgoing = _requests.outgoing;
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(tr('FRIENDS', 'AMIS'), style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 4),
          Text(tr('Add players to invite them to games quickly.', 'Ajoutez des joueurs pour les inviter rapidement à vos matchs.'),
              style: TextStyle(color: muted)),
          const SizedBox(height: 12),
          const BumpConnectButton(),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            key: _inviteButton,
            onPressed: _inviting ? null : _shareInvite,
            icon: _inviting
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.ios_share),
            label: Text(tr('Share invite link', 'Partager le lien d’invitation')),
          ),
          const SizedBox(height: 16),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: TextField(
                controller: _username,
                autocorrect: false,
                textInputAction: TextInputAction.send,
                onChanged: (_) => setState(() {}),
                onSubmitted: (_) => _send(),
                decoration: InputDecoration(hintText: tr('@username', '@pseudo')),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(
              onPressed: _sending || normalizeUsername(_username.text).isEmpty ? null : _send,
              child: Text(_sending ? '…' : tr('Add friend', 'Ajouter en ami')),
            ),
          ]),
          if (_error != null) ...[const SizedBox(height: 10), ErrorBanner(_error)],
          if (incoming.isNotEmpty) ...[
            const SizedBox(height: 16),
            _Label(tr('Requests for you', 'Demandes reçues')),
            for (final r in incoming)
              _FriendTile(
                user: r.user,
                trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                  FilledButton(
                    style: FilledButton.styleFrom(minimumSize: const Size(0, 36), padding: const EdgeInsets.symmetric(horizontal: 12)),
                    onPressed: _responding.contains(r.id) ? null : () => _respond(r, true),
                    child: Text(tr('Accept', 'Accepter')),
                  ),
                  TextButton(
                    onPressed: _responding.contains(r.id) ? null : () => _respond(r, false),
                    child: Text(tr('Decline', 'Refuser')),
                  ),
                ]),
              ),
          ],
          if (outgoing.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text('${tr('Waiting:', 'En attente :')} ${outgoing.map((r) => '@${r.user.username}').join(', ')}',
                style: TextStyle(color: muted)),
          ],
          const SizedBox(height: 16),
          _Label(tr('Your friends (${friends.length})', 'Vos amis (${friends.length})')),
          if (_friends == null && _error == null)
            const Padding(padding: EdgeInsets.all(12), child: Center(child: CircularProgressIndicator()))
          else if (friends.isEmpty)
            Text(tr('No friends yet — search by username above.', 'Pas encore d’amis — cherchez un nom d’utilisateur ci-dessus.'),
                style: TextStyle(color: muted))
          else
            for (final f in friends) _FriendTile(user: f),
        ]),
      ),
    );
  }
}

class _Label extends StatelessWidget {
  final String text;
  const _Label(this.text);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(text, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
      );
}

class _FriendTile extends StatelessWidget {
  final PublicUser user;
  final Widget? trailing;
  const _FriendTile({required this.user, this.trailing});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Material(
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(12),
          clipBehavior: Clip.antiAlias,
          child: ListTile(
            dense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 10),
            leading: UserAvatar(user, size: 36),
            title: Text('@${user.username}', overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
            trailing: trailing,
            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => UserScreen(userId: user.id))),
          ),
        ),
      );
}

/// Add friend / request sent / accept-decline / already friends on another
/// player's profile (web components/ProfileFriendActions.tsx).
class ProfileFriendActions extends StatefulWidget {
  final PublicUser user;
  const ProfileFriendActions({super.key, required this.user});
  @override
  State<ProfileFriendActions> createState() => _ProfileFriendActionsState();
}

class _ProfileFriendActionsState extends State<ProfileFriendActions> {
  List<PublicUser> _friends = const [];
  FriendRequests _requests = const FriendRequests();
  bool _loaded = false;
  bool _busy = false;
  String? _error;
  String? _loadedFor;

  Future<void> _load() async {
    final api = context.read<Api>();
    try {
      final r = await Future.wait([fetchFriends(api), fetchFriendRequests(api)]);
      if (!mounted) return;
      setState(() {
        _friends = r[0] as List<PublicUser>;
        _requests = r[1] as FriendRequests;
        _loaded = true;
      });
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    }
  }

  Future<void> _run(Future<void> Function(Api api) f) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await f(context.read<Api>());
      await _load();
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final viewer = context.watch<AuthState>().user;
    if (viewer != null && _loadedFor != viewer.id) {
      _loadedFor = viewer.id;
      _loaded = false;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _load();
      });
    }
    final rel = friendRelation(viewerId: viewer?.id, targetId: widget.user.id, friends: _friends, requests: _requests);
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    final name = '@${widget.user.username}';

    final Widget body = switch (rel.relation) {
      FriendRelation.self => const SizedBox.shrink(),
      FriendRelation.guest => Wrap(alignment: WrapAlignment.center, crossAxisAlignment: WrapCrossAlignment.center, children: [
          TextButton(
            style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 36)),
            onPressed: () => showLoginSheet(context),
            child: Text(tr('Log in', 'Connectez-vous')),
          ),
          Text(tr(' to add $name as a friend.', ' pour ajouter $name en ami.'), style: TextStyle(color: muted)),
        ]),
      _ when !_loaded => const SizedBox(height: 36, child: Center(child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)))),
      FriendRelation.friends => Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(12)),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Icon(Icons.people_alt_outlined, size: 18, color: Palette.brand),
            const SizedBox(width: 6),
            Text(tr('Friends', 'Amis'), style: const TextStyle(fontWeight: FontWeight.w700, color: Palette.brand)),
          ]),
        ),
      FriendRelation.outgoing => Text(tr('Friend request sent.', 'Demande d’ami envoyée.'), textAlign: TextAlign.center, style: TextStyle(color: muted)),
      FriendRelation.incoming => Row(children: [
          Expanded(
            child: FilledButton(
              onPressed: _busy ? null : () => _run((api) => respondFriendRequest(api, rel.incomingId!, accept: true)),
              child: Text(tr('Accept friend request', 'Accepter la demande d’ami'), textAlign: TextAlign.center),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: OutlinedButton(
              onPressed: _busy ? null : () => _run((api) => respondFriendRequest(api, rel.incomingId!, accept: false)),
              child: Text(tr('Decline', 'Refuser')),
            ),
          ),
        ]),
      FriendRelation.none => FilledButton.icon(
          onPressed: _busy ? null : () => _run((api) => sendFriendRequest(api, widget.user.username)),
          icon: const Icon(Icons.person_add_alt_1),
          label: Text(tr('Add friend', 'Ajouter en ami')),
        ),
    };
    if (rel.relation == FriendRelation.self) return body;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      body,
      if (_error != null) ...[const SizedBox(height: 8), ErrorBanner(_error)],
    ]);
  }
}
