// main.cpp — Punto de entrada del firmware ESP32-S3 (Capa 0)
// Inicializa MoralNode, SensorController y HashChain.
// Ejecuta el task de percepción en un núcleo dedicado: sin GC, sin pausas.

#include <cstdint>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_timer.h"
#include "esp_log.h"

// Capa 0 — módulos deterministas
#include "moral_node.cpp"
#include "sensor_controller.cpp"
#include "hash_chain.cpp"

static const char* TAG = "SENTRA_CORE";

// ── Configuración del task de percepción ────────────────────────────────

static constexpr uint32_t PERCEPTION_TASK_STACK  = 8192;   // 8 KB
static constexpr uint8_t  PERCEPTION_TASK_PRIO   = 5;      // Prioridad media-alta
static constexpr BaseType_t PERCEPTION_CORE      = 1;      // Núcleo 1 (determinista)
static constexpr uint32_t PERCEPTION_INTERVAL_US = 1000;   // 1 ms — ciclo de 1 kHz

// ── Estado global del sistema (estático) ────────────────────────────────

struct SystemState {
    bool     moralBlockActive = false;
    bool     humanVeto = false;
    uint64_t lastPerceptionCycle = 0;
    uint32_t totalCycles = 0;
    uint32_t totalBlocks = 0;
    uint32_t totalEvents = 0;
};

static SystemState s_state;

// ── Task de percepción determinista ────────────────────────────────────
// Se ejecuta en el Núcleo 1, cada 1 ms. Sin GC, sin heap, sin bloqueos.

static void perceptionTask(void* arg) {
    ESP_LOGI(TAG, "Perception task started on core %d", xPortGetCoreID());

    auto& moral   = sentra::getMoralNode();
    auto& sensors = sentra::getSensorController();
    auto& chain   = sentra::getHashChain();

    sensors.init();
    sensors.start();
    chain.init();

    TickType_t lastWake = xTaskGetTickCount();

    while (true) {
        vTaskDelayUntil(&lastWake, pdMS_TO_TICKS(1)); // 1 ms

        // 1. Muestrear sensores
        sensors.sample();
        s_state.totalCycles++;

        // 2. Procesar lecturas
        sentra::SensorReading reading;
        while (sensors.getNextReading(reading)) {
            s_state.totalEvents++;

            // 3. Evaluar moralmente cada lectura
            char command[128];
            snprintf(command, sizeof(command), "sensor:%d:type:%d",
                     static_cast<int>(reading.type),
                     static_cast<int>(reading.status));

            sentra::MoralEvaluation eval = moral.evaluate(command, false);

            if (!eval.allowed) {
                s_state.moralBlockActive = true;
                s_state.totalBlocks++;
                ESP_LOGW(TAG, "MoralNode blocked: rule=%d",
                         static_cast<int>(eval.decisions[0].rule));
                continue;
            }

            // 4. Registrar en hash chain (EVOLIS)
            char entryData[128];
            snprintf(entryData, sizeof(entryData), "sensor:%d:ts:%llu",
                     static_cast<int>(reading.type),
                     static_cast<unsigned long long)(reading.timestamp));
            chain.record(entryData, strlen(entryData));
        }

        // 5. Verificación periódica de integridad (cada 1000 ciclos)
        if (s_state.totalCycles % 1000 == 0) {
            bool valid = chain.verify();
            if (!valid) {
                ESP_LOGE(TAG, "EVOLIS chain integrity violation!");
                // En producción: activar cuarentena del Guardian
            }
        }

        s_state.lastPerceptionCycle = esp_timer_get_time();
    }
}

// ── Task de comunicación LoRa (placeholder — se implementa en Prompt B) ─
// Se crea aquí el task pero la lógica real de LoRa SX1262 va en lora_mesh.cpp

static void loraTask(void* arg) {
    ESP_LOGI(TAG, "LoRa task placeholder (core %d) — awaiting lora_mesh.cpp", xPortGetCoreID());
    while (true) {
        vTaskDelay(pdMS_TO_TICKS(1000));
        // LoRa SX1262 se inicializa en Prompt B
    }
}

// ── app_main() — punto de entrada ESP-IDF ────────────────────────────────

extern "C" void app_main() {
    ESP_LOGI(TAG, "Sentra Core v4.8.0_ZERO_LATENCY — Capa 0 firmware");
    ESP_LOGI(TAG, "ESP32-S3 — Dual core, deterministic, no GC");

    // Configurar MoralNode
    auto& moral = sentra::getMoralNode();
    moral.setHumanVeto(false);
    moral.setOfflineMode(true);

    // Crear task de percepción en Núcleo 1 (determinista)
    TaskHandle_t perceptionHandle = nullptr;
    xTaskCreatePinnedToCore(
        perceptionTask,
        "perception",
        PERCEPTION_TASK_STACK,
        nullptr,
        PERCEPTION_TASK_PRIO,
        &perceptionHandle,
        PERCEPTION_CORE
    );

    // Crear task de LoRa en Núcleo 0 (comunicación)
    TaskHandle_t loraHandle = nullptr;
    xTaskCreatePinnedToCore(
        loraTask,
        "lora",
        4096,
        nullptr,
    3,
        &loraHandle,
        0  // Núcleo 0
    );

    ESP_LOGI(TAG, "Tasks created: perception (core 1), lora (core 0)");
    ESP_LOGI(TAG, "Capa 0 lista. Cuando todo lo demas se apaga, la Capa 0 sigue ahi.");
}
