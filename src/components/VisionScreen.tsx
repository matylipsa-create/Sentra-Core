import { useState, useRef, useCallback, useEffect } from 'react';
import { voiceManager } from '../services/VoiceManager';
import { deviceManager } from '../core/DeviceManager';
import { useRealModeSensors, type Detection } from '../hooks/useRealModeSensors';

const LABEL_ES: Record<string, string> = {
  person: 'persona', dog: 'perro', cat: 'gato', car: 'auto',
  bicycle: 'bicicleta', motorcycle: 'moto', bus: 'autobús',
  truck: 'camión', chair: 'silla', table: 'mesa', bottle: 'botella',
  phone: 'teléfono', book: 'libro', tv: 'televisor',
  computer: 'computadora', knife: 'cuchillo', gun: 'arma',
  weapon: 'arma', scissors: 'tijeras'
};

const TTS_RATES = [1.0, 1.5, 2.0] as const;

interface VisionScreenProps {
  onToggle?: (active: boolean) => void;
}

export function VisionScreen({ onToggle }: VisionScreenProps) {
  const [isActive, setIsActive] = useState(false);
  const [lastDescription, setLastDescription] = useState('');
  const [detectionCount, setDetectionCount] = useState(0);
  const [detectedLabels, setDetectedLabels] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ttsRate, setTtsRate] = useState<number>(voiceManager.getRate());
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastTapRef = useRef(0);
  const lastSpokenRef = useRef<string>('');

  const speak = useCallback((text: string) => {
    try {
      if (voiceManager && typeof (voiceManager as any).speak === 'function') {
        (voiceManager as any).speak(text, 2);
        return;
      }
    } catch { /* noop */ }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1; u.pitch = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }
  }, []);

  const handleRateChange = useCallback((rate: number) => {
    voiceManager.setRate(rate);
    setTtsRate(rate);
  }, []);

  const { detections, error: detectionError } = useRealModeSensors(
    videoRef,
    isActive,
    3000
  );

  useEffect(() => {
    if (detections.length === 0) return;
    const labels = detections.map((d: Detection) => LABEL_ES[d.class] || d.class);
    setDetectedLabels(labels);
    setDetectionCount(detections.length);
    const top = labels.slice(0, 3).join(', ');
    const desc = `Detectados: ${top}`;
    if (desc !== lastSpokenRef.current) {
      lastSpokenRef.current = desc;
      setLastDescription(desc);
      speak(desc);
      try { deviceManager.vibratePattern('NOTIFICATION'); } catch { /* noop */ }
    }
  }, [detections, speak]);

  const handleToggle = useCallback(async () => {
    const newState = !isActive;
    setIsActive(newState);
    onToggle?.(newState);
    setError(null);
    lastSpokenRef.current = '';

    try {
      if (deviceManager && typeof (deviceManager as any).vibratePattern === 'function') {
        (deviceManager as any).vibratePattern('QUADRANT_TAP');
      }
    } catch { /* noop */ }

    if (newState) {
      speak('Visión activada. Describiendo entorno.');
      if (videoRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }, audio: false
          });
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        } catch {
          setError('No se pudo acceder a la cámara');
          speak('Error al activar cámara');
          setIsActive(false);
        }
      }
    } else {
      speak('Visión desactivada.');
      setDetectionCount(0);
      setDetectedLabels([]);
      setLastDescription('');
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
    }
  }, [isActive, speak, onToggle]);

  useEffect(() => {
    const handleDoubleTap = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTapRef.current < 300 && lastTapRef.current > 0) {
        e.preventDefault();
        handleToggle();
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    };
    window.addEventListener('touchstart', handleDoubleTap, { passive: false });
    return () => window.removeEventListener('touchstart', handleDoubleTap);
  }, [handleToggle]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  };

  const effectiveError = error || detectionError;

  return (
    <div className="vision-screen" role="application" aria-label="Sentra Visión">
      <h1 className="vision-title" aria-level={1}>Sentra Visión</h1>

      <button
        className={`vision-main-button ${isActive ? 'active' : 'inactive'}`}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        aria-label={isActive ? 'Desactivar visión' : 'Activar visión'}
        aria-pressed={isActive}
        role="button"
        tabIndex={0}
      >
        {isActive ? 'DESACTIVAR' : 'ACTIVAR VISIÓN'}
      </button>

      <div className="tts-rate-selector" role="group" aria-label="Velocidad de voz">
        <span className="tts-rate-label">Voz:</span>
        {TTS_RATES.map((rate) => (
          <button
            key={rate}
            className={`tts-rate-btn ${ttsRate === rate ? 'tts-rate-btn--active' : ''}`}
            onClick={() => handleRateChange(rate)}
            aria-label={`Velocidad de voz ${rate}x`}
            aria-pressed={ttsRate === rate}
          >
            {rate === 1.0 ? '1x' : `${rate}x`}
          </button>
        ))}
      </div>

      <div className="vision-status" role="status" aria-live="polite" aria-atomic="true">
        <p className="vision-camera-status">
          Cámara: <strong>{isActive ? 'ACTIVA' : 'INACTIVA'}</strong>
        </p>
        {isActive && (
          <>
            <p className="vision-detection-count">
              Objetos detectados: <strong>{detectionCount}</strong>
            </p>
            {detectedLabels.length > 0 && (
              <p className="vision-detected-labels">{detectedLabels.slice(0, 3).join(', ')}</p>
            )}
            {lastDescription && (
              <p className="vision-last-description">"{lastDescription}"</p>
            )}
          </>
        )}
        {effectiveError && (
          <p className="vision-error" role="alert">⚠️ {effectiveError}</p>
        )}
      </div>

      <p className="vision-hint" aria-hidden="true">
        Doble toque en pantalla para activar/desactivar
      </p>

      <video ref={videoRef} className="vision-hidden-video" aria-hidden="true" playsInline />
    </div>
  );
}

export default VisionScreen;
