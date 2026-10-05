import 'package:flutter/material.dart';

import '../core/avatar_presets.dart';
import '../core/dicebear_avatar.dart';

class AvatarPresetWidget extends StatelessWidget {
  const AvatarPresetWidget({super.key, required this.config, this.size = 96, this.headOnly = false});
  final AvatarConfigV2 config;
  final double size;
  final bool headOnly;

  @override
  Widget build(BuildContext context) {
    final h = headOnly ? size : size * 1.35;
    final url = dicebearAvatarUrl(config, size: (size * 2).round().clamp(128, 512));
    return ClipRRect(
      borderRadius: BorderRadius.circular(headOnly ? size : 16),
      child: SizedBox(
        width: size,
        height: h,
        child: ColoredBox(
          color: const Color(0xFFE8EEF4),
          child: Image.network(
            url,
            fit: BoxFit.cover,
            alignment: headOnly ? const Alignment(0, -0.35) : const Alignment(0, -0.2),
            errorBuilder: (_, _, _) => Icon(Icons.person, size: size * 0.5, color: Colors.grey),
            loadingBuilder: (context, child, progress) =>
                progress == null ? child : Center(child: SizedBox(width: size * 0.3, height: size * 0.3, child: const CircularProgressIndicator(strokeWidth: 2))),
          ),
        ),
      ),
    );
  }
}
