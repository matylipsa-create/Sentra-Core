import { deviceManager } from '../core/DeviceManager';
import { voiceManager } from '../services/VoiceManager';

interface BlindModeSelectorProps {
  mode: 'vision' | 'sentinel';
  onChange: (mode: 'vision' | 'sentinel') => void;
}

const MODES: { id: 'vision' | 'sentinel'; label: string; icon: string; description: string }[] = [
  { id: 'vision', label: 'Visión', icon: '\u{1F441}', description: 'Asistencia visual con detección de objetos y descripción por voz' },
  { id: 'sentinel', label: 'Sentinel', icon: '\u{1F6E1}', description: 'Seguridad soberana con monitoreo, alertas y trazabilidad EVOLIS' },
];

export function BlindModeSelector({ mode, onChange }: BlindModeSelectorProps) {
  const handleSelect = (m: 'vision' | 'sentinel') => {
    if (m === mode) return;
    onChange(m);
    deviceManager.vibrate(80);
    const selected = MODES.find((x) => x.id === m);
    voiceManager.speak(`Modo ${selected?.label ?? m} activado. ${selected?.description ?? ''}`, 2);
  };

  const handleKeyDown = (e: React.KeyboardEvent, m: 'vision' | 'sentinel') => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect(m);
    }
  };

  return (
    <div className="blind-mode-selector" role="tablist" aria-label="Selector de modo: Visión o Sentinel">
      {MODES.map((m) => {
        const active = m.id === mode;
        return (
          <button
            key={m.id}
            role="tab"
            aria-selected={active}
            aria-label={`Activar modo ${m.label}. ${m.description}`}
            className={`blind-mode-btn ${active ? 'blind-mode-btn--active' : ''}`}
            onClick={() => handleSelect(m.id)}
            onKeyDown={(e) => handleKeyDown(e, m.id)}
          >
            <span className="blind-mode-icon" aria-hidden="true">{m.icon}</span>
            <span className="blind-mode-label">{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}
