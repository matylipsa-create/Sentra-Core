/**
 * ZeroLatencyOrchestrator — Coordinador de Capa 0 y Capa 1.
 *
 * Capa 0: firmware determinista C++/ESP-IDF en ESP32-S3 (sin GC, <1 ms).
 * Capa 1: orquestación TypeScript/Node.js (con GC, 10-50 ms).
 *
 * Este orquestador recibe eventos del firmware (Capa 0) y los procesa
 * en Capa 1 sin bloquear el ciclo determinista del firmware.
 */

import { Layer0Bridge, Layer0Event, Layer0EventType } from './Layer0Bridge';
import { Layer1Orchestrator } from './Layer1Orchestrator';
import { evolis } from './EVOLIS';
import { moralNode } from './MoralNode';

export type LayerStatus = 'disconnected' | 'connecting' | 'connected' | 'degraded' | 'error';

export interface ZeroLatencyConfig {
  pollIntervalMs: number;
  reconnectDelayMs: number;
  maxReconnectAttempts: number;
  enableChainVerification: boolean;
  chainVerifyIntervalMs: number;
}

export interface ZeroLatencyState {
  layer0Status: LayerStatus;
  layer1Status: LayerStatus;
  totalEventsProcessed: number;
  totalMoralBlocks: number;
  totalChainEntries: number;
  lastEventTimestamp: number | null;
  uptimeMs: number;
}

type ZeroLatencyListener = (state: ZeroLatencyState) => void;

const DEFAULT_CONFIG: ZeroLatencyConfig = {
  pollIntervalMs: 50,
  reconnectDelayMs: 2000,
  maxReconnectAttempts: 5,
  enableChainVerification: true,
  chainVerifyIntervalMs: 15000,
};

export class ZeroLatencyOrchestrator {
  private bridge: Layer0Bridge;
  private layer1: Layer1Orchestrator;
  private config: ZeroLatencyConfig;
  private state: ZeroLatencyState;
  private listeners = new Set<ZeroLatencyListener>();
  private pollTimer: number | null = null;
  private chainVerifyTimer: number | null = null;
  private reconnectAttempts = 0;
  private startTime = Date.now();
  private running = false;

  constructor(config: Partial<ZeroLatencyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.bridge = new Layer0Bridge();
    this.layer1 = new Layer1Orchestrator();
    this.state = {
      layer0Status: 'disconnected',
      layer1Status: 'disconnected',
      totalEventsProcessed: 0,
      totalMoralBlocks: 0,
      totalChainEntries: 0,
      lastEventTimestamp: null,
      uptimeMs: 0,
    };
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.startTime = Date.now();

    await this.connectLayer0();
    await this.layer1.start();

    this.state.layer1Status = 'connected';
    this.notify();

    this.startPolling();
    if (this.config.enableChainVerification) this.startChainVerification();
  }

  stop(): void {
    this.running = false;
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.chainVerifyTimer !== null) {
      clearInterval(this.chainVerifyTimer);
      this.chainVerifyTimer = null;
    }
    this.bridge.disconnect();
    this.layer1.stop();
    this.state.layer0Status = 'disconnected';
    this.state.layer1Status = 'disconnected';
    this.notify();
  }

  getState(): ZeroLatencyState {
    return { ...this.state, uptimeMs: Date.now() - this.startTime };
  }

  getBridge(): Layer0Bridge {
    return this.bridge;
  }

  getLayer1(): Layer1Orchestrator {
    return this.layer1;
  }

  subscribe(listener: ZeroLatencyListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  sendCommand(command: string): void {
    // Capa 1 evalúa moralmente antes de enviar a Capa 0
    const eval_ = moralNode.evaluate(command, { externalRequest: false });
    if (!eval_.allowed) {
      this.state.totalMoralBlocks++;
      this.notify();
      return;
    }
    this.bridge.sendCommand(command);
  }

  setHumanVeto(active: boolean): void {
    this.bridge.setHumanVeto(active);
  moralNode.setHumanVeto(active);
  this.notify();
  }

  private async connectLayer0(): Promise<void> {
    this.state.layer0Status = 'connecting';
    this.notify();

    try {
      const connected = await this.bridge.connect();
      if (connected) {
        this.state.layer0Status = 'connected';
        this.reconnectAttempts = 0;
      } else {
        throw new Error('Bridge connection failed');
      }
    } catch {
      this.state.layer0Status = 'degraded';
      this.scheduleReconnect();
    }
    this.notify();
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.state.layer0Status = 'error';
      this.notify();
      return;
    }
    this.reconnectAttempts++;
    setTimeout(() => {
      if (this.running) this.connectLayer0();
    }, this.config.reconnectDelayMs * this.reconnectAttempts);
  }

  private startPolling(): void {
    this.pollTimer = window.setInterval(() => this.pollLayer0(), this.config.pollIntervalMs);
  }

  private startChainVerification(): void {
    this.chainVerifyTimer = window.setInterval(
      () => this.verifyChain(),
      this.config.chainVerifyIntervalMs
    );
  }

  private pollLayer0(): void {
    if (!this.bridge.isConnected()) {
      if (this.state.layer0Status === 'connected') {
        this.state.layer0Status = 'degraded';
        this.scheduleReconnect();
        this.notify();
      }
      return;
    }

    const events = this.bridge.pollEvents();
    for (const event of events) {
      this.processLayer0Event(event);
    }
  }

  private processLayer0Event(event: Layer0Event): void {
    this.state.totalEventsProcessed++;
    this.state.lastEventTimestamp = event.timestamp;

    switch (event.type) {
      case Layer0EventType.SENSOR_READING:
        this.layer1.handleSensorEvent(event);
        break;
      case Layer0EventType.MORAL_BLOCK:
        this.state.totalMoralBlocks++;
        this.layer1.handleMoralBlock(event);
        break;
      case Layer0EventType.CHAIN_ENTRY:
        this.state.totalChainEntries++;
        this.layer1.handleChainEntry(event);
        break;
      case Layer0EventType.CHAIN_VIOLATION:
        this.layer1.handleChainViolation(event);
        break;
      case Layer0EventType.VETO_CHANGE:
        this.layer1.handleVetoChange(event);
        break;
      case Layer0EventType.SYSTEM_STATUS:
        this.layer1.handleSystemStatus(event);
        break;
    }
    this.notify();
  }

  private async verifyChain(): Promise<void> {
    const layer0Valid = this.bridge.verifyChainIntegrity();
    const layer1Valid = await evolis.verify();
    if (!layer0Valid || !layer1Valid) {
      this.state.layer0Status = layer0Valid ? this.state.layer0Status : 'error';
      this.notify();
    }
  }

  private notify(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) listener(snapshot);
  }
}

export const zeroLatencyOrchestrator = new ZeroLatencyOrchestrator();
