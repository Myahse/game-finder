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

  /// Connects only while someone is signed in (the socket needs a ws-ticket).
  Future<void> start() async {
    if (api.session == null) {
      stop();
      return;
    }
    _stopped = false;
    await _connect();
  }

  Future<void> restart() async {
    stop();
    await start();
  }

  int _gen = 0; // bumped by stop(): a connect that started earlier gives up

  Future<void> _connect() async {
    if (_stopped) return;
    if (api.session == null) {
      stop(); // signed out meanwhile — nothing to connect to
      return;
    }
    final gen = _gen;
    final base = apiUrl.replaceFirst(RegExp(r'^http'), 'ws');
    String qs = '';
    try {
      final t = await api.post('/api/me/ws-ticket', {});
      final ticket = t is Map ? t['ticket'] as String? : null;
      if (ticket != null && ticket.isNotEmpty) {
        qs = '?ticket=${Uri.encodeQueryComponent(ticket)}';
      }
    } catch (_) {
      // Offline, server down or session gone: try again later (backoff).
      if (gen == _gen) _scheduleReconnect();
      return;
    }
    if (_stopped || gen != _gen) return;
    final uri = Uri.parse('$base/api/ws$qs');
    try {
      final ch = WebSocketChannel.connect(uri);
      _channel = ch;
      await ch.ready;
      if (_stopped || gen != _gen) {
        ch.sink.close();
        return;
      }
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
      if (gen == _gen) _scheduleReconnect();
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
    _gen++;
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
