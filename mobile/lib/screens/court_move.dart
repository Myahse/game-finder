import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/l10n.dart';
import '../core/models.dart';
import '../core/progress_models.dart';

/// Host (game) or challenger (challenge) moves it to another court. True once moved.
Future<bool?> showMoveCourtSheet(
  BuildContext context, {
  required String kind, // 'game' | 'challenge'
  required String id,
  required String sportId,
  required String sportSlug,
  required String courtId,
  required String courtName,
  required double lat,
  required double lng,
  bool rain = false,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => _MoveCourtSheet(
      kind: kind, id: id, sportId: sportId, sportSlug: sportSlug,
      courtId: courtId, courtName: courtName, lat: lat, lng: lng, rain: rain,
    ),
  );
}

class _MoveCourtSheet extends StatefulWidget {
  final String kind, id, sportId, sportSlug, courtId, courtName;
  final double lat, lng;
  final bool rain;
  const _MoveCourtSheet({
    required this.kind, required this.id, required this.sportId, required this.sportSlug,
    required this.courtId, required this.courtName, required this.lat, required this.lng, required this.rain,
  });
  @override
  State<_MoveCourtSheet> createState() => _MoveCourtSheetState();
}

class _MoveCourtSheetState extends State<_MoveCourtSheet> {
  List<Court>? _courts;
  Map<String, int> _rain = const {};
  String? _picked;
  late String _reason = widget.rain ? 'rain' : 'other';
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<Api>();
    try {
      final j = await api.get('/api/courts/nearby?lat=${widget.lat}&lng=${widget.lng}&radius_km=20&sport=${widget.sportSlug}');
      final courts = [
        for (final c in (j as List)) Court.fromJson(Map<String, dynamic>.from(c))
      ].where((c) => c.id != widget.courtId && c.sports.any((s) => s.id == widget.sportId)).toList()
        ..sort((a, b) => (a.distanceM ?? 0).compareTo(b.distanceM ?? 0));
      final list = courts.take(12).toList();
      var rain = <String, int>{};
      try {
        final ids = [widget.courtId, ...list.map((c) => c.id)].join(',');
        final r = await api.get('/api/courts/rain?ids=$ids');
        rain = {for (final e in (r as Map).entries) e.key as String: ((e.value as Map)['rain_pct'] as num).toInt()};
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _courts = list;
        _rain = rain;
        if (rain.containsKey(widget.courtId)) _reason = 'rain';
        _picked = list.where((c) => !rain.containsKey(c.id)).firstOrNull?.id ?? list.firstOrNull?.id;
      });
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    }
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<Api>().post('/api/${widget.kind == 'game' ? 'games' : 'challenges'}/${widget.id}/court', {'court_id': _picked, 'reason': _reason});
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr('Moved. Players are notified.', 'Déplacé. Les joueurs sont prévenus.'))));
      Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _rainTag(int pct) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(color: Colors.lightBlue.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(20)),
        child: Text('🌧️ ${tr('Rain', 'Pluie')} $pct%', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF0369A1))),
      );

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final courts = _courts;
    final rainHere = _rain[widget.courtId];
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 8, 16, 16 + MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          Text(tr('MOVE TO ANOTHER COURT', 'DÉPLACER VERS UN AUTRE TERRAIN'), style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: theme.colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(12)),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(tr('Current', 'Actuel'), style: theme.textTheme.labelSmall),
                  Text(widget.courtName, style: const TextStyle(fontWeight: FontWeight.w800)),
                ]),
              ),
              if (rainHere != null) _rainTag(rainHere),
            ]),
          ),
          if (rainHere != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(tr('Rain expected here — move to a dry court instead?', 'Pluie prévue ici — déplacer vers un terrain au sec ?'),
                  style: const TextStyle(color: Color(0xFF0369A1), fontWeight: FontWeight.w700)),
            ),
          const SizedBox(height: 12),
          Text(tr('Why?', 'Pourquoi ?'), style: theme.textTheme.labelLarge),
          const SizedBox(height: 6),
          SegmentedButton<String>(
            segments: [
              ButtonSegment(value: 'rain', label: Text('🌧️ ${tr('Rain', 'Pluie')}')),
              ButtonSegment(value: 'other', label: Text(tr('Other reason', 'Autre raison'))),
            ],
            selected: {_reason},
            onSelectionChanged: (s) => setState(() => _reason = s.first),
          ),
          const SizedBox(height: 12),
          Text(tr('New court', 'Nouveau terrain'), style: theme.textTheme.labelLarge),
          const SizedBox(height: 6),
          if (courts == null && _error == null)
            const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator()))
          else if (courts != null && courts.isEmpty)
            Text(tr('No other court for this sport nearby.', 'Aucun autre terrain pour ce sport à proximité.'))
          else if (courts != null)
            for (final c in courts)
              Card(
                margin: const EdgeInsets.only(bottom: 6),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(color: c.id == _picked ? theme.colorScheme.primary : Colors.transparent, width: 2),
                ),
                child: ListTile(
                  dense: true,
                  onTap: () => setState(() => _picked = c.id),
                  title: Text(c.name, style: const TextStyle(fontWeight: FontWeight.w700), overflow: TextOverflow.ellipsis),
                  trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                    if (_rain[c.id] != null) ...[_rainTag(_rain[c.id]!), const SizedBox(width: 8)],
                    if (c.distanceM != null) Text(formatDistance(c.distanceM)),
                  ]),
                ),
              ),
          const SizedBox(height: 6),
          Text(tr('Every player gets a notification and an alert.', 'Chaque joueur reçoit une notification et une alerte.'), style: theme.textTheme.bodySmall),
          if (_error != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(_error!, style: TextStyle(color: theme.colorScheme.error))),
          const SizedBox(height: 10),
          FilledButton.icon(
            onPressed: _busy || _picked == null ? null : _submit,
            icon: const Icon(Icons.place),
            label: Text(tr('MOVE HERE', 'DÉPLACER ICI')),
          ),
        ]),
      ),
    );
  }
}

/// Alert for a move of a game/challenge I'm in. Returns 'view' when the player wants to open it.
Future<String?> showCourtChangeAlert(BuildContext context, CourtChange c) {
  final theme = Theme.of(context);
  final who = c.changedBy != null ? '@${c.changedBy}' : 'Admin';
  final when = c.startTime == null ? null : DateFormat('dd/MM · HH:mm').format(c.startTime!);
  return showDialog<String>(
    context: context,
    barrierDismissible: false,
    builder: (ctx) => Dialog(
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: c.rain ? const [Color(0xFF0EA5E9), Color(0xFF075985)] : [theme.colorScheme.primary, const Color(0xFF7A1F00)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(c.rain ? '🌧️' : '📍', style: const TextStyle(fontSize: 36)),
            Text(
              c.challengeId != null ? tr('CHALLENGE MOVED!', 'DÉFI DÉPLACÉ !') : tr('GAME MOVED!', 'MATCH DÉPLACÉ !'),
              style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w900),
            ),
            Text(
              c.rain ? tr('$who moved it because of rain 🌧️', '$who l’a déplacé à cause de la pluie 🌧️') : tr('$who moved it', '$who l’a déplacé'),
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
            ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.all(18),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (c.fromCourt != null) ...[
              Text(tr('FROM', 'AVANT'), style: theme.textTheme.labelSmall),
              Text(c.fromCourt!, style: const TextStyle(decoration: TextDecoration.lineThrough, fontWeight: FontWeight.w600)),
              Icon(Icons.arrow_downward, color: theme.colorScheme.primary, size: 20),
            ],
            Text(tr('NOW AT', 'MAINTENANT À'), style: theme.textTheme.labelSmall),
            Row(children: [
              Icon(Icons.place, color: theme.colorScheme.primary),
              const SizedBox(width: 4),
              Expanded(child: Text(c.toCourt.name.toUpperCase(), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900))),
            ]),
            if (c.toAddress != null) Text(c.toAddress!, style: theme.textTheme.bodySmall),
            if (c.sportName != null || when != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text([c.sportName, when].whereType<String>().join(' · '), style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
            const SizedBox(height: 14),
            Row(children: [
              if (c.toCourt.latitude != null && c.toCourt.longitude != null)
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => openDirections(c.toCourt.latitude!, c.toCourt.longitude!),
                    icon: const Icon(Icons.navigation_outlined),
                    label: Text(tr('DIRECTIONS', 'ITINÉRAIRE')),
                  ),
                ),
              const SizedBox(width: 8),
              Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(ctx, 'view'), child: Text(tr('VIEW', 'VOIR')))),
            ]),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: FilledButton(onPressed: () => Navigator.pop(ctx, 'ok'), child: Text(tr('GOT IT', 'COMPRIS'))),
            ),
          ]),
        ),
      ]),
    ),
  );
}
