/**
 * SimulatedSensors — Sensores simulados que generan datos de prueba.
 *
 * Cada sensor produce lecturas realistas con variación aleatoria para
 * demostrar el funcionamiento del SensorHub, PerceptionEngine y
 * SensorModule sin hardware físico.
 */

import {
  type Sensor,
  type SensorDescriptor,
  type SensorStatus,
  type SensorReading,
  type SensorId,
  type SensorCategory,
} from "../core/SensorHub";

// ──────────────────────────────────────────────────────────────────────────
// Clase base abstracta
// ──────────────────────────────────────────────────────────────────────────

abstract class BaseSensor implements Sensor {
  protected status: SensorStatus = "offline";
  protected lastReading: SensorReading | null = null;
  protected running = false;
  protected tick = 0;
  protected timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    protected readonly id: SensorId,
    protected readonly name: string,
    protected readonly category: SensorCategory,
    protected readonly unit: string,
    protected readonly location: string,
    protected readonly sampleRateHz: number,
  ) {}

  abstract get descriptor(): Omit<SensorDescriptor, "status" | "lastReading">;

  getStatus(): SensorStatus {
    return this.status;
  }

  getDescriptor(): SensorDescriptor {
    return {
      ...this.descriptor,
      status: this.status,
      lastReading: this.lastReading,
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.status = "online";
    const intervalMs = Math.max(100, 1000 / this.sampleRateHz);
    this.timer = setInterval(() => this.sample(), intervalMs);
  }

  stop(): void {
    this.running = false;
    this.status = "offline";
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  getLastReading(): SensorReading | null {
    return this.lastReading;
  }

  protected abstract sample(): void;

  protected setReading(value: unknown, confidence: number): void {
    this.lastReading = {
      sensorId: this.id,
      category: this.category,
      timestamp: Date.now(),
      value,
      unit: this.unit,
      confidence,
    };
    this.tick++;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Utilidades
// ──────────────────────────────────────────────────────────────────────────

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function drift(base: number, range: number, tick: number, period: number): number {
  return base + Math.sin(tick / period) * range + rand(-range * 0.3, range * 0.3);
}

// ──────────────────────────────────────────────────────────────────────────
// Sensores ambientales
// ──────────────────────────────────────────────────────────────────────────

class AmbientSensor extends BaseSensor {
  get descriptor() {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      unit: this.unit,
      location: this.location,
      sampleRateHz: this.sampleRateHz,
    };
  }

  protected sample(): void {
    this.setReading(
      {
        temperatureC: drift(22, 8, this.tick, 30),
        humidityPct: Math.max(0, Math.min(100, drift(50, 20, this.tick, 45))),
        pressureHpa: drift(1013, 5, this.tick, 60),
        lightLux: Math.max(0, drift(3000, 2500, this.tick, 20)),
      },
      rand(0.92, 0.99),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Sensores de movimiento
// ──────────────────────────────────────────────────────────────────────────

class MotionSensor extends BaseSensor {
  get descriptor() {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      unit: this.unit,
      location: this.location,
      sampleRateHz: this.sampleRateHz,
    };
  }

  protected sample(): void {
    const accelX = rand(-0.3, 0.3);
    const accelY = rand(-0.3, 0.3);
    const accelZ = rand(0.9, 1.1);
    const gyroX = rand(-30, 30);
    const gyroY = rand(-30, 30);
    const gyroZ = rand(-30, 30);
    const magnitude = Math.sqrt(accelX ** 2 + accelY ** 2 + accelZ ** 2);
    this.setReading(
      { accelX, accelY, accelZ, gyroX, gyroY, gyroZ, magnitude },
      rand(0.9, 0.98),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Sensores de visión
// ──────────────────────────────────────────────────────────────────────────

class VisionSensor extends BaseSensor {
  private readonly labelPool = [
    "persona", "vehículo", "caja", "puerta", "ventana", "animal", "bolsa",
  "máquina", "carretilla", "paquete",
  ];

  get descriptor() {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      unit: this.unit,
      location: this.location,
      sampleRateHz: this.sampleRateHz,
    };
  }

  protected sample(): void {
    const objectsDetected = Math.floor(rand(0, 8));
    const labels: string[] = [];
    for (let i = 0; i < Math.min(objectsDetected, 4); i++) {
      labels.push(this.labelPool[Math.floor(rand(0, this.labelPool.length))]);
    }
    const motionDetected = Math.random() > 0.6;
    this.setReading(
      {
        objectsDetected,
        labels,
        motionDetected,
        brightness: Math.max(0, drift(128, 60, this.tick, 25)),
      },
      rand(0.85, 0.97),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Sensores de audio
// ──────────────────────────────────────────────────────────────────────────

class AudioSensor extends BaseSensor {
  get descriptor() {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      unit: this.unit,
      location: this.location,
      sampleRateHz: this.sampleRateHz,
    };
  }

  protected sample(): void {
    const spl = Math.max(20, drift(55, 25, this.tick, 18));
    const silence = spl < 30;
    this.setReading(
      {
        spl,
        dominantFreqHz: Math.floor(rand(200, 4000)),
        peakAmplitude: rand(0.01, 0.9),
        silence,
      },
      rand(0.88, 0.97),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Sensores de contacto
// ──────────────────────────────────────────────────────────────────────────

class ContactSensor extends BaseSensor {
  private open = false;
  private contactCount = 0;

  get descriptor() {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      unit: this.unit,
      location: this.location,
      sampleRateHz: this.sampleRateHz,
    };
  }

  protected sample(): void {
    if (Math.random() > 0.85) {
      this.open = !this.open;
      if (this.open) this.contactCount++;
    }
    const tamper = Math.random() > 0.97;
    this.setReading(
      {
        open: this.open,
        tamper,
        contactCount: this.contactCount,
      },
      rand(0.95, 1.0),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Sensores de gas
// ──────────────────────────────────────────────────────────────────────────

class GasSensor extends BaseSensor {
  get descriptor() {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      unit: this.unit,
      location: this.location,
      sampleRateHz: this.sampleRateHz,
    };
  }

  protected sample(): void {
    const co2Ppm = Math.max(300, drift(600, 200, this.tick, 35));
    const vocPpm = Math.max(0, drift(0.15, 0.1, this.tick, 22));
    const coPpm = Math.max(0, drift(3, 2, this.tick, 28));
    const methanePpm = Math.max(0, drift(20, 15, this.tick, 40));
    const airQualityIndex = Math.max(0, drift(80, 40, this.tick, 20));
    this.setReading(
      { co2Ppm, vocPpm, coPpm, methanePpm, airQualityIndex },
      rand(0.9, 0.98),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Sensores de flujo
// ──────────────────────────────────────────────────────────────────────────

class FlowSensor extends BaseSensor {
  get descriptor() {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      unit: this.unit,
      location: this.location,
      sampleRateHz: this.sampleRateHz,
    };
  }

  protected sample(): void {
    const rateLpm = Math.max(0, drift(15, 8, this.tick, 24));
    this.setReading(
      {
        rateLpm,
        totalLitres: this.tick * rateLpm * 0.1,
        temperatureC: drift(25, 15, this.tick, 30),
        pressureBar: Math.max(0, drift(3, 1.5, this.tick, 50)),
      },
      rand(0.91, 0.98),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Registro de sensores simulados
// ──────────────────────────────────────────────────────────────────────────

export function createSimulatedSensors(): Sensor[] {
  return [
    new AmbientSensor("amb-01", "Clima Sala A", "ambient", "°C/%/hPa/lx", "Sala A — Norte", 1),
    new AmbientSensor("amb-02", "Clima Exterior", "ambient", "°C/%/hPa/lx", "Exterior — Azotea", 0.5),
    new MotionSensor("mot-01", "Acelerómetro Estructura", "motion", "g/°/s", "Pilar Central", 2),
    new MotionSensor("mot-02", "Vibración Motor", "motion", "g/°/s", "Sala de Máquinas", 4),
    new VisionSensor("vis-01", "Cámara Entrada", "vision", "objetos", "Acceso Principal", 1),
    new VisionSensor("vis-02", "Cámara Almacén", "vision", "objetos", "Almacén B-2", 1),
    new AudioSensor("aud-01", "Micrófono Ambiental", "audio", "dB", "Oficina Central", 2),
    new ContactSensor("cnt-01", "Puerta Principal", "contact", "estado", "Acceso Principal", 1),
    new ContactSensor("cnt-02", "Ventana Sala A", "contact", "estado", "Sala A — Ventana", 1),
    new GasSensor("gas-01", "Calidad del Aire", "gas", "ppm/ICA", "Sala A", 1),
    new GasSensor("gas-02", "Detección Gas Tuberías", "gas", "ppm/ICA", "Sala de Máquinas", 1),
    new FlowSensor("flw-01", "Caudal Tubería Principal", "flow", "L/min/bar", "Tubería Principal", 1),
    new FlowSensor("flw-02", "Caudal Refrigeración", "flow", "L/min/bar", "Sistema de Refrigeración", 2),
  ];
}

export function registerSimulatedSensors(): void {
  for (const sensor of createSimulatedSensors()) {
    // sensorHub.register is called in the caller
    sensor;
  }
}
