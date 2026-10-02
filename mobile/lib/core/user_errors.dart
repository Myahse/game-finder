import 'package:flutter/material.dart';

import '../ui/widgets.dart';
import 'api.dart';

/// Modal for location / alert rules; snackbar for everything else.
void showApiIssue(BuildContext context, Object e) {
  if (e is ApiException) {
    final modal = {
      'browse_location_mismatch',
      'notify_jump_too_far',
      'notify_rate_limited',
    };
    if (modal.contains(e.code)) {
      final title = e.code == 'browse_location_mismatch' ? 'Map area unavailable' : 'Alert area';
      showAppAlert(context, title: title, message: apiUserMessage(e));
      return;
    }
  }
  showSnack(context, errorText(e));
}
