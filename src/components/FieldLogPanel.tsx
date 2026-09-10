import { useEffect, useState } from 'react';
import { fieldLogManager, FieldLogEntry, Checklist } from '../core/FieldLogManager';
import { deviceManager } from '../core/DeviceManager';
import { voiceManager } from '../services/VoiceManager';

const ENTRY_ICONS: Record<FieldLogEntry['type'], string> = {
  voice_note: '\u{1F3A4}',
  marker: '\u{1F4CD}',
  step_complete: '\u{2705}',
  milestone: '\u{1F3C6}',
};

const ENTRY_LABELS: Record<FieldLogEntry['type'], string> = {
  voice_note: 'Nota de voz',
  marker: 'Marcador',
  step_complete: 'Paso completado',
  milestone: 'Hito',
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

export function FieldLogPanel() {
  const [entries, setEntries] = useState<FieldLogEntry[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [markerLabel, setMarkerLabel] = useState('');
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [newChecklistSteps, setNewChecklistSteps] = useState('');
  const [activeChecklistTaskId, setActiveChecklistTaskId] = useState<string | null>(null);

  useEffect(() => {
    fieldLogManager.init().then(() => {
      setEntries(fieldLogManager.getRecentEntries(30));
      setChecklists(fieldLogManager.getAllChecklists());
    });
    const unsub = fieldLogManager.subscribe((state) => {
      setEntries(state.entries.slice(0, 30));
      setChecklists(state.checklists);
    });
    return unsub;
  }, []);

  const handleAddMarker = () => {
    const label = markerLabel.trim();
    if (!label) return;
    fieldLogManager.addMarker(label, null);
    deviceManager.vibrate(80);
    setMarkerLabel('');
  };

  const handleCreateChecklist = () => {
    const title = newChecklistTitle.trim();
    if (!title || !newChecklistSteps.trim()) return;
    const steps = newChecklistSteps
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => ({ label: s, description: '' }));
    if (steps.length === 0) return;
    const taskId = `task-${Date.now()}`;
    fieldLogManager.createChecklist(taskId, title, steps);
    deviceManager.vibrate(80);
    setNewChecklistTitle('');
    setNewChecklistSteps('');
    setActiveChecklistTaskId(taskId);
  };

  const handleCompleteStep = (taskId: string, stepId: string) => {
    fieldLogManager.completeStep(taskId, stepId);
    deviceManager.vibrate(60);
  };

  const handleExport = () => {
    fieldLogManager.exportLog();
    deviceManager.vibrate(80);
    voiceManager.speak('Exportacion de bitacora iniciada', 3);
  };

  const activeChecklist = checklists.find((c) => c.taskId === activeChecklistTaskId);

  return (
    <div className="module-content field-log-panel" role="region" aria-label="Bitacora de campo">
      <h2>Bitacora de Campo</h2>
      <p>Registro de eventos, notas de voz, marcadores y checklists paso a paso.</p>

      <div className="field-log-section">
        <h3>Marcador rapido</h3>
        <div className="field-log-marker-row">
          <input
            type="text"
            className="field-log-input"
            value={markerLabel}
            onChange={(e) => setMarkerLabel(e.target.value)}
            placeholder="Nombre del marcador"
            aria-label="Nombre del marcador"
          />
          <button
            className="action-btn"
            onClick={handleAddMarker}
            disabled={!markerLabel.trim()}
            aria-label="Agregar marcador"
          >
            Agregar
          </button>
        </div>
      </div>

      <div className="field-log-section">
        <h3>Crear checklist</h3>
        <input
          type="text"
          className="field-log-input"
          value={newChecklistTitle}
          onChange={(e) => setNewChecklistTitle(e.target.value)}
          placeholder="Titulo de la tarea"
          aria-label="Titulo de la tarea"
        />
        <textarea
          className="field-log-textarea"
          value={newChecklistSteps}
          onChange={(e) => setNewChecklistSteps(e.target.value)}
          placeholder="Un paso por linea"
          aria-label="Pasos del checklist, uno por linea"
          rows={4}
        />
        <button
          className="action-btn"
          onClick={handleCreateChecklist}
          disabled={!newChecklistTitle.trim() || !newChecklistSteps.trim()}
          aria-label="Crear checklist"
        >
          Crear checklist
        </button>
      </div>

      {checklists.length > 0 && (
        <div className="field-log-section">
          <h3>Checklists</h3>
          <div className="field-log-checklist-tabs" role="tablist" aria-label="Seleccionar checklist">
            {checklists.map((cl) => (
              <button
                key={cl.taskId}
                role="tab"
                aria-selected={activeChecklistTaskId === cl.taskId}
                className={`field-log-checklist-tab ${activeChecklistTaskId === cl.taskId ? 'active' : ''}`}
                onClick={() => setActiveChecklistTaskId(cl.taskId)}
              >
                {cl.title} ({cl.steps.filter((s) => s.completed).length}/{cl.steps.length})
              </button>
            ))}
          </div>
          {activeChecklist && (
            <div className="field-log-checklist-steps">
              {activeChecklist.steps.map((step) => (
                <div key={step.id} className={`field-log-step ${step.completed ? 'completed' : ''}`}>
                  <button
                    className="field-log-step-btn"
                    onClick={() => handleCompleteStep(activeChecklist.taskId, step.id)}
                    disabled={step.completed}
                    aria-label={step.completed ? `Paso ${step.label} completado` : `Marcar paso ${step.label} como completado`}
                  >
                    <span className="field-log-step-check" aria-hidden="true">
                      {step.completed ? '\u{2705}' : '\u{2B1C}'}
                    </span>
                    <span className="field-log-step-label">{step.label}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="field-log-section">
        <div className="field-log-entries-header">
          <h3>Entradas recientes ({entries.length})</h3>
          <button className="action-btn field-log-export-btn" onClick={handleExport} aria-label="Exportar bitacora">
            Exportar
          </button>
        </div>
        {entries.length === 0 ? (
          <p className="empty-state">No hay entradas registradas.</p>
        ) : (
          <div className="field-log-entries">
            {entries.map((entry) => (
              <div key={entry.id} className="field-log-entry">
                <span className="field-log-entry-icon" aria-hidden="true">{ENTRY_ICONS[entry.type]}</span>
                <div className="field-log-entry-content">
                  <strong>{ENTRY_LABELS[entry.type]}: {entry.label}</strong>
                  <span className="field-log-entry-context">{entry.context}</span>
                  <span className="field-log-entry-time">{formatTime(entry.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
