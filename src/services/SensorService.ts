export interface SensorReading {
  gps: {
    latitude: number; longitude: number; accuracy: number;
    speed: number | null; heading: number | null;
  } | null;
  imu: {
    accelerometer: { x: number; y: number; z: number } | null;
    gyroscope: { x: number; y: number; z: number } | null;
    orientation: { alpha: number; beta: number; gamma: number } | null;
  } | null;
  barometer: { pressure: number } | null;
  ambientLight: { level: number } | null;
  compass: { heading: number } | null;
  timestamp: number;
}

type SensorListener = (reading: SensorReading) => void;

export class SensorService {
  private listeners: Set<SensorListener> = new Set();
  private intervalId: number | null = null;
  private intervalMs: number = 3000;
  private watchId: number | null = null;
  private currentReading: SensorReading = {
    gps: null, imu: null, barometer: null,
    ambientLight: null, compass: null, timestamp: Date.now(),
  };

  setInterval(ms: number): void {
    this.intervalMs = ms;
    if (this.intervalId !== null) { this.stop(); this.start(); }
  }

  start(): void {
    this.startGPS();
    this.startIMU();
    this.startPolling();
  }

  stop(): void {
    if (this.watchId !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    window.removeEventListener('devicemotion', this.handleMotion);
    window.removeEventListener('deviceorientation', this.handleOrientation);
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  subscribe(listener: SensorListener): () => void {
    this.listeners.add(listener);
    listener(this.currentReading);
    return () => this.listeners.delete(listener);
  }

  getReading(): SensorReading {
    return this.currentReading;
  }

  private startGPS(): void {
    if (!('geolocation' in navigator)) return;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        this.currentReading = {
          ...this.currentReading,
          gps: {
            latitude: pos.coords.latitude, longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy, speed: pos.coords.speed,
            heading: pos.coords.heading,
          },
          timestamp: Date.now(),
        };
        this.notify();
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
  }

  private startIMU(): void {
    window.addEventListener('devicemotion', this.handleMotion);
    window.addEventListener('deviceorientation', this.handleOrientation);
  }

  private handleMotion = (event: DeviceMotionEvent) => {
    const acc = event.accelerationIncludingGravity;
    const gyro = event.rotationRate;
    this.currentReading = {
      ...this.currentReading,
      imu: {
        accelerometer: acc ? { x: acc.x ?? 0, y: acc.y ?? 0, z: acc.z ?? 0 } : null,
        gyroscope: gyro ? { x: gyro.alpha ?? 0, y: gyro.beta ?? 0, z: gyro.gamma ?? 0 } : null,
        orientation: this.currentReading.imu?.orientation ?? null,
      },
      timestamp: Date.now(),
    };
    this.notify();
  };

  private handleOrientation = (event: DeviceOrientationEvent) => {
    this.currentReading = {
      ...this.currentReading,
      imu: {
        accelerometer: this.currentReading.imu?.accelerometer ?? null,
        gyroscope: this.currentReading.imu?.gyroscope ?? null,
        orientation: { alpha: event.alpha ?? 0, beta: event.beta ?? 0, gamma: event.gamma ?? 0 },
      },
      compass: event.alpha !== null ? { heading: event.alpha } : this.currentReading.compass,
      timestamp: Date.now(),
    };
    this.notify();
  };

  private startPolling(): void {
    if (this.intervalId !== null) return;
    this.intervalId = window.setInterval(() => this.notify(), this.intervalMs);
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.currentReading);
  }
}

export const sensorService = new SensorService();
