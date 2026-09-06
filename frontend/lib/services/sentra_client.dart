import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:web_socket_channel/web_socket_channel.dart';
import '../config/constants.dart';
import '../models/tcrei_models.dart';

/// Cliente de comunicacion con el backend Sentra Core.
///
/// Mantiene una conexion WebSocket persistente para eventos en tiempo real
/// y un cliente HTTP para consultas REST puntuales.
class SentraClient {
  WebSocketChannel? _channel;
  StreamSubscription? _wsSub;
  bool _connected = false;
  int _reconnectAttempts = 0;
  Timer? _reconnectTimer;

  final _responseController = StreamController<TCREIResponse>.broadcast();
  final _eventController = StreamController<TCREIEventData>.broadcast();
  final _connectionController = StreamController<bool>.broadcast();

  /// Stream de respuestas a comandos/queries.
  Stream<TCREIResponse> get responses => _responseController.stream;

  /// Stream de eventos push del backend.
  Stream<TCREIEventData> get events => _eventController.stream;

  /// Stream de cambios de conexion.
  Stream<bool> get connectionChanges => _connectionController.stream;

  /// Si esta conectado al backend.
  bool get isConnected => _connected;

  /// Conectar al WebSocket del backend.
  void connect() {
    if (_channel != null) return;
    try {
      _channel = WebSocketChannel.connect(
        Uri.parse(SentraConstants.wsUrl),
      );
      _wsSub = _channel!.stream.listen(
        _onData,
        onError: (error) => _onError(error),
        onDone: _onDone,
      );
      _connected = true;
      _reconnectAttempts = 0;
      _connectionController.add(true);
    } catch (e) {
      _scheduleReconnect();
    }
  }

  /// Desconectar.
  void disconnect() {
    _reconnectTimer?.cancel();
    _wsSub?.cancel();
    _channel?.sink.close();
    _channel = null;
    _connected = false;
    _connectionController.add(false);
  }

  /// Enviar un mensaje al backend.
  void send(TCREIMessage message) {
    if (_channel != null && _connected) {
      _channel!.sink.add(jsonEncode(message.toJson()));
    }
  }

  /// Enviar un comando y esperar la respuesta.
  Future<TCREIResponse> sendCommand(TCREIMessage message, {Duration timeout = const Duration(seconds: 10)}) {
    send(message);
    return responses
        .where((r) => r.id == message.id)
        .first
        .timeout(timeout, onTimeout: () => TCREIResponse(
              id: message.id,
              ok: false,
              error: 'Timeout',
              timestamp: DateTime.now().millisecondsSinceEpoch,
            ));
  }

  // ─── REST API ─────────────────────────────────────

  Future<Map<String, dynamic>> getStatus() => _get('status');
  Future<Map<String, dynamic>> getModules() => _get('modules');
  Future<Map<String, dynamic>> getEvidence() => _get('evidence');
  Future<Map<String, dynamic>> getBioProtocols() => _get('bio/protocols');
  Future<Map<String, dynamic>> getBioState() => _get('bio/state');
  Future<Map<String, dynamic>> getBioStats() => _get('bio/stats');
  Future<Map<String, dynamic>> getGuardianStatus() => _get('guardian/status');

  Future<Map<String, dynamic>> verifyEvidence() => _post('evidence/verify', {});

  Future<Map<String, dynamic>> sendCommandREST(String command, {String perception = 'Sin percepcion activa'}) =>
      _post('command', {'command': command, 'perception': perception});

  Future<Map<String, dynamic>> updateSetting(String key, dynamic value) =>
      _post('settings', {'key': key, 'value': value});

  // ─── Internal ─────────────────────────────────────

  Future<Map<String, dynamic>> _get(String route) async {
    final res = await http.get(Uri.parse('${SentraConstants.apiUrl}/$route'));
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> _post(String route, Map<String, dynamic> body) async {
    final res = await http.post(
      Uri.parse('${SentraConstants.apiUrl}/$route'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  void _onData(dynamic data) {
    try {
      final json = jsonDecode(data as String) as Map<String, dynamic>;
      if (json['type'] == 'event') {
        _eventController.add(TCREIEventData.fromJson(json));
      } else {
        _responseController.add(TCREIResponse.fromJson(json));
      }
    } catch {
      // invalid JSON, ignore
    }
  }

  void _onError(Object error) {
    _connected = false;
    _connectionController.add(false);
    _scheduleReconnect();
  }

  void _onDone() {
    _connected = false;
    _connectionController.add(false);
    _channel = null;
    _scheduleReconnect();
  }

  void _scheduleReconnect() {
    if (_reconnectAttempts >= SentraConstants.maxReconnectAttempts) return;
    _reconnectAttempts++;
    final delay = Duration(
      seconds: SentraConstants.reconnectBaseDelaySec * _reconnectAttempts,
    );
    _reconnectTimer = Timer(delay, () => connect());
  }

  void dispose() {
    disconnect();
    _responseController.close();
    _eventController.close();
    _connectionController.close();
  }
}
