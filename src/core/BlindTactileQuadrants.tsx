/**
 * BlindTactileQuadrants
 * 4 zonas táctiles ciegas para control de Visión y Sentinel.
 * Sin botones visibles: solo áreas táctiles con ARIA labels descriptivos.
 */

import React, { useRef, useCallback, useEffect } from 'react';
import {
  quadrantGestures,
  Quadrant,
  QuadrantAction,
} from '../core/QuadrantGestures';
import { spatialAudioEngine } from '../core/SpatialAudioEngine';
import { deviceManager } from '../core/DeviceManager';

interface BlindTactileQuadrantsProps {
  onAction?: (action: QuadrantAction, quadrant: Quadrant) => void;
  className?: string;
}

const QUADRANT_LABELS: Record<Quadrant, string> = {
  TOP_LEFT: 'Modo ojos. Toque para conmutar entre lectura de colectivos y detección de objetos.',
  TOP_RIGHT: 'Descripción instantánea. Toque para describir lo que hay enfrente.',
  BOTTOM_LEFT: 'Estado del guardián perimetral. Toque para reporte de seguridad.',
  BOTTOM_RIGHT: 'Fijar perímetro o botón de pánico. Toque largo para silenciar todo.',
};

const QUADRANT_ORDER: Quadrant[] = [
  'TOP_LEFT',
  'TOP_RIGHT',
  'BOTTOM_LEFT',
  'BOTTOM_RIGHT',
];

export const BlindTactileQuadrants: React.FC<BlindTactileQuadrantsProps> = ({
  onAction,
  className = '',
}) => {
  const pressStartRef = useRef<Map<Quadrant, number>>(new Map());
  const audioInitRef = useRef<boolean>(false);

  // Inicializar audio en el primer toque (política de autoplay)
  const ensureAudioInit = useCallback(() => {
    if (!audioInitRef.current) {
      spatialAudioEngine.init();
      audioInitRef.current = true;
    }
  }, []);

  // Suscribirse a las acciones de QuadrantGestures
  useEffect(() => {
    if (!onAction) return;
    const unsubs = QUADRANT_ORDER.map((q) =>
      quadrantGestures.onQuadrantTap(q, () => onAction('TOGGLE_EYES_MODE', q))
    );
    return () => unsubs.forEach((u) => u());
  }, [onAction]);

  const handlePressStart = useCallback(
    (q: Quadrant) => {
      ensureAudioInit();
      pressStartRef.current.set(q, Date.now());
      try {
        if (deviceManager && typeof (deviceManager as any).vibratePattern === 'function') {
          (deviceManager as any).vibratePattern('QUADRANT_TAP');
        } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(50);
        }
      } catch (_) {
        /* noop */
      }
    },
    [ensureAudioInit]
  );

  const handlePressEnd = useCallback(
    (q: Quadrant) => {
      const start = pressStartRef.current.get(q);
      if (start === undefined) return;
      const duration = Date.now() - start;
      pressStartRef.current.delete(q);
      quadrantGestures.handleGesture(q, duration);
    },
    []
  );

  const handleKeyDown = useCallback(
    (q: Quadrant) => (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        ensureAudioInit();
        quadrantGestures.handleGesture(q, 100);
      }
    },
    [ensureAudioInit]
  );

  return (
    <div
      className={`blind-tactile-quadrants ${className}`}
      role="group"
      aria-label="Controles táctiles de Visión y Sentinel"
    >
      {QUADRANT_ORDER.map((q) => (
        <button
          key={q}
          type="button"
          className={`blind-quadrant blind-quadrant-${q.toLowerCase().replace('_', '-')}`}
          aria-label={QUADRANT_LABELS[q]}
          onPointerDown={() => handlePressStart(q)}
          onPointerUp={() => handlePressEnd(q)}
          onPointerCancel={() => handlePressEnd(q)}
          onKeyDown={handleKeyDown(q)}
        >
          <span className="blind-quadrant-visually-hidden">{QUADRANT_LABELS[q]}</span>
        </button>
      ))}
    </div>
  );
};

export default BlindTactileQuadrants;
