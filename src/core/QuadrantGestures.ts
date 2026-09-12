/**
 * QuadrantGestures
 * Lógica de los 4 cuadrantes táctiles ciegos.
 * Sin UI visible: solo detección de toques y gestos por zona.
 */

export type Quadrant = 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT';

export type QuadrantAction =
  | 'TOGGLE_EYES_MODE'      // TOP_LEFT
  | 'DESCRIBE_NOW'          // TOP_RIGHT
  | 'SENTINEL_STATUS'       // BOTTOM_LEFT
  | 'PANIC_OR_PERIMETER';   // BOTTOM_RIGHT

interface QuadrantConfig {
  tapMaxDurationMs: number;
  longPressMinDurationMs: number;
  onAction?: (action: QuadrantAction, quadrant: Quadrant) => void;
}

class QuadrantGestures {
  private config: QuadrantConfig;
  private listeners: Map<Quadrant, { tap: Array<() => void>; longPress: Array<() => void> }> =
    new Map();

  constructor(config: Partial<QuadrantConfig> = {}) {
    this.config = {
      tapMaxDurationMs: config.tapMaxDurationMs ?? 250,
      longPressMinDurationMs: config.longPressMinDurationMs ?? 600,
      onAction: config.onAction,
    };
  }

  /**
   * Retorna la acción asociada a un cuadrante.
   */
  public static getActionForQuadrant(q: Quadrant): QuadrantAction {
    switch (q) {
      case 'TOP_LEFT':
        return 'TOGGLE_EYES_MODE';
      case 'TOP_RIGHT':
        return 'DESCRIBE_NOW';
      case 'BOTTOM_LEFT':
        return 'SENTINEL_STATUS';
      case 'BOTTOM_RIGHT':
        return 'PANIC_OR_PERIMETER';
      default:
        return 'TOGGLE_EYES_MODE';
    }
  }

  /**
   * Registra un callback para tap en un cuadrante.
   */
  public onQuadrantTap(quadrant: Quadrant, cb: () => void): () => void {
    this.ensureBucket(quadrant);
    this.listeners.get(quadrant)!.tap.push(cb);
    return () => {
      const bucket = this.listeners.get(quadrant);
      if (!bucket) return;
      bucket.tap = bucket.tap.filter((fn) => fn !== cb);
    };
  }

  /**
   * Registra un callback para long press en un cuadrante.
   */
  public onQuadrantLongPress(quadrant: Quadrant, cb: () => void): () => void {
    this.ensureBucket(quadrant);
    this.listeners.get(quadrant)!.longPress.push(cb);
    return () => {
      const bucket = this.listeners.get(quadrant);
      if (!bucket) return;
      bucket.longPress = bucket.longPress.filter((fn) => fn !== cb);
    };
  }

  /**
   * Procesa un gesto completo (llamado desde el componente táctil).
   */
  public handleGesture(quadrant: Quadrant, durationMs: number): void {
    const action = QuadrantGestures.getActionForQuadrant(quadrant);

    if (durationMs >= this.config.longPressMinDurationMs) {
      this.emitLongPress(quadrant);
    } else if (durationMs <= this.config.tapMaxDurationMs) {
      this.emitTap(quadrant);
    }

    if (this.config.onAction) {
      this.config.onAction(action, quadrant);
    }
  }

  private emitTap(quadrant: Quadrant): void {
    const bucket = this.listeners.get(quadrant);
    if (!bucket) return;
    bucket.tap.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.warn('[QuadrantGestures] Error en tap:', err);
      }
    });
  }

  private emitLongPress(quadrant: Quadrant): void {
    const bucket = this.listeners.get(quadrant);
    if (!bucket) return;
    bucket.longPress.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.warn('[QuadrantGestures] Error en longPress:', err);
      }
    });
  }

  private ensureBucket(quadrant: Quadrant): void {
    if (!this.listeners.has(quadrant)) {
      this.listeners.set(quadrant, { tap: [], longPress: [] });
    }
  }
}

export const quadrantGestures = new QuadrantGestures();
export default QuadrantGestures;
