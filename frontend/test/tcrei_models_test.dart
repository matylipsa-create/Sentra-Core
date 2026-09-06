import 'package:flutter_test/flutter_test.dart';
import 'package:sentra_core/models/tcrei_models.dart';

void main() {
  group('TCREIMessage', () {
    test('command creates correct type', () {
      final msg = TCREIMessage.command(
        module: 'bio',
        action: 'start_session',
        payload: {'protocol': 'cardiac_coherence'},
      );
      expect(msg.type, TCREIMessageType.command);
      expect(msg.module, 'bio');
      expect(msg.action, 'start_session');
      expect(msg.payload['protocol'], 'cardiac_coherence');
      expect(msg.id, isNotEmpty);
    });

    test('query creates correct type', () {
      final msg = TCREIMessage.query(
        module: 'evidencia',
        action: 'get_evidence',
      );
      expect(msg.type, TCREIMessageType.query);
      expect(msg.module, 'evidencia');
    });

    test('toJson and fromJson roundtrip', () {
      final msg = TCREIMessage.command(
        module: 'vision',
        action: 'process',
        payload: {'command': 'describir escena'},
      );
      final json = msg.toJson();
      final restored = TCREIMessage.fromJson(json);
      expect(restored.module, msg.module);
      expect(restored.action, msg.action);
      expect(restored.type, msg.type);
      expect(restored.payload['command'], 'describir escena');
    });
  });

  group('TCREIResponse', () {
    test('parses ok response', () {
      final json = {
        'type': 'response',
        'id': 'test-1',
        'ok': true,
        'data': {'result': 'done'},
        'timestamp': 1694123456789,
      };
      final resp = TCREIResponse.fromJson(json);
      expect(resp.ok, true);
      expect(resp.id, 'test-1');
      expect(resp.error, isNull);
    });

    test('parses error response', () {
      final json = {
        'type': 'error',
        'id': 'test-2',
        'ok': false,
        'error': 'No handler for command:unknown',
        'timestamp': 1694123456789,
      };
      final resp = TCREIResponse.fromJson(json);
      expect(resp.ok, false);
      expect(resp.error, 'No handler for command:unknown');
    });
  });
}
