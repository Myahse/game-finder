import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import 'api.dart';
import 'env.dart';

/// One WebSocket for the whole app. Screens listen to [events] and refresh
/// what they show; court stats carry the new numbers directly.
class Realtime extends ChangeNotifier {
  final Api api;
  final _controller = StreamController<Map<String, dynamic>>.broadcast();
  WebSocketChannel? _channel;
  StreamSubscription? _sub;
  Timer? _retry;
  Duration _backoff = const Duration(seconds: 1);
  bool connected = false;
  bool _stopped = true;

  Realtime(this.api);

  Stream<Map<String, dynamic>> get events => _controller.stream;

  Stream<Map<String, dynamic>> ofType(String type) => events.where((e) => e['type'] == type);

  Future<void> start() async {
    _stopped = false;
    await _connect();
  }

  Future<void> restart() async {
    stop();
    await start();
  }

  Future<void> _connect() async {
    if (_stopped) return;
    final token = await api.accessToken();
    final base = apiUrl.replaceFirst(RegExp(r'^http'), 'ws');
    final uri = Uri.parse('$base/api/ws${token != null ? '?token=${Uri.encodeQueryComponent(token)}' : ''}');
    try {
      final ch = WebSocketChannel.connect(uri);
      _channel = ch;
      await ch.ready;
      connected = true;
      _backoff = const Duration(seconds: 1);
      notifyListeners();
      _controller.add({'type': 'reconnected'}); // screens refetch anything missed
      _sub = ch.stream.listen(
        (msg) {
          try {
            _controller.add(Map<String, dynamic>.from(jsonDecode(msg as String)));
          } catch (_) {}
        },
        onDone: _scheduleReconnect,
        onError: (_) => _scheduleReconnect(),
        cancelOnError: true,
      );
    } catch (_) {
      _scheduleReconnect();
    }
  }

  void _scheduleReconnect() {
    connected = false;
    notifyListeners();
    _sub?.cancel();
    if (_stopped) return;
    _retry?.cancel();
    _retry = Timer(_backoff, _connect);
    _backoff = Duration(seconds: (_backoff.inSeconds * 2).clamp(1, 30));
  }

  void stop() {
    _stopped = true;
    _retry?.cancel();
    _sub?.cancel();
    _channel?.sink.close();
    connected = false;
  }

  @override
  void dispose() {
    stop();
    _controller.close();
    super.dispose();
  }
}
