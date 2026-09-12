// src/components/SentraVisionScreen.tsx
// Sentra Visión — UI accesible con MoralNode + EVOLIS integrados
// Importado desde el repo prototipo v3.1.2-PROT y adaptado a Sentra-Core.

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRealModeSensors } from '../hooks/useRealModeSensors';
import { deviceManager } from '../core/DeviceManager';
import { voiceManager } from '../services/VoiceManager';

// Mapeo de etiquetas en español
const LABEL_ES: Record<string, string> = {
  person: 'persona',
  dog: 'perro',
  cat: 'gato',
  car: 'auto',
  bicycle: 'bicicleta',
  motorcycle: 'moto',
  bus: 'autobús',
  truck: 'camión',
  chair: 'silla',
  table: 'mesa',
  bottle: 'botella',
  phone: 'teléfono',
  book: 'libro',
  tv: 'televisor',
  computer: 'computadora',
  knife: 'cuchillo',
  gun: 'arma',
  weapon: 'arma',
  scissors: 'tijeras'
};

export function SentraVisionScreen() {
  const [isActive, setIsActive] = useState(false);
  const [detectionCount, setDetectionCount] = useState(0);
  const [detectedLabels, setDetectedLabels] = useState<string[]>([]);
  const [cameraStatus, setCameraStatus] = useState('INACTIVA');
  const [error, setError] = useState<string | null>(null);
  const [ethicalFilterActive, setEthicalFilterActive] = useState(true);
  const [chainVerified, setChainVerified] = useState(true);
  const [vetoRequired, setVetoRequired] = useState(false);
  const [lastVetoDecision, setLastVetoDecision] = useState<string | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const [showDebug, setShowDebug] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);

  // Función de voz — usa VoiceManager si está disponible, sino fallback
  const speak = useCallback((text: string) => {
    try {
      if (voiceManager && typeof (voiceManager as any).speak === 'function') {
        (voiceManager as any).speak(text, 2);
        return;
      }
    } catch (_) { /* noop */ }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // Hook de detección con ética y trazabilidad
  const {
    detections,
    filteredDetections,
    isModelLoading,
    error: detectionError,
    ethicalFilterActive: ethicsActive,
    isVetoRequired,
    lastVetoDecision: vetoDecision,
    chainVerified: chainOk,
    getChainStats,
    getMoralLog,
    evolis
  } = useRealModeSensors({
    videoRef,
    enabled: isActive,
    enableEthics: true,
    enableTracing: true,
    enableContext: true,
    onDetection: (objects: any[]) => {
      const labels = objects.map((o: any) => LABEL_ES[o.class] || o.class);
      setDetectedLabels(labels);
      setDetectionCount(objects.length);

      if (objects.length > 0 && objects.length % 3 === 0) {
        const topObjects = labels.slice(0, 3).join(', ');
        speak(`Detectados: ${topObjects}`);
      }
    },
    onEthicalFilter: (objects: any[], allowed: boolean) => {
      if (!allowed) {
        speak('Filtro ético activado');
      }
    }
  });

  // Actualizar estado de ética y trazabilidad
  useEffect(() => {
    setEthicalFilterActive(ethicsActive);
    setChainVerified(chainOk);
    setVetoRequired(isVetoRequired);
    setLastVetoDecision(vetoDecision);

    if (evolis && typeof (evolis as any).getStats === 'function') {
      const stats = (evolis as any).getStats();
      setEventCount(stats.totalEvents);
    }
  }, [ethicsActive, chainOk, isVetoRequired, vetoDecision, evolis]);

  // Manejar activación/desactivación
  const handleToggle = useCallback(async () => {
    try {
      if (deviceManager && typeof (deviceManager as any).vibratePattern === 'function') {
        (deviceManager as any).vibratePattern('QUADRANT_TAP');
      } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(50);
      }
    } catch (_) { /* noop */ }

    const newState = !isActive;
    setIsActive(newState);

    if (newState) {
      speak('Activando visión');
      setCameraStatus('ACTIVA');
      setError(null);

      if (videoRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          speak('Cámara activada');
        } catch (err) {
          speak('Error al activar cámara');
          setError('No se pudo acceder a la cámara');
          setIsActive(false);
          setCameraStatus('INACTIVA');
        }
      }
    } else {
      speak('Desactivando visión');
      setCameraStatus('INACTIVA');
      setDetectionCount(0);
      setDetectedLabels([]);

      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
    }
  }, [isActive, speak]);

  // Doble toque en pantalla
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

    const container = containerRef.current;
    if (container) {
      container.addEventListener('touchstart', handleDoubleTap, { passive: false });
    }

    return () => {
      if (container) {
        container.removeEventListener('touchstart', handleDoubleTap);
      }
    };
  }, [handleToggle]);

  return (
    <div ref={containerRef} className="app-container" role="application" aria-label="Sentra Visión">
      <h1 className="app-title" role="heading" aria-level={1} aria-label="Sentra Visión">
        🎯 Sentra Visión
      </h1>

      <button
        className={`main-button ${isActive ? 'active' : 'inactive'}`}
        onClick={handleToggle}
        aria-label={isActive ? 'Desactivar visión' : 'Activar visión'}
        aria-pressed={isActive}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        {isActive ? 'DESACTIVAR' : 'ACTIVAR'}
      </button>

      <div className="status-container" role="status" aria-live="polite" aria-atomic="true">
        <p className="status-text">
          <span className="status-dot" data-status={cameraStatus} />
          Cámara: {cameraStatus}
        </p>
        {isActive && (
          <p className="detection-text">
            👁️ Objetos detectados: {detectionCount}
          </p>
        )}
        {isActive && detectedLabels.length > 0 && (
          <p className="labels-text">
            {detectedLabels.slice(0, 3).join(', ')}
          </p>
        )}
        {error && (
          <p className="error-text" role="alert">⚠️ {error}</p>
        )}
        {isModelLoading && (
          <p className="loading-text">🔄 Cargando modelo de IA...</p>
        )}

        {/* INDICADORES DE ÉTICA Y TRAZABILIDAD */}
        {isActive && (
          <div className="ethics-indicators">
            <span className={`indicator ${ethicalFilterActive ? 'active' : 'inactive'}`}>
              {ethicalFilterActive ? '🛡️ Ética activa' : '⚠️ Ética desactivada'}
            </span>
            <span className={`indicator ${chainVerified ? 'active' : 'inactive'}`}>
              {chainVerified ? '🔗 Cadena verificada' : '⚠️ Cadena rota'}
            </span>
            {vetoRequired && (
              <span className="indicator veto">
                🔒 Veto humano requerido: {lastVetoDecision || 'Acción crítica'}
              </span>
            )}
            {eventCount > 0 && (
              <span className="indicator info">
                📋 Eventos registrados: {eventCount}
              </span>
            )}
          </div>
        )}
      </div>

      <p className="gesture-hint" aria-hidden="true">
        Doble toque en pantalla para activar/desactivar
      </p>

      <div className="footer">
        <p className="version-text">
          v3.1.2-PROT · Soberanía del dato
        </p>
        <button
          className="debug-toggle"
          onClick={() => setShowDebug(!showDebug)}
          aria-label="Mostrar información de depuración"
        >
          {showDebug ? '🔽 Ocultar debug' : '🔼 Mostrar debug'}
        </button>
      </div>

      {showDebug && isActive && evolis && (
        <div className="debug-panel">
          <h4>🔍 Estado del sistema</h4>
          <p>Eventos totales: {(evolis as any).getChain?.().length ?? 0}</p>
          <p>Cadena verificada: {chainVerified ? '✅ Sí' : '❌ No'}</p>
          <p>Último evento: {(evolis as any).getLastEvent?.()?.type || 'Ninguno'}</p>
          <p>Veto requerido: {vetoRequired ? '✅ Sí' : '❌ No'}</p>
          <button
            onClick={() => {
              const stats = (evolis as any).getStats?.();
              console.log('[Debug] Stats:', stats);
              alert(`Eventos: ${stats?.totalEvents}\nCadena verificada: ${stats?.chainVerified}`);
            }}
          >
            Ver estadísticas
          </button>
        </div>
      )}

      <video ref={videoRef} className="hidden-video" aria-hidden="true" playsInline />
    </div>
  );
}

export default SentraVisionScreen;
