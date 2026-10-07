import 'package:flutter/foundation.dart';

/// This week's Kings of the Court (GET /api/kings), shared by every avatar on
/// screen and refetched at most every [ttl] — like the web's useKings.
class KingsCache extends ChangeNotifier {
  KingsCache({DateTime Function()? clock, this.ttl = const Duration(minutes: 10)}) : _clock = clock ?? DateTime.now;

  static final instance = KingsCache();

  final DateTime Function() _clock;
  final Duration ttl;

  /// Loads the kings list; null = signed out (nothing is fetched).
  Future<dynamic> Function()? fetcher;

  Set<String> _ids = const {};
  DateTime? _fetchedAt;
  Future<void>? _inflight;

  /// Whether [userId] is a king. Starts a (throttled) refresh when stale.
  bool isKing(String? userId) {
    _refreshIfStale();
    return userId != null && _ids.contains(userId);
  }

  bool get stale {
    final at = _fetchedAt;
    return at == null || _clock().difference(at) >= ttl;
  }

  void _refreshIfStale() {
    if (_inflight != null || fetcher == null || !stale) return;
    // Out of the build phase: listeners rebuild once the list arrives.
    _inflight = Future<void>(refresh).whenComplete(() => _inflight = null);
  }

  Future<void> refresh() async {
    final f = fetcher;
    if (f == null) return;
    // Mark fetched first so a failure doesn't retry on every avatar build.
    _fetchedAt = _clock();
    try {
      final j = await f();
      final ids = <String>{
        for (final k in (j as List? ?? const []))
          if (k is Map && k['user_id'] is String) k['user_id'] as String,
      };
      if (!setEquals(ids, _ids)) {
        _ids = ids;
        notifyListeners();
      }
    } catch (_) {}
  }

  /// Signed out / switched account.
  void reset() {
    _fetchedAt = null;
    if (_ids.isNotEmpty) {
      _ids = const {};
      notifyListeners();
    }
  }
}
