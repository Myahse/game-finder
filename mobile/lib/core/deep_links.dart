import 'package:flutter_dotenv/flutter_dotenv.dart';

import 'game_share.dart';

/// Custom scheme fallback: `findthegame://g/<token>` (same paths as the web).
const appLinkScheme = 'findthegame';

/// Website hosts whose links open in the app, besides the host of
/// [webAppUrl]. Keep in sync with the intent filters in
/// android/app/src/main/AndroidManifest.xml and the associated domains in
/// ios/Runner/Runner.entitlements. More hosts: `APP_LINK_HOSTS=a.com,b.com`
/// in assets/.env.
const defaultAppLinkHosts = [
  'game-finder-swart.vercel.app',
  'outforground.com',
  'www.outforground.com',
];

/// Hosts accepted by [parseAppLink]: the share-link origin, the defaults and
/// `APP_LINK_HOSTS`.
Set<String> get appLinkHosts {
  final hosts = <String>{...defaultAppLinkHosts};
  final web = Uri.tryParse(webAppUrl)?.host ?? '';
  if (web.isNotEmpty) hosts.add(web.toLowerCase());
  final extra = dotenv.isInitialized ? dotenv.env['APP_LINK_HOSTS'] ?? '' : '';
  for (final h in extra.split(',')) {
    final t = h.trim().toLowerCase();
    if (t.isNotEmpty) hosts.add(t);
  }
  return hosts;
}

/// Where a link opened from outside the app goes (web routes in router.tsx).
sealed class DeepLink {
  const DeepLink();

  /// The screen needs a signed-in, onboarded player. Share landings
  /// (`/g/`, `/friend/`, `/u/`, `/verify-email`) work signed out, like the web.
  bool get needsAuth => true;

  List<Object?> get _props;

  @override
  bool operator ==(Object other) =>
      other.runtimeType == runtimeType && _listEquals((other as DeepLink)._props, _props);
  @override
  int get hashCode => Object.hash(runtimeType, Object.hashAll(_props));
  @override
  String toString() => '$runtimeType(${_props.join(', ')})';
}

bool _listEquals(List<Object?> a, List<Object?> b) {
  if (a.length != b.length) return false;
  for (var i = 0; i < a.length; i++) {
    if (a[i] != b[i]) return false;
  }
  return true;
}

/// `/` or anything the app has no screen for: just open the app.
final class HomeLink extends DeepLink {
  const HomeLink();
  @override
  bool get needsAuth => false;
  @override
  List<Object?> get _props => const [];
}

/// `/g/:token` — shared game link (web GameLinkPage).
final class GameShareLink extends DeepLink {
  final String token;
  const GameShareLink(this.token);
  @override
  bool get needsAuth => false;
  @override
  List<Object?> get _props => [token];
}

/// `/friend/:token` — friend invite (web FriendInvitePage).
final class FriendInviteLink extends DeepLink {
  final String token;
  const FriendInviteLink(this.token);
  @override
  bool get needsAuth => false;
  @override
  List<Object?> get _props => [token];
}

/// `/u/:username` — public profile.
final class UsernameLink extends DeepLink {
  final String username;
  const UsernameLink(this.username);
  @override
  bool get needsAuth => false;
  @override
  List<Object?> get _props => [username];
}

/// `/verify-email?token=` — email confirmation.
final class VerifyEmailLink extends DeepLink {
  final String token;
  const VerifyEmailLink(this.token);
  @override
  bool get needsAuth => false;
  @override
  List<Object?> get _props => [token];
}

/// `/challenges`.
final class ChallengesLink extends DeepLink {
  const ChallengesLink();
  @override
  List<Object?> get _props => const [];
}

/// `/challenges/:id`.
final class ChallengeLink extends DeepLink {
  final String id;
  const ChallengeLink(this.id);
  @override
  List<Object?> get _props => [id];
}

/// `/games/:id`.
final class GameLink extends DeepLink {
  final String id;
  const GameLink(this.id);
  @override
  List<Object?> get _props => [id];
}

/// `/courts/:id` and `/?court=<id>`.
final class CourtLink extends DeepLink {
  final String id;
  const CourtLink(this.id);
  @override
  List<Object?> get _props => [id];
}

/// `/users/:id`.
final class UserLink extends DeepLink {
  final String id;
  const UserLink(this.id);
  @override
  List<Object?> get _props => [id];
}

/// True when [uri] is one of ours: https on an app-link host, or the custom scheme.
bool isAppLink(Uri uri, {Iterable<String>? hosts}) {
  final scheme = uri.scheme.toLowerCase();
  if (scheme == appLinkScheme) return true;
  if (scheme != 'https' && scheme != 'http') return false;
  return (hosts ?? appLinkHosts).contains(uri.host.toLowerCase());
}

/// Maps a link to its screen. Never throws: unknown paths and foreign hosts
/// give [HomeLink]. [hosts] defaults to [appLinkHosts].
DeepLink parseAppLink(Uri uri, {Iterable<String>? hosts}) {
  if (!isAppLink(uri, hosts: hosts)) return const HomeLink();
  // findthegame://g/abc → host "g", path "/abc"; findthegame:///g/abc → path only.
  final custom = uri.scheme.toLowerCase() == appLinkScheme;
  final segs = [
    if (custom && uri.host.isNotEmpty) uri.host,
    ...uri.pathSegments,
  ].map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
  String? q(String key) {
    final v = uri.queryParameters[key]?.trim();
    return v == null || v.isEmpty ? null : v;
  }

  if (segs.isEmpty) {
    final court = q('court');
    return court != null ? CourtLink(court) : const HomeLink();
  }
  final head = segs[0].toLowerCase();
  final arg = segs.length > 1 ? segs[1] : null;
  switch (head) {
    case 'g' when arg != null:
      return GameShareLink(arg);
    case 'friend' when arg != null:
      return FriendInviteLink(arg);
    case 'u' when arg != null:
      final name = arg.replaceFirst(RegExp(r'^@+'), '');
      return name.isEmpty ? const HomeLink() : UsernameLink(name);
    case 'challenges':
      return arg == null ? const ChallengesLink() : ChallengeLink(arg);
    case 'games' when arg != null && arg != 'new':
      return GameLink(arg);
    case 'courts' when arg != null && arg != 'new':
      return CourtLink(arg);
    case 'users' when arg != null:
      return UserLink(arg);
    case 'verify-email':
      return VerifyEmailLink(q('token') ?? '');
  }
  return const HomeLink();
}
