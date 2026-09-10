/**
 * SerialSensorService — Sensores seriales (USB/RS-232) via Web Serial API.
 */

import {
  type Sensor,
  type SensorDescriptor,
  type SensorStatus,
  type SensorReading,
  type SensorCategory,
} from "../core/SensorHub";

interface SerialPortLike {
  open(opts: { baudRate: number; dataBits?: number; stopBits?: number; parity?: string }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}

interface NavigatorSerial {
  serial: {
    requestPort(opts?: { filters?: unknown[] }): Promise<SerialPortLike>;
    getPorts(): Promise<SerialPortLike[]>;
  };
}

export interface SerialSensorConfig {
  id: string;
  name: string;
  category: SensorCategory;
  unit: string;
  location: string;
  sampleRateHz: number;
  baudRate: number;
  parse: (line: string) => { value: unknown; confidence: number } | null;
}

export class SerialSensor implements Sensor {
  private status: SensorStatus = "offline";
  private lastReading: SensorReading | null = null;
  private running = false;
  private port: SerialPortLike | null = null;
  private cancelled = false;
  private lineBuffer = "";

  constructor(private readonly config: SerialSensorConfig) {}

  get descriptor(): Omit<SensorDescriptor, "status" | "lastReading"> {
    return {
      id: this.config.id, name: this.config.name, category: this.config.category,
      unit: this.config.unit, location: this.config.location,
      sampleRateHz: this.config.sampleRateHz,
    };
  }

  getStatus(): SensorStatus { return this.status; }

  getDescriptor(): SensorDescriptor {
    return { ...this.descriptor, status: this.status, lastReading: this.lastReading };
  }

  isRunning(): boolean { return this.running; }

  getLastReading(): SensorReading | null { return this.lastReading; }

  async requestAndStart(): Promise<boolean> {
    const nav = navigator as unknown as Partial<NavigatorSerial>;
    if (!nav.serial) { this.status = "error"; return false; }
    try {
      this.port = await nav.serial.requestPort();
      await this.port.open({ baudRate: this.config.baudRate });
    } catch {
      this.status = "error";
      return false;
    }
    this.running = true;
    this.cancelled = false;
    this.status = "online";
    void this.doRead();
    return true;
  }

  private async doRead(): Promise<void> {
    if (!this.port?.readable) return;
    const decoder = new TextDecoder();
    const reader = this.port.readable.getReader();
    try {
      while (!this.cancelled) {
        const { done, value } = await reader.read();
        if (done) break;
        this.lineBuffer += decoder.decode(value, { stream: true });
        let nlIdx: number;
        while ((nlIdx = this.lineBuffer.indexOf("\n")) >= 0) {
          const line = this.lineBuffer.slice(0, nlIdx).trim();
          this.lineBuffer = this.lineBuffer.slice(nlIdx + 1);
          if (!line) continue;
          const parsed = this.config.parse(line);
          if (!parsed) continue;
          this.status = "online";
          this.lastReading = {
            sensorId: this.config.id,
            category: this.config.category,
            timestamp: Date.now(),
            value: parsed.value,
            unit: this.config.unit,
            confidence: parsed.confidence,
          };
        }
      }
    } catch {
      this.status = "error";
    } finally {
      try { reader.releaseLock(); } catch { /* noop */ }
    }
  }

  start(): void {
    if (this.running) return;
    this.status = "offline";
  }

  stop(): void {
    this.cancelled = true;
    this.running = false;
    if (this.port) {
      try { this.port.close(); } catch { /* noop */ }
      this.port = null;
    }
    this.status = "offline";
  }
}

export function isSerialSupported(): boolean {
  return "serial" in navigator;
}
