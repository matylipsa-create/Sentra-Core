// lora_protocol.cpp — Protocolo P2P LoRa (SX1262) para ESP32-S3 (Capa 0)
// Empaquetamiento binario: 74 bytes, sin JSON. CRC16-CCITT (0xA001).
// Sin heap, sin new/malloc. Memoria estatica.

#include <cstdint>
#include <cstring>
#include "esp_timer.h"

namespace sentra {

// ── Configuracion estatica ──────────────────────────────────────────────

static constexpr uint8_t  PROTOCOL_VERSION   = 1;
static constexpr uint16_t MAX_PACKET_SIZE     = 74;
static constexpr uint16_t PAYLOAD_SIZE        = 40;
static constexpr uint16_t HMAC_SIZE           = 16;
static constexpr uint16_t NONCE_SIZE          = 8;
static constexpr uint16_t CRC_SIZE            = 2;

// ── Tipos de paquete ────────────────────────────────────────────────────

enum class LoraPacketType : uint8_t {
    DETECTION   = 0x01,
    ALERT       = 0x02,
    VETO        = 0x03,
    HASH_CHAIN  = 0x04,
    HEARTBEAT   = 0x05,
    MESH_ROUTE  = 0x06,
};

// ── Estructura del paquete (74 bytes) ───────────────────────────────────
// | version(1) | type(1) | node_id(2) | timestamp(4) | payload(40) |
// | crc16(2)  | nonce(8) | hmac(16)  | total = 74    |

struct LoraPacket {
    uint8_t  version;
    uint8_t  type;
    uint16_t nodeId;
    uint32_t timestamp;
    uint8_t  payload[PAYLOAD_SIZE];
    uint16_t crc16;
    uint8_t  nonce[NONCE_SIZE];
    uint8_t  hmac[HMAC_SIZE];
};

static_assert(sizeof(LoraPacket) == MAX_PACKET_SIZE, "LoraPacket must be 74 bytes");

// ── CRC16-CCITT (polinomio 0xA001) ──────────────────────────────────────

static uint16_t crc16CCITT(const uint8_t* data, uint16_t len) {
    uint16_t crc = 0xFFFF;
    for (uint16_t i = 0; i < len; i++) {
        crc ^= data[i];
        for (uint8_t j = 0; j < 8; j++) {
            if (crc & 0x0001) {
                crc = (crc >> 1) ^ 0xA001;
            } else {
                crc >>= 1;
            }
        }
    }
    return crc;
}

// ── Empaquetar evento en LoraPacket ─────────────────────────────────────
// payloadRaw: hasta 40 bytes. payloadLen: cuantos copiar.
// nonce y hmac se dejan en cero; lora_crypto.cpp los llena.

bool packEvent(LoraPacket& pkt, uint8_t type, uint16_t nodeId,
               const uint8_t* payloadRaw, uint16_t payloadLen) {
    if (payloadLen > PAYLOAD_SIZE) return false;

    pkt.version   = PROTOCOL_VERSION;
    pkt.type      = type;
    pkt.nodeId    = nodeId;
    pkt.timestamp = (uint32_t)(esp_timer_get_time() / 1000); // ms

    memset(pkt.payload, 0, PAYLOAD_SIZE);
    memcpy(pkt.payload, payloadRaw, payloadLen);

    memset(pkt.nonce, 0, NONCE_SIZE);
    memset(pkt.hmac, 0, HMAC_SIZE);

    // CRC sobre version + type + nodeId + timestamp + payload (48 bytes)
    uint8_t crcInput[48];
    uint16_t offset = 0;
    memcpy(crcInput + offset, &pkt.version, 1);   offset += 1;
    memcpy(crcInput + offset, &pkt.type, 1);      offset += 1;
    memcpy(crcInput + offset, &pkt.nodeId, 2);    offset += 2;
    memcpy(crcInput + offset, &pkt.timestamp, 4); offset += 4;
    memcpy(crcInput + offset, pkt.payload, PAYLOAD_SIZE); offset += PAYLOAD_SIZE;

    pkt.crc16 = crc16CCITT(crcInput, offset);
    return true;
}

// ── Verificar paquete recibido ──────────────────────────────────────────

bool verifyPacket(const LoraPacket& pkt) {
    if (pkt.version != PROTOCOL_VERSION) return false;

    // Recalcular CRC
    uint8_t crcInput[48];
    uint16_t offset = 0;
    memcpy(crcInput + offset, &pkt.version, 1);   offset += 1;
    memcpy(crcInput + offset, &pkt.type, 1);      offset += 1;
    memcpy(crcInput + offset, &pkt.nodeId, 2);    offset += 2;
    memcpy(crcInput + offset, &pkt.timestamp, 4); offset += 4;
    memcpy(crcInput + offset, pkt.payload, PAYLOAD_SIZE); offset += PAYLOAD_SIZE;

    uint16_t recomputed = crc16CCITT(crcInput, offset);
    return recomputed == pkt.crc16;
}

// ── Serializar paquete a buffer plano ───────────────────────────────────

void serializePacket(const LoraPacket& pkt, uint8_t* out) {
    memcpy(out, &pkt, MAX_PACKET_SIZE);
}

// ── Deserializar buffer plano a LoraPacket ──────────────────────────────

void deserializePacket(const uint8_t* in, LoraPacket& pkt) {
    memcpy(&pkt, in, MAX_PACKET_SIZE);
}

// ── Generar NONCE unico ─────────────────────────────────────────────────
// Combina timestamp + contador estatico. Sin heap.

static uint32_t s_nonceCounter = 0;

void generateNonce(uint8_t nonce[NONCE_SIZE]) {
    uint32_t ts = (uint32_t)(esp_timer_get_time() / 1000);
    s_nonceCounter++;
    memcpy(nonce, &ts, 4);
    memcpy(nonce + 4, &s_nonceCounter, 4);
}

} // namespace sentra
