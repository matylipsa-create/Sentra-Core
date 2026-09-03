export interface DeviceCapabilities {
  platform: 'mobile' | 'desktop' | 'tablet';
  hasCamera: boolean;
  hasGPS: boolean;
  hasAccelerometer: boolean;
  hasGyroscope: boolean;
  hasVibration: boolean;
  hasBluetooth: boolean;
  cores: number;
  memory: number;
  hasServiceWorker: boolean;
  isOnline: boolean;
  isStandalone: boolean;
  touchscreen: boolean;
}

export class DeviceManager {
  detect(): DeviceCapabilities {
    const ua = navigator.userAgent;
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const isTablet = /iPad|Tablet/i.test(ua);
    const platform: DeviceCapabilities['platform'] = isTablet
      ? 'tablet' : isMobile ? 'mobile' : 'desktop';

    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
    const cores = navigator.hardwareConcurrency ?? 4;

    return {
      platform,
      hasCamera: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      hasGPS: 'geolocation' in navigator,
      hasAccelerometer: 'DeviceMotion' in window,
      hasGyroscope: 'DeviceOrientation' in window,
      hasVibration: 'vibrate' in navigator,
      hasBluetooth: 'bluetooth' in navigator,
      cores,
      memory,
      hasServiceWorker: 'serviceWorker' in navigator,
      isOnline: navigator.onLine,
      isStandalone:
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
      touchscreen: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    };
  }

  async requestCamera(): Promise<MediaStream | null> {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
    } catch {
      return null;
    }
  }

  async requestGPS(): Promise<GeolocationPosition | null> {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });
  }

  vibrate(pattern: number | number[]): void {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  }
}

export const deviceManager = new DeviceManager();
