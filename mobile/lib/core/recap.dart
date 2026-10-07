// Monthly recap (GET /api/me/recap?month=YYYY-MM) and the month helpers the
// recap sheet uses — mirrors web/src/components/RecapSheet.tsx and lib/recapStory.ts.

import 'l10n.dart';
import 'models.dart';

class RecapCourt {
  final String id, name;
  final int visits;
  RecapCourt.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String? ?? '',
        name = j['name'] as String? ?? '',
        visits = (j['visits'] as num?)?.toInt() ?? 0;
}

class RecapTeammate {
  final PublicUser user;
  final int games;
  RecapTeammate.fromJson(Map<String, dynamic> j)
      : user = PublicUser.fromJson(Map<String, dynamic>.from(j['user'] as Map)),
        games = (j['games'] as num?)?.toInt() ?? 0;
}

class MonthlyRecap {
  final String month;
  final int games, courts, checkIns, showedUp, gamesCreated;
  final double hours;
  final int? showUpPct;
  final RecapCourt? topCourt;
  final RecapTeammate? topTeammate;

  MonthlyRecap.fromJson(Map<String, dynamic> j)
      : month = j['month'] as String? ?? '',
        games = (j['games'] as num?)?.toInt() ?? 0,
        hours = (j['hours'] as num?)?.toDouble() ?? 0,
        courts = (j['courts'] as num?)?.toInt() ?? 0,
        checkIns = (j['check_ins'] as num?)?.toInt() ?? 0,
        showedUp = (j['showed_up'] as num?)?.toInt() ?? 0,
        showUpPct = (j['show_up_pct'] as num?)?.round(),
        gamesCreated = (j['games_created'] as num?)?.toInt() ?? 0,
        topCourt = j['top_court'] is Map ? RecapCourt.fromJson(Map<String, dynamic>.from(j['top_court'] as Map)) : null,
        topTeammate = j['top_teammate'] is Map && (j['top_teammate'] as Map)['user'] is Map
            ? RecapTeammate.fromJson(Map<String, dynamic>.from(j['top_teammate'] as Map))
            : null;

  bool get isEmpty => games == 0;

  /// "12.5" / "3" — no trailing ".0", like the web story.
  String get hoursLabel => hours == hours.roundToDouble() ? '${hours.round()}' : hours.toStringAsFixed(1);

  String get showUpLabel => showUpPct == null ? '—' : '$showUpPct%';
}

/// "2026-10" for [d] (UTC, like the web).
String monthKey(DateTime d) {
  final u = d.toUtc();
  return '${u.year}-${u.month.toString().padLeft(2, '0')}';
}

/// The month [delta] months away from [key] ("2026-01", -1 → "2025-12").
String shiftMonth(String key, int delta) {
  final parts = key.split('-');
  final y = int.parse(parts[0]), m = int.parse(parts[1]);
  return monthKey(DateTime.utc(y, m + delta, 1));
}

const _monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const _monthsFr = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/// "October 2026" / "octobre 2026" for a month key.
String monthLabel(String key, {bool? french}) {
  final parts = key.split('-');
  final y = parts[0];
  final m = int.parse(parts[1]);
  return (french ?? isFrench) ? '${_monthsFr[m - 1]} $y' : '${_monthsEn[m - 1]} $y';
}
