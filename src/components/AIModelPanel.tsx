/**
 * AIModelPanel — Panel accesible para gestión de modelos IA locales (Ollama).
 *
 * Voice-First, ARIA live, targets 56px, alto contraste, focus neón 3px.
 * IMPORTA SentraVisionAccessibility desde src/modules/SentraVisionAccessibility.ts
 * para anuncios accesibles. NO reimplementa ARIA live region ni vibrate.
 */

import { useEffect, useState } from 'react';
import { aiModule, type AIModuleStatus } from '../modules/AIModule';
import { type ManagedModel } from '../core/ModelManager';
import SentraVisionAccessibility from '../modules/SentraVisionAccessibility';
import { deviceManager } from '../core/DeviceManager';

const accessibility = new SentraVisionAccessibility({ minConfidence: 0.5 });

function formatSize(bytes: number): string {
  if (bytes === 0) return '—';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

export function AIModelPanel() {
  const [status, setStatus] = useState<AIModuleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    aiModule.init().then(() => {
      setStatus(aiModule.getStatus());
      setLoading(false);
    });
    const unsub = aiModule.subscribe(setStatus);
    return unsub;
  }, []);

  const handleSelectModel = async (modelId: string) => {
    setActionLoading(true);
    deviceManager.vibrate(60);
    const ok = await aiModule.selectModel(modelId);
    if (ok) {
      accessibility.processDetections([
        { label: `Modelo ${modelId} activado`, confidence: 1 },
      ]);
    } else {
      accessibility.processDetections([
        { label: `Error al activar modelo ${modelId}`, confidence: 1 },
      ]);
    }
    setActionLoading(false);
  };

  const handlePullModel = async (modelId: string) => {
    setActionLoading(true);
    deviceManager.vibrate(80);
    accessibility.processDetections([
      { label: `Descargando modelo ${modelId}. Esto puede tardar varios minutos.`, confidence: 1 },
    ]);
    const ok = await aiModule.pullModel(modelId);
    if (ok) {
      accessibility.processDetections([
        { label: `Modelo ${modelId} descargado correctamente`, confidence: 1 },
      ]);
    } else {
      accessibility.processDetections([
        { label: `Error al descargar modelo ${modelId}`, confidence: 1 },
      ]);
    }
    setActionLoading(false);
  };

  const handleDeleteModel = async (modelId: string) => {
    setActionLoading(true);
    deviceManager.vibrate([100, 50, 100]);
    const ok = await aiModule.deleteModel(modelId);
    if (ok) {
      accessibility.processDetections([
        { label: `Modelo ${modelId} eliminado`, confidence: 1 },
      ]);
    }
    setActionLoading(false);
  };

  const handleRefresh = async () => {
    setActionLoading(true);
    deviceManager.vibrate(60);
    await aiModule.refreshModels();
    await aiModule.checkHealth();
    setActionLoading(false);
  };

  if (loading || !status) {
    return (
      <div className="module-content ai-model-panel" role="region" aria-label="Panel de IA local">
        <h2>IA Local (Ollama)</h2>
        <p className="loading-text">Inicializando módulo de IA local...</p>
      </div>
    );
  }

  const ollamaOk = status.ollamaHealth?.ok ?? false;
  const models = status.models.models;
  const installedModels = models.filter((m) => m.installed);
  const recommendation = status.quantization.recommendation;
  const hwProfile = status.quantization.detected;

  return (
    <div className="module-content ai-model-panel" role="region" aria-label="Panel de IA local Ollama">
      <h2>IA Local (Ollama)</h2>
      <p>Modelos IA cuantizados a 4 bits ejecutándose localmente. Offline, soberano, baja latencia.</p>

      {/* Estado de Ollama */}
      <div
        className="guardian-state-banner"
        style={{ borderColor: ollamaOk ? 'var(--accent)' : 'var(--error)' }}
        role="status"
        aria-live="polite"
      >
        <span className="guardian-state-icon" aria-hidden="true">
          {ollamaOk ? '\u{26A1}' : '\u{1F6D1}'}
        </span>
        <div className="guardian-state-info">
          <strong>{ollamaOk ? 'Ollama Activo' : 'Ollama No Disponible'}</strong>
          <span className="guardian-state-detail">
            {ollamaOk
              ? `Latencia: ${status.ollamaHealth?.latencyMs ?? 0} ms · ${status.ollamaHealth?.models ?? 0} modelos · Activo: ${status.models.activeModelId ?? 'ninguno'}`
              : 'Instala Ollama con scripts/setup-ollama.sh para activar IA local soberana.'}
          </span>
        </div>
      </div>

      {/* Controles */}
      <div className="guardian-controls">
        <button
          className="action-btn"
          onClick={handleRefresh}
          disabled={actionLoading}
          aria-label="Actualizar lista de modelos"
          style={{ minHeight: 56 }}
        >
          Actualizar
        </button>
      </div>

      {/* Hardware y cuantización */}
      {hwProfile && recommendation && (
        <div className="orchestrator-section" role="region" aria-label="Hardware y cuantización">
          <h3>Hardware Detectado</h3>
          <div className="orchestrator-stat-grid">
            <div className="orchestrator-stat-card">
              <span className="orchestrator-stat-label">GPU</span>
              <span className="orchestrator-stat-value" style={{ fontSize: '0.9rem' }}>
                {hwProfile.gpu.toUpperCase()}
              </span>
            </div>
            <div className="orchestrator-stat-card">
              <span className="orchestrator-stat-label">VRAM Estimada</span>
              <span className="orchestrator-stat-value">{hwProfile.vramGb.toFixed(0)} GB</span>
            </div>
            <div className="orchestrator-stat-card">
              <span className="orchestrator-stat-label">RAM</span>
              <span className="orchestrator-stat-value">{hwProfile.ramGb.toFixed(0)} GB</span>
            </div>
            <div className="orchestrator-stat-card">
              <span className="orchestrator-stat-label">Núcleos</span>
              <span className="orchestrator-stat-value">{hwProfile.cores}</span>
            </div>
          </div>
          <div
            className="guardian-state-banner"
            style={{ borderColor: 'var(--neon-focus)', marginTop: 8 }}
            role="status"
          >
            <span className="guardian-state-icon" aria-hidden="true">{'\u{1F9EE}'}</span>
            <div className="guardian-state-info">
              <strong>Recomendado: {recommendation.label}</strong>
              <span className="guardian-state-detail">
                {recommendation.description} · {recommendation.maxParameters} ·
                Calidad: {Math.round(recommendation.qualityScore * 100)}% ·
                Velocidad: {Math.round(recommendation.speedScore * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Niveles de cuantización */}
      <div className="orchestrator-section" role="region" aria-label="Niveles de cuantización">
        <h3>Niveles de Cuantización</h3>
        <div className="orchestrator-stat-grid">
          {status.quantization.availableLevels.map((level) => {
            const isRecommended = recommendation?.level === level.level;
            return (
              <div
                key={level.level}
                className="orchestrator-stat-card"
                style={isRecommended ? { borderColor: 'var(--neon-focus)' } : undefined}
              >
                <span className="orchestrator-stat-label">{level.label}</span>
                <span className="orchestrator-stat-value" style={{ fontSize: '0.85rem' }}>
                  {level.estimatedVramGb} GB VRAM
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                  {isRecommended ? 'Recomendado' : level.maxParameters}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modelos */}
      <div className="orchestrator-section" role="region" aria-label="Modelos disponibles">
        <h3>Modelos ({installedModels.length} instalados, {models.length} totales)</h3>
        {models.length === 0 && (
          <p className="empty-state">
            {ollamaOk
              ? 'No hay modelos instalados. Descarga con scripts/pull-models.sh.'
              : 'Ollama no está disponible. Instala con scripts/setup-ollama.sh.'}
          </p>
        )}
        {models.length > 0 && (
          <div className="orchestrator-node-list">
            {models.map((model) => (
              <ModelRow
                key={model.id}
                model={model}
                isActive={status.models.activeModelId === model.id}
                actionLoading={actionLoading}
                onSelect={() => handleSelectModel(model.id)}
                onPull={() => handlePullModel(model.id)}
                onDelete={() => handleDeleteModel(model.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Estado IA */}
      <div className="orchestrator-section" role="region" aria-label="Estado de IA">
        <h3>Estado de IA</h3>
        <div className="orchestrator-stat-grid">
          <div className="orchestrator-stat-card">
            <span className="orchestrator-stat-label">Fuente</span>
            <span className="orchestrator-stat-value" style={{ fontSize: '0.85rem' }}>
              {status.localAI.source === 'ollama' ? 'Ollama' : status.localAI.source === 'gemini' ? 'Gemini' : 'Local'}
            </span>
          </div>
          <div className="orchestrator-stat-card">
            <span className="orchestrator-stat-label">Última latencia</span>
            <span className="orchestrator-stat-value">{status.localAI.lastLatencyMs} ms</span>
          </div>
          <div className="orchestrator-stat-card">
            <span className="orchestrator-stat-label">Modelo activo</span>
            <span className="orchestrator-stat-value" style={{ fontSize: '0.85rem' }}>
              {status.localAI.activeModel ?? 'Ninguno'}
            </span>
          </div>
          <div className="orchestrator-stat-card">
            <span className="orchestrator-stat-label">Ollama</span>
            <span className="orchestrator-stat-value" style={{ color: ollamaOk ? 'var(--accent)' : 'var(--error)' }}>
              {ollamaOk ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ModelRowProps {
  model: ManagedModel;
  isActive: boolean;
  actionLoading: boolean;
  onSelect: () => void;
  onPull: () => void;
  onDelete: () => void;
}

function ModelRow({ model, isActive, actionLoading, onSelect, onPull, onDelete }: ModelRowProps) {
  return (
    <div className="orchestrator-node-row" style={{ flexWrap: 'wrap', gap: 6, padding: '10px 12px' }}>
      <span
        className="orchestrator-node-dot"
        style={{ backgroundColor: model.installed ? (isActive ? 'var(--neon-focus)' : 'var(--accent)') : 'var(--text-dim)' }}
        aria-hidden="true"
      />
      <span className="orchestrator-node-name" style={{ minWidth: 120 }}>
        {model.label}
      </span>
      <span className="orchestrator-node-type">{model.task}</span>
      <span className="orchestrator-node-status" style={{ color: model.installed ? 'var(--accent)' : 'var(--text-dim)' }}>
        {model.installed ? (isActive ? 'Activo' : 'Instalado') : 'No instalado'}
      </span>
      {model.installed && (
        <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
          {model.quantization} · {formatSize(model.sizeBytes)}
        </span>
      )}
      <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
        {model.installed && !isActive && (
          <button
            className="action-btn"
            onClick={onSelect}
            disabled={actionLoading}
            aria-label={`Activar modelo ${model.label}`}
            style={{ minHeight: 36, padding: '4px 12px', fontSize: '0.8rem' }}
          >
            Activar
          </button>
        )}
        {!model.installed && (
          <button
            className="action-btn guardian-activate-btn"
            onClick={onPull}
            disabled={actionLoading}
            aria-label={`Descargar modelo ${model.label}`}
            style={{ minHeight: 36, padding: '4px 12px', fontSize: '0.8rem' }}
          >
            Descargar
          </button>
        )}
        {model.installed && (
          <button
            className="action-btn guardian-deactivate-btn"
            onClick={onDelete}
            disabled={actionLoading}
            aria-label={`Eliminar modelo ${model.label}`}
            style={{ minHeight: 36, padding: '4px 12px', fontSize: '0.8rem' }}
          >
            Eliminar
          </button>
        )}
      </div>
    </div>
  );
}
