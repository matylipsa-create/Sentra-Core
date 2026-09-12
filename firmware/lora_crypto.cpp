// lora_crypto.cpp — AES-128 + HMAC-SHA256 para LoRa (SX1262) en ESP32-S3
// Usa mbedTLS. Sin heap dinamico: buffers estaticos.
// Rotacion de claves cada 24h o 10000 paquetes.

#include <cstdint>
#include <cstring>
#include "mbedtls/aes.h"
#include "mbedtls/md.h"
#include "esp_timer.h"

namespace sentra {

// ── Configuracion ──────────────────────────────────────────────────────

static constexpr uint16_t AES_KEY_SIZE    = 16;   // AES-128
static constexpr uint16_t HMAC_TRUNC_SIZE = 16;   // HMAC-SHA256 truncado a 16 bytes
static constexpr uint32_t KEY_ROTATION_MS = 86400000; // 24h
static constexpr uint32_t KEY_ROTATION_PKTS = 10000;

// ── Estado de claves (estatico) ─────────────────────────────────────────

static uint8_t s_aesKey[AES_KEY_SIZE] = {};
static uint8_t s_hmacKey[AES_KEY_SIZE] = {};
static uint32_t s_keyTimestamp = 0;
static uint32_t s_packetCount = 0;
static bool s_initialized = false;

// ── Inicializacion (en produccion: derivar de efuse / NVS) ──────────────

void initLoraCrypto() {
    if (s_initialized) return;
    // Claves de prueba — en produccion: derivar de efuse del ESP32-S3
    for (uint8_t i = 0; i < AES_KEY_SIZE; i++) {
        s_aesKey[i]  = 0xA0 + i;
        s_hmacKey[i] = 0xB0 + i;
    }
    s_keyTimestamp = (uint32_t)(esp_timer_get_time() / 1000);
    s_packetCount = 0;
    s_initialized = true;
}

// ── Verificar si hay que rotar claves ──────────────────────────────────

bool needsKeyRotation() {
    if (!s_initialized) return true;
    uint32_t now = (uint32_t)(esp_timer_get_time() / 1000);
    if (now - s_keyTimestamp > KEY_ROTATION_MS) return true;
    if (s_packetCount >= KEY_ROTATION_PKTS) return true;
    return false;
}

// ── Rotar claves (XOR simple para demo; en produccion: HKDF) ────────────

void rotateKeys() {
    for (uint8_t i = 0; i < AES_KEY_SIZE; i++) {
        s_aesKey[i]  ^= 0x55;
        s_hmacKey[i] ^= 0xAA;
    }
    s_keyTimestamp = (uint32_t)(esp_timer_get_time() / 1000);
    s_packetCount = 0;
}

// ── AES-128 CTR (cifrado y descifrado simetrico) ────────────────────────
// En CTR, cifrar y descifrar usan la misma operacion.

void aes128CTR(const uint8_t* input, uint16_t len,
               const uint8_t* nonce, uint16_t nonceLen,
               uint8_t* output) {
    mbedtls_aes_context ctx;
    mbedtls_aes_init(&ctx);
    mbedtls_aes_setkey_enc(&ctx, s_aesKey, 128);

    // Construir contador: nonce (8 bytes) + contador (8 bytes)
    uint8_t counter[16];
    memset(counter, 0, 16);
    memcpy(counter, nonce, nonceLen < 8 ? nonceLen : 8);

    uint8_t stream[16];
    uint16_t processed = 0;

    while (processed < len) {
        // Generar bloque de keystream
        mbedtls_aes_crypt_ecb(&ctx, MBEDTLS_AES_ENCRYPT, counter, stream);

        uint16_t chunk = (len - processed < 16) ? (len - processed) : 16;
        for (uint16_t i = 0; i < chunk; i++) {
            output[processed + i] = input[processed + i] ^ stream[i];
        }
        processed += chunk;

        // Incrementar contador (ultimos 8 bytes, big-endian)
        for (int8_t i = 15; i >= 8; i--) {
            counter[i]++;
            if (counter[i] != 0) break;
        }
    }

    mbedtls_aes_free(&ctx);
}

// ── HMAC-SHA256 truncado a 16 bytes ─────────────────────────────────────

void hmacSHA256Truncated(const uint8_t* data, uint16_t len,
                          uint8_t* outHmac) {
    uint8_t fullHmac[32];
    const mbedtls_md_info_t* info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);

    mbedtls_md_context_t ctx;
    mbedtls_md_init(&ctx);
    mbedtls_md_setup(&ctx, info, 1);
    mbedtls_md_hmac_starts(&ctx, s_hmacKey, AES_KEY_SIZE);
    mbedtls_md_hmac_update(&ctx, data, len);
    mbedtls_md_hmac_finish(&ctx, fullHmac);
    mbedtls_md_free(&ctx);

    memcpy(outHmac, fullHmac, HMAC_TRUNC_SIZE);
    memset(fullHmac, 0, 32);
}

// ── Cifrar payload de un LoraPacket ─────────────────────────────────────
// En produccion: se llama despues de packEvent() y antes de transmitir.

void encryptPayload(uint8_t* payload, uint16_t payloadLen,
                    const uint8_t* nonce, uint16_t nonceLen) {
    uint8_t temp[40];
    aes128CTR(payload, payloadLen, nonce, nonceLen, temp);
    memcpy(payload, temp, payloadLen);
    memset(temp, 0, sizeof(temp));
}

// ── Descifrar payload ───────────────────────────────────────────────────

void decryptPayload(uint8_t* payload, uint16_t payloadLen,
                     const uint8_t* nonce, uint16_t nonceLen) {
    // CTR es simetrico
    encryptPayload(payload, payloadLen, nonce, nonceLen);
}

// ── Calcular HMAC del paquete completo (sin el campo hmac) ─────────────

void computePacketHmac(const uint8_t* packetData, uint16_t packetLen,
                       uint8_t* outHmac) {
    // HMAC sobre todo el paquete excepto los ultimos 16 bytes (hmac)
    hmacSHA256Truncated(packetData, packetLen - HMAC_TRUNC_SIZE, outHmac);
}

// ── Verificar HMAC ──────────────────────────────────────────────────────

bool verifyPacketHmac(const uint8_t* packetData, uint16_t packetLen,
                      const uint8_t* receivedHmac) {
    uint8_t computed[HMAC_TRUNC_SIZE];
    computePacketHmac(packetData, packetLen, computed);
    bool ok = memcmp(computed, receivedHmac, HMAC_TRUNC_SIZE) == 0;
    memset(computed, 0, HMAC_TRUNC_SIZE);
    return ok;
}

// ── Contador de paquetes para rotacion ─────────────────────────────────

void incrementPacketCount() {
    if (s_initialized) s_packetCount++;
}

uint32_t getPacketCount() { return s_packetCount; }

} // namespace sentra
