// lora_mesh.cpp — Mesh P2P LoRa con ruteo dinamico para ESP32-S3 (Capa 0)
// Cada nodo es repetidor. Camino alternativo si se corta la linea directa.
// Sin heap, sin new/malloc. Buffers estaticos.

#include <cstdint>
#include <cstring>
#include "esp_timer.h"
#include "lora_protocol.cpp"
#include "lora_crypto.cpp"

namespace sentra {

// ── Configuracion estatica ──────────────────────────────────────────────

static constexpr uint16_t MAX_NODES         = 32;
static constexpr uint16_t MAX_ROUTES        = 8;
static constexpr uint16_t MAX_RETRANSMIT    = 3;
static constexpr uint32_t HEARTBEAT_MS       = 30000;
static constexpr uint32_t NODE_TIMEOUT_MS    = 90000;
static constexpr uint8_t  MAX_HOPS           = 6;

// ── Tabla de nodos ──────────────────────────────────────────────────────

struct MeshNode {
    uint16_t nodeId;
    int8_t   rssi;
    uint32_t lastSeen;    // ms
    bool     active;
    uint8_t  hops;
};

struct RouteEntry {
    uint16_t destId;
    uint16_t nextHopId;
    uint8_t  hopCount;
    uint32_t lastUsed;
    bool     active;
};

// ── Estado del mesh (estatico) ─────────────────────────────────────────

static MeshNode   s_nodes[MAX_NODES] = {};
static RouteEntry s_routes[MAX_ROUTES] = {};
static uint16_t   s_nodeCount = 0;
static uint16_t   s_routeCount = 0;
static uint16_t   s_localNodeId = 0;
static uint32_t   s_lastHeartbeat = 0;

// ── Inicializacion ─────────────────────────────────────────────────────

void initMesh(uint16_t localNodeId) {
    s_localNodeId = localNodeId;
    s_nodeCount = 0;
    s_routeCount = 0;
    s_lastHeartbeat = (uint32_t)(esp_timer_get_time() / 1000);

    for (uint16_t i = 0; i < MAX_NODES; i++) {
        s_nodes[i].active = false;
    }
    for (uint16_t i = 0; i < MAX_ROUTES; i++) {
        s_routes[i].active = false;
    }

    initLoraCrypto();
}

// ── Registrar / actualizar nodo descubierto ────────────────────────────

void registerNode(uint16_t nodeId, int8_t rssi, uint8_t hops) {
    // Buscar si ya existe
    for (uint16_t i = 0; i < s_nodeCount; i++) {
        if (s_nodes[i].nodeId == nodeId) {
            s_nodes[i].rssi = rssi;
            s_nodes[i].lastSeen = (uint32_t)(esp_timer_get_time() / 1000);
            s_nodes[i].active = true;
            s_nodes[i].hops = hops;
            return;
        }
    }

    // Nodo nuevo
    if (s_nodeCount >= MAX_NODES) return;

    s_nodes[s_nodeCount].nodeId = nodeId;
    s_nodes[s_nodeCount].rssi = rssi;
    s_nodes[s_nodeCount].lastSeen = (uint32_t)(esp_timer_get_time() / 1000);
    s_nodes[s_nodeCount].active = true;
    s_nodes[s_nodeCount].hops = hops;
    s_nodeCount++;
}

// ── Actualizar / crear ruta ─────────────────────────────────────────────

void updateRoute(uint16_t destId, uint16_t nextHopId, uint8_t hopCount) {
    // Buscar ruta existente
    for (uint16_t i = 0; i < s_routeCount; i++) {
        if (s_routes[i].destId == destId) {
            s_routes[i].nextHopId = nextHopId;
            s_routes[i].hopCount = hopCount;
            s_routes[i].lastUsed = (uint32_t)(esp_timer_get_time() / 1000);
            s_routes[i].active = true;
            return;
        }
    }

    // Ruta nueva
    if (s_routeCount >= MAX_ROUTES) return;

    s_routes[s_routeCount].destId = destId;
    s_routes[s_routeCount].nextHopId = nextHopId;
    s_routes[s_routeCount].hopCount = hopCount;
    s_routes[s_routeCount].lastUsed = (uint32_t)(esp_timer_get_time() / 1000);
    s_routes[s_routeCount].active = true;
    s_routeCount++;
}

// ── Buscar ruta a destino ───────────────────────────────────────────────

bool findRoute(uint16_t destId, uint16_t* nextHopId, uint8_t* hopCount) {
    for (uint16_t i = 0; i < s_routeCount; i++) {
        if (s_routes[i].destId == destId && s_routes[i].active) {
            *nextHopId = s_routes[i].nextHopId;
            *hopCount = s_routes[i].hopCount;
            return true;
        }
    }

    // Ruta directa: nodo visible
    for (uint16_t i = 0; i < s_nodeCount; i++) {
        if (s_nodes[i].nodeId == destId && s_nodes[i].active) {
            *nextHopId = destId;
            *hopCount = 1;
            return true;
        }
    }

    return false;
}

// ── Buscar ruta alternativa (si la directa fallo) ───────────────────────

bool findAlternateRoute(uint16_t destId, uint16_t excludeHop,
                        uint16_t* nextHopId, uint8_t* hopCount) {
    // Buscar nodo intermedio que pueda alcanzar el destino
    for (uint16_t i = 0; i < s_nodeCount; i++) {
        if (!s_nodes[i].active) continue;
        if (s_nodes[i].nodeId == destId) continue;
        if (s_nodes[i].nodeId == excludeHop) continue;
        if (s_nodes[i].hops >= MAX_HOPS) continue;

        // Este nodo podria ser repetidor
        *nextHopId = s_nodes[i].nodeId;
        *hopCount = s_nodes[i].hops + 1;
        return true;
    }
    return false;
}

// ── Limpiar nodos inactivos ─────────────────────────────────────────────

void pruneStaleNodes() {
    uint32_t now = (uint32_t)(esp_timer_get_time() / 1000);
    for (uint16_t i = 0; i < s_nodeCount; i++) {
        if (s_nodes[i].active && (now - s_nodes[i].lastSeen) > NODE_TIMEOUT_MS) {
            s_nodes[i].active = false;
            // Invalidar rutas que usan este nodo
            for (uint16_t j = 0; j < s_routeCount; j++) {
                if (s_routes[j].nextHopId == s_nodes[i].nodeId) {
                    s_routes[j].active = false;
                }
            }
        }
    }
}

// ── Procesar paquete recibido del mesh ──────────────────────────────────
// Retorna true si el paquete es para este nodo (o hay que retransmitir).

enum class MeshAction {
    PROCESS_LOCALLY,
    RETRANSMIT,
    DROP,
};

MeshAction processMeshPacket(const LoraPacket& pkt, uint16_t* retargetId) {
    if (!verifyPacket(pkt)) return MeshAction::DROP;

    // Extraer destino del payload (primeros 2 bytes del payload = destId)
    uint16_t destId;
    memcpy(&destId, pkt.payload, 2);

    // Paquete para este nodo
    if (destId == s_localNodeId) {
        return MeshAction::PROCESS_LOCALLY;
    }

    // Paquete de broadcast
    if (destId == 0xFFFF) {
        return MeshAction::PROCESS_LOCALLY;
    }

    // Retransmitir si conocemos ruta al destino
    uint16_t nextHop;
    uint8_t hopCount;
    if (findRoute(destId, &nextHop, &hopCount)) {
        if (hopCount < MAX_HOPS) {
            *retargetId = nextHop;
            return MeshAction::RETRANSMIT;
        }
    }

    // Buscar ruta alternativa
    uint16_t altHop;
    uint8_t altHops;
    if (findAlternateRoute(destId, 0, &altHop, &altHops)) {
        *retargetId = altHop;
        return MeshAction::RETRANSMIT;
    }

    return MeshAction::DROP;
}

// ── Construir paquete de heartbeat ─────────────────────────────────────

bool buildHeartbeat(LoraPacket& pkt) {
    uint8_t payload[PAYLOAD_SIZE] = {};
    uint16_t destId = 0xFFFF; // broadcast
    memcpy(payload, &destId, 2);

    // Numero de nodos conocidos
    uint16_t knownNodes = s_nodeCount;
    memcpy(payload + 2, &knownNodes, 2);

    // RSSI local (simulado)
    int8_t rssi = -50;
    memcpy(payload + 4, &rssi, 1);

    return packEvent(pkt, (uint8_t)LoraPacketType::HEARTBEAT,
                     s_localNodeId, payload, PAYLOAD_SIZE);
}

// ── Verificar si hay que enviar heartbeat ──────────────────────────────

bool needsHeartbeat() {
    uint32_t now = (uint32_t)(esp_timer_get_time() / 1000);
    return (now - s_lastHeartbeat) > HEARTBEAT_MS;
}

void markHeartbeatSent() {
    s_lastHeartbeat = (uint32_t)(esp_timer_get_time() / 1000);
}

// ── Construir paquete de ruteo mesh ────────────────────────────────────

bool buildMeshRoutePacket(LoraPacket& pkt, uint16_t destId, uint8_t hopCount) {
    uint8_t payload[PAYLOAD_SIZE] = {};
    memcpy(payload, &destId, 2);
    memcpy(payload + 2, &hopCount, 1);
    memcpy(payload + 3, &s_localNodeId, 2);

    return packEvent(pkt, (uint8_t)LoraPacketType::MESH_ROUTE,
                     s_localNodeId, payload, 5);
}

// ── Getters ─────────────────────────────────────────────────────────────

uint16_t getNodeCount() { return s_nodeCount; }
uint16_t getRouteCount() { return s_routeCount; }
uint16_t getLocalNodeId() { return s_localNodeId; }

const MeshNode* getNodes() { return s_nodes; }
const RouteEntry* getRoutes() { return s_routes; }

} // namespace sentra
