/**
 * QuantizationManager — Detecta VRAM y recomienda nivel de cuantización.
 *
 * Niveles soportados:
 *   4-bit Q4_K_M  — 4-6 GB VRAM, calidad buena, máximo ahorro
 *   5-bit Q5_K_M  — 6-8 GB VRAM, calidad muy buena
 *   8-bit Q8_0    — 8-12 GB VRAM, calidad excelente
 *
 * Optimiza para hardware modesto (gama media) sin sacrificar funcionalidad.
 */

export type QuantizationLevel = 'q4_K_M' | 'q5_K_M' | 'q8_0' | 'f16' | 'unknown';

export interface QuantizationRecommendation {
  level: QuantizationLevel;
  label: string;
  description: string;
  estimatedVramGb: number;
  maxParameters: string;
  qualityScore: number;
  speedScore: number;
}

export interface HardwareProfile {
  vramGb: number;
  ramGb: number;
  cores: number;
  platform: 'desktop' | 'mobile' | 'tablet';
  gpu: 'nvidia' | 'amd' | 'intel' | 'apple' | 'unknown';
  recommendedLevel: QuantizationLevel;
}

export interface QuantizationStatus {
  detected: HardwareProfile | null;
  recommendation: QuantizationRecommendation | null;
  availableLevels: QuantizationRecommendation[];
}

type QuantizationListener = (status: QuantizationStatus) => void;

const LEVEL_INFO: Record<QuantizationLevel, QuantizationRecommendation> = {
  q4_K_M: {
    level: 'q4_K_M',
    label: '4-bit Q4_K_M',
    description: 'Máximo ahorro de VRAM. Calidad buena. Ideal para hardware modesto.',
    estimatedVramGb: 4,
    maxParameters: '7B-8B en 4-6 GB',
    qualityScore: 0.75,
    speedScore: 0.95,
  },
  q5_K_M: {
    level: 'q5_K_M',
    label: '5-bit Q5_K_M',
    description: 'Balance entre calidad y VRAM. Muy buena calidad.',
    estimatedVramGb: 6,
    maxParameters: '7B-8B en 6-8 GB',
    qualityScore: 0.85,
    speedScore: 0.85,
  },
  q8_0: {
    level: 'q8_0',
    label: '8-bit Q8_0',
    description: 'Calidad excelente. Requiere más VRAM.',
    estimatedVramGb: 8,
    maxParameters: '7B-8B en 8-12 GB',
    qualityScore: 0.95,
    speedScore: 0.70,
  },
  f16: {
    level: 'f16',
    label: '16-bit FP16',
    description: 'Sin cuantizar. Calidad máxima. Requiere GPU potente.',
    estimatedVramGb: 16,
    maxParameters: '7B en 14-16 GB',
    qualityScore: 1.0,
    speedScore: 0.50,
  },
  unknown: {
    level: 'unknown',
    label: 'Desconocido',
    description: 'No se pudo detectar el hardware.',
    estimatedVramGb: 0,
    maxParameters: 'N/A',
    qualityScore: 0,
    speedScore: 0,
  },
};

export class QuantizationManager {
  private detected: HardwareProfile | null = null;
  private listeners = new Set<QuantizationListener>();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    this.detected = this.detectHardware();
    this.notify();
  }

  // ── Detección de hardware ──────────────────────────────────────────────

  detectHardware(): HardwareProfile {
    const ua = navigator.userAgent;
    const platform: HardwareProfile['platform'] =
      /iPad|Tablet/i.test(ua) ? 'tablet'
      : /Android|iPhone|iPod|Mobile/i.test(ua) ? 'mobile'
      : 'desktop';

    const ramGb = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
    const cores = navigator.hardwareConcurrency ?? 4;

    const gpu = this.detectGPU();
    const vramGb = this.estimateVRAM(gpu, ramGb);

    const recommendedLevel = this.recommendLevel(vramGb, ramGb);

    return {
      vramGb,
      ramGb,
      cores,
      platform,
      gpu,
      recommendedLevel,
    };
  }

  private detectGPU(): HardwareProfile['gpu'] {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
    if (!gl) return 'unknown';
    const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return 'unknown';
    const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string;
    const lower = renderer.toLowerCase();
    if (lower.includes('nvidia')) return 'nvidia';
    if (lower.includes('amd') || lower.includes('radeon')) return 'amd';
    if (lower.includes('intel')) return 'intel';
    if (lower.includes('apple') || lower.includes('m1') || lower.includes('m2') || lower.includes('m3')) return 'apple';
    return 'unknown';
  }

  private estimateVRAM(gpu: HardwareProfile['gpu'], ramGb: number): number {
    switch (gpu) {
      case 'nvidia':
        return Math.min(ramGb * 0.75, 12);
      case 'amd':
        return Math.min(ramGb * 0.6, 10);
      case 'apple':
        return Math.min(ramGb * 0.6, 16);
      case 'intel':
        return Math.min(ramGb * 0.4, 6);
      default:
        return Math.min(ramGb * 0.5, 6);
    }
  }

  private recommendLevel(vramGb: number, ramGb: number): QuantizationLevel {
    if (vramGb >= 16 || ramGb >= 32) return 'q8_0';
    if (vramGb >= 6 || ramGb >= 16) return 'q5_K_M';
    return 'q4_K_M';
  }

  // ── Recomendación ───────────────────────────────────────────────────────

  getRecommendation(): QuantizationRecommendation | null {
    if (!this.detected) return null;
    return LEVEL_INFO[this.detected.recommendedLevel];
  }

  getRecommendationForLevel(level: QuantizationLevel): QuantizationRecommendation {
    return LEVEL_INFO[level];
  }

  getAvailableLevels(): QuantizationRecommendation[] {
    return [LEVEL_INFO.q4_K_M, LEVEL_INFO.q5_K_M, LEVEL_INFO.q8_0];
  }

  getHardwareProfile(): HardwareProfile | null {
    return this.detected;
  }

  // ── Optimización ───────────────────────────────────────────────────────

  optimizeForLowEnd(): QuantizationRecommendation {
    return LEVEL_INFO.q4_K_M;
  }

  optimizeForHighEnd(): QuantizationRecommendation {
    return LEVEL_INFO.q8_0;
  }

  // ── Estado ────────────────────────────────────────────────────────────

  getStatus(): QuantizationStatus {
    return {
      detected: this.detected,
      recommendation: this.getRecommendation(),
      availableLevels: this.getAvailableLevels(),
    };
  }

  subscribe(listener: QuantizationListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const status = this.getStatus();
    for (const listener of this.listeners) listener(status);
  }
}

export const quantizationManager = new QuantizationManager();
