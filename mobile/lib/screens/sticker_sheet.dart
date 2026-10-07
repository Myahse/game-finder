import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart' show Uint8List;
import 'package:flutter/material.dart';

import '../core/l10n.dart';
import '../core/player_avatar.dart';
import '../core/stickers.dart';
import '../ui/share_image.dart';
import '../ui/widgets.dart';

/// Sticker frame in logical pixels; captured at 2× → 512×512 (WhatsApp sticker size).
const _side = 256.0;
const _pixelRatio = 2.0;

/// "My stickers" button (profile). Shown only when the player has avatar art.
class StickerButton extends StatelessWidget {
  final AvatarArt art;
  final String? sport;
  const StickerButton({super.key, required this.art, this.sport});

  @override
  Widget build(BuildContext context) => OutlinedButton.icon(
        onPressed: () => showStickerSheet(context, art: art, sport: sport),
        icon: const Icon(Icons.emoji_emotions_outlined),
        label: Text(tr('MY STICKERS', 'MES STICKERS')),
      );
}

Future<void> showStickerSheet(BuildContext context, {required AvatarArt art, String? sport}) => showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (_) => _StickerSheet(art: art, sport: sport),
    );

/// Tests swap the DiceBear image fetch (url → loaded?) for a fake.
@visibleForTesting
Future<bool> Function(String url)? debugStickerPrecache;

class _StickerSheet extends StatefulWidget {
  final AvatarArt art;
  final String? sport;
  const _StickerSheet({required this.art, this.sport});
  @override
  State<_StickerSheet> createState() => _StickerSheetState();
}

class _StickerSheetState extends State<_StickerSheet> {
  late final List<StickerSpec> _specs = stickerSet(widget.sport);
  late final Map<String, GlobalKey> _keys = {for (final s in _specs) s.id: GlobalKey()};
  final _saveButton = GlobalKey();

  /// Ids whose avatar image has loaded (ready to capture).
  final _loaded = <String>{};

  /// Ids whose image could not be fetched: the tile offers a retry.
  final _failed = <String>{};
  bool _busy = false;

  /// DiceBear fetches in flight at once.
  static const _maxParallel = 3;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _preload(_specs);
    });
  }

  /// Loads [specs] a few at a time; each tile shows as soon as its image is in.
  Future<void> _preload(List<StickerSpec> specs) async {
    final queue = [...specs];
    setState(() => _failed.removeAll(queue.map((s) => s.id)));
    Future<void> worker() async {
      while (queue.isNotEmpty) {
        final s = queue.removeAt(0);
        final ok = await _fetch(s);
        if (!mounted) return;
        setState(() => ok ? _loaded.add(s.id) : _failed.add(s.id));
      }
    }

    final workers = math.min(_maxParallel, queue.length);
    await Future.wait([for (var i = 0; i < workers; i++) worker()]);
  }

  Future<bool> _fetch(StickerSpec s) async {
    final url = widget.art.pngUrl(expression: s.expression);
    if (url == null) return false;
    final hook = debugStickerPrecache;
    if (hook != null) return hook(url);
    var ok = true;
    try {
      await precacheImage(NetworkImage(url), context, onError: (_, _) => ok = false);
    } catch (_) {
      ok = false;
    }
    return ok;
  }

  Future<({Uint8List bytes, String name})?> _render(StickerSpec s) async {
    final png = await captureBoundaryPng(_keys[s.id]!, pixelRatio: _pixelRatio);
    return png == null ? null : (bytes: png, name: 'sticker-${s.id}.png');
  }

  Future<void> _run(Future<void> Function() job) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await job();
    } catch (_) {
      if (mounted) showSnack(context, tr('Could not create the stickers.', 'Impossible de créer les stickers.'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _send(StickerSpec s) => _run(() async {
        final f = await _render(s);
        if (f == null) throw StateError('render failed');
        await sharePngs([f], origin: shareOriginOf(_keys[s.id]!));
      });

  Future<void> _saveAll() => _run(() async {
        final files = [
          for (final s in _specs)
            if (_loaded.contains(s.id)) await _render(s),
        ].whereType<({Uint8List bytes, String name})>().toList();
        if (files.isEmpty) throw StateError('render failed');
        await sharePngs(files, origin: shareOriginOf(_saveButton));
      });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(tr('YOUR STICKERS', 'VOS STICKERS'), style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 4),
          Text(
            tr('Tap a sticker to send it on WhatsApp or save it.', 'Touchez un sticker pour l’envoyer sur WhatsApp ou l’enregistrer.'),
            style: TextStyle(fontSize: 13, color: theme.colorScheme.onSurfaceVariant),
          ),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 3,
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            children: [
              for (final s in _specs)
                Semantics(
                  button: true,
                  label: s.caption,
                  child: Material(
                    color: theme.colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(16),
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: _loaded.contains(s.id) && !_busy ? () => _send(s) : null,
                      child: _loaded.contains(s.id)
                          ? FittedBox(
                              child: RepaintBoundary(
                                key: _keys[s.id],
                                child: StickerArt(art: widget.art, spec: s),
                              ),
                            )
                          : _failed.contains(s.id)
                              ? Center(
                                  child: IconButton(
                                    tooltip: tr('Retry', 'Réessayer'),
                                    onPressed: () => _preload([s]),
                                    icon: Icon(Icons.refresh, color: theme.colorScheme.onSurfaceVariant),
                                  ),
                                )
                              : const Center(child: SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            key: _saveButton,
            onPressed: _loaded.isEmpty || _busy ? null : _saveAll,
            icon: _busy
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.download_outlined),
            label: Text(tr('SAVE ALL', 'TOUT ENREGISTRER')),
          ),
        ]),
      ),
    );
  }
}

/// One sticker on a transparent square: the avatar with a white die-cut border,
/// the jersey number on the chest, and a tilted caption in the player's kit colour.
class StickerArt extends StatelessWidget {
  final AvatarArt art;
  final StickerSpec spec;
  const StickerArt({super.key, required this.art, required this.spec});

  @override
  Widget build(BuildContext context) {
    final url = art.pngUrl(expression: spec.expression);
    const avatar = 200.0;
    const left = (_side - avatar) / 2;
    const top = 4.0;
    const border = 6.0;
    Widget image({Color? tint}) {
      final img = Image.network(url ?? '', width: avatar, height: avatar, fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox.shrink());
      return tint == null ? img : ColorFiltered(colorFilter: ColorFilter.mode(tint, BlendMode.srcIn), child: img);
    }

    final accent = _hexColor(art.accentHex);
    final number = art.jersey;
    const ink = Color(0xFF12151A);
    final caption = spec.caption;
    TextStyle style(Paint? p, {Color? color}) => TextStyle(
          fontSize: 52,
          fontWeight: FontWeight.w900,
          height: 1,
          letterSpacing: -0.5,
          color: color,
          foreground: p,
        );
    Paint stroke(Color c, double w) => Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = w
      ..strokeJoin = StrokeJoin.round
      ..color = c;

    return MediaQuery(
      data: MediaQuery.of(context).copyWith(textScaler: TextScaler.noScaling),
      child: SizedBox(
        width: _side,
        height: _side,
        child: Stack(clipBehavior: Clip.none, children: [
          // Soft shadow, then the white outline (the avatar stamped in white around itself).
          Positioned(
            left: left,
            top: top + 2,
            child: ImageFiltered(
              imageFilter: _blur,
              child: Opacity(opacity: 0.22, child: image(tint: Colors.black)),
            ),
          ),
          for (var i = 0; i < 16; i++)
            Positioned(
              left: left + math.cos(i / 16 * 2 * math.pi) * border,
              top: top + math.sin(i / 16 * 2 * math.pi) * border,
              child: image(tint: Colors.white),
            ),
          Positioned(left: left, top: top, child: image()),
          if (number != null && art.player != null)
            Positioned(
              left: left + avatar * 172 / 280 - 20,
              top: top + avatar * 258 / 280 - 14,
              width: 40,
              child: _JerseyNumber(number: number, kit: kitOf(art.player!)),
            ),
          Positioned(
            left: 14,
            right: 14,
            top: _side - 35 - 32,
            height: 64,
            child: Transform.rotate(
              angle: spec.tilt * math.pi / 180,
              child: Center(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Stack(children: [
                    Text(caption, style: style(stroke(Colors.white, 11))),
                    Text(caption, style: style(stroke(ink, 3))),
                    Text(caption, style: style(null, color: accent)),
                  ]),
                ),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

final _blur = ui.ImageFilter.blur(sigmaX: 4, sigmaY: 4);

class _JerseyNumber extends StatelessWidget {
  final String number;
  final AvatarKit kit;
  const _JerseyNumber({required this.number, required this.kit});

  @override
  Widget build(BuildContext context) {
    const size = 15.7;
    return Stack(alignment: Alignment.center, children: [
      Text(number,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: size,
            fontWeight: FontWeight.w900,
            height: 1,
            foreground: Paint()
              ..style = PaintingStyle.stroke
              ..strokeWidth = 1.2
              ..color = _hexColor(kit.trim),
          )),
      Text(number, textAlign: TextAlign.center, style: TextStyle(fontSize: size, fontWeight: FontWeight.w900, height: 1, color: _hexColor(kit.ink))),
    ]);
  }
}

Color _hexColor(String hex) => Color(0xFF000000 | int.parse(hex.replaceFirst('#', ''), radix: 16));
