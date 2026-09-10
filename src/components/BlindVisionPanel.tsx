import { useEffect, useRef, useState } from 'react';
import { useRealModeSensors, Detection } from '../hooks/useRealModeSensors';
import { deviceManager } from '../core/DeviceManager';
import { voiceManager } from '../services/VoiceManager';
import { PerceptionData } from '../core/PerceptionEngine';
import { TCREIResponse } from '../core/TCREIBridge';

interface BlindVisionPanelProps {
  processCommand: (command: string, perception?: PerceptionData) => Promise<void>;
  lastResponse: TCREIResponse | null;
  voiceEnabled: boolean;
}

export function BlindVisionPanel({
  processCommand, lastResponse, voiceEnabled,
}: BlindVisionPanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [described, setDescribed] = useState(false);
  const { loading, error, detections, perception } = useRealModeSensors(
    videoRef, cameraActive, 5000
  );

  useEffect(() => {
    if (!cameraActive || detections.length === 0 || described) return;
    const summary = detections
      .slice(0, 5)
      .map((d) => `${d.class} ${Math.round(d.score * 100)}%`)
      .join(', ');
    const text = `Detecto: ${summary}. Modo offline activo.`;
    if (voiceEnabled) voiceManager.speak(text, 3);
    deviceManager.vibrate(100);
    setDescribed(true);
    const reset = setTimeout(() => setDescribed(false), 8000);
    return () => clearTimeout(reset);
  }, [detections, cameraActive, described, voiceEnabled]);

  const handleDescribe = () => {
    if (detections.length === 0) {
      if (voiceEnabled) voiceManager.speak('No detecto objetos en este momento', 3);
      return;
    }
    const summary = detections
      .slice(0, 5)
      .map((d) => `${d.class} ${Math.round(d.score * 100)}%`)
      .join(', ');
    const text = `Veo: ${summary}.`;
    if (voiceEnabled) voiceManager.speak(text, 2);
    deviceManager.vibrate(80);
    processCommand('describir escena', perception ?? undefined);
  };

  const handleToggleCamera = () => {
    setCameraActive((prev) => !prev);
    deviceManager.vibrate(80);
    voiceManager.speak(cameraActive ? 'Cámara desactivada' : 'Cámara activada', 2);
  };

  return (
    <div className="blind-vision-panel" role="region" aria-label="Asistencia visual para personas ciegas">
      <h2 className="blind-panel-title">Visión</h2>
      <p className="blind-panel-desc">
        Detección de objetos con descripción por voz. Todo funciona sin mirar la pantalla.
      </p>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="blind-hidden-video"
        aria-hidden="true"
        tabIndex={-1}
      />

      <div className="blind-vision-controls">
        <button
          className="blind-action-btn blind-camera-btn"
          onClick={handleToggleCamera}
          aria-label={cameraActive ? 'Detener cámara' : 'Activar cámara'}
          aria-pressed={cameraActive}
        >
          {cameraActive ? 'Detener cámara' : 'Activar cámara'}
        </button>
        <button
          className="blind-action-btn blind-describe-btn"
          onClick={handleDescribe}
          disabled={!cameraActive || loading}
          aria-label="Describir lo que veo"
        >
          Describir
        </button>
      </div>

      {loading && cameraActive && (
        <p className="blind-loading" aria-live="polite">Cargando modelo de detección...</p>
      )}
      {error && (
        <p className="blind-error" role="alert">Error: {error}</p>
      )}

      {detections.length > 0 && (
        <div className="blind-detections" aria-live="polite">
          <h3 className="blind-detections-title">Detecciones ({detections.length})</h3>
          <ul className="blind-detection-list">
            {detections.slice(0, 5).map((d: Detection, i: number) => (
              <li key={i} className="blind-detection-item">
                <span className="blind-detection-class">{d.class}</span>
                <span className="blind-detection-score">{Math.round(d.score * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lastResponse && cameraActive && (
        <div className="blind-vision-response" aria-live="polite">
          <span className="blind-response-source-tag">
            {lastResponse.source === 'gemini' ? 'Gemini' : 'Local'}
          </span>
          <p>{lastResponse.text}</p>
        </div>
      )}
    </div>
  );
}
