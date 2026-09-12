import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { voiceManager } from '../services/VoiceManager';
import { deviceManager } from '../core/DeviceManager';
import { BlindModeSelector } from './BlindModeSelector';
import { BlindVisionPanel } from './BlindVisionPanel';
import { BlindSentinelPanel } from './BlindSentinelPanel';
import { BlindTactileQuadrants } from './BlindTactileQuadrants';
import { sentraGuardianHub } from '../core/SentraGuardianHub';

type OrbState = 'idle' | 'listening' | 'speaking' | 'disabled';

export function BlindUnifiedUI() {
  const {
    uiMode, setUiMode, setModule,
    voiceEnabled, isPassiveListening,
    togglePassiveListening, toggleVoice,
    processCommand,
    lastResponse, lastMoralEval,
    humanVeto, evidenceCount,
    guardianStatus, isBacterialGuardianActive,
    activateGuardian, deactivateGuardian,
    getEvidence, exportData, toggleHumanVeto,
    cameraActive, toggleCamera,
  } = useApp();

  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [oneShotListening, setOneShotListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const lastTapRef = useRef(0);

  useEffect(() => {
    const SRC =
      (window as Window & { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ||
      (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (SRC) {
      const recognition = new SRC();
      recognition.lang = 'es-ES';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        processCommand(transcript);
      };
      recognition.onend = () => {
        setOneShotListening(false);
        setOrbState(isPassiveListening ? 'listening' : 'idle');
      };
      recognition.onerror = () => {
        setOneShotListening(false);
        setOrbState(isPassiveListening ? 'listening' : 'idle');
      };
      recognitionRef.current = recognition;
    }
  }, [processCommand, isPassiveListening]);

  useEffect(() => {
    if (isPassiveListening) {
      const ok = voiceManager.startPassiveListening((transcript) => {
        processCommand(transcript);
      });
      if (!ok) {
        voiceManager.speak('Escucha pasiva no disponible en este dispositivo', 2);
        togglePassiveListening();
        return;
      }
      setOrbState('listening');
      deviceManager.vibrate([60, 30, 60]);
    } else {
      voiceManager.stopPassiveListening();
      if (!oneShotListening) setOrbState('idle');
    }
    return () => {
      voiceManager.stopPassiveListening();
    };
  }, [isPassiveListening, processCommand, togglePassiveListening, oneShotListening]);

  useEffect(() => {
    if (!voiceEnabled) {
      setOrbState('disabled');
      voiceManager.stopPassiveListening();
    } else if (orbState === 'disabled') {
      setOrbState(isPassiveListening ? 'listening' : 'idle');
    }
  }, [voiceEnabled, isPassiveListening]);

  useEffect(() => {
    const checkSpeaking = window.setInterval(() => {
      if (voiceManager.isSpeaking() && !oneShotListening && !isPassiveListening) {
        setOrbState('speaking');
      } else if (orbState === 'speaking' && !voiceManager.isSpeaking()) {
        setOrbState(isPassiveListening ? 'listening' : 'idle');
      }
    }, 200);
    return () => clearInterval(checkSpeaking);
  }, [oneShotListening, isPassiveListening, orbState]);

  const handleOrbActivate = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      deviceManager.vibrate([50, 30, 50]);
      toggleVoice();
      return;
    }
    lastTapRef.current = now;

    if (!voiceEnabled) {
      toggleVoice();
      return;
    }

    if (oneShotListening) {
      recognitionRef.current?.stop();
      setOneShotListening(false);
      setOrbState(isPassiveListening ? 'listening' : 'idle');
      deviceManager.vibrate(80);
      return;
    }

    if (isPassiveListening) {
      togglePassiveListening();
      deviceManager.vibrate(80);
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setOneShotListening(true);
        setOrbState('listening');
        deviceManager.vibrate(120);
      } catch {
        setOneShotListening(false);
      }
    } else {
      togglePassiveListening();
    }
  };

  const handleOrbKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleOrbActivate();
    }
  };

  const handleModeChange = (mode: 'vision' | 'sentinel') => {
    setUiMode(mode);
    setModule(mode === 'vision' ? 'vision' : 'guardian');
    deviceManager.vibrate(80);
  };

  const handleQuadrantAction = (action: string, quadrant: string) => {
    switch (action) {
      case 'TOGGLE_EYES_MODE':
      case 'DESCRIBE_NOW':
        sentraGuardianHub.requestDescription();
        break;
      case 'SENTINEL_STATUS': {
        const state = sentraGuardianHub.getState();
        voiceManager.speak(
          state.sentinelAlertActive
            ? 'Guardian en alerta. Perimetro comprometido.'
            : 'Perimetro seguro. Sin alertas.',
          2
        );
        break;
      }
      case 'PANIC_OR_PERIMETER':
        sentraGuardianHub.silenceAll();
        voiceManager.speak('Silenciado. Perimetro fijado.', 2);
        break;
    }
  };

  const moralBlocked = lastMoralEval && !lastMoralEval.allowed;
  const moralReason = lastMoralEval?.decisions.find((d) => !d.passed)?.reason;

  const ariaLabel = orbState === 'listening'
    ? 'Detener conversacion por voz bidireccional'
    : orbState === 'speaking'
      ? 'Sentra Core esta hablando'
      : orbState === 'disabled'
        ? 'Voz desactivada, doble toque para activar'
        : 'Iniciar conversacion por voz bidireccional';

  return (
    <div className="blind-ui" role="application" aria-label="Sentra Core interfaz para personas ciegas">
      <header className="blind-header" role="banner">
        <h1 className="blind-title" aria-label="Sentra Core">
          Sentra Core
        </h1>
        <div className="blind-header-chips" aria-live="polite">
          {humanVeto && (
            <span className="blind-chip blind-chip--veto" role="status" aria-label="Veto humano activo">
              Veto
            </span>
          )}
          <span className="blind-chip blind-chip--evolis" role="status" aria-label={`${evidenceCount} registros de evidencia EVOLIS`}>
            {evidenceCount} EVOLIS
          </span>
          <span
            className={`blind-chip ${isBacterialGuardianActive ? 'blind-chip--guardian-on' : 'blind-chip--guardian-off'}`}
            role="status"
            aria-label={isBacterialGuardianActive ? 'Guardian activo' : 'Guardian inactivo'}
          >
            Guardian {isBacterialGuardianActive ? 'ON' : 'OFF'}
          </span>
        </div>
      </header>

      <BlindModeSelector mode={uiMode} onChange={handleModeChange} />

      <main className="blind-content" aria-live="polite">
        {uiMode === 'vision' ? (
          <BlindVisionPanel
            processCommand={processCommand}
            lastResponse={lastResponse}
            voiceEnabled={voiceEnabled}
            cameraActive={cameraActive}
            onCameraToggle={toggleCamera}
          />
        ) : (
          <BlindSentinelPanel
            guardianStatus={guardianStatus}
            isBacterialGuardianActive={isBacterialGuardianActive}
            activateGuardian={activateGuardian}
            deactivateGuardian={deactivateGuardian}
            evidenceCount={evidenceCount}
            getEvidence={getEvidence}
            exportData={exportData}
            humanVeto={humanVeto}
            toggleHumanVeto={toggleHumanVeto}
          />
        )}
      </main>

      <div className="blind-response-banner" aria-live={moralBlocked ? 'assertive' : 'polite'} role="status">
        {moralBlocked && (
          <div className="blind-moral-alert" role="alert">
            <strong>Filtro etico: accion bloqueada</strong>
            <p>{moralReason}</p>
          </div>
        )}
        {!moralBlocked && lastResponse && (
          <div className="blind-response-content">
            <span className="blind-response-source">
              {lastResponse.source === 'gemini' ? 'Gemini' : 'Local'}
            </span>
            <p>{lastResponse.text}</p>
          </div>
        )}
      </div>

      <nav className="blind-voice-bar" role="navigation" aria-label="Control principal de voz">
        <button
          className="blind-drawer-trigger"
          onClick={() => {
            deviceManager.vibrate(60);
            voiceManager.speak(
              `Modo ${uiMode === 'vision' ? 'vision' : 'sentinel'}. ${evidenceCount} registros EVOLIS. ` +
              `${humanVeto ? 'Veto activo. ' : ''}${isBacterialGuardianActive ? 'Guardian activo. ' : 'Guardian inactivo. '}`,
              2
            );
          }}
          aria-label="Anunciar estado del sistema"
        >
          <span aria-hidden="true">{'\u{1F4CA}'}</span>
          <span className="blind-trigger-label">Estado</span>
        </button>

        <div className="blind-orb-container">
          <button
            className={`blind-voice-orb blind-voice-orb--${orbState}`}
            onClick={handleOrbActivate}
            onKeyDown={handleOrbKeyDown}
            aria-label={ariaLabel}
            aria-pressed={orbState === 'listening'}
            role="button"
          >
            <span className="blind-orb-ring" aria-hidden="true" />
            <span className="blind-orb-ring blind-orb-ring--2" aria-hidden="true" />
            <span className="blind-orb-ring blind-orb-ring--3" aria-hidden="true" />
            <span className="blind-orb-core" aria-hidden="true">
              {orbState === 'listening' && '\u{1F3A4}'}
              {orbState === 'speaking' && '\u{1F50A}'}
              {orbState === 'idle' && '\u{1F5E3}'}
              {orbState === 'disabled' && '\u{1F507}'}
            </span>
          </button>
          <span className="blind-orb-label" aria-live="polite">
            {orbState === 'listening' && 'Escuchando...'}
            {orbState === 'speaking' && 'Hablando...'}
            {orbState === 'idle' && 'Toca para hablar'}
            {orbState === 'disabled' && 'Voz apagada'}
          </span>
        </div>

        <button
          className="blind-veto-trigger"
          onClick={() => {
            toggleHumanVeto();
            deviceManager.vibrate(80);
          }}
          aria-label={humanVeto ? 'Desactivar veto humano' : 'Activar veto humano'}
          aria-pressed={humanVeto}
        >
          <span aria-hidden="true">{humanVeto ? '\u{1F6AB}' : '\u{2705}'}</span>
          <span className="blind-trigger-label">{humanVeto ? 'Veto ON' : 'Veto OFF'}</span>
        </button>
      </nav>

      {/* Cuadrantes táctiles ciegos: capa invisible sobre toda la pantalla */}
      <BlindTactileQuadrants onAction={handleQuadrantAction} />
    </div>
  );
}
