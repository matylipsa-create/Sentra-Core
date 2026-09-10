export class PCSensorService {
  private cameraStream: MediaStream | null = null;
  private microphoneStream: MediaStream | null = null;

  hasCamera(): boolean { return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia; }
  hasMicrophone(): boolean { return this.hasCamera(); }
  hasGps(): boolean { return typeof navigator !== 'undefined' && 'geolocation' in navigator; }
  gpsActive(): boolean { return false; }
  cameraActive(): boolean { return this.cameraStream !== null; }
  microphoneActive(): boolean { return this.microphoneStream !== null; }

  async startCamera(): Promise<MediaStream | null> {
    if (!this.hasCamera()) return null;
    try { this.cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); return this.cameraStream; } catch { return null; }
  }

  async startMicrophone(): Promise<MediaStream | null> {
    if (!this.hasMicrophone()) return null;
    try { this.microphoneStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true }); return this.microphoneStream; } catch { return null; }
  }

  stopCamera(): void { this.cameraStream?.getTracks().forEach((track) => track.stop()); this.cameraStream = null; }
  stopMicrophone(): void { this.microphoneStream?.getTracks().forEach((track) => track.stop()); this.microphoneStream = null; }
  stopAll(): void { this.stopCamera(); this.stopMicrophone(); }
}

export const pcSensorService = new PCSensorService();