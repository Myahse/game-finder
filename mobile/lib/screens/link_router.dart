import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/app_lock.dart';
import '../core/auth.dart';
import '../core/deep_links.dart';
import '../core/map_pause.dart';
import 'auth_screens.dart';
import 'challenges_screen.dart';
import 'court_screens.dart';
import 'game_screens.dart';
import 'link_screens.dart';
import 'profile_screen.dart';

/// Opens links from outside the app (App Links / Universal Links / the
/// custom scheme) on the root navigator.
///
/// Links are held until the app has booted ([attach]) and the navigator is
/// mounted. A link whose screen needs a signed-in, onboarded player is kept
/// and opened once the player gets there ([resumeAfterSignIn]).
class LinkRouter {
  LinkRouter._();
  static final instance = LinkRouter._();

  /// Given to [MaterialApp.navigatorKey].
  final navigatorKey = GlobalKey<NavigatorState>();

  AuthState? _auth;
  DeepLink? _pending; // arrived before the app was ready
  DeepLink? _afterSignIn; // needs a player: opened once signed in + onboarded
  StreamSubscription<Uri>? _sub;
  Uri? _lastUri;
  DateTime? _lastAt;

  /// The link waiting for sign-in / onboarding (tests, debugging).
  DeepLink? get waitingForSignIn => _afterSignIn;

  /// Listens to incoming links (initial link included, app_links ≥ 6).
  void listen(Stream<Uri> links) {
    _sub?.cancel();
    _sub = links.listen(handleUri, onError: (_) {});
  }

  /// Boot finished: auth is known and the root screen is up.
  void attach(AuthState auth) {
    if (identical(_auth, auth)) return;
    _auth?.removeListener(_onAuth);
    _auth = auth;
    auth.addListener(_onAuth);
    final p = _pending;
    _pending = null;
    if (p != null) _afterFrame(() => open(p));
  }

  /// A held link will show the login sheet itself once opened signed out.
  bool get heldNeedsAuth => _pending?.needsAuth ?? false;

  /// The app lock opened: opens the link that arrived while it was up.
  void releaseHeld() {
    final p = _pending;
    if (p == null || _auth == null) return;
    _pending = null;
    _afterFrame(() => open(p));
  }

  void detach() {
    _auth?.removeListener(_onAuth);
    _auth = null;
  }

  /// An incoming URI. Foreign links are ignored; the same link delivered twice
  /// in a row (cold start on some Android versions) opens once.
  void handleUri(Uri uri) {
    if (!isAppLink(uri)) return;
    final now = DateTime.now();
    if (uri == _lastUri && _lastAt != null && now.difference(_lastAt!) < const Duration(seconds: 2)) return;
    _lastUri = uri;
    _lastAt = now;
    open(parseAppLink(uri));
  }

  /// Keeps [link] and opens it once the player is signed in and onboarded.
  void resumeAfterSignIn(DeepLink link) => _afterSignIn = link;

  bool _hasPlayer(AuthState auth) => auth.user?.onboarded == true;

  void open(DeepLink link) {
    final auth = _auth;
    final nav = navigatorKey.currentState;
    // Behind the fingerprint / Face ID lock: opened by [releaseHeld] after the unlock.
    if (auth == null || nav == null || AppLock.instance.locked) {
      _pending = link;
      return;
    }
    if (link is HomeLink) return; // just bring the app up
    if (link.needsAuth && !_hasPlayer(auth)) {
      _afterSignIn = link;
      nav.popUntil((r) => r.isFirst);
      // Signed out: the login sheet; not onboarded: RootGate shows onboarding.
      if (auth.user == null) {
        final ctx = nav.overlay?.context;
        if (ctx != null) showLoginSheet(ctx);
      }
      return;
    }
    _push(nav, link);
  }

  void _onAuth() {
    final auth = _auth;
    final link = _afterSignIn;
    if (auth == null || link == null || !_hasPlayer(auth)) return;
    _afterSignIn = null;
    // Let RootGate swap in the home screen (and the login sheet close) first.
    _afterFrame(() {
      final nav = navigatorKey.currentState;
      if (nav == null) return;
      nav.popUntil((r) => r.isFirst);
      _push(nav, link);
    });
  }

  /// After the next frame; asks for one so an idle app doesn't hold the link.
  void _afterFrame(VoidCallback fn) => WidgetsBinding.instance
    ..addPostFrameCallback((_) => fn())
    ..ensureVisualUpdate();

  void _push(NavigatorState nav, DeepLink link) {
    Route<void> page(Widget w) => MaterialPageRoute<void>(builder: (_) => w);
    switch (link) {
      case HomeLink():
        return;
      case GameShareLink(:final token):
        nav.push(page(GameLinkScreen(token: token)));
      case FriendInviteLink(:final token):
        nav.push(page(FriendInviteScreen(token: token)));
      case UsernameLink(:final username):
        openUserByUsername(nav.context, username);
      case VerifyEmailLink(:final token):
        nav.push(page(VerifyEmailScreen(token: token)));
      case ChallengesLink():
        nav.push(page(const ChallengesScreen()));
      case ChallengeLink(:final id):
        nav.push(page(ChallengeDetailScreen(challengeId: id)));
      case GameLink(:final id):
        openGameOnNavigator(nav, nav.context.read<MapPause>(), id);
      case CourtLink(:final id):
        nav.push(page(CourtDetailsScreen(courtId: id, fromLink: true)));
      case UserLink(:final id):
        nav.push(page(UserScreen(userId: id)));
    }
  }
}
