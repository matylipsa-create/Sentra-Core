# Arquitectura de Interfaz Multimodal — Sentra Core

## Visión general

La interfaz para personas ciegas **no es una pantalla**: es un **bus de eventos táctil y auditivo**. La pantalla queda como capa secundaria para videntes y configuración.

## 3 niveles jerárquicos de prioridad

| Nivel | Nombre | Canal | Regla |
|---|---|---|---|
| 1 | CRITICAL (Sentinel / BacterialGuardian) | Háptico pesado + TTS prioritario | Interrumpe todo |
| 2 | NAVIGATION (Visión / COCO-SSD) | Audio 3D binaural + beeps | Bloqueado si Nivel 1 activo |
| 3 | DESCRIPTIVE (descripción a demanda) | TTS alta velocidad | Solo por gesto explícito |

## Integración con arquitectura existente

| Componente existente | Rol en la nueva arquitectura |
|---|---|
| `ContextGovernor.ts` | Maneja `priorityLevel` (CRITICAL/NAVIGATION/DESCRIPTIVE) |
| `BacterialGuardian.ts` | Emite señal ternaria (-1 amenaza, 0 incierto, +1 seguro) → `ContextGovernor` |
| `EventRouter.ts` | Enruta eventos por prioridad con cooldowns |
| `VoiceManager.ts` | `speakPriority(text, priority)` — extiende TTS existente |
| `DeviceManager.ts` | `vibratePattern(name)` — extiende vibración existente |
| `CognitiveLoadManager.ts` | Tracking de carga por prioridad |
| `SentraVisionAccessibility.ts` | Delega `announcePriority()` a `VoiceManager` |

## Componentes nuevos (esta capa)

- `SpatialAudioEngine.ts` — Audio 3D binaural real (Web Audio API + HRTF + PannerNode).
- `QuadrantGestures.ts` — Lógica de los 4 cuadrantes táctiles.
- `BlindTactileQuadrants.tsx` — Componente táctil con 4 zonas ARIA.

## 4 cuadrantes táctiles ciegos

| Cuadrante | Acción | ARIA |
|---|---|---|
| TOP_LEFT | Modo ojos (bus/objetos) | "Modo ojos. Toque para conmutar..." |
| TOP_RIGHT | Descripción instantánea | "Descripción instantánea..." |
| BOTTOM_LEFT | Estado Sentinel | "Estado del guardián perimetral..." |
| BOTTOM_RIGHT | Perímetro / Pánico / Silenciar | "Fijar perímetro o botón de pánico..." |

## Cooldowns

| Nivel | Cooldown |
|---|---|
| CRITICAL | 500 ms |
| NAVIGATION | 1500 ms |
| DESCRIPTIVE | 3000 ms |
| Sentinel release | 5000 ms |

## Flujo de ejemplo

1. Usuario camina. COCO-SSD detecta obstáculo a la izquierda a 1.2m.
2. `EventRouter` clasifica como NAVIGATION.
3. `SpatialAudioEngine.playSpatialBeep(-0.8, 1.2)` → beep en oído izquierdo, frecuencia alta.
4. Simultáneamente, `BacterialGuardian` detecta movimiento sospechoso → señal -1.
5. `ContextGovernor.setPriorityLevel('CRITICAL')`.
6. `VoiceManager.speakPriority('Alerta: movimiento en perímetro', 'critical')` → `speechSynthesis.cancel()` + habla.
7. `DeviceManager.vibratePattern('SENTINEL_ALERT')` → [400,100,400,100,800].
8. Tras 5s, `ContextGovernor` libera y vuelve a NAVIGATION.

## Referencias

- `docs/ZERO_LATENCY_ARCHITECTURE.md`
- `docs/LORA_PROTOCOL_ARCHITECTURE.md`
- `docs/QUANTIZED_AI_ARCHITECTURE.md`

## Frase de cierre

> Cuando todo lo demás se apaga, la prioridad sigue ahí.
