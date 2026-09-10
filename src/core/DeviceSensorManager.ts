import { sensorHub, type Sensor, type SensorDescriptor, type SensorStatus } from './SensorHub';
import { createMobileSensors } from '../services/MobileSensorService';
import { PCSensorService } from '../services/PCSensorService';

export type DeviceSensorKind = 'gps' | 'accelerometer' | 'gyroscope' | 'magnetometer' | 'ambient-light' | 'proximity' | 'camera' | 'microphone';

export interface AvailableSensor extends SensorDescriptor {
  kind: DeviceSensorKind;
  device: 'phone' | 'pc' | 'shared';
  available: boolean;
  active: boolean;
}

type SensorChangeListener = (sensors: AvailableSensor[]) => void;

export class DeviceSensorManager {
  private sensors = new Map<string, Sensor>();
  private listeners = new Set<SensorChangeListener>();
  private pcService = new PCSensorService();
  private detected = false;

  detectAvailableSensors(): AvailableSensor[] {
    if (!this.detected) {
      for (const sensor of createMobileSensors()) this.registerSensor(sensor);
      this.detected = true;
      this.notify();
    }
    return this.getSensorStatusList();
  }

  activateSensor(sensorId: string): void {
    this.detectAvailableSensors();
    const sensor = this.sensors.get(sensorId);
    if (sensor) {
      sensor.start();
      this.notify();
      return;
    }
    if (sensorId === 'pc-camera') this.pcService.startCamera().then(() => this.notify());
    if (sensorId === 'pc-microphone') this.pcService.startMicrophone().then(() => this.notify());
  }

  deactivateSensor(sensorId: string): void {
    const sensor = this.sensors.get(sensorId);
    if (sensor) {
      sensor.stop();
      this.notify();
      return;
    }
    if (sensorId === 'pc-camera') this.pcService.stopCamera();
    if (sensorId === 'pc-microphone') this.pcService.stopMicrophone();
    this.notify();
  }

  getSensorStatus(sensorId: string): SensorStatus {
    return this.sensors.get(sensorId)?.getStatus() ?? 'offline';
  }

  onSensorChange(callback: SensorChangeListener): () => void {
    this.listeners.add(callback);
    callback(this.getSensorStatusList());
    return () => this.listeners.delete(callback);
  }

  getSensorStatusList(): AvailableSensor[] {
    const sensors = Array.from(this.sensors.values()).map((sensor) => ({
      ...sensor.getDescriptor(),
      kind: this.kindFor(sensor.descriptor.id),
      device: 'phone' as const,
      available: true,
      active: sensor.isRunning(),
    }));
    const shared = this.sharedSensor('gps', 'gps-shared', 'GPS', this.pcService.hasGps(), this.pcService.gpsActive());
    const camera = this.sharedSensor('camera', 'pc-camera', 'Cámara', this.pcService.hasCamera(), this.pcService.cameraActive());
    const microphone = this.sharedSensor('microphone', 'pc-microphone', 'Micrófono', this.pcService.hasMicrophone(), this.pcService.microphoneActive());
    return [...sensors, shared, camera, microphone];
  }

  private registerSensor(sensor: Sensor): void {
    if (this.sensors.has(sensor.descriptor.id)) return;
    this.sensors.set(sensor.descriptor.id, sensor);
    try { sensorHub.register(sensor); } catch { /* already registered */ }
  }

  private kindFor(id: string): DeviceSensorKind {
    if (id.includes('magnetometer')) return 'magnetometer';
    if (id.includes('proximity')) return 'proximity';
    if (id.includes('light')) return 'ambient-light';
    if (id.includes('gyro')) return 'gyroscope';
    return 'accelerometer';
  }

  private sharedSensor(kind: DeviceSensorKind, id: string, name: string, available: boolean, active: boolean): AvailableSensor {
    return {
      id, name, category: kind === 'camera' || kind === 'microphone' ? 'vision' : 'location',
      unit: '', location: 'Dispositivo', sampleRateHz: 0, status: active ? 'online' : 'offline',
      lastReading: null, kind, device: kind === 'camera' || kind === 'microphone' ? 'pc' : 'shared', available, active,
    };
  }

  private notify(): void {
    const status = this.getSensorStatusList();
    for (const listener of this.listeners) listener(status);
  }
}

export const deviceSensorManager = new DeviceSensorManager();