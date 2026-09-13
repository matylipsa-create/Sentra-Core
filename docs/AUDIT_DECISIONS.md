# Decisiones de Auditoría — Sentra Core Vision

## Fecha: 2026-09-13

## 1. Sensores huérfanos (marcar como futuro)

- src/services/BluetoothSensorService.ts
- src/services/SerialSensorService.ts
- src/services/USBSensorService.ts

Razón: Funcionales, pero requieren user gesture (requestDevice/requestPort)
+ configs predefinidas. Infraestructura válida para Tótem 2.0 / nodos ESP32.

Acción: No conectar ahora. Marcar como "roadmap hardware".

## 2. DeviceSensorManager (refactor opcional baja prioridad)

Razón: Duplica 5/8 sensores de DeviceManager.detect().
Mantiene AvailableSensor[] (active toggle) que DeviceManager no tiene.

Acción: Refactor opcional — usar DeviceManager.detect() internamente.
No urgente. No rompe nada.

## 3. FieldLogManager (mantener como está)

Razón: Duplicación de patrón (2 líneas: evolis.record + storageService.saveState).
Funcionalidad única: checklists, marcadores, suscripción por estado.

Acción: No refactorizar. Forzar delegación rompería el módulo EVOLIS.

## 4. Código muerto eliminado (21 archivos total)

Ver historial de commits.
