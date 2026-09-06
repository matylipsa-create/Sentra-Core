# Sentra Core API Server

Backend WebSocket + REST para el motor Sentra Core.

## Inicio rapido

```bash
cd server
npm install
npm start
```

El servidor escucha en el puerto 8080 (configurable via `SENTRA_PORT`).

- **WebSocket**: `ws://localhost:8080`
- **REST API**: `http://localhost:8080/api/...`

## Endpoints REST

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/status` | Estado global del sistema |
| GET | `/api/modules` | Lista de modulos disponibles |
| GET | `/api/evidence` | Cadena de evidencia EVOLIS (ultimas 50) |
| POST | `/api/evidence/verify` | Verificar integridad de la cadena |
| GET | `/api/bio/protocols` | Protocolos BioSoftware |
| GET | `/api/bio/state` | Estado actual de BioSoftware |
| GET | `/api/bio/stats` | Estadisticas de sesiones bio |
| GET | `/api/guardian/status` | Estado del Guardian Bacteriano |
| POST | `/api/command` | Procesar comando de texto |
| POST | `/api/settings` | Actualizar configuracion |

## WebSocket — Protocolo TCREI

Enviar mensajes JSON con la estructura:

```json
{
  "type": "command | query",
  "module": "vision | bio | evidencia | ...",
  "action": "process | get_status | start_session | ...",
  "payload": { ... },
  "timestamp": 1694123456789,
  "id": "uuid-v4"
}
```

El servidor responde con:

```json
{
  "type": "response",
  "id": "mismo-id",
  "ok": true,
  "data": { ... },
  "timestamp": 1694123456789
}
```

Los eventos push (bio.tick, guardian.alert, etc.) llegan sin `id`:

```json
{
  "type": "event",
  "event": "bio.tick",
  "data": { ... },
  "timestamp": 1694123456789
}
```
