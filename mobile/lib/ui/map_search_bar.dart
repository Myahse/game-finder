import 'dart:async';

import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

import '../core/forward_geocode.dart';
import '../core/l10n.dart';
import '../core/models.dart';
import 'app_icons.dart';
import 'theme.dart';

/// Search loaded courts by name and places via Mapbox (web MapSearchBar).
/// Results open under the field; picking one calls [onSelectCourt] / [onSelectPlace].
class MapSearchBar extends StatefulWidget {
  /// Player position (or map center) — biases place results.
  final LatLng? proximity;
  final List<Court> courts;
  final ValueChanged<Court>? onSelectCourt;
  final ValueChanged<GeocodePlace> onSelectPlace;
  final String? placeholder;

  /// Max height of the results panel.
  final double maxResultsHeight;

  const MapSearchBar({
    super.key,
    this.proximity,
    this.courts = const [],
    this.onSelectCourt,
    required this.onSelectPlace,
    this.placeholder,
    this.maxResultsHeight = 264,
  });

  @override
  State<MapSearchBar> createState() => _MapSearchBarState();
}

class _MapSearchBarState extends State<MapSearchBar> {
  final _query = TextEditingController();
  final _focus = FocusNode();
  Timer? _debounce;
  List<GeocodePlace> _places = const [];
  bool _loading = false;
  bool _open = false;
  int _seq = 0;

  @override
  void initState() {
    super.initState();
    _focus.addListener(() {
      if (_focus.hasFocus && !_open && mounted) setState(() => _open = true);
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _query.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _onChanged(String v) {
    _debounce?.cancel();
    final q = v.trim();
    final seq = ++_seq;
    setState(() {
      _open = true;
      if (q.length < 2) {
        _places = const [];
        _loading = false;
      } else {
        _loading = true;
      }
    });
    if (q.length < 2) return;
    _debounce = Timer(const Duration(milliseconds: 280), () async {
      final list = await forwardGeocode(q, proximity: widget.proximity);
      if (!mounted || seq != _seq) return;
      setState(() {
        _places = list;
        _loading = false;
      });
    });
  }

  void _close() {
    _focus.unfocus();
    setState(() => _open = false);
  }

  void _clear() {
    _debounce?.cancel();
    _seq++;
    _query.clear();
    setState(() {
      _places = const [];
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final q = _query.text.trim();
    final courtHits = searchCourtsByName(widget.courts, q);
    final hasResults = courtHits.isNotEmpty || _places.isNotEmpty;
    final showPanel = _open && q.length >= 2;
    final muted = TextStyle(fontSize: 12, color: scheme.onSurfaceVariant);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Material(
          elevation: 2,
          shadowColor: Colors.black26,
          borderRadius: BorderRadius.circular(14),
          color: Colors.transparent,
          child: TextField(
            controller: _query,
            focusNode: _focus,
            autocorrect: false,
            textInputAction: TextInputAction.search,
            onChanged: _onChanged,
            onTapOutside: (_) => _focus.unfocus(),
            decoration: InputDecoration(
              isDense: true,
              hintText: widget.placeholder ?? tr('Search courts or places…', 'Rechercher un terrain ou un lieu…'),
              prefixIcon: const Icon(Icons.search, size: 20),
              suffixIcon: _query.text.isEmpty
                  ? null
                  : IconButton(
                      tooltip: tr('Clear search', 'Effacer la recherche'),
                      icon: const Icon(Icons.close, size: 18),
                      onPressed: _clear,
                    ),
            ),
          ),
        ),
        if (showPanel)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Material(
              elevation: 6,
              shadowColor: Colors.black26,
              borderRadius: BorderRadius.circular(14),
              color: scheme.surface,
              clipBehavior: Clip.antiAlias,
              child: ConstrainedBox(
                constraints: BoxConstraints(maxHeight: widget.maxResultsHeight),
                child: ListView(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  shrinkWrap: true,
                  children: [
                    if (_loading && courtHits.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        child: Text(tr('Searching…', 'Recherche…'), style: muted),
                      ),
                    for (final c in courtHits)
                      ListTile(
                        dense: true,
                        leading: SportIcon(c.sports.firstOrNull?.slug ?? 'basketball', size: 18, color: Palette.brand),
                        minLeadingWidth: 20,
                        title: Text(c.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text(tr('Court on map', 'Terrain sur la carte'), style: muted),
                        onTap: () {
                          _query.text = c.name;
                          _close();
                          widget.onSelectCourt?.call(c);
                        },
                      ),
                    for (final p in _places)
                      ListTile(
                        dense: true,
                        leading: Icon(Icons.place_outlined, size: 18, color: scheme.onSurfaceVariant),
                        minLeadingWidth: 20,
                        title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w500)),
                        onTap: () {
                          _close();
                          widget.onSelectPlace(p);
                        },
                      ),
                    if (!_loading && !hasResults)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        child: Text(tr('No matches — try another name or address.', 'Aucun résultat — essayez un autre nom ou une autre adresse.'), style: muted),
                      ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}
