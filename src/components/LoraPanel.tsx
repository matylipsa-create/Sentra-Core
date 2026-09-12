/**
 * LoraPanel — Panel accesible para la red mesh P2P LoRa (SX1262).
 *
 * Voice-First, ARIA live, targets 56px, alto contraste, focus neón 3px.
 * IMPORTA SentraVisionAccessibility para anuncios — NO reimplementa ARIA ni vibrate.
 */

import { useEffect, useState } from 'react';
import { loraModule, type LoraModuleStatus } from '../modules/LoraModule';
import { loraMeshManager, type MeshStatus } from '../core/LoraMeshManager';
import { LoraPacketType } from '../core/LoraProtocol';
import SentraVisionAccessibility from '../modules/SentraVisionAccessibility';
import { deviceManager } from '../core/DeviceManager';

const accessibility = new SentraVisionAccessibility({ minConfidence: 0.5 });

const TYPE_LABELS: Record<number, string> = {
  [LoraPacketType.DETECTION]: 'Deteccion',
  [LoraPacketType.ALERT]: 'Alerta',
  [LoraPacketType.VETO]: 'Veto',
  [LoraPacketType.HASH_CHAIN]: 'Cadena',
  [LoraPacketType.HEARTBEAT]: 'Heartbeat',
  [LoraPacketType.MESH_ROUTE]: 'Ruta Mesh',
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function LoraPanel() {
  const [status, setStatus] = useState<LoraModuleStatus | null>(null);
  const [mesh, setMesh] = useState<MeshStatus | null>(null);
  const [destId, setDestId] = useState('1');
  const [alertMsg, setAlertMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    void loraModule.init();
    const unsubModule = loraModule.subscribe(setStatus);
    const unsubMesh = loraMeshManager.subscribe(setMesh);
    return () => {
      unsubModule();
      unsubMesh();
    };
  }, []);

  const handleSendAlert = async () => {
    if (!alertMsg.trim()) return;
    setSending(true);
    deviceManager.vibrate(60);
    const result = await loraModule.sendAlert(parseInt(destId, 10) || 1, alertMsg.trim());
    if (result.success) {
      setLastResult(`Alerta enviada al nodo ${destId}`);
      accessibility.processDetections([
        { label: `Alerta LoRa enviada al nodo ${destId}`, confidence: 1 },
      ]);
    } else {
      setLastResult(`Error: ${result.error ?? 'envio bloqueado'}`);
      accessibility.processDetections([
        { label: `Error de envio LoRa: ${result.error ?? 'bloqueado'}`, confidence: 1 },
      ]);
    }
    setSending(false);
    setAlertMsg('');
  };

  const handleSendHeartbeat = async () => {
    setSending(true);
    deviceManager.vibrate(60);
    const result = await loraModule.sendAlert(0xffff, 'heartbeat manual');
    setLastResult(result.success ? 'Heartbeat enviado (broadcast)' : 'Error enviando heartbeat');
    setSending(false);
  };

  const handleRotateKeys = async () => {
    const { loraCrypto } = await import('../core/LoraCrypto');
    await loraCrypto.rotateKeys();
    setLastResult('Claves rotadas');
    deviceManager.vibrate(80);
  };

  if (!status || !mesh) {
    return (
      <div className="module-content lora-panel" role="region" aria-label="Panel LoRa">
        <h2>Red Mesh LoRa (SX1262)</h2>
        <p className="loading-text">Inicializando modulo LoRa...</p>
      </div>
    );
  }

  return (
    <div className="module-content lora-panel" role="region" aria-label="Red Mesh LoRa SX1262">
      <h2>Red Mesh LoRa (SX1262)</h2>
      <p>Protocolo P2P binario, AES-128 + HMAC, CRC16-CCITT, ruteo dinamico. Offline-first.</p>

      {/* Estado del modulo */}
      <div
        className="guardian-state-banner"
        style={{ borderColor: status.initialized ? 'var(--accent)' : 'var(--text-dim)' }}
        role="status"
        aria-live="polite"
      >
        <span className="guardian-state-icon" aria-hidden="true">{'\u{1F4E1}'}</span>
        <div className="guardian-state-info">
          <strong>{status.initialized ? 'LoRa Activo' : 'LoRa Inactivo'}</strong>
          <span className="guardian-state-detail">
            Nodo {mesh.localNodeId} · {mesh.nodeCount} nodos · {mesh.routeCount} rutas ·
            {status.keyRotationNeeded ? ' Rotacion pendiente' : ' Claves OK'} ·
            {' '}Paquetes: {status.packetCount}
          </span>
        </div>
      </div>

      {/* Estadisticas */}
      <div className="orchestrator-stat-grid" role="region" aria-label="Estadisticas LoRa">
        <div className="orchestrator-stat-card">
          <span className="orchestrator-stat-label">Enviados</span>
          <span className="orchestrator-stat-value">{mesh.packetsSent}</span>
        </div>
        <div className="orchestrator-stat-card">
          <span className="orchestrator-stat-label">Recibidos</span>
          <span className="orchestrator-stat-value">{mesh.packetsReceived}</span>
        </div>
        <div className="orchestrator-stat-card">
          <span className="orchestrator-stat-label">Retransmitidos</span>
          <span className="orchestrator-stat-value">{mesh.packetsRetransmitted}</span>
        </div>
        <div className="orchestrator-stat-card">
          <span className="orchestrator-stat-label">Descartados</span>
          <span className="orchestrator-stat-value">{mesh.packetsDropped}</span>
        </div>
      </div>

      {/* Controles de envio */}
      <div className="orchestrator-section" role="region" aria-label="Enviar paquete LoRa">
        <h3>Enviar Alerta</h3>
        <div className="field-log-marker-row">
          <input
            type="text"
            className="field-log-input"
            value={destId}
            onChange={(e) => setDestId(e.target.value)}
            placeholder="ID del nodo destino"
            aria-label="ID del nodo destino"
            style={{ maxWidth: 120 }}
          />
          <input
            type="text"
            className="field-log-input"
            value={alertMsg}
            onChange={(e) => setAlertMsg(e.target.value)}
            placeholder="Mensaje de alerta"
            aria-label="Mensaje de alerta"
          />
        </div>
        <div className="guardian-controls" style={{ marginTop: 8 }}>
          <button
            className="action-btn guardian-activate-btn"
            onClick={handleSendAlert}
            disabled={sending || !alertMsg.trim()}
            aria-label="Enviar alerta por LoRa"
            style={{ minHeight: 56 }}
          >
            Enviar Alerta
          </button>
          <button
            className="action-btn"
            onClick={handleSendHeartbeat}
            disabled={sending}
            aria-label="Enviar heartbeat broadcast"
            style={{ minHeight: 56 }}
          >
            Heartbeat
          </button>
          <button
            className="action-btn"
            onClick={handleRotateKeys}
            disabled={sending}
            aria-label="Rotar claves criptograficas"
            style={{ minHeight: 56 }}
          >
            Rotar Claves
          </button>
        </div>
      </div>

      {/* Resultado */}
      {lastResult && (
        <div
          className="orchestrator-error-banner"
          style={{ borderColor: 'var(--accent)', background: 'rgba(0,255,136,0.06)' }}
          role="status"
          aria-live="polite"
        >
          <strong>{lastResult}</strong>
        </div>
      )}

      {/* Nodos descubiertos */}
      {mesh.nodes.length > 0 && (
        <div className="orchestrator-section" role="region" aria-label="Nodos descubiertos">
          <h3>Nodos ({mesh.nodes.length})</h3>
          <div className="orchestrator-node-list">
            {mesh.nodes.map((node) => (
              <div key={node.nodeId} className="orchestrator-node-row">
                <span
                  className="orchestrator-node-dot"
                  style={{ backgroundColor: node.active ? 'var(--accent)' : 'var(--text-dim)' }}
                  aria-hidden="true"
                />
                <span className="orchestrator-node-name">Nodo {node.nodeId}</span>
                <span className="orchestrator-node-type">{node.hops} hops</span>
                <span className="orchestrator-node-status" style={{ color: node.active ? 'var(--accent)' : 'var(--text-dim)' }}>
                  {node.active ? 'activo' : 'inactivo'}
                </span>
                <span className="orchestrator-node-time">{formatTime(node.lastSeen)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rutas */}
      {mesh.routes.length > 0 && (
        <div className="orchestrator-section" role="region" aria-label="Tabla de rutas">
          <h3>Rutas ({mesh.routes.length})</h3>
          <div className="orchestrator-node-list">
            {mesh.routes.map((route) => (
              <div key={route.destId} className="orchestrator-node-row">
                <span
                  className="orchestrator-node-dot"
                  style={{ backgroundColor: route.active ? 'var(--primary)' : 'var(--text-dim)' }}
                  aria-hidden="true"
                />
                <span className="orchestrator-node-name">Destino {route.destId}</span>
                <span className="orchestrator-node-type">via {route.nextHopId}</span>
                <span className="orchestrator-node-status" style={{ color: route.active ? 'var(--primary)' : 'var(--text-dim)' }}>
                  {route.hopCount} saltos
                </span>
                <span className="orchestrator-node-time">{formatTime(route.lastUsed)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tipos de paquete */}
      <div className="orchestrator-section" role="region" aria-label="Tipos de paquete soportados">
        <h3>Tipos de Paquete</h3>
        <div className="orchestrator-stat-grid">
          {Object.entries(TYPE_LABELS).map(([val, label]) => (
            <div key={val} className="orchestrator-stat-card">
              <span className="orchestrator-stat-label">0x{Number(val).toString(16).padStart(2, '0')}</span>
              <span className="orchestrator-stat-value" style={{ fontSize: '0.9rem' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
