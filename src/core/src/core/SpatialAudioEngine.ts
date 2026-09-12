/**
 * SpatialAudioEngine
 * Motor de audio 3D binaural real (Web Audio API + PannerNode + HRTF).
 * Ubica objetos en el espacio mediante panning y efecto sonar por distancia.
 *
 * IMPORTANTE: init() debe llamarse tras un gesto del usuario (políticas de autoplay).
 */

export type PanDirection = 'left' | 'center' | 'right';

interface SpatialConfig {
  masterVolume: number;
  hrtfEnabled: boolean;
  maxDistance: number; // metros
  minFrequency: number; // Hz
  maxFrequency: number; // Hz
}

class SpatialAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private config: SpatialConfig;
  private initialized: boolean = false;
  private activeSources: Set<AudioScheduledSourceNode> = new Set();

  constructor(config: Partial<SpatialConfig> = {}) {
    this.config = {
      masterVolume: config.masterVolume ?? 0.8,
      hrtfEnabled: config.hrtfEnabled ?? true,
      maxDistance: config.maxDistance ?? 10,
      minFrequency: config.minFrequency ?? 220,
      maxFrequency: config.maxFrequency ?? 1200,
    };
  }

  /**
   * Inicializa el AudioContext. Debe llamarse tras un gesto del usuario.
   */
  public init(): void {
    if (this.initialized) return;
    if (typeof window === 'undefined') return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        console.warn('[SpatialAudioEngine] Web Audio API no disponible');
        return;
      }

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.config.masterVolume;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (err) {
      console.warn('[SpatialAudioEngine] Error al inicializar:', err);
    }
  }

  /**
   * Reproduce un beep espacial 3D.
   * @param panX -1.0 (izquierda) a 1.0 (derecha)
   * @param distance metros (a menor distancia, mayor frecuencia)
   */
  public playSpatialBeep(panX: number, distance: number): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;

    const clampedPan = Math.max(-1, Math.min(1, panX));
    const clampedDist = Math.max(0, Math.min(this.config.maxDistance, distance));

    // Frecuencia inversamente proporcional a la distancia (efecto sonar)
    const freq =
      this.config.maxFrequency -
      (clampedDist / this.config.maxDistance) *
        (this.config.maxFrequency - this.config.minFrequency);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const panner = this.ctx.createPanner();

    osc.type = 'sine';
    osc.frequency.value = Math.max(this.config.minFrequency, freq);

    // Configurar PannerNode
    panner.panningModel = this.config.hrtfEnabled ? 'HRTF' : 'equalpower';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = this.config.maxDistance;
    panner.rolloffFactor = 1;

    // Posición espacial (x = pan, z = distancia)
    if (panner.positionX) {
      panner.positionX.value = clampedPan;
      panner.positionZ.value = -clampedDist;
    } else {
      // Fallback para navegadores antiguos
      (panner as any).setPosition(clampedPan, 0, -clampedDist);
    }

    // Envolvente de ganancia (beep corto)
    const now = this.ctx.currentTime;
    const duration = 0.15;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.6, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);

    this.activeSources.add(osc);
    osc.onended = () => {
      this.activeSources.delete(osc);
      try {
        osc.disconnect();
        gain.disconnect();
        panner.disconnect();
      } catch (_) {
        /* noop */
      }
    };
  }

  /**
   * Reproduce un tono mono (para alertas Sentinel).
   */
  public playMonoTone(frequency: number, duration: number): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.value = frequency;

    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.5, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);

    this.activeSources.add(osc);
    osc.onended = () => {
      this.activeSources.delete(osc);
      try {
        osc.disconnect();
        gain.disconnect();
      } catch (_) {
        /* noop */
      }
    };
  }

  /**
   * Detiene todos los sonidos activos.
   */
  public stopAll(): void {
    this.activeSources.forEach((src) => {
      try {
        src.stop();
      } catch (_) {
        /* noop */
      }
    });
    this.activeSources.clear();
  }

  /**
   * Ajusta el volumen maestro.
   */
  public setMasterVolume(v: number): void {
    this.config.masterVolume = Math.max(0, Math.min(1, v));
    if (this.masterGain) {
      this.masterGain.gain.value = this.config.masterVolume;
    }
  }

  /**
   * Retorna la dirección textual según panX.
   */
  public static getPanDirection(panX: number): PanDirection {
    if (panX < -0.3) return 'left';
    if (panX > 0.3) return 'right';
    return 'center';
  }

  public isInitialized(): boolean {
    return this.initialized;
  }
}

export const spatialAudioEngine = new SpatialAudioEngine();
export default SpatialAudioEngine;
