/**
 * SentraGuardianHub — Hub central del Motor de Contexto y Prioridad Operativa.
 *
 * Unifica Visión y Sentinel con 3 niveles jerárquicos:
 *   CRÍTICO (Sentinel) > NAVEGACIÓN (Visión) > DESCRIPTIVO (TTS a demanda)
 *
 * Sentinel interrumpe Visión de forma determinista con cooldown de 5s.
 * Audio 3D binaural real vía SpatialAudioEngine. Haptics vía DeviceManager.
 * TTS unificado vía SentraVisionAccessibility.announcePriority.
 * Prioridad delegada a ContextGovernor (sin estado duplicado).
 */

import { priorityQueue, type PriorityLevel } from './PriorityQueue';
import { spatialAudioEngine } from './SpatialAudioEngine';
import { deviceManager } from './DeviceManager';
import { quadrantGestures, type Quadrant } from './QuadrantGestures';
import { evolis } from './EVOLIS';
import { contextGovernor } from './ContextGovernor';
import { bacterialGuardian } from './BacterialGuardian';
import { eventRouter } from './EventRouter';
import { voiceManager } from '../services/VoiceManager';
import SentraVisionAccessibility from '../modules/SentraVisionAccessibility';

export interface VisionDetectionInput {
  label: string;
  confidence: number;
  panX?: number;
  distance?: number;
}

export interface SentinelEventInput {
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  source: string;
}

export interface HubState {
  sentinelAlertActive: boolean;
  currentPriorityLevel: PriorityLevel;
  lastSentinelEvent: SentinelEventInput | null;
  lastVisionDetection: VisionDetectionInput | null;
  spatialAudioEnabled: boolean;
}

type HubListener = (state: HubState) => void;
type QuadrantHandler = (quadrant: Quadrant) => void;

type GovernorLevel = 'CRITICAL' | 'NAVIGATION' | 'DESCRIPTIVE';

const SENTINEL_RELEASE_MS = 5000;

function fromGovernorLevel(level: GovernorLevel): PriorityLevel {
  if (level === 'CRITICAL') return 'critical';
  if (level === 'NAVIGATION') return 'navigation';
  return 'descriptive';
}

class SentraGuardianHub {
  private sentinelAlertActive = false;
  private lastSentinelEvent: SentinelEventInput | null = null;
  private lastVisionDetection: VisionDetectionInput | null = null;
  private spatialAudioEnabled = true;
  private listeners = new Set<HubListener>();
  private sentinelReleaseTimer: number | null = null;
  private quadrantTapHandlers = new Map<Quadrant, QuadrantHandler>();
  private quadrantLongPressHandlers = new Map<Quadrant, QuadrantHandler>();
  private _multimodalInitialized = false;
  private accessibility = new SentraVisionAccessibility({ minConfidence: 0.5 });

  getState(): HubState {
    return {
      sentinelAlertActive: this.sentinelAlertActive,
      currentPriorityLevel: fromGovernorLevel(contextGovernor.getPriorityLevel()),
      lastSentinelEvent: this.lastSentinelEvent,
      lastVisionDetection: this.lastVisionDetection,
      spatialAudioEnabled: this.spatialAudioEnabled,
    };
  }

  subscribe(listener: HubListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  setSpatialAudioEnabled(enabled: boolean): void {
    this.spatialAudioEnabled = enabled;
    this.notify();
  }

  initSpatialAudio(): void {
    if (!spatialAudioEngine.isInitialized()) {
      spatialAudioEngine.init();
    }
  }

  initMultimodal(): void {
    if (this._multimodalInitialized) return;

    bacterialGuardian.setContextGovernor(contextGovernor);
    eventRouter.setContextGovernor(contextGovernor);
    this.accessibility.setVoiceManager(voiceManager);

    if (typeof window !== 'undefined') {
      (window as unknown as { __sentraAccessibility?: SentraVisionAccessibility }).__sentraAccessibility =
        this.accessibility;
    }

    this._multimodalInitialized = true;
    console.log('[SentraGuardianHub] Multimodal wiring completado.');
  }

  onVisionDetection(detection: VisionDetectionInput): void {
    if (this.sentinelAlertActive) {
      void evolis.record('guardian_hub', 'vision_blocked_by_sentinel', detection.label);
      return;
    }

    this.lastVisionDetection = detection;
    contextGovernor.setPriorityLevel('NAVIGATION');

    priorityQueue.enqueue({
      level: 'navigation',
      type: 'vision_detection',
      message: detection.label,
      data: { confidence: detection.confidence, panX: detection.panX, distance: detection.distance },
    });

    if (this.spatialAudioEnabled && detection.panX !== undefined && detection.distance !== undefined) {
      spatialAudioEngine.playSpatialBeep(detection.panX, detection.distance);
    }

    this.notify();
  }

  onSentinelEvent(event: SentinelEventInput): void {
    this.lastSentinelEvent = event;

    if (event.severity === 'high' || event.severity === 'critical') {
      this.sentinelAlertActive = true;
      contextGovernor.setPriorityLevel('CRITICAL');

      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      deviceManager.vibratePattern('SENTINEL_ALERT');

      this.announceCritical(event.message);

      priorityQueue.enqueue({
        level: 'critical',
        type: 'sentinel_alert',
        message: event.message,
        data: { severity: event.severity, source: event.source },
      });

      void evolis.record('guardian_hub', 'SENTINEL_ALERT', JSON.stringify({
        severity: event.severity,
        source: event.source,
        message: event.message,
      }));

      if (this.sentinelReleaseTimer) clearTimeout(this.sentinelReleaseTimer);
      this.sentinelReleaseTimer = window.setTimeout(() => {
        this.sentinelAlertActive = false;
        contextGovernor.setPriorityLevel('DESCRIPTIVE');
        this.sentinelReleaseTimer = null;
        void evolis.record('guardian_hub', 'PRIORITY_CHANGE', 'sentinel_released');
        this.notify();
      }, SENTINEL_RELEASE_MS);
    } else if (event.severity === 'medium') {
      deviceManager.vibratePattern('WARNING');
      this.announceNormal(event.message);
      priorityQueue.enqueue({
        level: 'critical',
        type: 'sentinel_warning',
        message: event.message,
        data: { severity: event.severity, source: event.source },
      });
    } else {
      this.announceNormal(event.message);
    }

    this.notify();
  }

  requestDescription(): void {
    if (this.sentinelAlertActive) return;
    contextGovernor.setPriorityLevel('DESCRIPTIVE');
    this.notify();
  }

  silenceAll(): void {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    spatialAudioEngine.stopAll();
    this.sentinelAlertActive = false;
    contextGovernor.setPriorityLevel('DESCRIPTIVE');
    if (this.sentinelReleaseTimer) {
      clearTimeout(this.sentinelReleaseTimer);
      this.sentinelReleaseTimer = null;
    }
    void evolis.record('guardian_hub', 'SILENCE_ALL', 'manual');
    this.notify();
  }

  registerQuadrantTap(quadrant: Quadrant, handler: QuadrantHandler): void {
    this.quadrantTapHandlers.set(quadrant, handler);
    quadrantGestures.onQuadrantTap(quadrant, () => {
      this.initSpatialAudio();
      deviceManager.vibratePattern('QUADRANT_TAP');
      void evolis.record('guardian_hub', 'QUADRANT_TAP', quadrant);
      handler(quadrant);
    });
  }

  registerQuadrantLongPress(quadrant: Quadrant, handler: QuadrantHandler): void {
    this.quadrantLongPressHandlers.set(quadrant, handler);
    quadrantGestures.onQuadrantLongPress(quadrant, () => {
      void evolis.record('guardian_hub', 'QUADRANT_LONG_PRESS', quadrant);
      handler(quadrant);
    });
  }

  private announceCritical(message: string): void {
    this.accessibility.announcePriority(message, 'critical');
  }

  private announceNormal(message: string): void {
    this.accessibility.announcePriority(message, 'normal');
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) listener(state);
  }

  dispose(): void {
    if (this.sentinelReleaseTimer) {
      clearTimeout(this.sentinelReleaseTimer);
      this.sentinelReleaseTimer = null;
    }
    quadrantGestures.dispose();
    this.listeners.clear();
    this.quadrantTapHandlers.clear();
    this.quadrantLongPressHandlers.clear();
  }
}

export const sentraGuardianHub = new SentraGuardianHub();
