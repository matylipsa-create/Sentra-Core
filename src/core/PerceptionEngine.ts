/**
 * PerceptionEngine — Motor de procesamiento en tiempo real para SentraCore.
 *
 * Consume las lecturas del SensorHub, las analiza por categoría, detecta
 * anomalías y emite eventos de percepción que el SensorModule traduce en
 * acciones.
 */

import {
  sensorHub,
  type SensorReading,
  type SensorCategory,
  type AmbientReading,
  type MotionReading,
  type VisionReading,
  type AudioReading,
  type ContactReading,
  type GasReading,
  type FlowReading,
} from "./SensorHub";

// ──────────────────────────────────────────────────────────────────────────
// Eventos de percepción
// ──────────────────────────────────────────────────────────────────────────

export type PerceptionLevel = "info" | "warning" | "critical";

export interface PerceptionEvent {
  id: string;
  category: SensorCategory;
  sensorId: string;
  level: PerceptionLevel;
  message: string;
  timestamp: number;
  data?: Record<string, number | string | boolean>;
}

export type PerceptionListener = (event: PerceptionEvent) => void;

// ──────────────────────────────────────────────────────────────────────────
// Umbrales configurables
// ──────────────────────────────────────────────────────────────────────────

export interface PerceptionThresholds {
  ambient: {
    tempMin: number;
    tempMax: number;
    humidityMin: number;
    humidityMax: number;
    lightMax: number;
  };
  motion: {
    accelMax: number;
    gyroMax: number;
    magnitudeMax: number;
  };
  vision: {
    maxObjects: number;
    motionDetected: boolean;
  };
  audio: {
    splMax: number;
    silenceThreshold: number;
  };
  contact: {
    tamperAlert: boolean;
  };
  gas: {
    co2Max: number;
    vocMax: number;
    coMax: number;
    methaneMax: number;
    aqiMax: number;
  };
  flow: {
    rateMin: number;
    rateMax: number;
    pressureMax: number;
    tempMax: number;
  };
}

const DEFAULT_THRESHOLDS: PerceptionThresholds = {
  ambient: { tempMin: 10, tempMax: 35, humidityMin: 20, humidityMax: 80, lightMax: 10000 },
  motion: { accelMax: 2.5, gyroMax: 500, magnitudeMax: 3 },
  vision: { maxObjects: 10, motionDetected: true },
  audio: { splMax: 85, silenceThreshold: 30 },
  contact: { tamperAlert: true },
  gas: { co2Max: 1000, vocMax: 0.3, coMax: 9, methaneMax: 50, aqiMax: 150 },
  flow: { rateMin: 0.5, rateMax: 50, pressureMax: 6, tempMax: 80 },
};

// ──────────────────────────────────────────────────────────────────────────
// PerceptionEngine
// ──────────────────────────────────────────────────────────────────────────

class PerceptionEngine {
  private listeners = new Set<PerceptionListener>();
  private thresholds: PerceptionThresholds = DEFAULT_THRESHOLDS;
  private eventCount = 0;
  private unsubscribeReading: (() => void) | null = null;
  private history: PerceptionEvent[] = [];
  private readonly maxHistory = 200;

  // ── Configuración ─────────────────────────────────────────────────────

  setThresholds(thresholds: Partial<PerceptionThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  getThresholds(): PerceptionThresholds {
    return this.thresholds;
  }

  // ── Suscripciones ─────────────────────────────────────────────────────

  onEvent(listener: PerceptionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getHistory(): PerceptionEvent[] {
    return [...this.history];
  }

  // ── Ciclo de vida ────────────────────────────────────────────────────

  start(): void {
    if (this.unsubscribeReading) return;
    this.unsubscribeReading = sensorHub.onReading((r) => this.process(r));
  }

  stop(): void {
    if (this.unsubscribeReading) {
      this.unsubscribeReading();
      this.unsubscribeReading = null;
    }
  }

  // ── Procesamiento ────────────────────────────────────────────────────

  process(reading: SensorReading): void {
    switch (reading.category) {
      case "ambient":
        this.processAmbient(reading, reading.value as AmbientReading);
        break;
      case "motion":
        this.processMotion(reading, reading.value as MotionReading);
        break;
      case "vision":
        this.processVision(reading, reading.value as VisionReading);
        break;
      case "audio":
        this.processAudio(reading, reading.value as AudioReading);
        break;
      case "contact":
        this.processContact(reading, reading.value as ContactReading);
        break;
      case "gas":
        this.processGas(reading, reading.value as GasReading);
        break;
      case "flow":
        this.processFlow(reading, reading.value as FlowReading);
        break;
    }
  }

  // ── Procesadores por categoría ────────────────────────────────────────

  private processAmbient(r: SensorReading, v: AmbientReading): void {
    const t = this.thresholds.ambient;
    if (v.temperatureC > t.tempMax) {
      this.emit({
        category: "ambient",
        sensorId: r.sensorId,
        level: "warning",
        message: `Temperatura elevada: ${v.temperatureC.toFixed(1)} °C`,
        data: { temperatureC: v.temperatureC },
      });
    } else if (v.temperatureC < t.tempMin) {
      this.emit({
        category: "ambient",
        sensorId: r.sensorId,
        level: "warning",
        message: `Temperatura baja: ${v.temperatureC.toFixed(1)} °C`,
        data: { temperatureC: v.temperatureC },
      });
    }
    if (v.humidityPct > t.humidityMax || v.humidityPct < t.humidityMin) {
      this.emit({
        category: "ambient",
        sensorId: r.sensorId,
        level: "info",
        message: `Humedad fuera de rango: ${v.humidityPct.toFixed(0)} %`,
        data: { humidityPct: v.humidityPct },
      });
    }
    if (v.lightLux > t.lightMax) {
      this.emit({
        category: "ambient",
        sensorId: r.sensorId,
        level: "info",
        message: `Luz elevada: ${v.lightLux.toFixed(0)} lx`,
        data: { lightLux: v.lightLux },
      });
    }
  }

  private processMotion(r: SensorReading, v: MotionReading): void {
    const t = this.thresholds.motion;
    const maxAccel = Math.max(Math.abs(v.accelX), Math.abs(v.accelY), Math.abs(v.accelZ));
    if (maxAccel > t.accelMax) {
      this.emit({
        category: "motion",
        sensorId: r.sensorId,
        level: "critical",
        message: `Aceleración excesiva: ${maxAccel.toFixed(2)} g`,
        data: { maxAccel, magnitude: v.magnitude },
      });
    }
    const maxGyro = Math.max(Math.abs(v.gyroX), Math.abs(v.gyroY), Math.abs(v.gyroZ));
    if (maxGyro > t.gyroMax) {
      this.emit({
        category: "motion",
        sensorId: r.sensorId,
        level: "warning",
        message: `Rotación elevada: ${maxGyro.toFixed(0)} °/s`,
        data: { maxGyro },
      });
    }
    if (v.magnitude > t.magnitudeMax) {
      this.emit({
        category: "motion",
        sensorId: r.sensorId,
        level: "warning",
        message: `Magnitud de movimiento alta: ${v.magnitude.toFixed(2)}`,
        data: { magnitude: v.magnitude },
      });
    }
  }

  private processVision(r: SensorReading, v: VisionReading): void {
    const t = this.thresholds.vision;
    if (v.objectsDetected > t.maxObjects) {
      this.emit({
        category: "vision",
        sensorId: r.sensorId,
        level: "warning",
        message: `Muchos objetos detectados: ${v.objectsDetected}`,
        data: { objectsDetected: v.objectsDetected },
      });
    }
    if (v.motionDetected && t.motionDetected) {
      this.emit({
        category: "vision",
        sensorId: r.sensorId,
        level: "info",
        message: `Movimiento visual detectado`,
        data: { labels: v.labels.join(", ") },
      });
    }
  }

  private processAudio(r: SensorReading, v: AudioReading): void {
    const t = this.thresholds.audio;
    if (v.spl > t.splMax) {
      this.emit({
        category: "audio",
        sensorId: r.sensorId,
        level: "warning",
        message: `Nivel sonoro elevado: ${v.spl.toFixed(1)} dB`,
        data: { spl: v.spl },
      });
    }
    if (v.silence && v.spl < t.silenceThreshold) {
      this.emit({
        category: "audio",
        sensorId: r.sensorId,
        level: "info",
        message: `Silencio detectado`,
        data: { spl: v.spl },
      });
    }
  }

  private processContact(r: SensorReading, v: ContactReading): void {
    const t = this.thresholds.contact;
    if (v.tamper && t.tamperAlert) {
      this.emit({
        category: "contact",
        sensorId: r.sensorId,
        level: "critical",
        message: `Manipulación detectada (tamper)`,
        data: { tamper: v.tamper },
      });
    }
    if (v.open) {
      this.emit({
        category: "contact",
        sensorId: r.sensorId,
        level: "info",
        message: `Contacto abierto`,
        data: { open: v.open, contactCount: v.contactCount },
      });
    }
  }

  private processGas(r: SensorReading, v: GasReading): void {
    const t = this.thresholds.gas;
    if (v.co2Ppm > t.co2Max) {
      this.emit({
        category: "gas",
        sensorId: r.sensorId,
        level: v.co2Ppm > t.co2Max * 1.5 ? "critical" : "warning",
        message: `CO₂ elevado: ${v.co2Ppm.toFixed(0)} ppm`,
        data: { co2Ppm: v.co2Ppm },
      });
    }
    if (v.vocPpm > t.vocMax) {
      this.emit({
        category: "gas",
        sensorId: r.sensorId,
        level: "warning",
        message: `COV elevado: ${v.vocPpm.toFixed(2)} ppm`,
        data: { vocPpm: v.vocPpm },
      });
    }
    if (v.coPpm > t.coMax) {
      this.emit({
        category: "gas",
        sensorId: r.sensorId,
        level: "critical",
        message: `CO peligroso: ${v.coPpm.toFixed(1)} ppm`,
        data: { coPpm: v.coPpm },
      });
    }
    if (v.methanePpm > t.methaneMax) {
      this.emit({
        category: "gas",
        sensorId: r.sensorId,
        level: "critical",
        message: `Metano detectado: ${v.methanePpm.toFixed(0)} ppm`,
        data: { methanePpm: v.methanePpm },
      });
    }
    if (v.airQualityIndex > t.aqiMax) {
      this.emit({
        category: "gas",
        sensorId: r.sensorId,
        level: "warning",
        message: `ICA deficiente: ${v.airQualityIndex.toFixed(0)}`,
        data: { airQualityIndex: v.airQualityIndex },
      });
    }
  }

  private processFlow(r: SensorReading, v: FlowReading): void {
    const t = this.thresholds.flow;
    if (v.rateLpm < t.rateMin) {
      this.emit({
        category: "flow",
        sensorId: r.sensorId,
        level: "warning",
        message: `Caudal bajo: ${v.rateLpm.toFixed(2)} L/min`,
        data: { rateLpm: v.rateLpm },
      });
    } else if (v.rateLpm > t.rateMax) {
      this.emit({
        category: "flow",
        sensorId: r.sensorId,
        level: "warning",
        message: `Caudal alto: ${v.rateLpm.toFixed(2)} L/min`,
        data: { rateLpm: v.rateLpm },
      });
    }
    if (v.pressureBar > t.pressureMax) {
      this.emit({
        category: "flow",
        sensorId: r.sensorId,
        level: "critical",
        message: `Presión excesiva: ${v.pressureBar.toFixed(1)} bar`,
        data: { pressureBar: v.pressureBar },
      });
    }
    if (v.temperatureC > t.tempMax) {
      this.emit({
        category: "flow",
        sensorId: r.sensorId,
        level: "warning",
        message: `Temperatura de fluido alta: ${v.temperatureC.toFixed(1)} °C`,
        data: { temperatureC: v.temperatureC },
      });
    }
  }

  // ── Emisión de eventos ────────────────────────────────────────────────

  private emit(
    partial: Omit<PerceptionEvent, "id" | "timestamp">,
  ): void {
    const event: PerceptionEvent = {
      ...partial,
      id: `evt-${Date.now()}-${this.eventCount++}`,
      timestamp: Date.now(),
    };
    this.history.unshift(event);
    if (this.history.length > this.maxHistory) this.history.pop();
    for (const listener of this.listeners) listener(event);
  }
}

// Singleton — un solo motor para toda la aplicación.
export const perceptionEngine = new PerceptionEngine();
