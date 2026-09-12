// hash_chain.cpp — Hash chain EVOLIS en C++ para ESP32-S3 (Capa 0)
// Trazabilidad inalterable: cada evento se registra con SHA-256.
// Memoria estática, sin GC, sin new/malloc.

#include <cstdint>
#include <cstring>
#include "mbedtls/sha256.h"

namespace sentra {

// ── Configuración estática ──────────────────────────────────────────────

static constexpr uint16_t MAX_ENTRIES     = 128;    // En RAM estática
static constexpr uint8_t  HASH_SIZE       = 32;     // SHA-256 = 32 bytes
static constexpr uint16_t MAX_DATA_LEN    = 256;
static constexpr char     GENESIS_HASH[HASH_SIZE] = {0};

// ── Estructura de entrada ──────────────────────────────────────────────

struct HashChainEntry {
    uint32_t index;
    uint8_t  hash[HASH_SIZE];
    uint8_t  previousHash[HASH_SIZE];
    uint64_t timestamp;       // µs
    char     data[MAX_DATA_LEN];
    uint16_t dataLen;
};

// ── Hash chain ─────────────────────────────────────────────────────────

class HashChain {
private:
    HashChainEntry entries[MAX_ENTRIES];
    uint16_t       count = 0;
    bool           initialized = false;

    // SHA-256 usando mbedTLS (ESP-IDF) — sin heap, buffer interno estático
    void computeSHA256(const uint8_t* input, uint16_t len, uint8_t* output) {
        mbedtls_sha256_context ctx;
        mbedtls_sha256_init(&ctx);
        mbedtls_sha256_starts(&ctx, 0);
        mbedtls_sha256_update(&ctx, input, len);
        mbedtls_sha256_finish(&ctx, output);
        mbedtls_sha256_free(&ctx);
    }

    void computeEntryHash(const HashChainEntry& entry, uint8_t* outHash) {
        // Composite: index + previousHash + timestamp + data
        uint8_t composite[4 + HASH_SIZE + 8 + MAX_DATA_LEN];
        uint16_t offset = 0;

        memcpy(composite + offset, &entry.index, 4);
        offset += 4;
        memcpy(composite + offset, entry.previousHash, HASH_SIZE);
        offset += HASH_SIZE;
        memcpy(composite + offset, &entry.timestamp, 8);
        offset += 8;
        memcpy(composite + offset, entry.data, entry.dataLen);
        offset += entry.dataLen;

        computeSHA256(composite, offset, outHash);
    }

public:
    void init() {
        count = 0;
        initialized = true;
        // Entrada génesis
        entries[0].index = 0;
        memset(entries[0].previousHash, 0, HASH_SIZE);
        entries[0].timestamp = esp_timer_get_time();
        entries[0].dataLen = 7;
        memcpy(entries[0].data, "GENESIS", 7);
        computeEntryHash(entries[0], entries[0].hash);
        count = 1;
    }

    // record() — añade una entrada a la cadena. Sin heap.
    bool record(const char* data, uint16_t dataLen) {
        if (!initialized) init();
        if (count >= MAX_ENTRIES) return false;
        if (dataLen > MAX_DATA_LEN) dataLen = MAX_DATA_LEN;

        HashChainEntry& entry = entries[count];
        entry.index = count;
        entry.timestamp = esp_timer_get_time();
        entry.dataLen = dataLen;
        memcpy(entry.data, data, dataLen);

        // previousHash = hash de la entrada anterior
        if (count > 0) {
            memcpy(entry.previousHash, entries[count - 1].hash, HASH_SIZE);
        } else {
            memset(entry.previousHash, 0, HASH_SIZE);
        }

        computeEntryHash(entry, entry.hash);
        count++;
        return true;
    }

    // verify() — verifica la integridad de toda la cadena. Sin heap.
    bool verify() {
        if (count == 0) return true;

        for (uint16_t i = 0; i < count; i++) {
            uint8_t recomputed[HASH_SIZE];
            computeEntryHash(entries[i], recomputed);

            if (memcmp(recomputed, entries[i].hash, HASH_SIZE) != 0) {
                return false;
            }

            if (i > 0) {
                if (memcmp(entries[i].previousHash, entries[i - 1].hash, HASH_SIZE) != 0) {
                    return false;
                }
            }
        }
        return true;
    }

    uint16_t getCount() const { return count; }

    const HashChainEntry& getEntry(uint16_t index) const {
        return entries[index];
    }

    const HashChainEntry& getLastEntry() const {
        return entries[count > 0 ? count - 1 : 0];
    }

    // Exportar hash de la última entrada (para sincronización LoRa)
    void getLastHash(uint8_t* outHash) const {
        if (count > 0) {
            memcpy(outHash, entries[count - 1].hash, HASH_SIZE);
        } else {
            memset(outHash, 0, HASH_SIZE);
        }
    }

    // Verificar si una entrada específica fue alterada
    bool verifyEntry(uint16_t index) {
        if (index >= count) return false;
        uint8_t recomputed[HASH_SIZE];
        computeEntryHash(entries[index], recomputed);
        return memcmp(recomputed, entries[index].hash, HASH_SIZE) == 0;
    }

    // Verificar continuidad entre dos entradas consecutivas
    bool verifyLink(uint16_t index) {
        if (index == 0 || index >= count) return true;
        return memcmp(entries[index].previousHash, entries[index - 1].hash, HASH_SIZE) == 0;
    }
};

// Singleton estático
static HashChain s_chain;

HashChain& getHashChain() { return s_chain; }

} // namespace sentra
