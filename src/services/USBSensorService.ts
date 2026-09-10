/**
 * USBSensorService — Sensores USB via WebUSB API.
 */

import {
  type Sensor,
  type SensorDescriptor,
  type SensorStatus,
  type SensorReading,
  type SensorCategory,
} from "../core/SensorHub";

interface USBEndpointLike {
  endpointNumber: number;
  direction: "in" | "out";
  type: "bulk" | "interrupt" | "control";
  packetSize: number;
}

interface USBInterfaceLike {
  interfaceNumber: number;
  alternates: { alternateSetting: number; endpoints: USBEndpointLike[] }[];
}

interface USBDeviceLike {
  vendorId: number;
  productId: number;
  manufacturerName?: string | null;
  productName?: string | null;
  serialNumber?: string | null;
  configuration: { configurationValue: number; interfaces: USBInterfaceLike[] } | null;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  transferOut(endpointNumber: number, data: BufferSource): Promise<{ status: string; bytesWritten: number }>;
  transferIn(endpointNumber: number, length: number): Promise<{ status: string; data: DataView }>;
}

interface NavigatorUSB {
  usb: {
    requestDevice(opts: { filters: Record<string, unknown>[] }): Promise<USBDeviceLike>;
    getDevices(): Promise<USBDeviceLike[]>;
  };
}

export interface USBSensorConfig {
  id: string;
  name: string;
  category: SensorCategory;
  unit: string;
  location: string;
  sampleRateHz: number;
  vendorId?: number;
  productId?: number;
  interfaceNumber: number;
  endpointNumber: number;
  packetSize: number;
  parse: (dv: DataView) => { value: unknown; confidence: number } | null;
}

export class USBSensor implements Sensor {
  private status: SensorStatus = "offline";
  private lastReading: SensorReading | null = null;
  private running = false;
  private device: USBDeviceLike | null = null;
  private cancelled = false;

  constructor(private readonly config: USBSensorConfig) {}

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
    const nav = navigator as unknown as Partial<NavigatorUSB>;
    if (!nav.usb) { this.status = "error"; return false; }

    const filters: Record<string, unknown>[] = [];
    if (this.config.vendorId !== undefined && this.config.productId !== undefined) {
      filters.push({ vendorId: this.config.vendorId, productId: this.config.productId });
    } else if (this.config.vendorId !== undefined) {
      filters.push({ vendorId: this.config.vendorId });
    }

    try {
      this.device = await nav.usb.requestDevice({ filters });
      await this.device.open();
      if (this.device.configuration === null) {
        await this.device.selectConfiguration(1);
      }
      await this.device.claimInterface(this.config.interfaceNumber);
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
    if (!this.device) return;
    try {
      while (!this.cancelled) {
        const result = await this.device.transferIn(this.config.endpointNumber, this.config.packetSize);
        if (result.status !== "ok") { this.status = "warning"; continue; }
        const parsed = this.config.parse(result.data);
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
    } catch {
      this.status = "error";
    }
  }

  start(): void {
    if (this.running) return;
    this.status = "offline";
  }

  stop(): void {
    this.cancelled = true;
    this.running = false;
    if (this.device) {
      try {
        this.device.releaseInterface(this.config.interfaceNumber);
        this.device.close();
      } catch { /* noop */ }
      this.device = null;
    }
    this.status = "offline";
  }
}

export function isUSBSupported(): boolean {
  return "usb" in navigator;
}
