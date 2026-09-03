import { DeviceCapabilities } from './DeviceManager';
import { PowerMode } from './PowerManager';

export interface HardwareProfile {
  tier: 'low' | 'medium' | 'high' | 'desktop';
  label: string;
  powerMode: PowerMode;
  visionModel: 'lite_mobilenet_v2' | 'mobilenet_v2' | 'none';
  maxFps: number;
  enableVision: boolean;
  enableGPS: boolean;
  enableIMU: boolean;
  enableAudio: boolean;
  enableBackgroundSync: boolean;
  sensorIntervalMs: number;
  visionIntervalMs: number;
}

export class HardwareAutoAdjust {
  detectTier(caps: DeviceCapabilities): 'low' | 'medium' | 'high' | 'desktop' {
    if (caps.platform === 'desktop') return 'desktop';

    const score =
      (caps.memory >= 4 ? 2 : caps.memory >= 2 ? 1 : 0) +
      (caps.cores >= 4 ? 2 : caps.cores >= 2 ? 1 : 0) +
      (caps.hasCamera ? 1 : 0) +
      (caps.hasAccelerometer ? 1 : 0) +
      (caps.hasBluetooth ? 1 : 0);

    if (caps.platform === 'mobile' && caps.memory <= 2) return 'low';
    if (score >= 5) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }

  getProfile(caps: DeviceCapabilities): HardwareProfile {
    const tier = this.detectTier(caps);

    switch (tier) {
      case 'desktop':
        return {
          tier: 'desktop',
          label: 'PC - Maximo rendimiento',
          powerMode: 'alto_rendimiento',
          visionModel: 'mobilenet_v2',
          maxFps: 30,
          enableVision: true,
          enableGPS: false,
          enableIMU: false,
          enableAudio: true,
          enableBackgroundSync: true,
          sensorIntervalMs: 500,
          visionIntervalMs: 1000,
        };
      case 'high':
        return {
          tier: 'high',
          label: 'Celular alto - COCO-SSD completo',
          powerMode: 'alto_rendimiento',
          visionModel: 'mobilenet_v2',
          maxFps: 30,
          enableVision: true,
          enableGPS: true,
          enableIMU: true,
          enableAudio: true,
          enableBackgroundSync: true,
          sensorIntervalMs: 1000,
          visionIntervalMs: 1000,
        };
      case 'medium':
        return {
          tier: 'medium',
          label: 'Celular medio - COCO-SSD lite',
          powerMode: 'normal',
          visionModel: 'lite_mobilenet_v2',
          maxFps: 15,
          enableVision: true,
          enableGPS: true,
          enableIMU: true,
          enableAudio: true,
          enableBackgroundSync: true,
          sensorIntervalMs: 3000,
          visionIntervalMs: 5000,
        };
      case 'low':
      default:
        return {
          tier: 'low',
          label: 'Celular bajo - Ultra ahorro',
          powerMode: 'ultra_ahorro',
          visionModel: 'none',
          maxFps: 5,
          enableVision: false,
          enableGPS: false,
          enableIMU: true,
          enableAudio: false,
          enableBackgroundSync: false,
          sensorIntervalMs: 10000,
          visionIntervalMs: 0,
        };
    }
  }

  adjust(caps: DeviceCapabilities): HardwareProfile {
    return this.getProfile(caps);
  }
}

export const hardwareAutoAdjust = new HardwareAutoAdjust();
