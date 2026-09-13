# Sentra Core Vision

> Devolver autonomía a personas ciegas desde su celular.

## ¿Qué es?

App minimalista con UN botón: "ACTIVAR VISIÓN". Al tocar, la cámara del celular describe el entorno por voz.

## Cómo funciona

1. Tocar el botón
2. Cámara captura entorno
3. IA local (COCO-SSD) detecta objetos
4. Voz describe: "Detectados: persona, bicicleta"
5. Vibración confirma

## Estado

- ✅ PWA funcional
- ✅ VisionScreen con un botón
- ✅ COCO-SSD + TTS
- ✅ TalkBack ready
- ⏳ Flutter nativo (en desarrollo)
- ⏳ Piloto UMADESCA

## Accesibilidad

- TalkBack (Android)
- VoiceOver (iOS)
- NVDA (Windows)
- Alto contraste (negro + cyan)
- Botón ≥ 56px táctil
- ARIA labels completos

## Diferenciadores

- **100% offline**
- **Soberanía del dato**
- **Veto humano**
- **Trazabilidad inalterable (EVOLIS)**

## Stack

- TypeScript + React (PWA)
- Flutter (Android nativo)
- Node.js (backend)
- C++ + ESP32 (Tótem 2.0)

## Links

- Repo: github.com/matylipsa-create/Sentra-Core
- Pitch: docs/PITCH_UMADESCA.md
- Demo: docs/DEMO_SCRIPT.md

---

> "Cuando todo lo demás se apaga, Sentra Core sigue ahí."
