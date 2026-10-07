import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../core/l10n.dart';

/// Gallery or camera. OS permission dialogs are handled by [ImagePicker].
Future<XFile?> pickImageFile(
  BuildContext context, {
  double maxWidth = 1600,
  int imageQuality = 85,
}) async {
  final source = await showModalBottomSheet<ImageSource>(
    context: context,
    useRootNavigator: true,
    showDragHandle: true,
    builder: (ctx) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            leading: const Icon(Icons.photo_library_outlined),
            title: Text(tr('Photo library', 'Photothèque')),
            onTap: () => Navigator.pop(ctx, ImageSource.gallery),
          ),
          ListTile(
            leading: const Icon(Icons.photo_camera_outlined),
            title: Text(tr('Camera', 'Appareil photo')),
            onTap: () => Navigator.pop(ctx, ImageSource.camera),
          ),
        ],
      ),
    ),
  );
  if (source == null) return null;

  return ImagePicker().pickImage(
    source: source,
    maxWidth: maxWidth,
    imageQuality: imageQuality,
    requestFullMetadata: false,
  );
}
