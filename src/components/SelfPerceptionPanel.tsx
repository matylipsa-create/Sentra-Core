import { useEffect, useState } from 'react';
import { selfPerceptionLoop, AgentStats, SessionMetrics } from '../core/SelfPerceptionLoop';
import { bioSoftware } from '../core/BioSoftwareInterface';

export function SelfPerceptionPanel() {
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [session, setSession] = useState<SessionMetrics | null>(null);
  const [status, setStatus] = useState('');
  const [summary, setSummary] = useState('');
  const [coherence, setCoherence] = useState(0);

  useEffect(() => {
    const update = () => {
      setStats(selfPerceptionLoop.getStats());
      setSession(selfPerceptionLoop.getSessionMetrics());
      setStatus(selfPerceptionLoop.getAgentStatus());
      setSummary(selfPerceptionLoop.getDailySummary());
      setCoherence(bioSoftware.getState().cardiacCoherence);
    };
    update();
    const interval = window.setInterval(update, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!stats || !session) {
    return (
      <div className="module-content self-perception-panel">
        <h2>Autopercepcion</h2>
        <p className="loading-text">Recopilando estado interno...</p>
      </div>
    );
  }

  const uptimeMin = Math.floor(stats.uptimeMs / 60000);
  const uptimeLabel = uptimeMin < 60
    ? `${uptimeMin} min`
    : `${Math.floor(uptimeMin / 60)}h ${uptimeMin % 60}min`;

  return (
    <div className="module-content self-perception-panel">
      <h2>Autopercepcion</h2>
      <p>El agente reporta su propio estado con datos reales de actividad.</p>

      <div className="perception-status-banner">
        <span className="perception-status-icon" aria-hidden="true">{'\u{1F9E0}'}</span>
        <div className="perception-status-info">
          <strong>{status}</strong>
          <span className="perception-status-detail">{summary}</span>
        </div>
      </div>

      <div className="perception-metrics-grid">
        <div className="perception-metric-card">
          <span className="perception-metric-label">Comandos hoy</span>
          <span className="perception-metric-value">{stats.dailyCommands}</span>
        </div>
        <div className="perception-metric-card">
          <span className="perception-metric-label">Total comandos</span>
          <span className="perception-metric-value">{stats.totalCommands}</span>
        </div>
        <div className="perception-metric-card">
          <span className="perception-metric-label">Coherencia</span>
          <span className="perception-metric-value">{Math.round(stats.avgCoherence * 100)}%</span>
        </div>
        <div className="perception-metric-card">
          <span className="perception-metric-label">Tiempo activo</span>
          <span className="perception-metric-value">{uptimeLabel}</span>
        </div>
        <div className="perception-metric-card">
          <span className="perception-metric-label">Detecciones</span>
          <span className="perception-metric-value">{stats.totalDetections}</span>
        </div>
        <div className="perception-metric-card">
          <span className="perception-metric-label">Registros EVOLIS</span>
          <span className="perception-metric-value">{stats.totalEvidence}</span>
        </div>
        <div className="perception-metric-card">
          <span className="perception-metric-label">Sesiones bio</span>
          <span className="perception-metric-value">{stats.totalBioSessions}</span>
        </div>
        <div className="perception-metric-card">
          <span className="perception-metric-label">Bloqueos eticos</span>
          <span className="perception-metric-value">{stats.totalMoralBlocks}</span>
        </div>
      </div>

      <div className="perception-session-section">
        <h3>Sesion actual</h3>
        <div className="perception-session-row">
          <span>Comandos procesados</span>
          <strong>{session.commandsProcessed}</strong>
        </div>
        <div className="perception-session-row">
          <span>Detecciones</span>
          <strong>{session.detectionsMade}</strong>
        </div>
        <div className="perception-session-row">
          <span>Sesiones bio completadas</span>
          <strong>{session.bioSessionsCompleted}</strong>
        </div>
        <div className="perception-session-row">
          <span>Registros de evidencia</span>
          <strong>{session.evidenceRecorded}</strong>
        </div>
        <div className="perception-session-row">
          <span>Bloqueos morales</span>
          <strong>{session.moralBlocks}</strong>
        </div>
        <div className="perception-session-row">
          <span>Coherencia cardiaca actual</span>
          <strong>{Math.round(coherence * 100)}%</strong>
        </div>
      </div>

      <button
        className="action-btn"
        onClick={() => {
          selfPerceptionLoop.resetStats();
          setStats(selfPerceptionLoop.getStats());
          setSession(selfPerceptionLoop.getSessionMetrics());
        }}
        aria-label="Reiniciar estadisticas"
      >
        Reiniciar estadisticas
      </button>
    </div>
  );
}
