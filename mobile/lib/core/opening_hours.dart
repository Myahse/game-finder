import 'package:flutter/material.dart';

String formatOpeningHours(String opens, String closes) {
  return '${_padHm(opens)}–${_padHm(closes)}';
}

String _padHm(String s) {
  final parts = s.split(':');
  if (parts.length != 2) return s;
  return '${parts[0].padLeft(2, '0')}:${parts[1].padLeft(2, '0')}';
}

({String opens, String closes})? parseOpeningHours(String? raw) {
  if (raw == null || raw.trim().isEmpty) return null;
  for (final sep in ['–', '-', '—', ' to ']) {
    final i = raw.indexOf(sep);
    if (i > 0) {
      final opens = raw.substring(0, i).trim();
      final closes = raw.substring(i + sep.length).trim();
      if (_hmRe.hasMatch(opens) && _hmRe.hasMatch(closes)) {
        return (opens: _padHm(opens), closes: _padHm(closes));
      }
    }
  }
  return null;
}

final _hmRe = RegExp(r'^\d{1,2}:\d{2}$');

String timeOfDayToHm(TimeOfDay t) =>
    '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

TimeOfDay? hmToTimeOfDay(String hm) {
  final parts = hm.split(':');
  if (parts.length != 2) return null;
  final h = int.tryParse(parts[0]);
  final m = int.tryParse(parts[1]);
  if (h == null || m == null) return null;
  return TimeOfDay(hour: h, minute: m);
}
