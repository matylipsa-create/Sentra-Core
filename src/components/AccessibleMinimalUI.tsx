import { useEffect, useRef, useState } from 'react';
import { useApp, ModuleName } from '../context/AppContext';
import { voiceManager } from '../services/VoiceManager';
import { deviceManager } from '../core/DeviceManager';

const MODULES: { id: ModuleName; label: string; icon: string }[] = [
  { id: 'vision', label: 'Vision', icon: '\u{1F441}' },
  { id: 'seguridad', label: 'Seguridad', icon: '\u{1F6E1}' },
  { id: 'movimiento', label: 'Movimiento', icon: '\u{1F9ED}' },
  { id: 'aprendizaje', label: 'Aprendizaje', icon: '\u{1F4DA}' },
  { id: 'evidencia', label: 'Evidencia', icon: '\u{1F4CB}' },
  { id: 'silencio', label: 'Silencio', icon: '\u{1F507}' },
];

export function AccessibleMinimalUI() {
  const {
    activeModule, voiceEnabled, humanVeto,
    lastResponse, lastMoralEval, evidenceCount,
    processCommand, toggleVoice, toggleHumanVeto, setModule,
  } = useApp();

  const [listening, setListening] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [lastTapTime, setLastTapTime] = useState(0);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

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
      recognition.onend = () => setListening(false);
      recognition.onerror = () => setListening(false);
      recognitionRef.current = recognition;
    }
  }, [processCommand]);

  const handleVoiceButton = () => {
    const now = Date.now();
    if (now - lastTapTime < 400) {
      deviceManager.vibrate([50, 30, 50]);
      toggleVoice();
      return;
    }
    setLastTapTime(now);
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    if (recognitionRef.current && voiceEnabled) {
      try {
        recognitionRef.current.start();
        setListening(true);
        deviceManager.vibrate(100);
      } catch {
        setListening(false);
      }
    } else if (!recognitionRef.current) {
      voiceManager.speak('Reconocimiento de voz no disponible. Usa el campo de texto.', 3);
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim()) {
      processCommand(textInput.trim());
      setTextInput('');
    }
  };

  return (
    <div className="minimal-ui">
      <div className="module-selector" role="tablist" aria-label="Seleccion de modulo">
        {MODULES.map((mod) => (
          <button
            key={mod.id}
            role="tab"
            aria-selected={activeModule === mod.id}
            className={`module-btn ${activeModule === mod.id ? 'active' : ''}`}
            onClick={() => setModule(mod.id)}
            aria-label={`Activar modulo ${mod.label}`}
          >
            <span className="module-icon" aria-hidden="true">{mod.icon}</span>
            <span className="module-label">{mod.label}</span>
          </button>
        ))}
      </div>

      <div className="main-action">
        <button
          className={`voice-btn ${listening ? 'listening' : ''} ${!voiceEnabled ? 'muted' : ''}`}
          onClick={handleVoiceButton}
          aria-label={listening ? 'Detener escucha' : 'Activar comando de voz'}
          aria-pressed={listening}
        >
          <span className="voice-btn-icon" aria-hidden="true">
            {listening ? '\u{23F9}' : '\u{1F3A4}'}
          </span>
          <span className="voice-btn-label">
            {listening ? 'Escuchando' : voiceEnabled ? 'Hablar' : 'Voz apagada'}
          </span>
        </button>

        <form className="text-input-form" onSubmit={handleTextSubmit}>
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Escribe un comando..."
            aria-label="Campo de comando de texto"
          />
          <button type="submit" aria-label="Enviar comando">Enviar</button>
        </form>
      </div>

      <div className="control-toggles">
        <button
          className={`toggle-btn ${voiceEnabled ? 'on' : 'off'}`}
          onClick={toggleVoice}
          aria-pressed={voiceEnabled}
          aria-label="Activar o desactivar voz"
        >
          {voiceEnabled ? '\u{1F50A} Voz ON' : '\u{1F507} Voz OFF'}
        </button>
        <button
          className={`toggle-btn ${humanVeto ? 'on veto' : 'off'}`}
          onClick={toggleHumanVeto}
          aria-pressed={humanVeto}
          aria-label="Activar o desactivar veto humano"
        >
          {humanVeto ? '\u{1F6D1} Veto ON' : '\u{2705} Veto OFF'}
        </button>
      </div>

      {(lastResponse || lastMoralEval) && (
        <div className="response-area" role="status" aria-live="polite">
          {lastMoralEval && !lastMoralEval.allowed && (
            <div className="moral-block">
              <strong>Accion bloqueada por filtro etico</strong>
              <p>{lastMoralEval.decisions.find((d) => !d.passed)?.reason}</p>
            </div>
          )}
          {lastResponse && lastMoralEval?.allowed && (
            <div className="response-text">
              <span className="response-source">
                {lastResponse.source === 'gemini' ? 'Gemini' : 'Local'}
              </span>
              <p>{lastResponse.text}</p>
            </div>
          )}
        </div>
      )}

      <div className="evidence-counter" aria-label="Contador de evidencia">
        <span aria-hidden="true">{'\u{1F4CB}'}</span> {evidenceCount} registros EVOLIS
      </div>
    </div>
  );
}
