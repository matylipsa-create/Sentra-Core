/**
 * NativeSensorService — Sensores nativos del navegador via Generic Sensor API.
 *
 * Encapsula Accelerometer, Gyroscope y AmbientLightSensor en sensores
 * compatibles con la interfaz Sensor del SensorHub.
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
// Tipos mínimos para la Generic Sensor API (no incluidos en lib.dom.d.ts)
// ──────────────────────────────────────────────────────────────────────────

interface GenericSensor {
  start(): void;
  stop(): void;
  addEventListener(type: "reading" | "error" | "activate", cb: () => void): void;
  removeEventListener(type: string, cb: () => void): void;
  hasReading?: boolean;
  activated?: boolean;
}

interface AccelerometerLike extends GenericSensor {
  x: number | null;
  y: number | null;
  z: number | null;
}

interface GyroscopeLike extends GenericSensor {
  x: number | null;
  y: number | null;
  z: number | null;
}

interface AmbientLightSensorLike extends GenericSensor {
  illuminance: number | null;
}

interface SensorConstructor<T extends GenericSensor = GenericSensor> {
  new (options?: { frequency?: number }): T;
}

function getConstructor<T extends GenericSensor>(name: string): SensorConstructor<T> | null {
  const w = window as unknown as Record<string, SensorConstructor<T> | undefined>;
  return w[name] ?? null;
}

// ──────────────────────────────────────────────────────────────────────────
// Clase base compartida
// ──────────────────────────────────────────────────────────────────────────

abstract class NativeSensor implements Sensor {
  protected status: SensorStatus = "offline";
  protected lastReading: SensorReading | null = null;
  protected running = false;
  protected native: GenericSensor | null = null;
  protected frequency: number;

  constructor(
    protected readonly id: SensorId,
    protected readonly name: string,
    protected readonly category: SensorCategory,
    protected readonly unit: string,
    protected readonly location: string,
    frequencyHz: number,
  ) {
    this.frequency = frequencyHz;
  }

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

  isRunning(): boolean {
    return this.running;
  }

  getLastReading(): SensorReading | null {
    return this.lastReading;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    try {
      this.startNative();
    } catch {
      this.status = "error";
      this.running = false;
    }
  }

  stop(): void {
    this.running = false;
    if (this.native) {
      try { this.native.stop(); } catch { /* noop */ }
      this.native = null;
    }
    this.status = "offline";
  }

  protected abstract startNative(): void;

  protected setReading(value: unknown, confidence: number): void {
    this.lastReading = {
      sensorId: this.id,
      category: this.category,
      timestamp: Date.now(),
      value,
      unit: this.unit,
      confidence,
    };
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Acelerómetro
// ──────────────────────────────────────────────────────────────────────────

class NativeAccelerometer extends NativeSensor {
  get descriptor() {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      unit: this.unit,
      location: this.location,
      sampleRateHz: this.frequency,
    };
  }

  protected startNative(): void {
    const Ctor = getConstructor<AccelerometerLike>("Accelerometer");
    if (!Ctor) { this.status = "error"; this.running = false; return; }
    const sensor = new Ctor({ frequency: this.frequency });
    sensor.addEventListener("reading", () => {
      if (sensor.x === null || sensor.y === null || sensor.z === null) return;
      this.status = "online";
      this.setReading(
        { accelX: sensor.x, accelY: sensor.y, accelZ: sensor.z },
        0.95,
      );
    });
    sensor.addEventListener("error", () => {
      this.status = "error";
    });
    sensor.start();
    this.native = sensor;
    this.status = "online";
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Giroscopio
// ──────────────────────────────────────────────────────────────────────────

class NativeGyroscope extends NativeSensor {
  get descriptor() {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      unit: this.unit,
      location: this.location,
      sampleRateHz: this.frequency,
    };
  }

  protected startNative(): void {
    const Ctor = getConstructor<GyroscopeLike>("Gyroscope");
    if (!Ctor) { this.status = "error"; this.running = false; return; }
    const sensor = new Ctor({ frequency: this.frequency });
    sensor.addEventListener("reading", () => {
      if (sensor.x === null || sensor.y === null || sensor.z === null) return;
      this.status = "online";
      this.setReading(
        { gyroX: sensor.x, gyroY: sensor.y, gyroZ: sensor.z },
        0.93,
      );
    });
    sensor.addEventListener("error", () => {
      this.status = "error";
    });
    sensor.start();
    this.native = sensor;
    this.status = "online";
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Sensor de luz ambiental
// ──────────────────────────────────────────────────────────────────────────

class NativeAmbientLight extends NativeSensor {
  get descriptor() {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      unit: this.unit,
      location: this.location,
      sampleRateHz: this.frequency,
    };
  }

  protected startNative(): void {
    const Ctor = getConstructor<AmbientLightSensorLike>("AmbientLightSensor");
    if (!Ctor) { this.status = "error"; this.running = false; return; }
    const sensor = new Ctor({ frequency: this.frequency });
    sensor.addEventListener("reading", () => {
      if (sensor.illuminance === null) return;
      this.status = "online";
      this.setReading({ lightLux: sensor.illuminance }, 0.9);
    });
    sensor.addEventListener("error", () => {
      this.status = "error";
    });
    sensor.start();
    this.native = sensor;
    this.status = "online";
  }
}

// ──────────────────────────────────────────────────────────────────────────
// API pública
// ──────────────────────────────────────────────────────────────────────────

/** Devuelve true si el navegador soporta la Generic Sensor API para un tipo dado. */
export function isNativeSensorSupported(type: "Accelerometer" | "Gyroscope" | "AmbientLightSensor"): boolean {
  return getConstructor(type) !== null;
}

/** Crea sensores nativos si el navegador los soporta. Devuelve array vacío si no. */
export function createNativeSensors(): Sensor[] {
  const sensors: Sensor[] = [];

  if (isNativeSensorSupported("Accelerometer")) {
    sensors.push(
      new NativeAccelerometer("nat-accel", "Acelerometro Nativo", "motion", "m/s²", "Dispositivo", 10),
    );
  }
  if (isNativeSensorSupported("Gyroscope")) {
    sensors.push(
      new NativeGyroscope("nat-gyro", "Giroscopio Nativo", "motion", "rad/s", "Dispositivo", 10),
    );
  }
  if (isNativeSensorSupported("AmbientLightSensor")) {
    sensors.push(
      new NativeAmbientLight("nat-light", "Luz Ambiental Nativa", "ambient", "lx", "Dispositivo", 5),
    );
  }

  return sensors;
}
