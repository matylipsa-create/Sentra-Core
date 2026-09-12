/**
 * LoraMeshManager — Gestor mesh P2P LoRa: descubrimiento, ruteo, retransmisión.
 *
 * Espejo TypeScript de firmware/lora_mesh.cpp. Sin hardware, opera con
 * simulación para que Capa 1 funcione offline.
 */

import {
  LoraPacketType,
  packEvent,
  verifyPacket,
  serializePacket,
  deserializePacket,
  generateNonce,
  type LoraPacket,
} from './LoraProtocol';
import { loraCrypto } from './LoraCrypto';
import { moralNode } from './MoralNode';
import { evolis } from './EVOLIS';

export interface MeshNode {
  nodeId: number;
  rssi: number;
  lastSeen: number;
  active: boolean;
  hops: number;
}

export interface RouteEntry {
  destId: number;
  nextHopId: number;
  hopCount: number;
  lastUsed: number;
  active: boolean;
}

export interface MeshStatus {
  localNodeId: number;
  nodeCount: number;
  routeCount: number;
  nodes: MeshNode[];
  routes: RouteEntry[];
  packetsSent: number;
  packetsReceived: number;
  packetsRetransmitted: number;
  packetsDropped: number;
}

type MeshListener = (status: MeshStatus) => void;

const MAX_NODES = 32;
const MAX_ROUTES = 8;
const MAX_HOPS = 6;
const HEARTBEAT_MS = 30_000;
const NODE_TIMEOUT_MS = 90_000;

export class LoraMeshManager {
  private localNodeId: number;
  private nodes: Map<number, MeshNode> = new Map();
  private routes: Map<number, RouteEntry> = new Map();
  private listeners = new Set<MeshListener>();
  private heartbeatTimer: number | null = null;
  private packetsSent = 0;
  private packetsReceived = 0;
  private packetsRetransmitted = 0;
  private packetsDropped = 0;
  private initialized = false;

  constructor(localNodeId?: number) {
    this.localNodeId = localNodeId ?? this.generateNodeId();
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    await loraCrypto.init();
    this.startHeartbeat();
  }

  private generateNodeId(): number {
    return Math.floor(Math.random() * 0xffff) + 1;
  }

  getLocalNodeId(): number {
    return this.localNodeId;
  }

  // ── Registro de nodos ─────────────────────────────────────────────────

  registerNode(nodeId: number, rssi: number, hops: number): void {
    const existing = this.nodes.get(nodeId);
    if (existing) {
      existing.rssi = rssi;
      existing.lastSeen = Date.now();
      existing.active = true;
      existing.hops = hops;
    } else if (this.nodes.size < MAX_NODES) {
      this.nodes.set(nodeId, {
        nodeId,
        rssi,
        lastSeen: Date.now(),
        active: true,
        hops,
      });
    }
    this.notify();
  }

  updateRoute(destId: number, nextHopId: number, hopCount: number): void {
    const existing = this.routes.get(destId);
    if (existing) {
      existing.nextHopId = nextHopId;
      existing.hopCount = hopCount;
      existing.lastUsed = Date.now();
      existing.active = true;
    } else if (this.routes.size < MAX_ROUTES) {
      this.routes.set(destId, {
        destId,
        nextHopId,
        hopCount,
        lastUsed: Date.now(),
        active: true,
      });
    }
    this.notify();
  }

  findRoute(destId: number): { nextHopId: number; hopCount: number } | null {
    const route = this.routes.get(destId);
    if (route && route.active) {
      return { nextHopId: route.nextHopId, hopCount: route.hopCount };
    }

    const node = this.nodes.get(destId);
    if (node && node.active) {
      return { nextHopId: destId, hopCount: 1 };
    }

    return null;
  }

  findAlternateRoute(destId: number, excludeHop: number): { nextHopId: number; hopCount: number } | null {
    for (const node of this.nodes.values()) {
      if (!node.active) continue;
      if (node.nodeId === destId || node.nodeId === excludeHop) continue;
      if (node.hops >= MAX_HOPS) continue;
      return { nextHopId: node.nodeId, hopCount: node.hops + 1 };
    }
    return null;
  }

  pruneStaleNodes(): void {
    const now = Date.now();
    for (const [id, node] of this.nodes) {
      if (node.active && now - node.lastSeen > NODE_TIMEOUT_MS) {
        node.active = false;
        for (const route of this.routes.values()) {
          if (route.nextHopId === id) route.active = false;
        }
      }
    }
    this.notify();
  }

  // ── Envío de paquetes ─────────────────────────────────────────────────

  async sendPacket(
    type: LoraPacketType,
    destId: number,
    payloadData: Uint8Array,
  ): Promise<LoraPacket | null> {
    const eval_ = moralNode.evaluate(`lora:send:${type}:${destId}`);
    if (!eval_.allowed) return null;

    const payload = new Uint8Array(40);
    const dv = new DataView(payload.buffer);
    dv.setUint16(0, destId, true);
    const copyLen = Math.min(payloadData.length, 38);
    payload.set(payloadData.subarray(0, copyLen), 2);

    const pkt = packEvent(type, this.localNodeId, payload);

    pkt.nonce = generateNonce();
    const encrypted = await loraCrypto.encryptPayload(pkt.payload, pkt.nonce);
    pkt.payload = encrypted;

    const serialized = serializePacket(pkt);
    pkt.hmac = await loraCrypto.computePacketHmac(serialized);

    await evolis.record('lora', 'send', `${type}:${destId}`);
    loraCrypto.incrementPacketCount();
    this.packetsSent++;

    if (loraCrypto.needsKeyRotation()) {
      await loraCrypto.rotateKeys();
    }

    this.notify();
    return pkt;
  }

  // ── Recepción de paquetes ─────────────────────────────────────────────

  async receivePacket(rawData: Uint8Array): Promise<LoraPacket | null> {
    if (rawData.length !== 74) {
      this.packetsDropped++;
      this.notify();
      return null;
    }

    const pkt = deserializePacket(rawData);
    if (!verifyPacket(pkt)) {
      this.packetsDropped++;
      this.notify();
      return null;
    }

    if (!loraCrypto.isNonceFresh(pkt.nonce)) {
      this.packetsDropped++;
      this.notify();
      return null;
    }

    const serialized = serializePacket(pkt);
    const hmacValid = await loraCrypto.verifyPacketHmac(serialized, pkt.hmac);
    if (!hmacValid) {
      this.packetsDropped++;
      this.notify();
      return null;
    }

    pkt.payload = await loraCrypto.decryptPayload(pkt.payload, pkt.nonce);

    this.packetsReceived++;
    this.registerNode(pkt.nodeId, -50, 1);
    await evolis.record('lora', 'receive', `${pkt.type}:${pkt.nodeId}`);

    this.notify();
    return pkt;
  }

  // ── Heartbeat ─────────────────────────────────────────────────────────

  private startHeartbeat(): void {
    if (this.heartbeatTimer !== null) return;
    this.heartbeatTimer = window.setInterval(() => {
      void this.sendHeartbeat();
      this.pruneStaleNodes();
    }, HEARTBEAT_MS);
  }

  stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async sendHeartbeat(): Promise<void> {
    const payload = new Uint8Array(40);
    const dv = new DataView(payload.buffer);
    dv.setUint16(0, 0xffff, true);
    dv.setUint16(2, this.nodes.size, true);
    payload[4] = 50;
    await this.sendPacket(LoraPacketType.HEARTBEAT, 0xffff, payload);
  }

  // ── Estado y suscripciones ────────────────────────────────────────────

  getStatus(): MeshStatus {
    return {
      localNodeId: this.localNodeId,
      nodeCount: this.nodes.size,
      routeCount: this.routes.size,
      nodes: Array.from(this.nodes.values()),
      routes: Array.from(this.routes.values()),
      packetsSent: this.packetsSent,
      packetsReceived: this.packetsReceived,
      packetsRetransmitted: this.packetsRetransmitted,
      packetsDropped: this.packetsDropped,
    };
  }

  subscribe(listener: MeshListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const status = this.getStatus();
    for (const listener of this.listeners) listener(status);
  }

  dispose(): void {
    this.stopHeartbeat();
    this.listeners.clear();
    this.nodes.clear();
    this.routes.clear();
  }
}

export const loraMeshManager = new LoraMeshManager();
