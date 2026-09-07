import { useEffect, useState } from 'react';
import { usbService, USBDeviceInfo, PortStatus } from '../services/USBService';
import { bacterialGuardian } from '../core/BacterialGuardian';
import { useToast } from '../context/ToastContext';
import { evolis } from '../core/EVOLIS';

const STATUS_LABELS: Record<PortStatus, string> = {
  blocked: 'Bloqueado',
  allowed: 'Permitido',
  infected: 'Infectado',
};

const STATUS_ICONS: Record<PortStatus, string> = {
  blocked: '\u{1F6AB}',
  allowed: '\u{2705}',
  infected: '\u{1F9A0}',
};

export function USBStoragePanel() {
  const { showToast } = useToast();
  const [devices, setDevices] = useState<USBDeviceInfo[]>(usbService.getDevices());
  const [vetoOpen, setVetoOpen] = useState<string | null>(null);
  const [vetoConfirm, setVetoConfirm] = useState(false);

  useEffect(() => {
    const unsub = usbService.subscribe((d) => setDevices([...d]));
    return unsub;
  }, []);

  const handleUnblock = async (key: string) => {
    if (!vetoConfirm) return;
    usbService.unblockPort(key);
    bacterialGuardian.vaccinatePort(key);
    await evolis.registerUSBEvent(`unblock:${key}`);
    showToast(`Puerto ${key} desbloqueado y vacunado`, 'success');
    setVetoOpen(null);
    setVetoConfirm(false);
  };

  const handleBlock = async (key: string) => {
    usbService.blockPort(key, 'Bloqueo manual');
    await evolis.registerUSBEvent(`block:${key}`);
    showToast(`Puerto ${key} bloqueado`, 'warning');
  };

  const handleAuthenticate = async (key: string) => {
    const ok = usbService.authenticateDevice(key);
    if (ok) {
      await evolis.registerUSBEvent(`auth:${key}`);
      showToast('Dispositivo autenticado', 'success');
    } else {
      bacterialGuardian.activateDefense(key);
      await evolis.registerUSBEvent(`defense:${key}`);
      showToast('Autenticacion rechazada: defensa activada', 'error');
    }
  };

  return (
    <div className="guardian-usb-section">
      <h3>Puertos USB</h3>
      {devices.length === 0 && (
        <p className="empty-state">No hay dispositivos USB conectados.</p>
      )}
      {devices.length > 0 && (
        <div className="guardian-usb-list">
          {devices.map((dev, i) => {
            const key = `${dev.vendorId}:${dev.productId}:${dev.serialNumber ?? 'unknown'}`;
            const status = usbService.getPortStatus(key);
            const infected = usbService.isPortInfected(key);
            return (
              <div
                key={i}
                className={`guardian-usb-device guardian-usb--${status}`}
              >
                <div className="guardian-usb-info">
                  <strong>{STATUS_ICONS[status]} VID {dev.vendorId.toString(16)} / PID {dev.productId.toString(16)}</strong>
                  <span className="guardian-usb-name">{dev.productName ?? 'Sin nombre'}</span>
                  <span className="guardian-usb-status">{STATUS_LABELS[status]}</span>
                  {infected && (
                    <span className="guardian-usb-status" style={{ color: 'var(--error)' }}>
                      Bacteria desplegada
                    </span>
                  )}
                </div>
                <div className="guardian-usb-actions">
                  {status === 'allowed' && !dev.authenticated && dev.connected && (
                    <button className="action-btn" onClick={() => handleAuthenticate(key)}>
                      Autenticar
                    </button>
                  )}
                  {status === 'allowed' && (
                    <button className="action-btn guardian-block-btn" onClick={() => handleBlock(key)}>
                      Bloquear
                    </button>
                  )}
                  {status === 'blocked' && (
                    <button className="action-btn" onClick={() => setVetoOpen(key)}>
                      Desbloquear
                    </button>
                  )}
                  {status === 'infected' && (
                    <button className="action-btn" onClick={() => setVetoOpen(key)}>
                      Vacunar
                    </button>
                  )}
                </div>
                {vetoOpen === key && (
                  <div className="guardian-veto-confirm">
                    <p className="guardian-veto-text">
                      {infected
                        ? `Confirmar vacunacion del puerto ${key}? Esto eliminara la bacteria.`
                        : `Confirmar desbloqueo del puerto ${key}? Requiere veto humano.`}
                    </p>
                    <label className="guardian-veto-label">
                      <input
                        type="checkbox"
                        checked={vetoConfirm}
                        onChange={(e) => setVetoConfirm(e.target.checked)}
                      />
                      Confirmo manualmente
                    </label>
                    <div className="guardian-veto-buttons">
                      <button
                        className="action-btn"
                        onClick={() => handleUnblock(key)}
                        disabled={!vetoConfirm}
                      >
                        Confirmar
                      </button>
                      <button
                        className="action-btn"
                        onClick={() => { setVetoOpen(null); setVetoConfirm(false); }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {usbService.isSupported() && (
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
  );
}
