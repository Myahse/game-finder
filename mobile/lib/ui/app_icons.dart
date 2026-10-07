import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/auth.dart';
import '../core/models.dart';
import '../core/my_sport.dart';
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

IconData sportIconDataOutlined(String slug) {
  switch (slug) {
    case 'basketball':
      return Icons.sports_basketball_outlined;
    case 'football':
      return Icons.sports_soccer_outlined;
    case 'volleyball':
      return Icons.sports_volleyball_outlined;
    case 'tennis':
      return Icons.sports_tennis_outlined;
    default:
      return Icons.sports_outlined;
  }
}

/// Sport-neutral mark (whistle) for logged-out screens and while the player's
/// sport is still unknown.
const kNeutralSportIcon = Icons.sports;

/// Icon of the signed-in player's main sport — the app's sport mark (Play tab,
/// empty states, prompts), like the web's BaseSportIcon. Rebuilds when the
/// user or the sports list changes; works without providers (tests).
IconData baseSportIconData(BuildContext context, {bool outlined = false}) {
  final user = Provider.of<AuthState?>(context)?.user;
  final id = user?.preferredSportId;
  if (id == null) return outlined ? Icons.sports_outlined : kNeutralSportIcon;
  final sports = knownSports.value;
  if (sports.isEmpty) {
    final api = Provider.of<Api?>(context, listen: false);
    if (api != null) ensureKnownSports(api.get);
  }
  final slug = sportSlugForUser(user, sports);
  if (slug == null) return outlined ? Icons.sports_outlined : kNeutralSportIcon;
  return outlined ? sportIconDataOutlined(slug) : sportIconData(slug);
}

class BaseSportIcon extends StatelessWidget {
  final double? size;
  final Color? color;
  final bool outlined;
  const BaseSportIcon({super.key, this.size, this.color, this.outlined = false});

  @override
  Widget build(BuildContext context) => BaseSportBuilder(
        builder: (context, data) => Icon(data(outlined: outlined), size: size, color: color),
      );
}

/// Rebuilds [builder] when the shared sports list arrives; [builder] gets a
/// resolver for the player's base sport icon.
class BaseSportBuilder extends StatelessWidget {
  final Widget Function(BuildContext context, IconData Function({bool outlined}) icon) builder;
  const BaseSportBuilder({super.key, required this.builder});

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<List<Sport>>(
        valueListenable: knownSports,
        builder: (context, _, _) => builder(context, ({bool outlined = false}) => baseSportIconData(context, outlined: outlined)),
      );
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
        mainAxisAlignment: textAlign == TextAlign.center ? MainAxisAlignment.center : MainAxisAlignment.start,
        children: [
          const Icon(Icons.circle, size: 10, color: Palette.live),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              text,
              textAlign: textAlign,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Palette.live, fontWeight: FontWeight.w700),
            ),
          ),
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
    case 'game_created':
      return Icons.sports;
    case 'court_added':
      return Icons.add_location_alt_outlined;
    case 'presence_check':
      return Icons.place;
    case 'game_cancelled':
      return Icons.close;
    default:
      return Icons.campaign_outlined;
  }
}
