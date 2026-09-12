/**
 * LoraModule — Módulo LoRa de alto nivel que integra protocol, crypto y mesh.
 *
 * Expone funciones simplificadas para enviar alertas, detecciones y
 * vetos a través de la red mesh P2P LoRa (SX1262).
 */

import { loraMeshManager, type MeshStatus } from '../core/LoraMeshManager';
import { LoraPacketType, type LoraPacket } from '../core/LoraProtocol';
import { loraCrypto } from '../core/LoraCrypto';
import { alertModule } from './AlertModule';
import { evolis } from '../core/EVOLIS';

export interface LoraSendResult {
  success: boolean;
  packet: LoraPacket | null;
  error?: string;
}

export interface LoraModuleStatus {
  initialized: boolean;
  cryptoReady: boolean;
  mesh: MeshStatus;
  keyRotationNeeded: boolean;
  packetCount: number;
}

type LoraModuleListener = (status: LoraModuleStatus) => void;

class LoraModule {
  private initialized = false;
  private listeners = new Set<LoraModuleListener>();

  async init(): Promise<void> {
    if (this.initialized) return;
    await loraCrypto.init();
    await loraMeshManager.init();
    this.initialized = true;
    this.notify();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // ── Envío de alto nivel ───────────────────────────────────────────────

  async sendAlert(destId: number, message: string): Promise<LoraSendResult> {
    await this.ensureInit();
    const payload = this.encodeText(message, 38);
    const pkt = await loraMeshManager.sendPacket(LoraPacketType.ALERT, destId, payload);
    if (pkt) {
      return { success: true, packet: pkt };
    }
    return { success: false, packet: null, error: 'MoralNode bloqueo el envio' };
  }

  async sendDetection(destId: number, label: string, confidence: number): Promise<LoraSendResult> {
    await this.ensureInit();
    const payload = new Uint8Array(38);
    const text = this.encodeText(label, 20);
    payload.set(text, 0);
    const dv = new DataView(payload.buffer);
    dv.setFloat32(20, confidence, true);
    const pkt = await loraMeshManager.sendPacket(LoraPacketType.DETECTION, destId, payload);
    if (pkt) {
      return { success: true, packet: pkt };
    }
    return { success: false, packet: null, error: 'MoralNode bloqueo el envio' };
  }

  async sendVeto(destId: number, vetoActive: boolean): Promise<LoraSendResult> {
    await this.ensureInit();
    const payload = new Uint8Array(38);
    payload[0] = vetoActive ? 1 : 0;
    const pkt = await loraMeshManager.sendPacket(LoraPacketType.VETO, destId, payload);
    if (pkt) {
      return { success: true, packet: pkt };
    }
    return { success: false, packet: null, error: 'MoralNode bloqueo el envio' };
  }

  async sendHashChainEntry(destId: number, index: number, hashHex: string): Promise<LoraSendResult> {
    await this.ensureInit();
    const payload = new Uint8Array(38);
    const dv = new DataView(payload.buffer);
    dv.setUint32(0, index, true);
    const hashBytes = this.hexToBytes(hashHex, 32);
    payload.set(hashBytes, 4);
    const pkt = await loraMeshManager.sendPacket(LoraPacketType.HASH_CHAIN, destId, payload);
    if (pkt) {
      return { success: true, packet: pkt };
    }
    return { success: false, packet: null, error: 'MoralNode bloqueo el envio' };
  }

  // ── Recepción de alto nivel ───────────────────────────────────────────

  async receive(rawData: Uint8Array): Promise<LoraPacket | null> {
    await this.ensureInit();
    const pkt = await loraMeshManager.receivePacket(rawData);
    if (!pkt) return null;

    const destId = this.extractDestId(pkt);
    if (destId === 0xffff || destId === loraMeshManager.getLocalNodeId()) {
      this.handleIncomingPacket(pkt);
    }
    return pkt;
  }

  private handleIncomingPacket(pkt: LoraPacket): void {
    const type = pkt.type as LoraPacketType;
    switch (type) {
      case LoraPacketType.ALERT: {
        const text = this.decodeText(pkt.payload.subarray(2, 40));
        alertModule.alert('warning', `LoRa: ${text}`, `node:${pkt.nodeId}`);
        break;
      }
      case LoraPacketType.DETECTION: {
        const label = this.decodeText(pkt.payload.subarray(2, 22));
        const dv = new DataView(pkt.payload.buffer, pkt.payload.byteOffset + 22, 4);
        const confidence = dv.getFloat32(0, true);
        void evolis.record('lora', 'detection', `${label}:${confidence}`);
        break;
      }
      case LoraPacketType.VETO: {
        const vetoActive = pkt.payload[2] === 1;
        void evolis.record('lora', 'veto', `node:${pkt.nodeId}:${vetoActive}`);
        alertModule.alert('info', `Nodo ${pkt.nodeId}: veto ${vetoActive ? 'ON' : 'OFF'}`, `node:${pkt.nodeId}`);
        break;
      }
      case LoraPacketType.HEARTBEAT: {
        // Heartbeat ya actualiza la tabla de nodos en receivePacket
        break;
      }
      default:
        break;
    }
  }

  // ── Estado ────────────────────────────────────────────────────────────

  getStatus(): LoraModuleStatus {
    return {
      initialized: this.initialized,
      cryptoReady: loraCrypto.getPacketCount() >= 0,
      mesh: loraMeshManager.getStatus(),
      keyRotationNeeded: loraCrypto.needsKeyRotation(),
      packetCount: loraCrypto.getPacketCount(),
    };
  }

  subscribe(listener: LoraModuleListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    loraMeshManager.dispose();
    this.listeners.clear();
    this.initialized = false;
  }

  // ── Utilidades internas ───────────────────────────────────────────────

  private async ensureInit(): Promise<void> {
    if (!this.initialized) await this.init();
  }

  private encodeText(text: string, maxLen: number): Uint8Array {
    const encoded = new TextEncoder().encode(text);
    const result = new Uint8Array(maxLen);
    const copyLen = Math.min(encoded.length, maxLen);
    result.set(encoded.subarray(0, copyLen));
    return result;
  }

  private decodeText(data: Uint8Array): string {
    const end = data.indexOf(0);
    const slice = end >= 0 ? data.subarray(0, end) : data;
    return new TextDecoder().decode(slice);
  }

  private hexToBytes(hex: string, maxLen: number): Uint8Array {
    const result = new Uint8Array(maxLen);
    for (let i = 0; i < Math.min(hex.length / 2, maxLen); i++) {
      result[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return result;
  }

  private extractDestId(pkt: LoraPacket): number {
    const dv = new DataView(pkt.payload.buffer, pkt.payload.byteOffset, 2);
    return dv.getUint16(0, true);
  }

  private notify(): void {
    const status = this.getStatus();
    for (const listener of this.listeners) listener(status);
  }
}

export const loraModule = new LoraModule();
