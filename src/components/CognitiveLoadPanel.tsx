import { useEffect, useState } from 'react';
import { cognitiveLoadManager, CognitiveMode, CognitiveLoadState } from '../core/CognitiveLoadManager';
import { bioSoftware } from '../core/BioSoftwareInterface';
import { deviceManager } from '../core/DeviceManager';
import { voiceManager } from '../services/VoiceManager';

const MODE_LABELS: Record<CognitiveMode, string> = {
  STABILIZE: 'Estabilizar',
  OBSERVE: 'Observar',
  ASSIST: 'Asistir',
};

const MODE_DESCRIPTIONS: Record<CognitiveMode, string> = {
  STABILIZE: 'Carga alta. Instrucciones minimizadas para evitar saturacion.',
  OBSERVE: 'Carga media. Monitoreando sin saturar.',
  ASSIST: 'Carga baja. Asistencia completa activa.',
};

function loadColor(load: number): string {
  if (load >= 0.75) return 'var(--error)';
  if (load >= 0.5) return 'var(--warning)';
  return 'var(--accent)';
}

function loadLabel(load: number): string {
  if (load >= 0.75) return 'Alta';
  if (load >= 0.5) return 'Media';
  return 'Baja';
}

export function CognitiveLoadPanel() {
  const [state, setState] = useState<CognitiveLoadState | null>(null);

  useEffect(() => {
    cognitiveLoadManager.init();
    const unsub = cognitiveLoadManager.subscribe(setState);
    const interval = window.setInterval(() => {
      cognitiveLoadManager.updateLoadFromBio();
    }, 3000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  if (!state) {
    return (
      <div className="module-content cognitive-load-panel">
        <h2>Reduccion de Fatiga Cognitiva</h2>
        <p className="loading-text">Inicializando monitor de carga cognitiva...</p>
      </div>
    );
  }

  const load = state.load;
  const color = loadColor(load);

  const handleModeChange = (mode: CognitiveMode) => {
    cognitiveLoadManager.setMode(mode);
    deviceManager.vibrate(80);
    voiceManager.speak(`Modo ${MODE_LABELS[mode]} activado`, 3);
  };

  const handleReset = () => {
    cognitiveLoadManager.resetLoad();
    deviceManager.vibrate(60);
    voiceManager.speak('Carga cognitiva reiniciada', 3);
  };

  return (
    <div className="module-content cognitive-load-panel" role="region" aria-label="Control de carga cognitiva">
      <h2>Reduccion de Fatiga Cognitiva</h2>
      <p>Monitorea el nivel de carga mental y adapta la interfaz para evitar saturacion auditiva.</p>

      <div className="cognitive-load-banner" style={{ borderColor: color }} role="status" aria-live="polite">
        <span className="cognitive-load-icon" aria-hidden="true">{'\u{1F9E0}'}</span>
        <div className="cognitive-load-info">
          <strong>Carga {loadLabel(load)}: {Math.round(load * 100)}%</strong>
          <span className="cognitive-load-detail">{MODE_DESCRIPTIONS[state.mode]}</span>
        </div>
      </div>

      <div className="cognitive-load-bar-container">
        <div className="cognitive-load-bar">
          <div
            className="cognitive-load-bar-fill"
            style={{ width: `${load * 100}%`, backgroundColor: color }}
            role="progressbar"
            aria-valuenow={Math.round(load * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Nivel de carga cognitiva"
          />
        </div>
        <span className="cognitive-load-bar-label">{Math.round(load * 100)}%</span>
      </div>

      <div className="cognitive-mode-selector" role="radiogroup" aria-label="Modo de adaptacion cognitiva">
        {(Object.keys(MODE_LABELS) as CognitiveMode[]).map((mode) => {
          const active = state.mode === mode;
          return (
            <button
              key={mode}
              role="radio"
              aria-checked={active}
              aria-label={`Modo ${MODE_LABELS[mode]}. ${MODE_DESCRIPTIONS[mode]}`}
              className={`cognitive-mode-btn ${active ? 'cognitive-mode-btn--active' : ''}`}
              onClick={() => handleModeChange(mode)}
            >
              <strong>{MODE_LABELS[mode]}</strong>
              <span>{MODE_DESCRIPTIONS[mode]}</span>
            </button>
          );
        })}
      </div>

      <div className="cognitive-stats-grid">
        <div className="cognitive-stat-card">
          <span className="cognitive-stat-label">Estres (Bio)</span>
          <span className="cognitive-stat-value">{Math.round(bioSoftware.getState().stressLevel * 100)}%</span>
        </div>
        <div className="cognitive-stat-card">
          <span className="cognitive-stat-label">Enfoque (Bio)</span>
          <span className="cognitive-stat-value">{Math.round(bioSoftware.getState().focusLevel * 100)}%</span>
        </div>
        <div className="cognitive-stat-card">
          <span className="cognitive-stat-label">Instrucciones en cola</span>
          <span className="cognitive-stat-value">{state.voiceInstructionsQueue}</span>
        </div>
        <div className="cognitive-stat-card">
          <span className="cognitive-stat-label">Estabilizado</span>
          <span className="cognitive-stat-value">{state.stabilized ? 'Si' : 'No'}</span>
        </div>
      </div>

      <button
        className="action-btn cognitive-reset-btn"
        onClick={handleReset}
        aria-label="Reiniciar carga cognitiva"
      >
        Reiniciar carga
      </button>
    </div>
  );
}
