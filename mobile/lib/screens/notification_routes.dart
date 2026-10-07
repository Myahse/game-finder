import 'package:flutter/material.dart';

import '../core/notification_links.dart';
import 'challenges_screen.dart';
import 'court_screens.dart';
import 'game_screens.dart';
import 'profile_screen.dart';

/// Opens the screen a notification points to (list taps and push taps).
/// Returns false when the notification has nowhere to go.
bool openNotificationTarget(BuildContext context, NotificationTarget? target) {
  if (target == null) return false;
  final nav = Navigator.of(context);
  switch (target.dest) {
    case NotificationDest.profileFriends:
      nav.push(MaterialPageRoute(builder: (_) => const ProfileScreen(focusFriends: true)));
    case NotificationDest.profile:
      nav.push(MaterialPageRoute(builder: (_) => const ProfileScreen()));
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
