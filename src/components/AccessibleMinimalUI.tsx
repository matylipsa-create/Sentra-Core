import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { VoiceOrbButton } from './VoiceOrbButton';
import { TactileModuleDrawer } from './TactileModuleDrawer';
import { deviceManager } from '../core/DeviceManager';
import { bioSoftware } from '../core/BioSoftwareInterface';

export function AccessibleMinimalUI() {
  const {
    activeModule, lastResponse, lastMoralEval, evidenceCount,
    humanVeto, bioEnabled, bioActiveProtocol,
  } = useApp();

  const [drawerOpen, setDrawerOpen] = useState(false);

  const moralBlocked = lastMoralEval && !lastMoralEval.allowed;
  const moralReason = lastMoralEval?.decisions.find((d) => !d.passed)?.reason;

  return (
    <>
      <TactileModuleDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      <div className="response-banner" aria-live={moralBlocked ? 'assertive' : 'polite'} role="status">
        {moralBlocked && (
          <div className="moral-alert" role="alert">
            <strong>Filtro etico: accion bloqueada</strong>
            <p>{moralReason}</p>
          </div>
        )}
        {!moralBlocked && lastResponse && (
          <div className="response-content">
            <span className="response-source-tag">{lastResponse.source === 'gemini' ? 'Gemini' : 'Local'}</span>
            <p>{lastResponse.text}</p>
          </div>
        )}
      </div>

      <nav className="voice-bar" role="navigation" aria-label="Control principal">
        <button
          className="bar-drawer-trigger"
          onClick={() => {
            setDrawerOpen(true);
            deviceManager.vibrate(60);
          }}
          aria-label="Abrir menu de modulos"
          aria-expanded={drawerOpen}
          aria-controls="module-navigation"
          aria-haspopup="dialog"
        >
          <span className="bar-trigger-icon" aria-hidden="true">{'\u{1F4CA}'}</span>
          <span className="bar-trigger-label">{activeModule}</span>
        </button>

        <VoiceOrbButton />

        <div className="bar-status" aria-live="polite">
          {humanVeto && <span className="status-chip status-chip--veto" title="Veto humano activo">Veto</span>}
          {bioEnabled && (
            <span className="status-chip status-chip--bio" title="BioSoftware activo">
              Bio {bioActiveProtocol ? Math.round(bioSoftware.getState().cardiacCoherence * 100) + '%' : 'ON'}
            </span>
          )}
          <span className="status-chip status-chip--evolis" title="Registros EVOLIS">{evidenceCount}</span>
        </div>
      </nav>
    </>
  );
}
