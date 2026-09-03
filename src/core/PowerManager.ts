export type PowerMode = 'ultra_ahorro' | 'normal' | 'alto_rendimiento';

export interface PowerProfile {
  mode: PowerMode;
  label: string;
  description: string;
  sensorIntervalMs: number;
  visionIntervalMs: number;
  enableVision: boolean;
  enableGPS: boolean;
  enableIMU: boolean;
  enableAudio: boolean;
  enableBackgroundSync: boolean;
  cpuThrottle: number;
}

const PROFILES: Record<PowerMode, PowerProfile> = {
  ultra_ahorro: {
    mode: 'ultra_ahorro',
    label: 'Ultra Ahorro',
    description: 'Minimo consumo: solo sensores esenciales, sin vision ni audio',
    sensorIntervalMs: 10000,
    visionIntervalMs: 0,
    enableVision: false,
    enableGPS: false,
    enableIMU: true,
    enableAudio: false,
    enableBackgroundSync: false,
    cpuThrottle: 0.5,
  },
  normal: {
    mode: 'normal',
    label: 'Normal',
    description: 'Balance entre funcionalidad y consumo energetico',
    sensorIntervalMs: 3000,
    visionIntervalMs: 5000,
    enableVision: true,
    enableGPS: true,
    enableIMU: true,
    enableAudio: true,
    enableBackgroundSync: true,
    cpuThrottle: 1,
  },
  alto_rendimiento: {
    mode: 'alto_rendimiento',
    label: 'Alto Rendimiento',
    description: 'Maxima capacidad: todos los sensores a maxima frecuencia',
    sensorIntervalMs: 500,
    visionIntervalMs: 1000,
    enableVision: true,
    enableGPS: true,
    enableIMU: true,
    enableAudio: true,
    enableBackgroundSync: true,
    cpuThrottle: 1,
  },
};

export class PowerManager {
  private currentMode: PowerMode = 'normal';
  private batteryLevel: number | null = null;
  private isCharging: boolean = false;

  getProfile(): PowerProfile {
    return PROFILES[this.currentMode];
  }

  setMode(mode: PowerMode): PowerProfile {
    this.currentMode = mode;
    return this.getProfile();
  }

  getMode(): PowerMode {
    return this.currentMode;
  }

  async initBatteryMonitor(): Promise<void> {
    if (!('getBattery' in navigator)) return;
    try {
      const battery = await (navigator as Navigator & {
        getBattery?: () => Promise<{
          level: number; charging: boolean;
          addEventListener: (event: string, cb: () => void) => void;
        }>;
      }).getBattery?.();
      if (!battery) return;
      this.batteryLevel = battery.level;
      this.isCharging = battery.charging;
      battery.addEventListener('levelchange', () => {
        this.batteryLevel = battery.level;
        this.autoAdjust();
      });
      battery.addEventListener('chargingchange', () => {
        this.isCharging = battery.charging;
        this.autoAdjust();
      });
    } catch {
      // Battery API not available
    }
  }

  getBatteryLevel(): number | null {
    return this.batteryLevel;
  }

  isChargingStatus(): boolean {
    return this.isCharging;
  }

  private autoAdjust(): void {
    if (this.isCharging) {
      if (this.currentMode === 'ultra_ahorro') this.setMode('normal');
      return;
    }
    if (this.batteryLevel !== null && this.batteryLevel < 0.15) {
      this.setMode('ultra_ahorro');
    } else if (this.batteryLevel !== null && this.batteryLevel < 0.3 && this.currentMode === 'alto_rendimiento') {
      this.setMode('normal');
    }
  }

  getAllProfiles(): PowerProfile[] {
    return Object.values(PROFILES);
  }
}

export const powerManager = new PowerManager();
