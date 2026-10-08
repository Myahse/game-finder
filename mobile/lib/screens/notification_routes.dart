import 'package:flutter/material.dart';

import '../core/notification_links.dart';
import 'challenges_screen.dart';
import 'court_screens.dart';
import 'game_screens.dart';
import 'profile_screen.dart';

/// Lets screens under the home shell switch to its Profile tab instead of
/// pushing a second [ProfileScreen] on top (web: navigate to /profile).
class HomeTabScope extends InheritedWidget {
  final void Function({bool focusFriends}) openProfile;
  const HomeTabScope({super.key, required this.openProfile, required super.child});

  static HomeTabScope? maybeOf(BuildContext context) => context.getInheritedWidgetOfExactType<HomeTabScope>();

  @override
  bool updateShouldNotify(HomeTabScope oldWidget) => false;
}

/// Opens the screen a notification points to (list taps and push taps).
/// Returns false when the notification has nowhere to go. Profile targets use
/// [openProfileTab] (or the enclosing [HomeTabScope]) when there is one.
bool openNotificationTarget(
  BuildContext context,
  NotificationTarget? target, {
  void Function({bool focusFriends})? openProfileTab,
}) {
  if (target == null) return false;
  final nav = Navigator.of(context);
  final profileTab = openProfileTab ?? HomeTabScope.maybeOf(context)?.openProfile;
  switch (target.dest) {
    case NotificationDest.profileFriends:
      if (profileTab != null) {
        profileTab(focusFriends: true);
      } else {
        nav.push(MaterialPageRoute(builder: (_) => const ProfileScreen(focusFriends: true)));
      }
    case NotificationDest.profile:
      if (profileTab != null) {
        profileTab();
      } else {
        nav.push(MaterialPageRoute(builder: (_) => const ProfileScreen()));
      }
    case NotificationDest.challenges:
      nav.push(MaterialPageRoute(builder: (_) => const ChallengesScreen()));
    case NotificationDest.court:
      nav.push(MaterialPageRoute(builder: (_) => CourtDetailsScreen(courtId: target.id!)));
    case NotificationDest.game:
      openGameScreen(context, target.id!);
    case NotificationDest.user:
      nav.push(MaterialPageRoute(builder: (_) => UserScreen(userId: target.id!)));
  }
  return true;
}
