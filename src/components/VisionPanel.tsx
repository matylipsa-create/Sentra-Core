import { useEffect, useRef, useState } from 'react';
import { CameraStream } from './CameraStream';
import { useRealModeSensors, Detection } from '../hooks/useRealModeSensors';
import { deviceManager } from '../core/DeviceManager';
import { voiceManager } from '../services/VoiceManager';
import { PerceptionData } from '../core/PerceptionEngine';
import { TCREIResponse } from '../core/TCREIBridge';

interface VisionPanelProps {
  processCommand: (command: string, perception?: PerceptionData) => Promise<void>;
  lastResponse: TCREIResponse | null;
  setLastPerception: (p: PerceptionData) => void;
  voiceEnabled: boolean;
}

export function VisionPanel({
  processCommand, lastResponse, setLastPerception, voiceEnabled,
}: VisionPanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [described, setDescribed] = useState(false);
  const { loading, error, detections, perception } = useRealModeSensors(
    videoRef, cameraActive, 5000
  );

  useEffect(() => {
    if (perception) setLastPerception(perception);
  }, [perception, setLastPerception]);

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

  return (
    <div className="vision-panel" role="region" aria-label="Asistencia visual">
      <h2 className="vision-panel-title">Visión</h2>

      <div className="vision-camera-container">
        {cameraActive && (
          <CameraStream
            active={cameraActive}
            detections={detections}
            onVideoReady={(v) => { videoRef.current = v; }}
          />
        )}
        {!cameraActive && (
          <div className="vision-camera-placeholder">
            <span className="vision-camera-icon" aria-hidden="true">{'\u{1F4F7}'}</span>
            <p>Activa la cámara para detectar objetos</p>
          </div>
        )}
      </div>

      <div className="vision-controls">
        <button
          className="action-btn vision-toggle-btn"
          onClick={() => {
            setCameraActive((prev) => !prev);
            deviceManager.vibrate(80);
            voiceManager.speak(cameraActive ? 'Cámara desactivada' : 'Cámara activada', 2);
          }}
          aria-label={cameraActive ? 'Detener cámara' : 'Activar cámara'}
          aria-pressed={cameraActive}
        >
          {cameraActive ? 'Detener cámara' : 'Activar cámara'}
        </button>
        <button
          className="action-btn vision-describe-btn"
          onClick={handleDescribe}
          disabled={!cameraActive || loading}
          aria-label="Describir lo que veo"
        >
          Describir
        </button>
      </div>

      {loading && cameraActive && (
        <p className="vision-loading" aria-live="polite">Cargando modelo de detección...</p>
      )}
      {error && (
        <p className="vision-error" role="alert">Error: {error}</p>
      )}

      {detections.length > 0 && (
        <div className="vision-detections" aria-live="polite">
          <h3 className="vision-detections-title">Detecciones ({detections.length})</h3>
          <ul className="vision-detection-list">
            {detections.slice(0, 5).map((d: Detection, i: number) => (
              <li key={i} className="vision-detection-item">
                <span className="vision-detection-class">{d.class}</span>
                <span className="vision-detection-score">{Math.round(d.score * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lastResponse && cameraActive && (
        <div className="vision-response" aria-live="polite">
          <span className="response-source-tag">
            {lastResponse.source === 'gemini' ? 'Gemini' : 'Local'}
          </span>
          <p>{lastResponse.text}</p>
        </div>
      )}
    </div>
  );
}
