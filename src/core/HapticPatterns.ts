/**
 * HapticPatterns — Patrones de vibración nombrados.
 *
 * SENTINEL_ALERT=[400,100,400,100,800]
 * WARNING=[200,100,200]
 * NOTIFICATION=[100,50,100]
 * CONFIRM=[200]
 * QUADRANT_TAP=[50]
 */

export type HapticPatternName =
  | 'SENTINEL_ALERT'
  | 'WARNING'
  | 'NOTIFICATION'
  | 'CONFIRM'
  | 'QUADRANT_TAP';

const PATTERNS: Record<HapticPatternName, number | number[]> = {
  SENTINEL_ALERT: [400, 100, 400, 100, 800],
  WARNING: [200, 100, 200],
  NOTIFICATION: [100, 50, 100],
  CONFIRM: [200],
  QUADRANT_TAP: [50],
};

function isVibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

export function vibrate(patternName: HapticPatternName): void {
  if (!isVibrationSupported()) return;
  const pattern = PATTERNS[patternName];
  navigator.vibrate(pattern);
}

export function vibrateRaw(pattern: number | number[]): void {
  if (!isVibrationSupported()) return;
  navigator.vibrate(pattern);
}

export function getPattern(name: HapticPatternName): number | number[] {
  return PATTERNS[name];
}

export function getAllPatterns(): Record<HapticPatternName, number | number[]> {
  return { ...PATTERNS };
}
