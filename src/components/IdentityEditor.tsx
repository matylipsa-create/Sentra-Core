import { useEffect, useState } from 'react';
import {
  identityManager,
  AgentIdentity,
  AgentTone,
  AgentStyle,
} from '../core/IdentityManager';
import { useToast } from '../context/ToastContext';

export function IdentityEditor() {
  const { showToast } = useToast();
  const [identity, setIdentity] = useState<AgentIdentity | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tone, setTone] = useState<AgentTone>('directo');
  const [style, setStyle] = useState<AgentStyle>('directo');
  const [values, setValues] = useState('');
  const [saving, setSaving] = useState(false);
  const [consistency, setConsistency] = useState(false);
  const [history, setHistory] = useState(identityManager.getIdentityHistory());

  useEffect(() => {
    identityManager.init().then(() => {
      const id = identityManager.getIdentity();
      setIdentity(id);
      setName(id.name);
      setDescription(id.description);
      setTone(id.tone);
      setStyle(id.style);
      setValues(id.values.join(', '));
      setConsistency(identityManager.verifyIdentityConsistency());
      setHistory(identityManager.getIdentityHistory());
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const valueList = values
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    identityManager.createIdentity(name, description, tone, style, valueList);
    await identityManager.persistIdentity();
    setConsistency(identityManager.verifyIdentityConsistency());
    setHistory(identityManager.getIdentityHistory());
    setIdentity(identityManager.getIdentity());
    setSaving(false);
    showToast('Identidad guardada y registrada en EVOLIS', 'success');
  };

  const tones = identityManager.getAllTones();
  const stylesList = identityManager.getAllStyles();

  if (!identity) {
    return (
      <div className="module-content identity-editor">
        <h2>Identidad del Agente</h2>
        <p className="loading-text">Cargando identidad...</p>
      </div>
    );
  }

  return (
    <div className="module-content identity-editor">
      <h2>Identidad del Agente</h2>
      <p>
        La identidad define como Sentra Core se presenta y responde. Se persiste en la cadena EVOLIS
        y se verifica por consistencia.
      </p>

      <div className="identity-form">
        <label className="identity-field">
          <span className="identity-field-label">Nombre</span>
          <input
            type="text"
            className="identity-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del agente"
            aria-label="Nombre del agente"
            maxLength={50}
          />
        </label>

        <label className="identity-field">
          <span className="identity-field-label">Descripcion</span>
          <textarea
            className="identity-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe la identidad del agente"
            aria-label="Descripcion del agente"
            maxLength={300}
            rows={3}
          />
        </label>

        <div className="identity-field">
          <span className="identity-field-label">Tono</span>
          <div className="identity-options" role="radiogroup" aria-label="Tono del agente">
            {tones.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={tone === t.id}
                className={`identity-option-btn ${tone === t.id ? 'active' : ''}`}
                onClick={() => setTone(t.id)}
              >
                <strong>{t.label}</strong>
                <span>{t.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="identity-field">
          <span className="identity-field-label">Estilo</span>
          <div className="identity-options" role="radiogroup" aria-label="Estilo del agente">
            {stylesList.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={style === s.id}
                className={`identity-option-btn ${style === s.id ? 'active' : ''}`}
                onClick={() => setStyle(s.id)}
              >
                <strong>{s.label}</strong>
                <span>{s.description}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="identity-field">
          <span className="identity-field-label">Valores (separados por comas)</span>
          <input
            type="text"
            className="identity-input"
            value={values}
            onChange={(e) => setValues(e.target.value)}
            placeholder="etica, soberania, offline-first"
            aria-label="Valores del agente"
          />
        </label>

        <div className="identity-consistency">
          <span className={`identity-consistency-badge ${consistency ? 'ok' : 'fail'}`}>
            {consistency ? 'Identidad consistente' : 'Identidad incompleta'}
          </span>
          <span className="identity-meta">
            Creada: {identity.createdAt ? new Date(identity.createdAt).toLocaleDateString('es-ES') : '--'}
          </span>
          <span className="identity-meta">
            Actualizada: {identity.updatedAt ? new Date(identity.updatedAt).toLocaleDateString('es-ES') : '--'}
          </span>
        </div>

        <button
          className="action-btn identity-save-btn"
          onClick={handleSave}
          disabled={saving}
          aria-label="Guardar identidad en EVOLIS"
        >
          {saving ? 'Guardando...' : 'Guardar identidad'}
        </button>
      </div>

      {history.length > 0 && (
        <div className="identity-history">
          <h3>Historial de cambios ({history.length})</h3>
          {history.slice(-5).reverse().map((event) => (
            <div key={event.id} className="identity-history-entry">
              <span className="identity-history-type">{event.type}</span>
              <span className="identity-history-time">
                {new Date(event.timestamp).toLocaleString('es-ES')}
              </span>
              <span className="identity-history-hash">
                {event.hash.slice(0, 16)}...
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
