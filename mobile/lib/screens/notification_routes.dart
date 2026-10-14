import 'package:flutter/material.dart';

import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/announcements.dart';
import '../core/api.dart';
import '../core/notification_links.dart';
import '../ui/announcement_sheet.dart';
import 'challenges_screen.dart';
import 'court_screens.dart';
import 'game_screens.dart';
import 'player_card_sheet.dart';
import 'lists_screens.dart';
import 'profile_screen.dart';

/// Lets screens under the home shell switch to its Profile tab instead of
/// pushing a second [ProfileScreen] on top (web: navigate to /profile).
class HomeTabScope extends InheritedWidget {
  final void Function({bool focusFriends}) openProfile;
  /// Switches the shell to a tab (0 map, 1 play) — used by announcement buttons.
  final void Function(int tab)? openTab;
  const HomeTabScope({super.key, required this.openProfile, this.openTab, required super.child});

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
    case NotificationDest.card:
      showPlayerCardSheet(context, userId: 'me', sport: target.id, own: true);
    case NotificationDest.announcement:
      final openTab = HomeTabScope.maybeOf(context)?.openTab;
      openAnnouncementById(context, target.id!,
          openProfileTab: profileTab, openPlayTab: openTab == null ? null : () => openTab(1), openMapTab: openTab == null ? null : () => openTab(0));
  }
  return true;
}

/// Shows an announcement from a notification (seen or not), then follows its button.
Future<void> openAnnouncementById(BuildContext context, String id, {void Function({bool focusFriends})? openProfileTab, void Function()? openPlayTab, void Function()? openMapTab}) async {
  final api = context.read<Api>();
  Announcement? a;
  try {
    a = await fetchAnnouncement(api, id);
  } catch (_) {}
  if (a == null || !context.mounted) return;
  await presentAnnouncement(context, a, openProfileTab: openProfileTab, openPlayTab: openPlayTab, openMapTab: openMapTab);
}

/// Shows the pop-up, marks it seen, and follows the button when tapped.
Future<void> presentAnnouncement(BuildContext context, Announcement a, {void Function({bool focusFriends})? openProfileTab, void Function()? openPlayTab, void Function()? openMapTab}) async {
  final api = context.read<Api>();
  final tapped = await showAnnouncementSheet(context, a);
  try {
    await markAnnouncementSeen(api, a.id);
  } catch (_) {}
  if (!tapped || !context.mounted) return;
  final link = announcementLink(a.linkUrl);
  if (link == null) return;
  final nav = Navigator.of(context);
  switch (link.kind) {
    case AnnouncementLinkKind.map:
      openMapTab?.call();
    case AnnouncementLinkKind.play:
      if (openPlayTab != null) {
        openPlayTab();
      } else {
        nav.push(MaterialPageRoute(builder: (_) => const PlayScreen(tabActive: true)));
      }
    case AnnouncementLinkKind.challenges:
      nav.push(MaterialPageRoute(builder: (_) => const ChallengesScreen()));
    case AnnouncementLinkKind.profile:
      if (openProfileTab != null) {
        openProfileTab();
      } else {
        nav.push(MaterialPageRoute(builder: (_) => const ProfileScreen()));
      }
    case AnnouncementLinkKind.addCourt:
      nav.push(MaterialPageRoute(builder: (_) => const AddCourtScreen()));
    case AnnouncementLinkKind.external:
      await launchUrl(link.uri!, mode: LaunchMode.externalApplication);
  }
}
