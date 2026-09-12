// sensor_controller.cpp — Controlador de sensores para ESP32-S3 (Capa 0)
// Buffers estáticos, sin new/malloc, sin GC. Latencia determinista <1 ms.
// Sensores: PIR (movimiento), I2S (audio), mmWave (presencia/radar).

#include <cstdint>
#include <cstring>

namespace sentra {

// ── Configuración estática ──────────────────────────────────────────────

static constexpr uint16_t SENSOR_BUFFER_SIZE   = 256;
static constexpr uint16_t AUDIO_FRAME_SIZE     = 512;
static constexpr uint16_t MAX_EVENTS_PER_CYCLE = 16;

// ── Tipos de sensor ────────────────────────────────────────────────────

enum class SensorType : uint8_t {
    PIR      = 0,
    I2S_MIC  = 1,
    MMWAVE   = 2,
    IMU      = 3,
    AMBIENT  = 4,
};

enum class SensorStatus : uint8_t {
    OFFLINE  = 0,
    ONLINE   = 1,
    WARNING  = 2,
    ERROR_  = 3,
};

struct SensorReading {
    SensorType   type;
    SensorStatus status;
    uint64_t     timestamp;   // µs
    uint16_t     valueLen;
    uint8_t      value[64];   // datos crudos o struct embebido
};

// ── Lecturas específicas (embebidas en value[]) ─────────────────────────

struct PIRReading {
    bool     motionDetected;
    uint8_t  sensitivity;   // 0-100
    uint32_t durationMs;
};

struct I2SReading {
    int16_t  peakAmplitude;
    uint16_t dominantFreqHz;
    bool     silenceDetected;
    float    splDb;          // sound pressure level
};

struct MmWaveReading {
    bool     presenceDetected;
    float    distanceM;
    float    velocityMs;
    float    angleDeg;
    uint8_t  targetCount;
};

struct IMUReading {
    float accelX, accelY, accelZ;
    float gyroX, gyroY, gyroZ;
    float magnitude;
};

struct AmbientReading {
    float temperatureC;
    float humidityPct;
    float lightLux;
    float pressureHpa;
};

// ── Buffer circular estático ────────────────────────────────────────────

struct SensorBuffer {
    SensorReading readings[SENSOR_BUFFER_SIZE];
    uint16_t      head;
    uint16_t      tail;
    uint16_t      count;

    void init() { head = 0; tail = 0; count = 0; }

    bool push(const SensorReading& reading) {
        if (count >= SENSOR_BUFFER_SIZE) return false;
        readings[head] = reading;
        head = (head + 1) % SENSOR_BUFFER_SIZE;
        count++;
        return true;
    }

    bool pop(SensorReading& out) {
        if (count == 0) return false;
        out = readings[tail];
        tail = (tail + 1) % SENSOR_BUFFER_SIZE;
        count--;
        return true;
    }

    uint16_t available() const { return count; }
};

// ── Controller ─────────────────────────────────────────────────────────

class SensorController {
private:
    SensorBuffer buffer;
    SensorStatus statuses[5] = {};
    bool         running = false;

    // Buffers estáticos para cada sensor — sin heap
    static SensorBuffer s_eventBuffer;

    // Simulación de lectura cruda (en producción: I2C/SPI/I2S)
    void readPIR(SensorReading& reading) {
        reading.type = SensorType::PIR;
        reading.timestamp = esp_timer_get_time();
        reading.valueLen = sizeof(PIRReading);

        PIRReading pir = {};
        pir.motionDetected = (gpio_get_level(GPIO_NUM_4) == 1);
        pir.sensitivity = 80;
        pir.durationMs = pir.motionDetected ? 200 : 0;

        memcpy(reading.value, &pir, sizeof(PIRReading));
        reading.status = SensorStatus::ONLINE;
        statuses[static_cast<uint8_t>(SensorType::PIR)] = SensorStatus::ONLINE;
    }

    void readI2S(SensorReading& reading) {
        reading.type = SensorType::I2S_MIC;
        reading.timestamp = esp_timer_get_time();
        reading.valueLen = sizeof(I2SReading);

        I2SReading i2s = {};
        i2s.peakAmplitude = 0;
        i2s.dominantFreqHz = 0;
        i2s.silenceDetected = true;
        i2s.splDb = 30.0f;

        // En producción: leer del periférico I2S
        // size_t bytesRead = 0;
        // i2s_read(I2S_NUM_0, s_i2sBuffer, AUDIO_FRAME_SIZE, &bytesRead, portMAX_DELAY);
        // i2s.splDb = computeSPL(s_i2sBuffer, bytesRead);

        memcpy(reading.value, &i2s, sizeof(I2SReading));
        reading.status = SensorStatus::ONLINE;
        statuses[static_cast<uint8_t>(SensorType::I2S_MIC)] = SensorStatus::ONLINE;
    }

    void readMmWave(SensorReading& reading) {
        reading.type = SensorType::MMWAVE;
        reading.timestamp = esp_timer_get_time();
        reading.valueLen = sizeof(MmWaveReading);

        MmWaveReading mmw = {};
        mmw.presenceDetected = false;
        mmw.distanceM = 0.0f;
        mmw.velocityMs = 0.0f;
        mmw.angleDeg = 0.0f;
        mmw.targetCount = 0;

        // En producción: UART al módulo mmWave (HLK-LD2410)
        memcpy(reading.value, &mmw, sizeof(MmWaveReading));
        reading.status = SensorStatus::ONLINE;
        statuses[static_cast<uint8_t>(SensorType::MMWAVE)] = SensorStatus::ONLINE;
    }

    void readIMU(SensorReading& reading) {
        reading.type = SensorType::IMU;
        reading.timestamp = esp_timer_get_time();
        reading.valueLen = sizeof(IMUReading);

        IMUReading imu = {};
        imu.accelX = 0.0f; imu.accelY = 0.0f; imu.accelZ = 9.81f;
        imu.gyroX = 0.0f; imu.gyroY = 0.0f; imu.gyroZ = 0.0f;
        imu.magnitude = 9.81f;

        // En producción: I2C al MPU6050
        memcpy(reading.value, &imu, sizeof(IMUReading));
        reading.status = SensorStatus::ONLINE;
        statuses[static_cast<uint8_t>(SensorType::IMU)] = SensorStatus::ONLINE;
    }

    void readAmbient(SensorReading& reading) {
        reading.type = SensorType::AMBIENT;
        reading.timestamp = esp_timer_get_time();
        reading.valueLen = sizeof(AmbientReading);

        AmbientReading amb = {};
        amb.temperatureC = 22.0f;
        amb.humidityPct = 50.0f;
        amb.lightLux = 3000.0f;
        amb.pressureHpa = 1013.0f;

        // En producción: I2C al BME280/BMP280
        memcpy(reading.value, &amb, sizeof(AmbientReading));
        reading.status = SensorStatus::ONLINE;
        statuses[static_cast<uint8_t>(SensorType::AMBIENT)] = SensorStatus::ONLINE;
    }

public:
    void init() {
        buffer.init();
        for (uint8_t i = 0; i < 5; i++) statuses[i] = SensorStatus::OFFLINE;
        running = false;
    }

    void start() { running = true; }
    void stop()  { running = false; }
    bool isRunning() const { return running; }

    // sample() — lee todos los sensores en un ciclo determinista
    // Sin new, sin malloc, sin bloqueos. Tiempo de ejecución fijo.
    void sample() {
        if (!running) return;

        SensorReading reading = {};

        // PIR — lectura GPIO directa
        readPIR(reading);
        buffer.push(reading);

        // I2S — audio
        readI2S(reading);
        buffer.push(reading);

        // mmWave — presencia/radar
        readMmWave(reading);
        buffer.push(reading);

        // IMU — movimiento
        readIMU(reading);
        buffer.push(reading);

        // Ambient — clima
        readAmbient(reading);
        buffer.push(reading);
    }

    uint16_t getAvailable() const { return buffer.available(); }

    bool getNextReading(SensorReading& out) { return buffer.pop(out); }

    SensorStatus getStatus(SensorType type) const {
        return statuses[static_cast<uint8_t>(type)];
    }

    // Extraer lectura tipada (sin copia — cast directo al buffer)
    static const PIRReading* asPIR(const SensorReading& r) {
        return reinterpret_cast<const PIRReading*>(r.value);
    }
    static const I2SReading* asI2S(const SensorReading& r) {
        return reinterpret_cast<const I2SReading*>(r.value);
    }
    static const MmWaveReading* asMmWave(const SensorReading& r) {
        return reinterpret_cast<const MmWaveReading*>(r.value);
    }
    static const IMUReading* asIMU(const SensorReading& r) {
        return reinterpret_cast<const IMUReading*>(r.value);
    }
    static const AmbientReading* asAmbient(const SensorReading& r) {
        return reinterpret_cast<const AmbientReading*>(r.value);
    }
};

// Singleton estático
static SensorController s_controller;

SensorController& getSensorController() { return s_controller; }

} // namespace sentra
