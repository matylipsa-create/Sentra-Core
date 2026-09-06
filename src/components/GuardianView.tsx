import { useEffect, useState } from 'react';
import { useBacterialGuardian } from '../hooks/useBacterialGuardian';
import { useToast } from '../context/ToastContext';
import { usbService } from '../services/USBService';
import { bacterialGuardian, GuardianState } from '../core/BacterialGuardian';
import { tritToValue, Trit } from '../core/TernaryMath';

const STATE_LABELS: Record<GuardianState, string> = {
  dormant: 'Dormido',
  active: 'Activo',
  alert: 'Alerta',
  quarantine: 'Cuarentena',
};

const STATE_ICONS: Record<GuardianState, string> = {
  dormant: '\u{1F634}',
  active: '\u{1F9EA}',
  alert: '\u{26A0}',
  quarantine: '\u{1F6AB}',
};

function tritLabel(t: Trit): string {
  const v = tritToValue(t);
  if (v === 'positive') return '+1 Confiable';
  if (v === 'negative') return '-1 Amenaza';
  return '0 Neutral';
}

function tritSymbol(t: Trit): string {
  if (t > 0) return '+1';
  if (t < 0) return '-1';
  return '0';
}

export function GuardianView() {
  const { status, activate, deactivate, resolveAlert, clearAlerts, dismissQuarantine, checkChain } = useBacterialGuardian();
  const { showToast } = useToast();
  const [usbSupported] = useState(() => usbService.isSupported());
  const [devices, setDevices] = useState(usbService.getDevices());

  useEffect(() => {
    const unsub = usbService.subscribe((d) => setDevices([...d]));
    return unsub;
  }, []);

  useEffect(() => {
    if (!status) return;
    if (status.state === 'quarantine') {
      showToast('Guardian en cuarentena: alteracion detectada en EVOLIS', 'error', 8000);
    }
  }, [status?.state, showToast]);

  if (!status) {
    return (
      <div className="module-content guardian-view">
        <h2>Guardian Bacteriano</h2>
        <p className="loading-text">Inicializando guardian...</p>
      </div>
    );
  }

  const state = status.state;
  const trust = status.overallTrust;

  return (
    <div className="module-content guardian-view">
      <h2>Guardian Bacteriano</h2>
      <p>Defensa activa: monitorea puertos USB y la cadena de evidencia EVOLIS con logica ternaria (+1, 0, -1).</p>

      <div className={`guardian-state-banner guardian-state--${state}`}>
        <span className="guardian-state-icon" aria-hidden="true">{STATE_ICONS[state]}</span>
        <div className="guardian-state-info">
          <strong>{STATE_LABELS[state]}</strong>
          <span className="guardian-state-detail">
            {state === 'dormant' && 'Guardian inactivo. Activalo para comenzar el monitoreo.'}
            {state === 'active' && 'Monitoreando USB y cadena EVOLIS. Todo en orden.'}
            {state === 'alert' && 'Amenaza detectada. Revisa las alertas.'}
            {state === 'quarantine' && 'Alteracion critica. Sistema en cuarentena.'}
          </span>
        </div>
      </div>

      <div className="guardian-controls">
        {state === 'dormant' && (
          <button className="action-btn guardian-activate-btn" onClick={activate}>
            Activar Guardian
          </button>
        )}
        {state !== 'dormant' && state !== 'quarantine' && (
          <button className="action-btn guardian-deactivate-btn" onClick={deactivate}>
            Desactivar Guardian
          </button>
        )}
        {state === 'quarantine' && (
          <button className="action-btn guardian-dismiss-btn" onClick={dismissQuarantine}>
            Salir de cuarentena
          </button>
        )}
        <button
          className="action-btn"
          onClick={async () => {
            const valid = await checkChain();
            showToast(valid ? 'Cadena EVOLIS verificada: OK' : 'Cadena corrupta', valid ? 'success' : 'error');
          }}
        >
          Verificar cadena ahora
        </button>
      </div>

      <div className="guardian-trust-grid">
        <div className="guardian-trust-card">
          <span className="guardian-trust-label">Confianza USB</span>
          <span className={`guardian-trust-value guardian-trust--${tritToValue(status.usbTrust)}`}>
            {tritSymbol(status.usbTrust)}
          </span>
          <span className="guardian-trust-detail">{tritLabel(status.usbTrust)}</span>
        </div>
        <div className="guardian-trust-card">
          <span className="guardian-trust-label">Cadena EVOLIS</span>
          <span className={`guardian-trust-value guardian-trust--${tritToValue(status.chainTrust)}`}>
            {tritSymbol(status.chainTrust)}
          </span>
          <span className="guardian-trust-detail">{tritLabel(status.chainTrust)}</span>
        </div>
        {trust && (
          <div className="guardian-trust-card guardian-trust-card--overall">
            <span className="guardian-trust-label">Confianza Global</span>
            <span className={`guardian-trust-value guardian-trust--${trust.label}`}>
              {tritSymbol(trust.value)}
            </span>
            <span className="guardian-trust-detail">
              {Math.round(trust.confidence * 100)}% confianza
            </span>
          </div>
        )}
      </div>

      {trust && trust.breakdown.length > 0 && (
        <div className="guardian-breakdown">
          <h3>Desglose ternario</h3>
          {trust.breakdown.map((b) => (
            <div key={b.factor} className="guardian-breakdown-row">
              <span className="guardian-breakdown-factor">{b.factor}</span>
              <span className={`guardian-breakdown-trit guardian-trust--${tritToValue(b.trit)}`}>
                {tritSymbol(b.trit)}
              </span>
              <span className="guardian-breakdown-weight">peso {b.weight}</span>
            </div>
          ))}
        </div>
      )}

      {status.alerts.length > 0 && (
        <div className="guardian-alerts">
          <div className="guardian-alerts-header">
            <h3>Alertas ({status.alerts.length})</h3>
            <button className="action-btn guardian-clear-btn" onClick={clearAlerts}>
              Limpiar
            </button>
          </div>
          {status.alerts.map((alert) => (
            <div key={alert.id} className={`guardian-alert guardian-alert--${alert.severity}`}>
              <div className="guardian-alert-content">
                <strong>{alert.message}</strong>
                <span className="guardian-alert-time">
                  {new Date(alert.timestamp).toLocaleString('es-ES')}
                </span>
              </div>
              <button
                className="action-btn guardian-alert-resolve"
                onClick={() => resolveAlert(alert.id)}
                aria-label="Resolver alerta"
              >
                {'\u{2713}'}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="guardian-usb-section">
        <h3>Dispositivos USB</h3>
        {!usbSupported && (
          <p className="empty-state">WebUSB no soportado en este dispositivo.</p>
        )}
        {usbSupported && devices.length === 0 && (
          <p className="empty-state">No hay dispositivos USB conectados.</p>
        )}
        {devices.length > 0 && (
          <div className="guardian-usb-list">
            {devices.map((dev, i) => {
              const key = `${dev.vendorId}:${dev.productId}:${dev.serialNumber ?? 'unknown'}`;
              const blocked = usbService.isBlocked(key);
              return (
                <div key={i} className={`guardian-usb-device ${blocked ? 'guardian-usb-blocked' : ''} ${dev.authenticated ? 'guardian-usb-auth' : ''}`}>
                  <div className="guardian-usb-info">
                    <strong>VID {dev.vendorId.toString(16)} / PID {dev.productId.toString(16)}</strong>
                    <span className="guardian-usb-name">{dev.productName ?? 'Sin nombre'}</span>
                    <span className="guardian-usb-status">
                      {blocked ? 'Bloqueado' : dev.authenticated ? 'Autenticado' : dev.connected ? 'No autenticado' : 'Desconectado'}
                    </span>
                  </div>
                  <div className="guardian-usb-actions">
                    {!blocked && !dev.authenticated && dev.connected && (
                      <button className="action-btn" onClick={() => {
                        const ok = usbService.authenticateDevice(key);
                        showToast(ok ? 'Dispositivo autenticado' : 'Autenticacion rechazada', ok ? 'success' : 'error');
                      }}>
                        Autenticar
                      </button>
                    )}
                    {!blocked && (
                      <button className="action-btn guardian-block-btn" onClick={() => {
                        usbService.blockDevice(key, 'Bloqueo manual');
                        showToast('Dispositivo bloqueado', 'warning');
                      }}>
                        Bloquear
                      </button>
                    )}
                    {blocked && (
                      <button className="action-btn" onClick={() => {
                        usbService.unblockDevice(key);
                        showToast('Dispositivo desbloqueado', 'info');
                      }}>
                        Desbloquear
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {usbSupported && (
          <button
            className="action-btn guardian-scan-btn"
            onClick={async () => {
              const dev = await usbService.requestDevice();
              if (dev) showToast('Dispositivo USB detectado', 'info');
              else showToast('No se selecciono dispositivo', 'warning');
            }}
          >
            Escanear puertos USB
          </button>
        )}
      </div>

      <div className="guardian-monitoring-status">
        <div className="guardian-monitor-row">
          <span>Monitoreo USB</span>
          <span className={status.monitoringUsb ? 'guardian-mon-on' : 'guardian-mon-off'}>
            {status.monitoringUsb ? 'ON' : 'OFF'}
          </span>
        </div>
        <div className="guardian-monitor-row">
          <span>Monitoreo cadena</span>
          <span className={status.monitoringChain ? 'guardian-mon-on' : 'guardian-mon-off'}>
            {status.monitoringChain ? 'ON' : 'OFF'}
          </span>
        </div>
        {status.lastChainCheck !== null && (
          <div className="guardian-monitor-row">
            <span>Ultima verificacion</span>
            <span className="guardian-mon-time">
              {new Date(status.lastChainCheck).toLocaleTimeString('es-ES')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
