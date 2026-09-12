/**
 * Layer0Bridge — Puente entre Capa 0 (C++/ESP32-S3) y Capa 1 (TypeScript).
 *
 * Traduce eventos binarios del firmware a objetos TypeScript.
 *
 * IMPORTANTE: Las funciones packEvent, verifyPacket, CRC16 y HMAC
 * NO se implementan aquí. Viven en src/core/LoraProtocol.ts (Prompt B).
 * Layer0Bridge solo las consumirá cuando existan.
 */

export enum Layer0EventType {
  SENSOR_READING    = 0x01,
  MORAL_BLOCK       = 0x02,
  CHAIN_ENTRY       = 0x03,
  CHAIN_VIOLATION   = 0x04,
  VETO_CHANGE       = 0x05,
  SYSTEM_STATUS     = 0x06,
}

export interface Layer0Event {
  type: Layer0EventType;
  timestamp: number;
  data: Record<string, unknown>;
  raw?: Uint8Array;
}

export interface Layer0SensorData {
  sensorType: string;
  status: string;
  values: Record<string, number | boolean>;
}

export interface Layer0MoralBlock {
  rule: string;
  reason: string;
  command: string;
}

export interface Layer0ChainEntry {
  index: number;
  hash: string;
  previousHash: string;
  data: string;
}

export interface Layer0SystemStatus {
  cycles: number;
  events: number;
  blocks: number;
  chainEntries: number;
  uptimeUs: number;
}

type ConnectionListener = (connected: boolean) => void;
type EventListener = (event: Layer0Event) => void;

export class Layer0Bridge {
  private connected = false;
  private eventQueue: Layer0Event[] = [];
  private connectionListeners = new Set<ConnectionListener>();
  private eventListeners = new Set<EventListener>();
  private commandQueue: string[] = [];
  private humanVeto = false;

  // En producción: conexión serial/USB/WebSocket al ESP32-S3
  // Por ahora: simulación de eventos del firmware
  private simulationActive = false;
  private simulationTimer: number | null = null;

  async connect(): Promise<boolean> {
    // En producción: abrir puerto serial o WebSocket al ESP32-S3
    // const port = await navigator.serial.requestPort();
    // await port.open({ baudRate: 115200 });

    // Simulación: el firmware está "conectado"
    this.connected = true;
    this.startSimulation();
    this.notifyConnection(true);
    return true;
  }

  disconnect(): void {
    this.connected = false;
    this.stopSimulation();
    this.notifyConnection(false);
  }

  isConnected(): boolean {
    return this.connected;
  }

  sendCommand(command: string): void {
    if (!this.connected) return;
    this.commandQueue.push(command);
    // En producción: escribir al puerto serial
    // port.write(encoder.encode(command + '\n'));
  }

  setHumanVeto(active: boolean): void {
    this.humanVeto = active;
    this.sendCommand(`SET_VETO:${active ? 1 : 0}`);
  }

  verifyChainIntegrity(): boolean {
    // En producción: enviar comando VERIFY_CHAIN al firmware
    // y leer la respuesta. Por ahora: simular OK.
    return true;
  }

  pollEvents(): Layer0Event[] {
    const events = [...this.eventQueue];
    this.eventQueue = [];
    return events;
  }

  onConnection(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    listener(this.connected);
    return () => this.connectionListeners.delete(listener);
  }

  onEvent(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  getPendingCommands(): string[] {
    const cmds = [...this.commandQueue];
    this.commandQueue = [];
    return cmds;
  }

  isHumanVetoActive(): boolean {
    return this.humanVeto;
  }

  // ── Simulación de eventos del firmware ────────────────────────────────
  // En producción, los eventos llegan por serial/WebSocket del ESP32-S3.
  // Aquí se simulan para que Capa 1 funcione sin hardware.

  private startSimulation(): void {
    if (this.simulationActive) return;
    this.simulationActive = true;
    let cycle = 0;
    this.simulationTimer = window.setInterval(() => {
      cycle++;

      // Simular lectura de sensor cada 3 ciclos
      if (cycle % 3 === 0) {
        this.enqueueEvent({
          type: Layer0EventType.SENSOR_READING,
          timestamp: Date.now(),
          data: {
            sensorType: 'PIR',
            status: 'ONLINE',
            values: {
              motionDetected: Math.random() > 0.7,
              sensitivity: 80,
              durationMs: Math.random() > 0.7 ? 200 : 0,
            },
          },
        });
      }

      // Simular entrada de cadena cada 5 ciclos
      if (cycle % 5 === 0) {
        const hash = Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        this.enqueueEvent({
          type: Layer0EventType.CHAIN_ENTRY,
          timestamp: Date.now(),
          data: {
            index: cycle,
            hash,
            previousHash: hash,
            data: `sensor:PIR:ts:${Date.now()}`,
          },
        });
      }

      // Simular estado del sistema cada 10 ciclos
      if (cycle % 10 === 0) {
        this.enqueueEvent({
          type: Layer0EventType.SYSTEM_STATUS,
          timestamp: Date.now(),
          data: {
            cycles: cycle * 3,
            events: cycle,
            blocks: 0,
            chainEntries: Math.floor(cycle / 5),
            uptimeUs: cycle * 50 * 1000,
          },
        });
      }
    }, 50);
  }

  private stopSimulation(): void {
    this.simulationActive = false;
    if (this.simulationTimer !== null) {
      clearInterval(this.simulationTimer);
      this.simulationTimer = null;
    }
  }

  private enqueueEvent(event: Layer0Event): void {
    this.eventQueue.push(event);
    for (const listener of this.eventListeners) listener(event);
  }

  private notifyConnection(connected: boolean): void {
    for (const listener of this.connectionListeners) listener(connected);
  }
}

export const layer0Bridge = new Layer0Bridge();
