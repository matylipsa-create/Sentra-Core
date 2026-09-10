import { type Sensor, type SensorDescriptor, type SensorReading, type SensorStatus } from '../core/SensorHub';

type GenericSensor = { start(): void; stop(): void; addEventListener(type: string, listener: () => void): void; x?: number | null; y?: number | null; z?: number | null; value?: number | null };

type SensorConstructor = new (options?: { frequency?: number }) => GenericSensor;

function getConstructor(name: string): SensorConstructor | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as Record<string, SensorConstructor | undefined>)[name] ?? null;
}

class BrowserSensor implements Sensor {
  private status: SensorStatus = 'offline';
  private reading: SensorReading | null = null;
  private native: GenericSensor | null = null;
  private running = false;

  constructor(private readonly config: Omit<SensorDescriptor, 'status' | 'lastReading'>, private readonly constructorName: string) {}

  get descriptor() { return this.config; }
  getStatus() { return this.status; }
  getDescriptor() { return { ...this.config, status: this.status, lastReading: this.reading }; }
  isRunning() { return this.running; }
  getLastReading() { return this.reading; }

  start(): void {
    if (this.running) return;
    const Constructor = getConstructor(this.constructorName);
    if (!Constructor) { this.status = 'error'; return; }
    try {
      const native = new Constructor({ frequency: this.config.sampleRateHz });
      native.addEventListener('reading', () => {
        const value = this.constructorName === 'ProximitySensor' ? native.value ?? 0 : { x: native.x ?? 0, y: native.y ?? 0, z: native.z ?? 0 };
        this.reading = { sensorId: this.config.id, category: this.config.category, timestamp: Date.now(), value, unit: this.config.unit, confidence: 0.9 };
        this.status = 'online';
      });
      native.addEventListener('error', () => { this.status = 'error'; });
      native.start();
      this.native = native;
      this.running = true;
      this.status = 'online';
    } catch { this.status = 'error'; }
  }

  stop(): void {
    this.native?.stop();
    this.native = null;
    this.running = false;
    this.status = 'offline';
  }
}

export function createMobileSensors(): Sensor[] {
  const sensors: Sensor[] = [];
  if (getConstructor('Magnetometer')) sensors.push(new BrowserSensor({ id: 'mobile-magnetometer', name: 'Magnetómetro', category: 'motion', unit: 'µT', location: 'Teléfono', sampleRateHz: 10 }, 'Magnetometer'));
  if (getConstructor('ProximitySensor')) sensors.push(new BrowserSensor({ id: 'mobile-proximity', name: 'Proximidad', category: 'contact', unit: 'cm', location: 'Teléfono', sampleRateHz: 5 }, 'ProximitySensor'));
  return sensors;
}