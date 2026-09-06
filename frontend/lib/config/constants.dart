/// Constantes de configuracion para Sentra Core Frontend.
class SentraConstants {
  SentraConstants._();

  /// URL del WebSocket del backend.
  static const String wsUrl = String.fromEnvironment(
    'SENTRA_WS_URL',
    defaultValue: 'ws://localhost:8080',
  );

  /// URL base del REST API del backend.
  static const String apiUrl = String.fromEnvironment(
    'SENTRA_API_URL',
    defaultValue: 'http://localhost:8080/api',
  );

  /// Intervalo de ping WebSocket (segundos).
  static const int pingIntervalSec = 30;

  /// Maximos intentos de reconexion.
  static const int maxReconnectAttempts = 5;

  /// Delay base de reconexion (segundos).
  static const int reconnectBaseDelaySec = 1;

  /// Duracion de animacion del orbe de voz (ms).
  static const int orbAnimationMs = 300;

  /// Minima altura de botones tactiles (dp).
  static const double minTouchHeight = 56;

  /// Diametro del orbe de voz (dp).
  static const double orbSize = 72;
}
