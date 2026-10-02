
import 'package:flutter/foundation.dart';

/// Release-mode error logging. Plug in Crashlytics/Sentry here when you add a package.
void initMonitoring() {
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    if (kReleaseMode) {
      debugPrint('[ftg] FlutterError: ${details.exceptionAsString()}');
    }
  };

  PlatformDispatcher.instance.onError = (error, stack) {
    if (kReleaseMode) {
      debugPrint('[ftg] async error: $error\n$stack');
    }
    return true;
  };
}
