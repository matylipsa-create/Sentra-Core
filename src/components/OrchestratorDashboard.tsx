/**
 * OrchestratorDashboard — Dashboard del orquestador nativo.
 *
 * Visualiza el estado del orquestador, failovers, eventos y registros
 * en tiempo real. Accesible: Voice-First, ARIA, minimos 56px touch.
 */

import { useEffect, useState } from 'react';
import { orchestratorEngine, FlowStatus } from '../core/OrchestratorEngine';
import { failoverManager, FailoverStatus } from '../core/FailoverManager';
import { offlineLogger, LogEntry } from '../core/OfflineLogger';
import { actionDispatcher, DispatchAction } from '../core/ActionDispatcher';
import { alertModule, Alert } from '../modules/AlertModule';

const STATE_LABELS: Record<string, string> = {
  stable: 'Estable',
  degraded: 'Degradado',
  backup_active: 'Backup Activo',
  critical: 'Critico',
};

const STATE_COLORS: Record<string, string> = {
  stable: '#00ff88',
  degraded: '#ffaa00',
  backup_active: '#00d4ff',
  critical: '#ff4444',
};

const NODE_STATUS_COLORS: Record<string, string> = {
  pending: '#8888a0',
  running: '#00d4ff',
  completed: '#00ff88',
  failed: '#ff4444',
  skipped: '#8888a0',
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function OrchestratorDashboard() {
  const [flowStatus, setFlowStatus] = useState<FlowStatus | null>(null);
  const [failoverStatus, setFailoverStatus] = useState<FailoverStatus | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [actions, setActions] = useState<DispatchAction[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    const unsubFlow = orchestratorEngine.subscribe(setFlowStatus);
    const unsubFailover = failoverManager.subscribe(setFailoverStatus);
    const unsubLogs = offlineLogger.subscribe((entry) => {
      setLogs((prev) => [entry, ...prev].slice(0, 50));
    });
    const unsubActions = actionDispatcher.subscribe((action) => {
      setActions((prev) => [action, ...prev].slice(0, 30));
    });
    const unsubAlerts = alertModule.subscribe(setAlerts);

    return () => {
      unsubFlow();
      unsubFailover();
      unsubLogs();
      unsubActions();
      unsubAlerts();
    };
  }, []);

  const handleStart = () => {
    orchestratorEngine.startOrchestration();
  };

  const handleStop = () => {
    orchestratorEngine.stopOrchestration();
  };

  const running = flowStatus?.running ?? false;
  const failoverState = failoverStatus?.state ?? 'stable';
  const stateColor = STATE_COLORS[failoverState] ?? '#8888a0';

  return (
    <div className="module-content orchestrator-dashboard" role="region" aria-label="Dashboard del orquestador">
      <h2>Orquestador N8N Offline</h2>
      <p>Orquestacion nativa offline-first con failover, filtro etico y trazabilidad EVOLIS.</p>

      {/* Status banner */}
      <div
        className="guardian-state-banner"
        style={{ borderColor: running ? stateColor : '#8888a0' }}
        role="status"
        aria-live="polite"
      >
        <span className="guardian-state-icon" aria-hidden="true">
          {running ? '\u{26A1}' : '\u{1F6D1}'}
        </span>
        <div className="guardian-state-info">
          <strong>{running ? 'Orquestacion Activa' : 'Orquestacion Detenida'}</strong>
          <span className="guardian-state-detail">
            Failover: {STATE_LABELS[failoverState]} · Eventos: {flowStatus?.totalEvents ?? 0} · Fallos: {flowStatus?.failedEvents ?? 0}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="guardian-controls">
        {!running && (
          <button
            className="action-btn guardian-activate-btn"
            onClick={handleStart}
            aria-label="Iniciar orquestacion"
            style={{ minHeight: 56, padding: '12px 20px' }}
          >
            Iniciar Orquestacion
          </button>
        )}
        {running && (
          <button
            className="action-btn guardian-deactivate-btn"
            onClick={handleStop}
            aria-label="Detener orquestacion"
            style={{ minHeight: 56, padding: '12px 20px' }}
          >
            Detener Orquestacion
          </button>
        )}
      </div>

      {/* Failover status */}
      {failoverStatus && (
        <div className="orchestrator-section" role="region" aria-label="Estado de failover">
          <h3>Failover</h3>
          <div className="orchestrator-stat-grid">
            <div className="orchestrator-stat-card">
              <span className="orchestrator-stat-label">Estado</span>
              <span className="orchestrator-stat-value" style={{ color: stateColor }}>
                {STATE_LABELS[failoverStatus.state]}
              </span>
            </div>
            <div className="orchestrator-stat-card">
              <span className="orchestrator-stat-label">Errores totales</span>
              <span className="orchestrator-stat-value">{failoverStatus.totalErrors}</span>
            </div>
            <div className="orchestrator-stat-card">
              <span className="orchestrator-stat-label">Backups activos</span>
              <span className="orchestrator-stat-value">{failoverStatus.activeBackups}</span>
            </div>
          </div>
          {failoverStatus.lastError && (
            <div className="orchestrator-error-banner" role="alert">
              <strong>Ultimo error:</strong> {failoverStatus.lastError.error}
              <span className="orchestrator-error-time">{formatTime(failoverStatus.lastError.timestamp)}</span>
            </div>
          )}
        </div>
      )}

      {/* Executed flow nodes */}
      {flowStatus && flowStatus.executedNodes.length > 0 && (
        <div className="orchestrator-section" role="region" aria-label="Nodos ejecutados">
          <h3>Flujo activo · Nodos ejecutados ({flowStatus.executedNodes.length})</h3>
          <div className="orchestrator-node-list">
            {flowStatus.executedNodes.slice(0, 20).map((node, i) => (
              <div key={`${node.stepId}-${node.startedAt}-${i}`} className="orchestrator-node-row">
                <span
                  className="orchestrator-node-dot"
                  style={{ backgroundColor: NODE_STATUS_COLORS[node.status] ?? '#8888a0' }}
                  aria-hidden="true"
                />
                <span className="orchestrator-node-name">{node.stepName}</span>
                <span className="orchestrator-node-type">{node.stepType}</span>
                <span
                  className="orchestrator-node-status"
                  style={{ color: NODE_STATUS_COLORS[node.status] ?? '#8888a0' }}
                >
                  {node.status}
                </span>
                {node.error && (
                  <span className="orchestrator-node-error" title={node.error}>
                    {node.error.slice(0, 40)}
                  </span>
                )}
                <span className="orchestrator-node-time">{formatTime(node.startedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active alerts */}
      {alerts.length > 0 && (
        <div className="orchestrator-section" role="region" aria-label="Alertas activas" aria-live="polite">
          <h3>Alertas ({alerts.length})</h3>
          <div className="orchestrator-alert-list">
            {alerts.slice(0, 10).map((alert) => (
              <div
                key={alert.id}
                className={`guardian-alert guardian-alert--${alert.level}`}
              >
                <div className="guardian-alert-content">
                  <strong>{alert.message}</strong>
                  <span className="guardian-alert-time">
                    {formatTime(alert.timestamp)} · {alert.source}
                  </span>
                </div>
                {!alert.acknowledged && (
                  <button
                    className="action-btn guardian-alert-resolve"
                    onClick={() => alertModule.acknowledge(alert.id)}
                    aria-label="Reconocer alerta"
                    style={{ minHeight: 36, padding: '4px 12px' }}
                  >
                    {'\u{2713}'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent actions */}
      {actions.length > 0 && (
        <div className="orchestrator-section" role="region" aria-label="Acciones recientes">
          <h3>Acciones dispatchadas ({actions.length})</h3>
          <div className="orchestrator-log-box">
            {actions.slice(0, 15).map((action, i) => (
              <div key={i} className="orchestrator-log-row">
                <span className="orchestrator-log-time">{formatTime(Date.now())}</span>
                <span
                  className="orchestrator-log-badge"
                  style={{
                    backgroundColor: action.level === 'critical' ? 'rgba(255,68,68,0.15)' : action.level === 'warning' ? 'rgba(255,170,0,0.15)' : 'rgba(0,212,255,0.15)',
                    color: action.level === 'critical' ? '#ff4444' : action.level === 'warning' ? '#ffaa00' : '#00d4ff',
                  }}
                >
                  {action.type}
                </span>
                <span className="orchestrator-log-message">{action.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Offline logs */}
      {logs.length > 0 && (
        <div className="orchestrator-section" role="region" aria-label="Registros offline">
          <h3>Registros Offline ({logs.length})</h3>
          <div className="orchestrator-log-box">
            {logs.slice(0, 20).map((log) => (
              <div key={log.id} className="orchestrator-log-row">
                <span className="orchestrator-log-time">{formatTime(log.timestamp)}</span>
                <span
                  className="orchestrator-log-badge"
                  style={{
                    backgroundColor: log.level === 'critical' ? 'rgba(255,68,68,0.15)' : log.level === 'warning' ? 'rgba(255,170,0,0.15)' : 'rgba(136,136,160,0.15)',
                    color: log.level === 'critical' ? '#ff4444' : log.level === 'warning' ? '#ffaa00' : '#8888a0',
                  }}
                >
                  {log.type}
                </span>
                <span className="orchestrator-log-message">{log.message}</span>
                {log.evolisRecorded && (
                  <span className="orchestrator-log-evolis" title="Registrado en EVOLIS">
                    {'\u{1F512}'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
