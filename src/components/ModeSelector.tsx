import { deviceManager } from '../core/DeviceManager';
import { voiceManager } from '../services/VoiceManager';

export type UiMode = 'vision' | 'sentinel';

interface ModeSelectorProps {
  mode: UiMode;
  onChange: (mode: UiMode) => void;
}

const MODES: { id: UiMode; label: string; icon: string; description: string }[] = [
  { id: 'vision', label: 'Visión', icon: '\u{1F441}', description: 'Asistencia visual con detección de objetos y descripción por voz' },
  { id: 'sentinel', label: 'Sentinel', icon: '\u{1F6E1}', description: 'Seguridad soberana con monitoreo, alertas y trazabilidad EVOLIS' },
];

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  const handleSelect = (m: UiMode) => {
    if (m === mode) return;
    onChange(m);
    deviceManager.vibrate(80);
    const selected = MODES.find((x) => x.id === m);
    voiceManager.speak(`Modo ${selected?.label ?? m} activado`, 2);
  };

  return (
    <div className="mode-selector" role="tablist" aria-label="Selector de modo">
      {MODES.map((m) => {
        const active = m.id === mode;
        return (
          <button
            key={m.id}
            role="tab"
            aria-selected={active}
            aria-label={`Activar modo ${m.label}. ${m.description}`}
            className={`mode-btn ${active ? 'mode-btn--active' : ''}`}
            onClick={() => handleSelect(m.id)}
          >
            <span className="mode-btn-icon" aria-hidden="true">{m.icon}</span>
            <span className="mode-btn-label">{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}
