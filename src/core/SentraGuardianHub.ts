/**
 * SentraGuardianHub — Hub central del Motor de Contexto y Prioridad Operativa.
 *
 * Unifica Visión y Sentinel con 3 niveles jerárquicos:
 *   CRÍTICO (Sentinel) > NAVEGACIÓN (Visión) > DESCRIPTIVO (TTS a demanda)
 *
 * Sentinel interrumpe Visión de forma determinista con cooldown de 5s.
 * Audio 3D binaural real vía SpatialAudioEngine. Haptics vía HapticPatterns.
 * TTS unificado vía SentraVisionAccessibility.announcePriority.
 */

import { priorityQueue, type PriorityLevel } from './PriorityQueue';
import { spatialAudioEngine } from './SpatialAudioEngine';
import { vibrate } from './HapticPatterns';
import { quadrantGestures, type QuadrantId } from './QuadrantGestures';
import { evolis } from './EVOLIS';

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
type QuadrantHandler = (quadrant: QuadrantId) => void;

const SENTINEL_RELEASE_MS = 5000;

declare global {
  interface Window {
    __sentraAccessibility?: {
      announcePriority: (text: string, priority: 'critical' | 'normal' | 'low') => void;
      processDetections: (detections: { label: string; confidence: number }[]) => void;
    };
  }
}

class SentraGuardianHub {
  private sentinelAlertActive = false;
  private currentPriorityLevel: PriorityLevel = 'descriptive';
  private lastSentinelEvent: SentinelEventInput | null = null;
  private lastVisionDetection: VisionDetectionInput | null = null;
  private spatialAudioEnabled = true;
  private listeners = new Set<HubListener>();
  private sentinelReleaseTimer: number | null = null;
  private quadrantTapHandlers = new Map<QuadrantId, QuadrantHandler>();
  private quadrantLongPressHandlers = new Map<QuadrantId, QuadrantHandler>();

  getState(): HubState {
    return {
      sentinelAlertActive: this.sentinelAlertActive,
      currentPriorityLevel: this.currentPriorityLevel,
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

  onVisionDetection(detection: VisionDetectionInput): void {
    if (this.sentinelAlertActive) {
      void evolis.record('guardian_hub', 'vision_blocked_by_sentinel', detection.label);
      return;
    }

    this.lastVisionDetection = detection;
    this.currentPriorityLevel = 'navigation';

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
      this.currentPriorityLevel = 'critical';

      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      vibrate('SENTINEL_ALERT');

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
        this.currentPriorityLevel = 'descriptive';
        this.sentinelReleaseTimer = null;
        void evolis.record('guardian_hub', 'PRIORITY_CHANGE', 'sentinel_released');
        this.notify();
      }, SENTINEL_RELEASE_MS);
    } else if (event.severity === 'medium') {
      vibrate('WARNING');
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
    this.currentPriorityLevel = 'descriptive';
    this.notify();
  }

  silenceAll(): void {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    spatialAudioEngine.stopAll();
    this.sentinelAlertActive = false;
    this.currentPriorityLevel = 'descriptive';
    if (this.sentinelReleaseTimer) {
      clearTimeout(this.sentinelReleaseTimer);
      this.sentinelReleaseTimer = null;
    }
    void evolis.record('guardian_hub', 'SILENCE_ALL', 'manual');
    this.notify();
  }

  registerQuadrantTap(quadrant: QuadrantId, handler: QuadrantHandler): void {
    this.quadrantTapHandlers.set(quadrant, handler);
    quadrantGestures.onQuadrantTap(quadrant, (q) => {
      this.initSpatialAudio();
      vibrate('QUADRANT_TAP');
      void evolis.record('guardian_hub', 'QUADRANT_TAP', q);
      handler(q);
    });
  }

  registerQuadrantLongPress(quadrant: QuadrantId, handler: QuadrantHandler): void {
    this.quadrantLongPressHandlers.set(quadrant, handler);
    quadrantGestures.onQuadrantLongPress(quadrant, (q) => {
      void evolis.record('guardian_hub', 'QUADRANT_LONG_PRESS', q);
      handler(q);
    });
  }

  private announceCritical(message: string): void {
    if (window.__sentraAccessibility?.announcePriority) {
      window.__sentraAccessibility.announcePriority(message, 'critical');
    }
  }

  private announceNormal(message: string): void {
    if (window.__sentraAccessibility?.announcePriority) {
      window.__sentraAccessibility.announcePriority(message, 'normal');
    }
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
    quadrantGestures.clearAll();
    this.listeners.clear();
    this.quadrantTapHandlers.clear();
    this.quadrantLongPressHandlers.clear();
  }
}

export const sentraGuardianHub = new SentraGuardianHub();
