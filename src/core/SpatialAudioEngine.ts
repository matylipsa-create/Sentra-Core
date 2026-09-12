/**
 * SpatialAudioEngine — Motor de audio 3D binaural real vía Web Audio API.
 *
 * PannerNode con HRTF para ubicación espacial. Beeps proporcionales
 * a distancia: frecuencia sube cuando distance baja (efecto sonar).
 *
 * init() debe llamarse tras un gesto del usuario (políticas de autoplay).
 */

class SpatialAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private panner: PannerNode | null = null;
  private masterVolume = 0.7;
  private initialized = false;
  private activeOscillators: OscillatorNode[] = [];

  isInitialized(): boolean {
    return this.initialized;
  }

  init(): boolean {
    if (this.initialized) return true;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return false;
      this.ctx = new Ctor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.ctx.destination);

      this.panner = this.ctx.createPanner();
      this.panner.panningModel = 'HRTF';
      this.panner.distanceModel = 'inverse';
      this.panner.refDistance = 1;
      this.panner.maxDistance = 100;
      this.panner.rolloffFactor = 1;
      this.panner.connect(this.masterGain);

      if (this.ctx.listener) {
        const listener = this.ctx.listener;
        if (listener.positionX) {
          listener.positionX.value = 0;
          listener.positionY.value = 0;
          listener.positionZ.value = 0;
        }
      }

      this.initialized = true;
      return true;
    } catch {
      return false;
    }
  }

  resume(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  suspend(): void {
    if (this.ctx?.state === 'running') void this.ctx.suspend();
  }

  playSpatialBeep(panX: number, distance: number): void {
    if (!this.initialized || !this.ctx || !this.panner || !this.masterGain) return;
    this.resume();

    const clampedX = Math.max(-1, Math.min(1, panX));
    const clampedDist = Math.max(0.5, Math.min(50, distance));

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    const freq = Math.min(2000, Math.max(200, 1200 - clampedDist * 20));
    osc.frequency.value = freq;
    osc.type = 'sine';

    const duration = 0.15;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.5, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    const localPanner = this.ctx.createPanner();
    localPanner.panningModel = 'HRTF';
    localPanner.distanceModel = 'inverse';
    localPanner.refDistance = 1;
    localPanner.maxDistance = 100;
    localPanner.rolloffFactor = 1;

    if (localPanner.positionX) {
      localPanner.positionX.value = clampedX * 10;
      localPanner.positionY.value = 0;
      localPanner.positionZ.value = -clampedDist;
    } else {
      localPanner.setPosition(clampedX * 10, 0, -clampedDist);
    }

    osc.connect(gain);
    gain.connect(localPanner);
    localPanner.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.05);

    this.activeOscillators.push(osc);
    osc.onended = () => {
      this.activeOscillators = this.activeOscillators.filter((o) => o !== osc);
    };
  }

  playMonoTone(freq: number, duration: number): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    this.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.frequency.value = freq;
    osc.type = 'square';

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.05);

    this.activeOscillators.push(osc);
    osc.onended = () => {
      this.activeOscillators = this.activeOscillators.filter((o) => o !== osc);
    };
  }

  stopAll(): void {
    for (const osc of this.activeOscillators) {
      try { osc.stop(); } catch { /* already stopped */ }
    }
    this.activeOscillators = [];
  }

  setMasterVolume(v: number): void {
    this.masterVolume = Math.max(0, Math.min(1, v));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    }
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  dispose(): void {
    this.stopAll();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.initialized = false;
    this.panner = null;
    this.masterGain = null;
  }
}

export const spatialAudioEngine = new SpatialAudioEngine();
