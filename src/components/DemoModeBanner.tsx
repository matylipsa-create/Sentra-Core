import { useApp } from '../context/AppContext';
import { usePowerMode } from '../hooks/usePowerMode';
import { useDeviceCapabilities } from '../hooks/useDeviceCapabilities';

export function DemoModeBanner() {
  const { activeModule, evidenceCount, humanVeto, geminiRemote, worldEnabled } = useApp();
  const { profile, batteryLevel, isCharging } = usePowerMode();
  const { capabilities } = useDeviceCapabilities();

  return (
    <div className="demo-banner" role="banner">
      <div className="demo-banner-section">
        <span className="banner-label">Modulo</span>
        <span className="banner-value">{activeModule}</span>
      </div>
      <div className="demo-banner-section">
        <span className="banner-label">Energia</span>
        <span className="banner-value">{profile.label}</span>
        {batteryLevel !== null && (
          <span className="banner-detail">
            {Math.round(batteryLevel * 100)}%{isCharging ? ' \u{26A1}' : ''}
          </span>
        )}
      </div>
      <div className="demo-banner-section">
        <span className="banner-label">EVOLIS</span>
        <span className="banner-value">{evidenceCount}</span>
      </div>
      <div className="demo-banner-section">
        <span className="banner-label">Veto</span>
        <span className="banner-value">{humanVeto ? 'ON' : 'OFF'}</span>
      </div>
      <div className="demo-banner-section">
        <span className="banner-label">IA</span>
        <span className="banner-value">{geminiRemote ? 'Gemini' : 'Local'}</span>
      </div>
      <div className="demo-banner-section">
        <span className="banner-label">Mundo</span>
        <span className="banner-value">{worldEnabled ? 'ON' : 'OFF'}</span>
      </div>
      {capabilities && (
        <div className="demo-banner-section">
          <span className="banner-label">Dispositivo</span>
          <span className="banner-value">{capabilities.platform}</span>
          <span className="banner-detail">
            {capabilities.isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      )}
    </div>
  );
}
