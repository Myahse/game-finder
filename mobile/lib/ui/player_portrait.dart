import 'package:flutter/material.dart';

import '../core/player_avatar.dart';

/// Head-and-shoulders player portrait (DiceBear Avataaars PNG). Keeps the
/// previous look on screen while the next one loads (gaplessPlayback), so the
/// studio preview never flashes blank between choices.
class PlayerAvatarPortrait extends StatelessWidget {
  const PlayerAvatarPortrait({super.key, required this.avatar, this.pixels = 256, this.spinner = true});
  final PlayerAvatar avatar;

  /// Requested PNG size (DiceBear caps PNGs at 256 px).
  final int pixels;

  /// Small spinner on top while a new look downloads.
  final bool spinner;

  @override
  Widget build(BuildContext context) {
    return Image.network(
      playerAvatarPngUrl(avatar, size: pixels),
      fit: BoxFit.contain,
      alignment: Alignment.bottomCenter,
      gaplessPlayback: true,
      errorBuilder: (_, _, _) => LayoutBuilder(
        builder: (_, c) => Center(child: Icon(Icons.person, size: c.biggest.shortestSide * 0.5, color: Colors.grey)),
      ),
      loadingBuilder: (context, child, progress) => progress == null || !spinner
          ? child
          : Stack(fit: StackFit.expand, children: [
              child,
              const Center(child: SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))),
            ]),
    );
  }
}

/// #rrggbb → Color.
Color colorFromHex(String hex) => Color(0xFF000000 | int.parse(hex.replaceFirst('#', ''), radix: 16));
