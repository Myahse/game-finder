import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import '../ui/widgets.dart';
import 'l10n.dart';
import 'location.dart';

/// Matches the backend default `presence_max_distance_m` (web: COURT_AT_RADIUS_M).
const courtAtRadiusM = 500.0;

bool isAtCourt(LatLng? me, double courtLat, double courtLng, {double maxM = courtAtRadiusM}) {
  if (me == null) return false;
  return const Distance()(me, LatLng(courtLat, courtLng)) <= maxM;
}

/// Body for POST /api/games/{id}/join — same shape as the web's useGameAction.
Map<String, dynamic> gameJoinBody(LatLng? at) => {'latitude': at?.latitude, 'longitude': at?.longitude};

enum JoinLocationCheck { ok, locationOff, notAtCourt }

/// Live games can only be joined at the court; scheduled games from anywhere.
JoinLocationCheck checkJoinLocation({
  required bool live,
  required LatLng? at,
  required double courtLat,
  required double courtLng,
}) {
  if (!live) return JoinLocationCheck.ok;
  if (at == null) return JoinLocationCheck.locationOff;
  return isAtCourt(at, courtLat, courtLng) ? JoinLocationCheck.ok : JoinLocationCheck.notAtCourt;
}

String notAtCourtTitle() => tr("You're not at the court", 'Tu n’es pas au terrain');

String notAtCourtMessage() => tr(
      'Turn on location and move within about 500 m of the court to check in or join a live game. You can still join scheduled games from anywhere.',
      'Active la localisation et rapproche-toi à environ 500 m du terrain pour faire ton check-in ou rejoindre un match en cours. Tu peux quand même rejoindre les matchs programmés de n’importe où.',
    );

/// Resolves the join body for a game. For a live game it asks for a fresh fix
/// and warns (alert) when location is off or the player is far from the court;
/// returns null then and the join should not be sent.
Future<Map<String, dynamic>?> prepareGameJoin(
  BuildContext context, {
  required bool live,
  required double courtLat,
  required double courtLng,
}) async {
  final loc = context.read<LocationState>();
  final at = live ? await loc.freshFix() : loc.position;
  if (!context.mounted) return null;
  switch (checkJoinLocation(live: live, at: at, courtLat: courtLat, courtLng: courtLng)) {
    case JoinLocationCheck.ok:
      return gameJoinBody(at);
    case JoinLocationCheck.locationOff:
      await showAppAlert(
        context,
        title: tr('Location needed', 'Localisation requise'),
        message: tr('Turn on location so we can confirm you are at the court.',
            'Activez la localisation pour que nous puissions confirmer que vous êtes sur le terrain.'),
      );
      return null;
    case JoinLocationCheck.notAtCourt:
      await showAppAlert(context, title: notAtCourtTitle(), message: notAtCourtMessage());
      return null;
  }
}
