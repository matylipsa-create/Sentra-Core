# Sentra Core

**Navaja Suiza Soberana Multiplataforma**

> Cuando todo lo demas se apaga, Sentra Core sigue ahi.

## Principios

- **Offline-first**: Toda operacion funciona sin conexion a internet
- **Veto humano estricto**: El veto humano siempre tiene prioridad sobre cualquier accion
- **Soberania del dato**: Los datos pertenecen al usuario, almacenados localmente
- **Trazabilidad inalterable**: EVOLIS + firmas Dilithium (ECDSA P-256)
- **Modularidad**: Navaja suiza con 8 modos de operacion
- **Multiplataforma**: Celular + PC, UI adaptativa
- **Sincronizacion P2P**: Syncthing / Bluetooth Mesh / LoRa

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

## Arquitectura

```
src/
  lib/crypto.ts          SHA-256, UUID, hash chain, firmas Dilithium
  core/
    MoralNode.ts         Filtro etico (4 reglas)
    EVOLIS.ts            Hash chain + trazabilidad inalterable
    TCREIBridge.ts       Puente percepcion <-> lenguaje
    GeminiService.ts     IA con fallback local
    PerceptionEngine.ts  Vision, audio, IMU, STF, GPS
    DeviceManager.ts     Deteccion de capacidades
    PowerManager.ts      Ultra ahorro / normal / alto rendimiento
    SyncManager.ts       Sincronizacion P2P
  services/
    VoiceManager.ts      Sintesis de voz con cola y dedupe
    StorageService.ts    IndexedDB + exportacion/importacion
    SensorService.ts     GPS, IMU, barometro, luz, brujula
  hooks/
    useRealModeSensors   COCO-SSD + MoralNode + EVOLIS
    useDeviceCapabilities Deteccion de dispositivo
    usePowerMode         Gestion de energia
  context/
    AppContext.tsx       Estado global
    ToastContext.tsx     Notificaciones
  components/
    AccessibleMinimalUI  1 boton, voz, vibracion, doble toque, ARIA
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
3. **OFFLINE_ONLY**: Verifica operacion offline
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
