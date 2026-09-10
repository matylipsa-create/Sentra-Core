import { sensorHub, type SensorReading } from './SensorHub';

export interface UnifiedSensorData {
  deviceId: string;
  readings: Record<string, SensorReading>;
  updatedAt: number;
}

type UnifiedListener = (data: UnifiedSensorData[]) => void;

export class CrossDeviceSensorHub {
  private devices = new Map<string, UnifiedSensorData>();
  private listeners = new Set<UnifiedListener>();
  private unsubscribe = sensorHub.onReading((reading) => this.recordReading('local-device', reading));

  registerDeviceSensor(deviceId: string, reading: SensorReading): void { this.recordReading(deviceId, reading); }
  getUnifiedSensorData(): UnifiedSensorData[] { return Array.from(this.devices.values()).map((device) => ({ ...device, readings: { ...device.readings } })); }
  syncSensorsBetweenDevices(): UnifiedSensorData[] { const data = this.getUnifiedSensorData(); this.notify(); return data; }
  subscribe(listener: UnifiedListener): () => void { this.listeners.add(listener); listener(this.getUnifiedSensorData()); return () => this.listeners.delete(listener); }
  dispose(): void { this.unsubscribe(); this.listeners.clear(); }

  private recordReading(deviceId: string, reading: SensorReading): void {
    const current = this.devices.get(deviceId) ?? { deviceId, readings: {}, updatedAt: Date.now() };
    current.readings[reading.sensorId] = reading;
    current.updatedAt = Date.now();
    this.devices.set(deviceId, current);
    this.notify();
  }
  private notify(): void { const data = this.getUnifiedSensorData(); for (const listener of this.listeners) listener(data); }
}

export const crossDeviceSensorHub = new CrossDeviceSensorHub();