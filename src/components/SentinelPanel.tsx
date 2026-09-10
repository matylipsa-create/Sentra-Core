import { useState, useEffect } from 'react';
import { GuardianStatus } from '../core/BacterialGuardian';
import { tritToValue, Trit } from '../core/TernaryMath';
import { deviceManager } from '../core/DeviceManager';
import { voiceManager } from '../services/VoiceManager';
import { evolis, EVOLISEvidence } from '../core/EVOLIS';

interface SentinelPanelProps {
  guardianStatus: GuardianStatus | null;
  isBacterialGuardianActive: boolean;
  activateGuardian: () => void;
  deactivateGuardian: () => void;
  evidenceCount: number;
  getEvidence: () => EVOLISEvidence[];
  exportData: () => Promise<void>;
  humanVeto: boolean;
  toggleHumanVeto: () => void;
}

const STATE_LABELS: Record<string, string> = {
  dormant: 'Dormido',
  active: 'Activo',
  alert: 'Alerta',
  quarantine: 'Cuarentena',
};

const STATE_ICONS: Record<string, string> = {
  dormant: '\u{1F634}',
  active: '\u{1F9EA}',
  alert: '\u{26A0}',
  quarantine: '\u{1F6AB}',
};

function tritSymbol(t: Trit): string {
  if (t > 0) return '+1';
  if (t < 0) return '-1';
  return '0';
}

export function SentinelPanel({
  guardianStatus, isBacterialGuardianActive,
  activateGuardian, deactivateGuardian,
  evidenceCount, getEvidence, exportData,
  humanVeto, toggleHumanVeto,
}: SentinelPanelProps) {
  const [showEvidence, setShowEvidence] = useState(false);
  const [evidence, setEvidence] = useState<EVOLISEvidence[]>([]);
  const [chainValid, setChainValid] = useState<boolean | null>(null);

  useEffect(() => {
    if (guardianStatus?.state === 'alert') {
      deviceManager.vibrate([100, 50, 100]);
      voiceManager.speak('Alerta de seguridad detectada', 1);
    }
    if (guardianStatus?.state === 'quarantine') {
      deviceManager.vibrate([200, 100, 200, 100, 200]);
      voiceManager.speak('Sistema en cuarentena. Alteracion critica detectada.', 1);
    }
  }, [guardianStatus?.state]);

  const handleLoadEvidence = () => {
    setEvidence(getEvidence());
    setShowEvidence(true);
    deviceManager.vibrate(60);
  };

  const handleVerifyChain = async () => {
    const valid = await evolis.verify();
    setChainValid(valid);
    deviceManager.vibrate(80);
    voiceManager.speak(valid ? 'Cadena EVOLIS verificada: OK' : 'Cadena corrupta', 2);
  };

  const handleExport = async () => {
    await exportData();
    deviceManager.vibrate(80);
    voiceManager.speak('Exportacion iniciada', 2);
  };

  const state = guardianStatus?.state ?? 'dormant';
  const alerts = guardianStatus?.alerts ?? [];

  return (
    <div className="sentinel-panel" role="region" aria-label="Seguridad soberana Sentinel">
      <h2 className="sentinel-panel-title">Sentinel</h2>

      <div className={`sentinel-state-banner sentinel-state--${state}`}>
        <span className="sentinel-state-icon" aria-hidden="true">
          {STATE_ICONS[state] ?? '\u{1F6E1}'}
        </span>
        <div className="sentinel-state-info">
          <strong>{STATE_LABELS[state] ?? 'Desconocido'}</strong>
          <span className="sentinel-state-detail">
            {state === 'dormant' && 'Guardian inactivo. Activalo para monitoreo.'}
            {state === 'active' && 'Monitoreando USB y cadena EVOLIS. Todo en orden.'}
            {state === 'alert' && 'Amenaza detectada. Revisa las alertas.'}
            {state === 'quarantine' && 'Alteracion critica. Sistema en cuarentena.'}
          </span>
        </div>
      </div>

      <div className="sentinel-controls">
        {!isBacterialGuardianActive && (
          <button
            className="action-btn sentinel-activate-btn"
            onClick={() => { activateGuardian(); deviceManager.vibrate(80); }}
            aria-label="Activar guardian"
          >
            Activar Guardian
          </button>
        )}
        {isBacterialGuardianActive && state !== 'quarantine' && (
          <button
            className="action-btn sentinel-deactivate-btn"
            onClick={() => { deactivateGuardian(); deviceManager.vibrate(80); }}
            aria-label="Desactivar guardian"
          >
            Desactivar Guardian
          </button>
        )}
        <button
          className="action-btn"
          onClick={handleVerifyChain}
          aria-label="Verificar cadena EVOLIS"
        >
          Verificar cadena
        </button>
        <button
          className={`action-btn ${humanVeto ? 'sentinel-veto-active' : ''}`}
          onClick={() => { toggleHumanVeto(); deviceManager.vibrate(80); }}
          aria-label={humanVeto ? 'Desactivar veto humano' : 'Activar veto humano'}
          aria-pressed={humanVeto}
        >
          {humanVeto ? 'Veto ON' : 'Veto OFF'}
        </button>
      </div>

      {chainValid !== null && (
        <div
          className={`sentinel-chain-result ${chainValid ? 'ok' : 'fail'}`}
          role="status"
          aria-live="polite"
        >
          {chainValid ? 'Cadena verificada: integridad OK' : 'Cadena corrupta o firma invalida'}
        </div>
      )}

      <div className="sentinel-trust-grid">
        <div className="sentinel-trust-card">
          <span className="sentinel-trust-label">Confianza USB</span>
          <span className={`sentinel-trust-value sentinel-trust--${tritToValue(guardianStatus?.usbTrust ?? 0)}`}>
            {tritSymbol(guardianStatus?.usbTrust ?? 0)}
          </span>
        </div>
        <div className="sentinel-trust-card">
          <span className="sentinel-trust-label">Cadena EVOLIS</span>
          <span className={`sentinel-trust-value sentinel-trust--${tritToValue(guardianStatus?.chainTrust ?? 1)}`}>
            {tritSymbol(guardianStatus?.chainTrust ?? 1)}
          </span>
        </div>
        {guardianStatus?.overallTrust && (
          <div className="sentinel-trust-card sentinel-trust-card--overall">
            <span className="sentinel-trust-label">Confianza Global</span>
            <span className={`sentinel-trust-value sentinel-trust--${guardianStatus.overallTrust.label}`}>
              {tritSymbol(guardianStatus.overallTrust.value)}
            </span>
            <span className="sentinel-trust-detail">
              {Math.round(guardianStatus.overallTrust.confidence * 100)}%
            </span>
          </div>
        )}
      </div>

      {alerts.length > 0 && (
        <div className="sentinel-alerts">
          <div className="sentinel-alerts-header">
            <h3>Alertas ({alerts.length})</h3>
          </div>
          {alerts.map((alert) => (
            <div key={alert.id} className={`sentinel-alert sentinel-alert--${alert.severity}`}>
              <div className="sentinel-alert-content">
                <strong>{alert.message}</strong>
                <span className="sentinel-alert-time">
                  {new Date(alert.timestamp).toLocaleString('es-ES')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="sentinel-evidence-section">
        <div className="sentinel-evidence-header">
          <h3>EVOLIS — {evidenceCount} registros</h3>
          <button
            className="action-btn"
            onClick={handleLoadEvidence}
            aria-label="Ver cadena de evidencia"
          >
            Ver cadena
          </button>
          <button
            className="action-btn"
            onClick={handleExport}
            aria-label="Exportar evidencia"
          >
            Exportar
          </button>
        </div>
        {showEvidence && (
          <div className="sentinel-evidence-list">
            {evidence.length === 0 ? (
              <p className="empty-state">No hay evidencia registrada.</p>
            ) : (
              evidence.slice(-20).reverse().map((e) => (
                <div key={e.id} className="sentinel-evidence-entry">
                  <span className="sentinel-evidence-index">#{e.entry.index}</span>
                  <span className="sentinel-evidence-module">{e.module}</span>
                  <span className="sentinel-evidence-hash">
                    {e.entry.hash.substring(0, 16)}...
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="sentinel-monitoring">
        <div className="sentinel-monitor-row">
          <span>Monitoreo USB</span>
          <span className={guardianStatus?.monitoringUsb ? 'sentinel-mon-on' : 'sentinel-mon-off'}>
            {guardianStatus?.monitoringUsb ? 'ON' : 'OFF'}
          </span>
        </div>
        <div className="sentinel-monitor-row">
          <span>Monitoreo cadena</span>
          <span className={guardianStatus?.monitoringChain ? 'sentinel-mon-on' : 'sentinel-mon-off'}>
            {guardianStatus?.monitoringChain ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>
    </div>
  );
}
