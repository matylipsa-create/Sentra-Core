/**
 * Layer1Orchestrator — Orquestador de Capa 1 (TypeScript / Node.js).
 *
 * Procesa eventos de alto nivel (UI, n8n, registro) sin bloquear Capa 0.
 * Capa 1 puede usar GC: latencia 10-50 ms es aceptable.
 */

import { Layer0Event, Layer0EventType } from './Layer0Bridge';
import { evolis } from './EVOLIS';
import { offlineLogger } from './OfflineLogger';
import { actionDispatcher } from './ActionDispatcher';

export type Layer1Status = 'idle' | 'running' | 'paused' | 'error';

export interface Layer1State {
  status: Layer1Status;
  totalSensorEvents: number;
  totalMoralBlocks: number;
  totalChainEntries: number;
  totalChainViolations: number;
  totalVetoChanges: number;
  totalSystemStatuses: number;
  lastProcessedTimestamp: number | null;
  queueDepth: number;
}

type Layer1Listener = (state: Layer1State) => void;

const MAX_QUEUE_DEPTH = 500;

export class Layer1Orchestrator {
  private state: Layer1State = {
    status: 'idle',
    totalSensorEvents: 0,
    totalMoralBlocks: 0,
    totalChainEntries: 0,
    totalChainViolations: 0,
    totalVetoChanges: 0,
    totalSystemStatuses: 0,
    lastProcessedTimestamp: null,
    queueDepth: 0,
  };

  private listeners = new Set<Layer1Listener>();
  private eventQueue: Layer0Event[] = [];
  private processing = false;
  private flushTimer: number | null = null;

  async start(): Promise<void> {
    this.state.status = 'running';
    this.startFlushLoop();
    this.notify();
  }

  stop(): void {
    this.state.status = 'paused';
    if (this.flushTimer !== null) { clearInterval(this.flushTimer); this.flushTimer = null; }
    this.notify();
  }

  getState(): Layer1State { return { ...this.state }; }

  subscribe(listener: Layer1Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  handleSensorEvent(event: Layer0Event): void {
    this.enqueue(event);
    this.state.totalSensorEvents++;
    this.notify();
  }

  handleMoralBlock(event: Layer0Event): void {
    this.enqueue(event);
    this.state.totalMoralBlocks++;
    offlineLogger.log({
      type: 'moral_block_layer0',
      message: `Capa 0 blocked: ${event.data['reason'] ?? 'unknown'}`,
      level: 'warning',
      data: event.data,
    });
    this.notify();
  }

  handleChainEntry(event: Layer0Event): void {
    this.enqueue(event);
    this.state.totalChainEntries++;
    void evolis.record('layer0', 'chain_entry', JSON.stringify(event.data));
    this.notify();
  }

  handleChainViolation(event: Layer0Event): void {
    this.enqueue(event);
    this.state.totalChainViolations++;
    offlineLogger.log({
      type: 'chain_violation',
      message: 'EVOLIS chain violation detected in Capa 0',
      level: 'critical',
      data: event.data,
    });
    actionDispatcher.sendAlert('critical', 'Violacion de cadena EVOLIS en Capa 0');
    this.notify();
  }

  handleVetoChange(event: Layer0Event): void {
    this.enqueue(event);
    this.state.totalVetoChanges++;
    offlineLogger.log({
      type: 'veto_change',
      message: `Veto humano cambiado en Capa 0: ${event.data['active'] ? 'ON' : 'OFF'}`,
      level: 'info',
      data: event.data,
    });
    this.notify();
  }

  handleSystemStatus(event: Layer0Event): void {
    this.enqueue(event);
    this.state.totalSystemStatuses++;
    this.notify();
  }

  private enqueue(event: Layer0Event): void {
    if (this.eventQueue.length >= MAX_QUEUE_DEPTH) {
      this.eventQueue.shift();
    }
    this.eventQueue.push(event);
    this.state.queueDepth = this.eventQueue.length;
  }

  private startFlushLoop(): void {
    this.flushTimer = window.setInterval(() => this.flush(), 50);
  }

  private flush(): void {
    if (this.processing || this.eventQueue.length === 0) return;
    this.processing = true;

    const batch = this.eventQueue.splice(0, Math.min(20, this.eventQueue.length));
    this.state.queueDepth = this.eventQueue.length;

    for (const event of batch) {
      this.processEvent(event);
    }

    this.processing = false;
    this.notify();
  }

  private processEvent(event: Layer0Event): void {
    this.state.lastProcessedTimestamp = event.timestamp;

    switch (event.type) {
      case Layer0EventType.SENSOR_READING:
        this.processSensorReading(event);
        break;
      case Layer0EventType.CHAIN_ENTRY:
        break;
      case Layer0EventType.CHAIN_VIOLATION:
        break;
      case Layer0EventType.SYSTEM_STATUS:
        this.processSystemStatus(event);
        break;
      default:
        break;
    }
  }

  private processSensorReading(event: Layer0Event): void {
    const sensorType = event.data['sensorType'] as string;
    const status = event.data['status'] as string;
    const values = event.data['values'] as Record<string, unknown>;

    offlineLogger.log({
      type: 'layer0_sensor',
      message: `Sensor ${sensorType}: ${status}`,
      level: 'info',
      data: values,
    });

    if (sensorType === 'PIR' && values['motionDetected'] === true) {
      actionDispatcher.dispatch({
        type: 'alert',
        level: 'warning',
        message: 'Movimiento detectado por Capa 0 (PIR)',
        category: 'motion',
      });
    }
  }

  private processSystemStatus(event: Layer0Event): void {
    const cycles = event.data['cycles'] as number;
    const events = event.data['events'] as number;
    const blocks = event.data['blocks'] as number;
    const chainEntries = event.data['chainEntries'] as number;

    offlineLogger.log({
      type: 'layer0_status',
      message: `Capa 0: ${cycles} ciclos, ${events} eventos, ${blocks} bloqueos, ${chainEntries} entradas`,
      level: 'info',
      data: event.data,
    });
  }

  private notify(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) listener(snapshot);
  }
}

export const layer1Orchestrator = new Layer1Orchestrator();
