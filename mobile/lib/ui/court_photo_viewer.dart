import 'package:flutter/material.dart';
import 'theme.dart';

import '../core/media_url.dart';

/// Fullscreen swipeable court photos.
class CourtPhotoViewerScreen extends StatelessWidget {
  final List<String> photos;
  final int initialIndex;

  const CourtPhotoViewerScreen({super.key, required this.photos, this.initialIndex = 0});

  static void open(BuildContext context, List<String> photos, {int index = 0}) {
    if (photos.isEmpty) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => CourtPhotoViewerScreen(photos: photos, initialIndex: index),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final urls = photos.map(resolveMediaUrl).where((u) => u.isNotEmpty).toList();
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        systemOverlayStyle: systemBarsFor(Brightness.dark),
      ),
      body: PageView.builder(
        controller: PageController(initialPage: initialIndex.clamp(0, urls.length - 1)),
        itemCount: urls.length,
        itemBuilder: (_, i) => InteractiveViewer(
          minScale: 1,
          maxScale: 4,
          child: Center(
            child: Image.network(
              urls[i],
              fit: BoxFit.contain,
              errorBuilder: (_, _, _) => const Icon(Icons.broken_image_outlined, color: Colors.white54, size: 48),
            ),
          ),
        ),
      ),
    );
  }
}

/// Horizontal thumbnails; tap opens [CourtPhotoViewerScreen].
class CourtPhotoStrip extends StatelessWidget {
  final List<String> photos;
  final double height;

  const CourtPhotoStrip({super.key, required this.photos, this.height = 190});

  @override
  Widget build(BuildContext context) {
    if (photos.isEmpty) return const SizedBox.shrink();
    return SizedBox(
      height: height,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: photos.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final url = resolveMediaUrl(photos[i]);
          return GestureDetector(
            onTap: () => CourtPhotoViewerScreen.open(context, photos, index: i),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Image.network(
                url,
                width: 280,
                height: height,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Container(
                  width: 280,
                  height: height,
                  color: Colors.black12,
                  child: const Icon(Icons.image_not_supported_outlined),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
