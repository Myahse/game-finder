import 'package:flutter/material.dart';

import '../ui/widgets.dart';
import 'api.dart';
import 'api_errors.dart';

/// Modal for location / alert rules; snackbar for everything else.
void showApiIssue(BuildContext context, Object e) {
  if (e is ApiException) {
    const modal = {
      'browse_location_mismatch',
      'notify_jump_too_far',
      'notify_rate_limited',
    };
    final toast = apiErrorToast(e.code);
    if (modal.contains(e.code) && toast != null) {
      showAppAlert(context, title: toast.title, message: toast.description);
      return;
    }
  }
  showSnack(context, errorText(e));
}
