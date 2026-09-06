import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/app_state.dart';
import '../models/bio_session.dart';
import '../models/guardian_status.dart';
import '../models/tcrei_models.dart';
import 'sentra_client.dart';

/// Gestor de estado global de Sentra Core.
///
/// Sincroniza el estado local con el backend via WebSocket eventos
/// y REST queries. Expone [state] como ValueListenable para Provider.
class SentraStateNotifier extends ChangeNotifier {
  final SentraClient _client;
  AppStateData _state = const AppStateData();
  StreamSubscription? _eventSub;
  StreamSubscription? _connSub;

  SentraStateNotifier(this._client) {
    _eventSub = _client.events.listen(_onEvent);
    _connSub = _client.connectionChanges.listen(_onConnectionChange);
  }

  AppStateData get state => _state;

  /// Conectar al backend y cargar estado inicial.
  void init() {
    _client.connect();
    _refreshStatus();
  }

  // ─── Acciones ──────────────────────────────────────

  Future<void> processCommand(String command) async {
    final msg = TCREIMessage.command(
      module: _state.activeModule,
      action: 'process',
      payload: {'command': command},
    );
    final resp = await _client.sendCommand(msg);
    if (resp.ok && resp.data != null) {
      final data = resp.data as Map<String, dynamic>;
      final allowed = data['allowed'] as bool? ?? false;
      if (allowed) {
        final response = data['response'] as Map<String, dynamic>?;
        _state = _state.copyWith(
          lastResponseText: response?['text'] as String?,
          lastResponseSource: response?['source'] as String?,
          moralBlockReason: null,
        );
      } else {
        _state = _state.copyWith(
          moralBlockReason: data['reason'] as String? ?? 'Accion bloqueada',
        );
      }
      notifyListeners();
    }
  }

  Future<void> setModule(String module) async {
    final msg = TCREIMessage.command(
      module: 'system',
      action: 'set_module',
      payload: {'module': module},
    );
    await _client.sendCommand(msg);
    _state = _state.copyWith(activeModule: module);
    notifyListeners();
  }

  Future<void> toggleHumanVeto() async {
    final next = !_state.humanVeto;
    await _client.updateSetting('humanVeto', next);
    _state = _state.copyWith(humanVeto: next);
    notifyListeners();
  }

  Future<void> toggleBio() async {
    final next = !_state.bioEnabled;
    await _client.updateSetting('bioEnabled', next);
    _state = _state.copyWith(bioEnabled: next);
    notifyListeners();
  }

  Future<void> toggleWorldConnection() async {
    final next = !_state.worldEnabled;
    await _client.updateSetting('worldEnabled', next);
    _state = _state.copyWith(worldEnabled: next);
    notifyListeners();
  }

  Future<void> toggleGeminiRemote() async {
    final next = !_state.geminiRemote;
    await _client.updateSetting('geminiRemote', next);
    _state = _state.copyWith(geminiRemote: next);
    notifyListeners();
  }

  Future<void> startBioSession(String protocol) async {
    final msg = TCREIMessage.command(
      module: 'bio',
      action: 'start_session',
      payload: {'protocol': protocol},
    );
    await _client.sendCommand(msg);
  }

  Future<void> stopBioSession() async {
    final msg = TCREIMessage.command(
      module: 'bio',
      action: 'stop_session',
    );
    await _client.sendCommand(msg);
  }

  Future<void> getReframe() async {
    final msg = TCREIMessage.command(
      module: 'bio',
      action: 'get_reframe',
    );
    final resp = await _client.sendCommand(msg);
    if (resp.ok && resp.data != null) {
      final data = resp.data as Map<String, dynamic>;
      final reframe = data['reframe'] as String?;
      if (reframe != null) {
        _state = _state.copyWith(lastResponseText: reframe);
        notifyListeners();
      }
    }
  }

  Future<void> activateGuardian() async {
    final msg = TCREIMessage.command(
      module: 'guardian',
      action: 'activate_guardian',
    );
    await _client.sendCommand(msg);
  }

  Future<void> deactivateGuardian() async {
    final msg = TCREIMessage.command(
      module: 'guardian',
      action: 'deactivate_guardian',
    );
    await _client.sendCommand(msg);
  }

  Future<void> dismissQuarantine() async {
    final msg = TCREIMessage.command(
      module: 'guardian',
      action: 'dismiss_quarantine',
    );
    await _client.sendCommand(msg);
  }

  Future<void> resolveAlert(String alertId) async {
    final msg = TCREIMessage.command(
      module: 'guardian',
      action: 'resolve_alert',
      payload: {'alertId': alertId},
    );
    await _client.sendCommand(msg);
  }

  Future<void> clearAlerts() async {
    final msg = TCREIMessage.command(
      module: 'guardian',
      action: 'clear_alerts',
    );
    await _client.sendCommand(msg);
  }

  Future<bool> checkChain() async {
    final msg = TCREIMessage.command(
      module: 'evidencia',
      action: 'check_chain',
    );
    final resp = await _client.sendCommand(msg);
    if (resp.ok && resp.data != null) {
      return (resp.data as Map<String, dynamic>)['valid'] as bool? ?? false;
    }
    return false;
  }

  // ─── Estado interno ────────────────────────────────

  Future<void> _refreshStatus() async {
    try {
      final status = await _client.getStatus();
      _state = _state.copyWith(
        activeModule: status['activeModule'] as String? ?? 'vision',
        humanVeto: status['humanVeto'] as bool? ?? false,
        bioEnabled: status['bioEnabled'] as bool? ?? false,
        geminiRemote: status['geminiRemote'] as bool? ?? false,
        worldEnabled: status['worldEnabled'] as bool? ?? false,
        evidenceCount: status['evidenceCount'] as int? ?? 0,
      );
      notifyListeners();
    } catch {
      // backend no disponible, usar defaults
    }
  }

  void _onConnectionChange(bool connected) {
    _state = _state.copyWith(connected: connected);
    notifyListeners();
    if (connected) _refreshStatus();
  }

  void _onEvent(TCREIEventData event) {
    switch (event.event) {
      case 'bio.tick':
        final data = event.data as Map<String, dynamic>?;
        if (data != null) {
          _state = _state.copyWith(
            bioState: _state.bioState.copyWith(
              cardiacCoherence: (data['coherence'] as num?)?.toDouble() ?? 0.5,
              stressLevel: (data['stress'] as num?)?.toDouble() ?? 0.5,
              focusLevel: (data['focus'] as num?)?.toDouble() ?? 0.5,
            ),
          );
          notifyListeners();
        }
        break;
      case 'bio.session_complete':
        _refreshStatus();
        break;
      case 'guardian.state_change':
        final data = event.data as Map<String, dynamic>?;
        if (data != null) {
          final gs = GuardianStatus.fromJson(data);
          _state = _state.copyWith(guardianState: gs.state);
          notifyListeners();
        }
        break;
      case 'evidence.recorded':
        _state = _state.copyWith(evidenceCount: _state.evidenceCount + 1);
        notifyListeners();
        break;
      case 'moral.blocked':
        final data = event.data as Map<String, dynamic>?;
        _state = _state.copyWith(
          moralBlockReason: data?['reason'] as String?,
        );
        notifyListeners();
        break;
      case 'connection.status':
        final data = event.data as Map<String, dynamic>?;
        _state = _state.copyWith(connected: data?['connected'] as bool? ?? false);
        notifyListeners();
        break;
    }
  }

  @override
  void dispose() {
    _eventSub?.cancel();
    _connSub?.cancel();
    super.dispose();
  }
}
