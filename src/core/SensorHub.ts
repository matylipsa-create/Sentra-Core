/**
 * SensorHub — Hub centralizado de sensores para SentraCore v4.2.0
 *
 * Unifica todos los tipos de sensor (ambientales, movimiento, visión,
 * audio, contacto, gas, flujo) bajo una interfaz común. Cada sensor se
 * registra, publica lecturas y notifica a los suscriptores.
 */

// ──────────────────────────────────────────────────────────────────────────
// Tipos base
// ──────────────────────────────────────────────────────────────────────────

export type SensorCategory =
  | "ambient"
  | "motion"
  | "vision"
  | "audio"
  | "contact"
  | "gas"
  | "flow";

export type SensorStatus = "online" | "offline" | "warning" | "error";

export type SensorId = string;

/** Lectura genérica que todo sensor produce. */
export interface SensorReading<T = unknown> {
  sensorId: SensorId;
  category: SensorCategory;
  timestamp: number;
  value: T;
  unit: string;
  confidence: number; // 0..1
}

/** Metadatos de un sensor registrado. */
export interface SensorDescriptor {
  id: SensorId;
  name: string;
  category: SensorCategory;
  unit: string;
  location: string;
  sampleRateHz: number;
  status: SensorStatus;
  lastReading: SensorReading | null;
}

/** Callback que reciben los suscriptores del hub. */
export type ReadingListener = (reading: SensorReading) => void;
export type StatusListener = (sensorId: SensorId, status: SensorStatus) => void;

// ──────────────────────────────────────────────────────────────────────────
// Definiciones de tipos de sensor por categoría
// ──────────────────────────────────────────────────────────────────────────

export interface AmbientReading {
  temperatureC: number;
  humidityPct: number;
  pressureHpa: number;
  lightLux: number;
}

export interface MotionReading {
  accelX: number;
  accelY: number;
  accelZ: number;
  gyroX: number;
  gyroY: number;
  gyroZ: number;
  magnitude: number;
}

export interface VisionReading {
  objectsDetected: number;
  labels: string[];
  motionDetected: boolean;
  brightness: number;
}

export interface AudioReading {
  spl: number; // sound pressure level dB
  dominantFreqHz: number;
  peakAmplitude: number;
  silence: boolean;
}

export interface ContactReading {
  open: boolean;
  tamper: boolean;
  contactCount: number;
}

export interface GasReading {
  co2Ppm: number;
  vocPpm: number;
  coPpm: number;
  methanePpm: number;
  airQualityIndex: number;
}

export interface FlowReading {
  rateLpm: number; // litres per minute
  totalLitres: number;
  temperatureC: number;
  pressureBar: number;
}

/** Unión discriminada de lecturas con tipado fuerte por categoría. */
export type TypedReading =
  | { category: "ambient"; value: AmbientReading }
  | { category: "motion"; value: MotionReading }
  | { category: "vision"; value: VisionReading }
  | { category: "audio"; value: AudioReading }
  | { category: "contact"; value: ContactReading }
  | { category: "gas"; value: GasReading }
  | { category: "flow"; value: FlowReading };

// ──────────────────────────────────────────────────────────────────────────
// Sensor genérico — interfaz común que todos los sensores implementan
// ──────────────────────────────────────────────────────────────────────────

export interface Sensor {
  readonly descriptor: Omit<SensorDescriptor, "status" | "lastReading">;
  getStatus(): SensorStatus;
  getDescriptor(): SensorDescriptor;
  start(): void;
  stop(): void;
  isRunning(): boolean;
  /** Devuelve la última lectura o null. */
  getLastReading(): SensorReading | null;
}

// ──────────────────────────────────────────────────────────────────────────
// SensorHub — registro y bus de publicación centralizado
// ──────────────────────────────────────────────────────────────────────────

class SensorHub {
  private sensors = new Map<SensorId, Sensor>();
  private readingListeners = new Set<ReadingListener>();
  private statusListeners = new Set<StatusListener>();
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  // ── Registro ──────────────────────────────────────────────────────────

  register(sensor: Sensor): void {
    const id = sensor.descriptor.id;
    if (this.sensors.has(id)) {
      throw new Error(`Sensor ya registrado: ${id}`);
    }
    this.sensors.set(id, sensor);
    this.notifyStatus(id, sensor.getStatus());
  }

  unregister(id: SensorId): void {
    const sensor = this.sensors.get(id);
    if (sensor) {
      sensor.stop();
      this.sensors.delete(id);
      this.notifyStatus(id, "offline");
    }
  }

  get(id: SensorId): Sensor | undefined {
    return this.sensors.get(id);
  }

  getAll(): Sensor[] {
    return Array.from(this.sensors.values());
  }

  getByCategory(category: SensorCategory): Sensor[] {
    return this.getAll().filter((s) => s.descriptor.category === category);
  }

  getDescriptors(): SensorDescriptor[] {
    return this.getAll().map((s) => s.getDescriptor());
  }

  // ── Suscripciones ─────────────────────────────────────────────────────

  onReading(listener: ReadingListener): () => void {
    this.readingListeners.add(listener);
    return () => this.readingListeners.delete(listener);
  }

  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  // ── Ciclo de muestreo ─────────────────────────────────────────────────

  /** Inicia el muestreo de todos los sensores registrados. */
  startAll(): void {
    if (this.intervalHandle !== null) return;
    for (const sensor of this.sensors.values()) sensor.start();

    this.intervalHandle = setInterval(() => {
      for (const sensor of this.sensors.values()) {
        if (!sensor.isRunning()) continue;
        const reading = sensor.getLastReading();
        if (reading) this.dispatchReading(reading);
      }
    }, 1000);
  }

  stopAll(): void {
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    for (const sensor of this.sensors.values()) sensor.stop();
  }

  // ── Internos ──────────────────────────────────────────────────────────

  private dispatchReading(reading: SensorReading): void {
    for (const listener of this.readingListeners) listener(reading);
  }

  private notifyStatus(id: SensorId, status: SensorStatus): void {
    for (const listener of this.statusListeners) listener(id, status);
  }
}

// Singleton — una sola instancia para toda la aplicación.
export const sensorHub = new SensorHub();
