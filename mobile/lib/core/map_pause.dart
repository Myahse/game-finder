import 'package:flutter/foundation.dart';

/// Pauses the home map while a full-screen route (e.g. game detail) is open.
/// Bottom sheets do not touch this — only [openGameScreen].
class MapPause extends ChangeNotifier {
  int _depth = 0;
  bool get paused => _depth > 0;

  void pushOverlay() {
    _depth++;
    notifyListeners();
  }

  void popOverlay() {
    if (_depth > 0) _depth--;
    notifyListeners();
  }
}
