import { useEffect, useRef, useState } from 'react';
import { useApp, ModuleName } from '../context/AppContext';
import { deviceManager } from '../core/DeviceManager';
import { moduleManager } from '../modules/ModuleManager';

const MODULES: { id: ModuleName; label: string; icon: string }[] = [
  { id: 'vision', label: 'Vision', icon: '\u{1F441}' },
  { id: 'seguridad', label: 'Seguridad', icon: '\u{1F6E1}' },
  { id: 'movimiento', label: 'Movimiento', icon: '\u{1F9ED}' },
  { id: 'aprendizaje', label: 'Aprendizaje', icon: '\u{1F4DA}' },
  { id: 'bio', label: 'Bio', icon: '\u{1F9EC}' },
  { id: 'evidencia', label: 'Evidencia', icon: '\u{1F4CB}' },
  { id: 'silencio', label: 'Silencio', icon: '\u{1F507}' },
];

interface TactileModuleDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TactileModuleDrawer({ open, onOpenChange }: TactileModuleDrawerProps) {
  const { activeModule, setModule } = useApp();
  const drawerRef = useRef<HTMLDivElement>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      const firstBtn = drawerRef.current?.querySelector<HTMLButtonElement>('.drawer-module-btn');
      firstBtn?.focus();
    }
  }, [open]);

  const handleSelect = (id: ModuleName) => {
    setModule(id);
    deviceManager.vibrate(80);
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onOpenChange(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const delta = e.touches[0].clientX - touchStartX;
    if (delta < -60) {
      onOpenChange(false);
      setTouchStartX(null);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onOpenChange(false);
    }
  };

  return (
    <>
      <div
        className={`drawer-backdrop ${open ? 'drawer-backdrop--open' : ''}`}
        onClick={handleBackdropClick}
        aria-hidden={!open}
      />
      <div
        ref={drawerRef}
        className={`tactile-drawer ${open ? 'tactile-drawer--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navegacion de modulos"
        aria-expanded={open}
        aria-controls="module-navigation"
        onKeyDown={handleKeyDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        <div className="drawer-handle" aria-hidden="true" />
        <h2 className="drawer-title" id="module-navigation">Modulos</h2>
        <nav className="drawer-nav" role="tablist" aria-label="Seleccion de modulo">
          {MODULES.map((mod) => {
            const def = moduleManager.getModule(mod.id);
            return (
              <button
                key={mod.id}
                role="tab"
                aria-selected={activeModule === mod.id}
                className={`drawer-module-btn ${activeModule === mod.id ? 'drawer-module-btn--active' : ''}`}
                onClick={() => handleSelect(mod.id)}
                aria-label={`Activar modulo ${mod.label}. ${def?.description ?? ''}`}
              >
                <span className="drawer-module-icon" aria-hidden="true">{mod.icon}</span>
                <span className="drawer-module-info">
                  <span className="drawer-module-label">{mod.label}</span>
                  <span className="drawer-module-desc">{def?.description ?? ''}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
