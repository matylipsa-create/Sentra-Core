import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { VoiceOrbButton } from './VoiceOrbButton';
import { ModeSelector } from './ModeSelector';
import { VisionPanel } from './VisionPanel';
import { SentinelPanel } from './SentinelPanel';
import { CognitiveLoadPanel } from './CognitiveLoadPanel';
import { FieldLogPanel } from './FieldLogPanel';
import { deviceManager } from '../core/DeviceManager';
import { bioSoftware } from '../core/BioSoftwareInterface';

export function UnifiedUI() {
  const {
    activeModule, lastResponse, lastMoralEval, evidenceCount,
    humanVeto, bioEnabled, bioActiveProtocol,
    uiMode, setUiMode, setModule,
  processCommand, setLastPerception,
    guardianStatus, isBacterialGuardianActive,
    activateGuardian, deactivateGuardian,
    getEvidence, exportData, toggleHumanVeto,
    voiceEnabled,
  } = useApp();

  const [drawerOpen, setDrawerOpen] = useState(false);

  const moralBlocked = lastMoralEval && !lastMoralEval.allowed;
  const moralReason = lastMoralEval?.decisions.find((d) => !d.passed)?.reason;

  const handleModeChange = (mode: 'vision' | 'sentinel') => {
    setUiMode(mode);
    setModule(mode === 'vision' ? 'vision' : 'guardian');
    deviceManager.vibrate(80);
  };

  return (
    <div className="unified-ui">
      <header className="unified-header" role="banner">
        <div className="unified-header-left">
          <ModeSelector mode={uiMode} onChange={handleModeChange} />
        </div>
        <div className="unified-header-right" aria-live="polite">
          {humanVeto && (
            <span className="status-chip status-chip--veto" title="Veto humano activo">Veto</span>
          )}
          {bioEnabled && (
            <span className="status-chip status-chip--bio" title="BioSoftware activo">
              Bio {bioActiveProtocol ? Math.round(bioSoftware.getState().cardiacCoherence * 100) + '%' : 'ON'}
            </span>
          )}
          <span className="status-chip status-chip--evolis" title="Registros EVOLIS">{evidenceCount}</span>
        </div>
      </header>

      <main className="unified-content" aria-live="polite">
        {activeModule === 'cognitivo' ? (
          <CognitiveLoadPanel />
        ) : activeModule === 'bitacora' ? (
          <FieldLogPanel />
        ) : uiMode === 'vision' ? (
          <VisionPanel
            processCommand={processCommand}
            lastResponse={lastResponse}
            setLastPerception={setLastPerception}
            voiceEnabled={voiceEnabled}
          />
        ) : (
          <SentinelPanel
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
    </div>
  );
}
