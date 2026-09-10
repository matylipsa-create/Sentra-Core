/**
 * BluetoothSensorService — Sensores BLE via Web Bluetooth API.
 */

import {
  type Sensor,
  type SensorDescriptor,
  type SensorStatus,
  type SensorReading,
  type SensorCategory,
} from "../core/SensorHub";

interface BluetoothCharacteristicLike {
  startNotifications(): Promise<BluetoothCharacteristicLike>;
  stopNotifications(): Promise<BluetoothCharacteristicLike>;
  addEventListener(type: "characteristicvaluechanged", cb: (e: Event) => void): void;
  removeEventListener(type: string, cb: (e: Event) => void): void;
  value: DataView | null;
}

interface BluetoothServiceLike {
  getCharacteristic(uuid: string): Promise<BluetoothCharacteristicLike>;
}

interface BluetoothServerLike {
  getPrimaryService(uuid: string): Promise<BluetoothServiceLike>;
  connected: boolean;
  disconnect(): void;
}

interface BluetoothDeviceLike {
  id: string;
  name: string;
  gatt?: { connect(): Promise<BluetoothServerLike>; connected?: boolean; disconnect(): void };
  addEventListener(type: "gattserverdisconnected", cb: () => void): void;
}

interface NavigatorBluetooth {
  bluetooth: {
    requestDevice(opts: {
      filters: { services: string[] }[];
      optionalServices?: string[];
    }): Promise<BluetoothDeviceLike>;
  };
}

export interface BLESensorConfig {
  id: string;
  name: string;
  category: SensorCategory;
  unit: string;
  location: string;
  sampleRateHz: number;
  serviceUUID: string;
  characteristicUUID: string;
  parse: (dv: DataView) => { value: unknown; confidence: number };
}

export class BLESensor implements Sensor {
  private status: SensorStatus = "offline";
  private lastReading: SensorReading | null = null;
  private running = false;
  private device: BluetoothDeviceLike | null = null;
  private server: BluetoothServerLike | null = null;
  private characteristic: BluetoothCharacteristicLike | null = null;
  private onReadingCb: ((e: Event) => void) | null = null;
  private onDisconnectCb: (() => void) | null = null;

  constructor(private readonly config: BLESensorConfig) {}

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
    const nav = navigator as unknown as Partial<NavigatorBluetooth>;
    if (!nav.bluetooth) { this.status = "error"; return false; }
    try {
      this.device = await nav.bluetooth.requestDevice({
        filters: [{ services: [this.config.serviceUUID] }],
        optionalServices: [this.config.serviceUUID],
      });
    } catch {
      this.status = "error";
      return false;
    }

    this.onDisconnectCb = () => {
      this.status = "offline";
      this.characteristic = null;
      this.server = null;
    };
    this.device.addEventListener("gattserverdisconnected", this.onDisconnectCb);
    this.running = true;
    return this.connect();
  }

  private async connect(): Promise<boolean> {
    if (!this.device?.gatt) { this.status = "error"; return false; }
    try {
      this.server = await this.device.gatt.connect();
      const service = await this.server.getPrimaryService(this.config.serviceUUID);
      this.characteristic = await service.getCharacteristic(this.config.characteristicUUID);
      this.onReadingCb = (e: Event) => {
        const target = e.target as unknown as BluetoothCharacteristicLike;
        if (!target.value) return;
        const parsed = this.config.parse(target.value);
        this.status = "online";
        this.lastReading = {
          sensorId: this.config.id,
          category: this.config.category,
          timestamp: Date.now(),
          value: parsed.value,
          unit: this.config.unit,
          confidence: parsed.confidence,
        };
      };
      this.characteristic.addEventListener("characteristicvaluechanged", this.onReadingCb);
      await this.characteristic.startNotifications();
      this.status = "online";
      return true;
    } catch {
      this.status = "error";
      return false;
    }
  }

  start(): void {
    if (this.running) return;
    this.status = "offline";
  }

  stop(): void {
    this.running = false;
    if (this.characteristic && this.onReadingCb) {
      this.characteristic.removeEventListener("characteristicvaluechanged", this.onReadingCb);
      try { this.characteristic.stopNotifications(); } catch { /* noop */ }
    }
    this.characteristic = null;
    if (this.server?.connected) this.server.disconnect();
    this.server = null;
    this.status = "offline";
  }
}

export function isBluetoothSupported(): boolean {
  return "bluetooth" in navigator;
}
