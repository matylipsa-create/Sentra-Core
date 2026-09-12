/**
 * QuadrantGestures — Lógica de los 4 cuadrantes táctiles ciegos.
 *
 * TOP_LEFT: Modo ojos — conmutar lectura de bus/objetos
 * TOP_RIGHT: Descripción instantánea
 * BOTTOM_LEFT: Estado Sentinel
 * BOTTOM_RIGHT: Fijar perímetro / Pánico / Silenciar todo (long press)
 *
 * Sin UI visible: solo lógica. El componente BlindTactileQuadrants
 * usa estas funciones para despachar gestos.
 */

export type QuadrantId = 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT';

export interface QuadrantConfig {
  id: QuadrantId;
  label: string;
  ariaLabel: string;
}

export const QUADRANT_CONFIGS: QuadrantConfig[] = [
  {
    id: 'TOP_LEFT',
    label: 'Modo ojos',
    ariaLabel: 'Modo ojos. Toque para conmutar entre lectura de colectivos y detección de objetos.',
  },
  {
    id: 'TOP_RIGHT',
    label: 'Descripción instantánea',
    ariaLabel: 'Descripción instantánea. Toque para describir lo que hay enfrente.',
  },
  {
    id: 'BOTTOM_LEFT',
    label: 'Estado Sentinel',
    ariaLabel: 'Estado del guardián perimetral. Toque para reporte de seguridad.',
  },
  {
    id: 'BOTTOM_RIGHT',
    label: 'Fijar perímetro / Pánico',
    ariaLabel: 'Fijar perímetro o botón de pánico. Toque largo para silenciar todo.',
  },
];

type TapCallback = (quadrant: QuadrantId) => void;
type LongPressCallback = (quadrant: QuadrantId) => void;

const LONG_PRESS_MS = 800;

class QuadrantGestureManager {
  private tapCallbacks = new Map<QuadrantId, TapCallback>();
  private longPressCallbacks = new Map<QuadrantId, LongPressCallback>();
  private timers = new Map<QuadrantId, number>();

  onQuadrantTap(quadrant: QuadrantId, cb: TapCallback): void {
    this.tapCallbacks.set(quadrant, cb);
  }

  onQuadrantLongPress(quadrant: QuadrantId, cb: LongPressCallback): void {
    this.longPressCallbacks.set(quadrant, cb);
  }

  handleTouchStart(quadrant: QuadrantId): void {
    const longPressCb = this.longPressCallbacks.get(quadrant);
    if (longPressCb) {
      const timer = window.setTimeout(() => {
        longPressCb(quadrant);
        this.timers.delete(quadrant);
      }, LONG_PRESS_MS);
      this.timers.set(quadrant, timer);
    }
  }

  handleTouchEnd(quadrant: QuadrantId): void {
    const timer = this.timers.get(quadrant);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(quadrant);
      return;
    }
    const tapCb = this.tapCallbacks.get(quadrant);
    if (tapCb) tapCb(quadrant);
  }

  handleTouchCancel(quadrant: QuadrantId): void {
    const timer = this.timers.get(quadrant);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(quadrant);
    }
  }

  clearAll(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.tapCallbacks.clear();
    this.longPressCallbacks.clear();
  }
}

export const quadrantGestures = new QuadrantGestureManager();
