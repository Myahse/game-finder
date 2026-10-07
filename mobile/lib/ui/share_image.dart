import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

/// PNG bytes of the [RepaintBoundary] under [key] (null when it isn't laid out).
/// [pixelRatio] scales logical pixels to image pixels (e.g. 360 × 3 = 1080).
Future<Uint8List?> captureBoundaryPng(GlobalKey key, {double pixelRatio = 3, Duration settle = const Duration(milliseconds: 50)}) async {
  // Let images finish painting before the snapshot.
  if (settle > Duration.zero) await Future<void>.delayed(settle);
  final ro = key.currentContext?.findRenderObject();
  if (ro is! RenderRepaintBoundary) return null;
  final image = await ro.toImage(pixelRatio: pixelRatio);
  try {
    final data = await image.toByteData(format: ui.ImageByteFormat.png);
    return data?.buffer.asUint8List();
  } finally {
    image.dispose();
  }
}

/// Where the share sheet anchors on iPad: the widget under [key].
Rect? shareOriginOf(GlobalKey key) {
  final box = key.currentContext?.findRenderObject() as RenderBox?;
  if (box == null || !box.hasSize) return null;
  return box.localToGlobal(Offset.zero) & box.size;
}

/// Where the share sheet anchors on iPad: the widget that owns [context].
Rect? shareOriginOfContext(BuildContext context) {
  final box = context.findRenderObject();
  if (box is! RenderBox || !box.hasSize) return null;
  return box.localToGlobal(Offset.zero) & box.size;
}

/// Opens the system share sheet with PNG files (and optional text). From there
/// the player can send it (WhatsApp…) or save it to Photos / Files.
Future<ShareResult> sharePngs(
  List<({Uint8List bytes, String name})> files, {
  String? text,
  String? title,
  Rect? origin,
}) {
  return SharePlus.instance.share(ShareParams(
    title: title,
    text: text,
    files: [for (final f in files) XFile.fromData(f.bytes, mimeType: 'image/png', name: f.name)],
    fileNameOverrides: [for (final f in files) f.name],
    sharePositionOrigin: origin,
  ));
}
