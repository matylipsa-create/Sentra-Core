# LoRa P2P Protocol — Arquitectura del Protocolo SX1262

**Sentra Core v5.0.0_LORA_PROTOCOL**

> Cuando todo lo demás se apaga, el protocolo LoRa sigue ahí.

---

## Visión General

El protocolo P2P LoRa (SX1262) permite la comunicación entre nodos Sentra Core sin infraestructura celular ni WiFi. Cada nodo es repetidor. El protocolo opera en dos capas:

- **Capa 0** (firmware C++/ESP32-S3): empaquetamiento, cifrado y transmisión determinista (<1 ms, sin GC)
- **Capa 1** (TypeScript/Node.js): gestión mesh, ruteo dinámico, integración con EVOLIS y MoralNode

Extiende la arquitectura Zero Latency definida en `docs/ZERO_LATENCY_ARCHITECTURE.md`.

---

## Estructura del Paquete (74 bytes)

```
┌──────────┬──────────┬───────────┬───────────┬──────────────┬────────┬──────────┬──────────┐
│ version  │   type   │  node_id  │ timestamp │   payload    │  crc16 │  nonce   │   hmac   │
│  1 byte  │  1 byte  │  2 bytes  │  4 bytes  │  40 bytes    │ 2 bytes│ 8 bytes  │ 16 bytes │
└──────────┴──────────┴───────────┴───────────┴──────────────┴────────┴──────────┴──────────┘
```

| Campo      | Tamaño  | Descripción                                    |
|------------|---------|------------------------------------------------|
| `version`  | 1 byte  | Versión del protocolo (actual: 1)              |
| `type`     | 1 byte  | Tipo de paquete (ver tabla abajo)              |
| `node_id`  | 2 bytes | ID del nodo origen (little-endian)             |
| `timestamp`| 4 bytes | Timestamp en ms desde boot del ESP32 (LE)       |
| `payload`  | 40 bytes| Datos del evento (primeros 2 bytes = destId)   |
| `crc16`    | 2 bytes | CRC16-CCITT (polinomio 0xA001) sobre los 48B   |
| `nonce`    | 8 bytes | NONCE único anti-replay                         |
| `hmac`     | 16 bytes| HMAC-SHA256 truncado a 16 bytes                |
| **Total**  | **74**  | Sin JSON, binario puro                          |

### Tipos de Paquete

| Tipo        | Valor | Descripción                              |
|-------------|-------|------------------------------------------|
| `DETECTION` | 0x01  | Detección de objeto del PerceptionEngine  |
| `ALERT`     | 0x02  | Alerta de seguridad                      |
| `VETO`      | 0x03  | Cambio de veto humano                    |
| `HASH_CHAIN`| 0x04  | Entrada de la cadena EVOLIS              |
| `HEARTBEAT` | 0x05  | Latido de nodo (broadcast 0xFFFF)        |
| `MESH_ROUTE`| 0x06  | Actualización de tabla de ruteo         |

---

## Seguridad

### Cifrado: AES-128-CTR

- **Capa 0**: mbedTLS (`mbedtls_aes_crypt_ecb` en modo CTR manual)
- **Capa 1**: `crypto.subtle` con `AES-CTR`
- El NONCE de 8 bytes se usa como prefijo del contador de 16 bytes

### Autenticación: HMAC-SHA256 truncado

- HMAC-SHA256 sobre todo el paquete excepto el campo `hmac` (58 bytes)
- Truncado a 16 bytes para optimizar el tamaño del paquete

### Anti-Replay: NONCE único

- Cada paquete incluye un NONCE de 8 bytes (timestamp + contador)
- Capa 1 mantiene una ventana deslizante de 256 NONCEs vistos
- Paquetes con NONCEs duplicados se descartan

### Rotación de Claves

- Cada 24 horas (86_400_000 ms) o cada 10_000 paquetes
- Capa 0: XOR simple (demo); en producción: HKDF desde efuse
- Capa 1: `crypto.getRandomValues` para nuevas claves

### Integridad: CRC16-CCITT

- Polinomio: 0xA001 (reflected CCITT)
- Calculado sobre `version + type + node_id + timestamp + payload` (48 bytes)
- Verificado antes de procesar cualquier paquete recibido

---

## Mesh P2P

### Descubrimiento de Nodos

- Cada nodo envía un `HEARTBEAT` cada 30 segundos (broadcast 0xFFFF)
- El heartbeat incluye: ID del nodo, número de nodos conocidos, RSSI
- Los nodos que no responden en 90 segundos se marcan como inactivos

### Ruteo Dinámico

- **Ruta directa**: si el destino es un nodo visible (1 hop)
- **Ruta conocida**: tabla de rutas con `destId → nextHopId`
- **Ruta alternativa**: si la ruta directa falla, se busca un nodo intermedio activo
- Máximo 6 hops por paquete

### Retransmisión

- Cada nodo que recibe un paquete verifica:
  1. CRC16 (integridad)
  2. NONCE (anti-replay)
  3. HMAC (autenticidad)
  4. Destino (¿es para mí? ¿debo retransmitir?)
- Si el destino no es el nodo local ni broadcast, se retransmite al `nextHopId`

### Limpieza

- `pruneStaleNodes()` se ejecuta en cada ciclo de heartbeat
- Nodos inactivos invalidan las rutas que los usan como `nextHop`

---

## Integración con Sentra Core

### MoralNode (Veto Humano)

Antes de transmitir cualquier paquete, `LoraMeshManager.sendPacket()` evalúa el comando con `moralNode.evaluate()`. Si el veto humano está activo o el comando viola las reglas éticas, el paquete no se envía.

### EVOLIS (Trazabilidad)

Cada paquete enviado y recibido se registra en la cadena EVOLIS:
- Envío: `evolis.record('lora', 'send', '${type}:${destId}')`
- Recepción: `evolis.record('lora', 'receive', '${type}:${nodeId}')`

### Layer0Bridge

`Layer0Bridge.ts` (Prompt A) consume `LoraProtocol.ts` para traducir eventos binarios del firmware a objetos TypeScript. Las funciones `packEvent()`, `verifyPacket()`, `calculateCrc16()` y `serializePacket()` son la **única fuente de verdad** — Layer0Bridge no las reimplementa.

### PerceptionEngine

Los eventos del PerceptionEngine (detecciones, alertas) se empaquetan en `LoraPacketType.DETECTION` y `LoraPacketType.ALERT` para distribuirse a otros nodos de la mesh.

### AlertModule

Las alertas recibidas de otros nodos se inyectan en `AlertModule` para notificación local (voz, vibración, registro).

### SentraVisionAccessibility

`LoraPanel.tsx` importa `SentraVisionAccessibility` para anuncios accesibles. No reimplementa ARIA live region, speechSynthesis ni navigator.vibrate.

---

## Archivos

### Capa 0 (Firmware C++)

| Archivo                    | Responsabilidad                              |
|----------------------------|----------------------------------------------|
| `firmware/lora_protocol.cpp`| Struct LoraPacket, CRC16, pack/verify        |
| `firmware/lora_crypto.cpp`  | AES-128, HMAC-SHA256, rotación de claves     |
| `firmware/lora_mesh.cpp`    | Tabla de nodos, ruteo, heartbeat, retransmisión|

### Capa 1 (TypeScript)

| Archivo                       | Responsabilidad                              |
|-------------------------------|----------------------------------------------|
| `src/core/LoraProtocol.ts`    | Espejo TS: packEvent, verifyPacket, CRC16    |
| `src/core/LoraCrypto.ts`      | AES-128, HMAC-SHA256, NONCE anti-replay      |
| `src/core/LoraMeshManager.ts` | Gestor mesh: nodos, rutas, heartbeat        |
| `src/modules/LoraModule.ts`   | API de alto nivel: sendAlert, sendDetection  |
| `src/components/LoraPanel.tsx`| UI accesible: estado, envío, nodos, rutas     |

---

## Ejemplo de Flujo

### Enviar una alerta de un nodo a otro

```
1. LoraPanel → loraModule.sendAlert(destId=5, "Movimiento detectado")
2. LoraModule → loraMeshManager.sendPacket(ALERT, 5, payload)
3. LoraMeshManager → moralNode.evaluate("lora:send:2:5") → allowed
4. LoraProtocol.packEvent(ALERT, localNodeId, payload) → LoraPacket
5. LoraCrypto.encryptPayload(payload, nonce) → payload cifrado
6. LoraCrypto.computePacketHmac(serialized) → hmac
7. LoraMeshManager → evolis.record('lora', 'send', '2:5')
8. SX1262 transmite 74 bytes por radio

Receptor:
9.  LoraMeshManager.receivePacket(rawData)
10. LoraProtocol.deserializePacket(rawData) → LoraPacket
11. LoraProtocol.verifyPacket(pkt) → CRC OK
12. LoraCrypto.isNonceFresh(pkt.nonce) → true
13. LoraCrypto.verifyPacketHmac(serialized, pkt.hmac) → true
14. LoraCrypto.decryptPayload(pkt.payload, pkt.nonce) → payload claro
15. LoraModule.handleIncomingPacket(pkt) → AlertModule.alert("warning", ...)
```

---

> Cuando todo lo demás se apaga, el protocolo LoRa sigue ahí.
