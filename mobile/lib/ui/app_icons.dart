import 'package:flutter/material.dart';

import '../core/models.dart';
import 'theme.dart';

IconData sportIconData(String slug) {
  switch (slug) {
    case 'basketball':
      return Icons.sports_basketball;
    case 'football':
      return Icons.sports_soccer;
    case 'volleyball':
      return Icons.sports_volleyball;
    case 'tennis':
      return Icons.sports_tennis;
    case 'badminton':
      return Icons.sports;
    default:
      return Icons.place;
  }
}

class SportIcon extends StatelessWidget {
  final String slug;
  final double size;
  final Color? color;
  const SportIcon(this.slug, {super.key, this.size = 20, this.color});

  @override
  Widget build(BuildContext context) {
    return Icon(sportIconData(slug), size: size, color: color);
  }
}

IconData activityIconData(Activity activity) {
  switch (activity) {
    case Activity.active:
      return Icons.local_fire_department;
    case Activity.players:
      return Icons.groups;
    case Activity.inactive:
      return Icons.circle_outlined;
  }
}

class SportInline extends StatelessWidget {
  final Sport sport;
  final double iconSize;
  final TextStyle? textStyle;
  const SportInline(this.sport, {super.key, this.iconSize = 16, this.textStyle});

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SportIcon(sport.slug, size: iconSize),
          const SizedBox(width: 6),
          Text(sport.name, style: textStyle),
        ],
      );
}

class PresenceLiveText extends StatelessWidget {
  final String text;
  final TextAlign? textAlign;
  const PresenceLiveText(this.text, {super.key, this.textAlign});

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: textAlign == TextAlign.center ? MainAxisAlignment.center : MainAxisAlignment.start,
        children: [
          const Icon(Icons.circle, size: 10, color: Palette.live),
          const SizedBox(width: 6),
          Flexible(child: Text(text, textAlign: textAlign, style: const TextStyle(color: Palette.live, fontWeight: FontWeight.w700))),
        ],
      );
}

IconData notificationIconData(String type) {
  switch (type) {
    case 'game_reminder':
      return Icons.schedule;
    case 'game_invite':
      return Icons.handshake_outlined;
    case 'game_activity':
      return Icons.local_fire_department;
    case 'presence_check':
      return Icons.place;
    case 'game_cancelled':
      return Icons.close;
    default:
      return Icons.campaign_outlined;
  }
}
