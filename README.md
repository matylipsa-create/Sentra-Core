# Sentra Core

**Navaja Suiza Soberana Multiplataforma**

> Cuando todo lo demas se apaga, Sentra Core sigue ahi.

## Principios

- **Offline-first**: Toda operacion funciona sin conexion a internet
- **Veto humano estricto**: El veto humano siempre tiene prioridad sobre cualquier accion
- **Soberania del dato**: Los datos pertenecen al usuario, almacenados localmente
- **Trazabilidad inalterable**: EVOLIS + firmas Dilithium (ECDSA P-256)
- **Modularidad**: Navaja suiza con 9 modos de operacion
- **Multiplataforma**: Celular + PC, UI adaptativa
- **Sincronizacion P2P**: Syncthing / Bluetooth Mesh / LoRa
- **Bio-Software Interface**: Inferencia activa, placebos cognitivos, neuroplasticidad, epigenetica, reencuadre cognitivo y coherencia cardiaca

## Deteccion Offline

La deteccion de objetos (COCO-SSD) se ejecuta **siempre localmente**, sin depender de la conexion a internet. El modo offline solo afecta a la IA generativa (Gemini), no a la percepcion.

- Cuando hay internet + Gemini ON: respuestas en lenguaje natural generadas por la IA
- Cuando no hay internet o Gemini OFF: respuestas contextuales basadas en los objetos detectados (ej: "Veo una persona", "Detecto: TV, persona, silla")
- Cache de respuestas offline en memoria para respuesta instantanea (< 200ms)

## Voz Bilateral

Sentra Core soporta comunicacion de voz en dos direcciones:

- **Sintesis de voz (TTS)**: El agente habla usando SpeechSynthesis con selector de voces del sistema
- **Escucha pasiva (STT)**: Cuando se activa "Escucha ON", el agente escucha continuamente usando SpeechRecognition y procesa comandos de voz automaticamente
- **Comando manual**: Boton de voz para comandos puntuales sin escucha pasiva

El filtro etico (MoralNode) se aplica a **todos** los comandos, tanto de voz como de texto.

## Modos de Operacion

| Modo | Descripcion |
|------|-------------|
| vision | Camara + COCO-SSD + descripcion por voz |
| seguridad | Sensores + alertas + EVOLIS + monitoreo |
| movimiento | GPS + IMU + orientacion + vibracion guia |
| juego | Narrativa adaptativa |
| aprendizaje | GeminiService + preguntas + respuestas |
| impacto | STF + ARS Evolved + energy harvesting |
| silencio | Vibracion + LEDs (sin voz) |
| evidencia | EVOLIS + hash chain + exportacion |
| bio | Inferencia activa, placebos cognitivos, neuroplasticidad, epigenetica, coherencia cardiaca |

## Arquitectura

```
src/
  lib/crypto.ts          SHA-256, UUID, hash chain, firmas Dilithium
  core/
    MoralNode.ts         Filtro etico (4 reglas)
    EVOLIS.ts            Hash chain + trazabilidad inalterable
    TCREIBridge.ts       Puente percepcion <-> lenguaje
    GeminiService.ts     IA con fallback local + cache offline
    PerceptionEngine.ts  Vision, audio, IMU, STF, GPS
    DeviceManager.ts     Deteccion de capacidades
    PowerManager.ts      Ultra ahorro / normal / alto rendimiento
    SyncManager.ts       Sincronizacion P2P
    BioSoftwareInterface.ts  Inferencia activa, placebos, reencuadre, coherencia cardiaca
    HardwareAutoAdjust.ts  Auto-ajuste segun hardware (incluye Bio)
  services/
    VoiceManager.ts      Sintesis + escucha pasiva + selector de voz
    StorageService.ts    IndexedDB + exportacion/importacion
    SensorService.ts     GPS, IMU, barometro, luz, brujula
  hooks/
    useRealModeSensors   COCO-SSD + MoralNode + EVOLIS
    useDeviceCapabilities Deteccion de dispositivo
    usePowerMode         Gestion de energia
  context/
    AppContext.tsx       Estado global + persistencia de settings
    ToastContext.tsx     Notificaciones
  components/
    AccessibleMinimalUI  Botones, voz bilateral, vibracion, ARIA
    AdaptiveUI           Tactil vs mouse/teclado
    CameraStream         Camara en vivo + detecciones
    DemoModeBanner       Metricas del sistema
  modules/
    ModuleManager        Navaja suiza - activar/desactivar modulos
  App.tsx                Componente principal
  main.tsx               Punto de entrada
  registerServiceWorker  PWA offline
public/
  manifest.json          Configuracion PWA
  sw.js                  Service Worker offline-first
  icon.svg               Icono de la app
scripts/
  generate-state.js      Generador de estado EVOLIS + MoralNode
```

## Verificacion

```bash
npm run typecheck   # Verificacion de tipos
npm run build       # Build de produccion
npm run preview     # Preview PWA
```

## Filtro Etico (MoralNode)

4 reglas inquebrantables:

1. **NO_VIOLENCE**: Bloquea comandos con lenguaje violento
2. **PRIVACY_FIRST**: Bloquea solicitudes de datos sensibles
3. **OFFLINE_ONLY**: Verifica operacion offline (activa con externalRequest: true)
4. **HUMAN_VETO**: El veto humano bloquea todas las acciones

## Trazabilidad (EVOLIS)

- Hash chain con SHA-256
- Firmas digitales (ECDSA P-256, equivalente funcional a Dilithium)
- Verificacion de integridad de la cadena completa
- Exportacion de respaldo completo
- Almacenamiento persistente en IndexedDB

## PWA

- Instalable en celular y desktop
- Service Worker con cache offline-first
- Manifest con iconos y colores de tema
- Funciona sin conexion a internet

## Preparacion para Verticales

El motor Sentra Core esta listo para ser integrado en las aplicaciones verticales:

- **Sentinel**: Modo de seguridad y monitoreo con sensores + EVOLIS
- **Vision**: Asistencia visual con deteccion offline + descripcion por voz

Ambas verticales pueden reutilizar el motor de percepcion, el filtro etico, la trazabilidad EVOLIS, el sistema de voz bilateral, y la capa de BioSoftware.

## BioSoftware (BioSoftwareInterface)

Capa funcional que optimiza el "hardware biologico" del usuario:

- **Coherencia cardiaca**: Respiracion guiada 5.5 bpm con guia visual (inhala/exhala)
- **Placebo cognitivo**: Refuerzo de expectativas positivas
- **Reencuadre cognitivo**: Cambio de perspectiva ante estres o ansiedad
- **Inferencia activa**: Prediccion y minimizacion de error
- **Neuroplasticidad**: Ejercicios de formacion de conexiones neuronales
- **Epigenetica**: Modulacion de expresion genetica mediante habits

Cada protocolo genera sesiones con metricas (coherencia, estres, enfoque, ciclos respiratorios) y reencuadres contextuales. Las sesiones se registran en EVOLIS.
