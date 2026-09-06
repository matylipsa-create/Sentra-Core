# Tótem 2.0 — Arquitectura de Hardware

**Sentra Core · Hardware de referencia**

> Nodo soberano para despliegues sin conectividad.

---

## Visión General

El Tótem 2.0 es el hardware de referencia para ejecutar Sentra Core en entornos sin internet garantizado. Combina un nodo central de procesamiento con nodos de percepción distribuidos, comunicándose por LoRa, Bluetooth Mesh y Syncthing.

```
┌──────────────────────────────────────────────────┐
│                  TÓTEM 2.0                         │
│                                                    │
│  ┌─────────────┐     ┌──────────────────────────┐  │
│  │  Nodo Central │     │  Nodos de Percepción     │  │
│  │  (Raspberry   │     │  (ESP32 x N)             │  │
│  │   Pi 4 / PC) │     │                          │  │
│  │              │     │  Sensores:               │  │
│  │  - Sentra    │◄───►│  - Temperatura           │  │
│  │    Core Motor │     │  - Humedad               │  │
│  │  - EVOLIS     │ LoRa│  - Luz                   │  │
│  │  - MoralNode  │ BT  │  - Movimiento (PIR)      │  │
│  │  - Gemini     │ Mesh│  - Cámara (ESP32-CAM)    │  │
│  │  - SyncManager│     │  - STF (Skin Temp Flux)  │  │
│  └──────┬───────┘     └──────────────────────────┘  │
│         │                                          │
│  ┌──────┴───────┐     ┌──────────────────────────┐  │
│  │  Almacenam.  │     │  Energía                 │  │
│  │              │     │                          │  │
│  │  - USB/SD    │     │  - Batería recargable     │  │
│  │    (export   │     │  - Carga Qi (inalámbrica) │  │
│  │     EVOLIS) │     │  - Panel solar (opcional) │  │
│  │  - IndexedDB │     │  - USB-C (carga rápida)  │  │
│  └──────────────┘     └──────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

---

## Nodo Central

### Especificaciones

| Componente | Recomendado | Mínimo |
|------------|-------------|--------|
| **SBC** | Raspberry Pi 4 (4GB) | Raspberry Pi 3B+ (1GB) |
| **Alternativa** | PC de bajo consumo (x86) | Cualquier PC con Node.js |
| **Almacenamiento** | 64GB microSD + USB 32GB | 16GB microSD |
| **RAM** | 4GB | 1GB |
| **Red** | WiFi + Bluetooth + LoRa HAT | WiFi |
| **OS** | Raspberry Pi OS Lite (64-bit) | Cualquier Linux |

### Software

- **Node.js 20+**: Ejecuta el Sentra Core API Server (WebSocket + REST)
- **Sentra Core Motor**: TypeScript, compilado y servido via Vite
- **Syncthing**: Sincronización P2P de datos entre tótems
- **EVOLIS**: Hash chain persistente en almacenamiento local

### Puertos

| Puerto | Protocolo | Uso |
|--------|-----------|-----|
| 8080 | WebSocket | Comunicación tiempo real (TCREI) |
| 8080 | HTTP REST | Consultas de estado, evidencia, configuración |
| 8384 | HTTP | Syncthing (sincronización P2P) |

---

## Nodos de Percepción (ESP32)

### Especificaciones

| Componente | Detalle |
|------------|---------|
| **MCU** | ESP32 (dual-core, 240MHz, WiFi + BT) |
| **Variante** | ESP32-CAM (con cámara OV2640) para visión |
| **Sensores** | DHT22 (temp/humedad), BH1750 (luz), PIR (movimiento), STF |
| **Comunicación** | LoRa (SX1276), Bluetooth Mesh, WiFi |
| **Energía** | Batería LiPo 18650 + carga solar opcional |
| **Firmware** | Arduino / PlatformIO |

### Sensores Soportados

| Sensor | Función | Modo Sentra |
|--------|---------|-------------|
| **DHT22** | Temperatura y humedad ambiente | Seguridad, Impacto |
| **BH1750** | Luz ambiental | Seguridad, Silencio |
| **PIR** | Detección de movimiento | Seguridad |
| **ESP32-CAM** | Cámara para visión por computadora | Visión |
| **MPU6050** | IMU (acelerómetro + giroscopio) | Movimiento |
| **STF** | Skin Temperature Flux | Impacto, Bio |
| **NEO-6M** | GPS | Movimiento |
| **BMP280** | Barómetro | Seguridad |

---

## Comunicación

### LoRa (Larga Distancia)

- **Módulo**: SX1276 (433MHz / 915MHz según región)
- **Alcance**: 2-15 km (línea de vista)
- **Uso**: Sincronización entre tótems distantes, alertas críticas
- **Datos**: Paquetes pequeños firmados (SyncManager)

### Bluetooth Mesh (Local)

- **Protocolo**: BLE Mesh (ESP32 nativo)
- **Alcance**: 10-30m (extensible con mesh)
- **Uso**: Comunicación entre nodos de percepción y nodo central
- **Datos**: Telemetría de sensores en tiempo real

### Syncthing (P2P)

- **Protocolo**: Syncthing sobre TCP/IP
- **Uso**: Sincronización de base de datos EVOLIS entre tótems
- **Ventaja**: Sin servidor central, cifrado extremo a extremo

---

## Energía

| Fuente | Capacidad | Uso |
|--------|-----------|-----|
| **Batería LiPo 18650** | 2600-3400mAh | Respaldo, operación offline |
| **Carga USB-C** | 5V/2A | Carga principal |
| **Carga Qi** | 5W | Carga inalámbrica (opcional) |
| **Panel solar** | 5V/1W | Carga autónoma (opcional) |

### Gestión de Energía (PowerManager)

Sentra Core ajusta automáticamente el consumo:

- **Ultra Ahorro**: Solo sensores esenciales, sin visión ni audio. Intervalo 10s.
- **Normal**: Balance entre funcionalidad y consumo. Intervalo 3-5s.
- **Alto Rendimiento**: Todos los sensores a máxima frecuencia. Intervalo 0.5-1s.

El HardwareAutoAdjust detecta las capacidades del dispositivo y selecciona el perfil óptimo.

---

## Almacenamiento y Exportación

### Local

- **IndexedDB**: Base de datos del navegador (PWA web)
- **microSD**: Almacenamiento del nodo central (Raspberry Pi)
- **SQLite** (opcional): Para despliegues server-side

### Exportación

- **Ranura USB**: Conectar pendrive → exportar cadena EVOLIS completa
- **Ranura SD**: Extraer tarjeta → transferir evidencia físicamente
- **Syncthing**: Sincronización automática entre tótems
- **QR/NFC** (futuro): Exportación rápida de evidencia a móvil

---

## Diagrama de Despliegue

```
                    ┌─────────────┐
                    │   Tótem A   │
                    │ (Nodo Central)│
                    │             │
            ┌───────┤  Sentra Core│───────┐
            │       │  EVOLIS     │       │
            │       │  MoralNode  │       │
            │       └──────┬──────┘       │
            │              │              │
         LoRa           BT Mesh        Syncthing
            │              │              │
    ┌───────┴───┐  ┌──────┴─────┐  ┌─────┴──────┐
    │  ESP32 #1 │  │  ESP32 #2  │  │  Tótem B   │
    │  (Cámara) │  │  (Sensores)│  │ (Remoto)   │
    └───────────┘  └───────────┘  └────────────┘
```

---

## Enclosure (Carcasa)

- **Material**: PLA impreso en 3D o aluminio (según entorno)
- **Dimensiones**: 15cm x 10cm x 5cm (nodo central), 5cm x 5cm x 3cm (ESP32)
- **IP Rating**: IP54 (interior), IP65 (exterior, carcasa sellada)
- **Montaje**: Pared, poste o mesa
- **LEDs indicadores**: Estado del sistema (activo/alerta/cuarentena)

---

## Costos Estimados (ARS)

| Componente | Costo Unitario |
|------------|---------------|
| Raspberry Pi 4 (4GB) | $45,000 |
| ESP32 + sensores | $8,000 c/u |
| LoRa HAT (SX1276) | $12,000 |
| Batería + carga | $6,000 |
| Carcasa 3D | $3,000 |
| **Tótem completo** | **~$80,000 - $120,000** |

> Costos orientativos en pesos argentinos, septiembre 2026. Fabricable localmente.

---

## Roadmap Hardware

1. **v2.0 (actual)**: Tótem con Raspberry Pi + ESP32 + LoRa
2. **v2.1**: Integración de panel solar, carcasa IP65
3. **v2.2**: ESP32-S3 con TFLite Micro (inferencia on-chip)
4. **v3.0**: Tótem mini (ESP32-S3 como nodo central standalone)

---

> Cuando todo lo demás se apaga, el Tótem sigue ahí.
