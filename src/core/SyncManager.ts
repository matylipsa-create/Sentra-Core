export type SyncTransport = 'syncthing' | 'bluetooth_mesh' | 'lora' | 'offline';

export interface SyncPeer {
  id: string;
  name: string;
  transport: SyncTransport;
  lastSeen: number;
  connected: boolean;
}

export interface SyncPacket {
  id: string;
  sourceId: string;
  targetId: string | null;
  module: string;
  payload: unknown;
  timestamp: number;
  signature: string;
}

export interface SyncStatus {
  transport: SyncTransport;
  peers: SyncPeer[];
  pendingPackets: number;
  syncedPackets: number;
  lastSync: number | null;
}

export class SyncManager {
  private peers: Map<string, SyncPeer> = new Map();
  private pending: SyncPacket[] = [];
  private synced: SyncPacket[] = [];
  private transport: SyncTransport = 'offline';
  private deviceId: string;

  constructor(deviceId: string) {
    this.deviceId = deviceId;
  }

  setTransport(transport: SyncTransport): void {
    this.transport = transport;
  }

  getTransport(): SyncTransport {
    return this.transport;
  }

  registerPeer(peer: SyncPeer): void {
    this.peers.set(peer.id, peer);
  }

  removePeer(id: string): void {
    this.peers.delete(id);
  }

  getPeers(): SyncPeer[] {
    return Array.from(this.peers.values());
  }

  enqueue(packet: Omit<SyncPacket, 'id' | 'sourceId' | 'timestamp' | 'signature'>): SyncPacket {
    const full: SyncPacket = {
      ...packet,
      id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
      sourceId: this.deviceId,
      timestamp: Date.now(),
      signature: 'pending',
    };
    this.pending.push(full);
    return full;
  }

  async sync(): Promise<number> {
    if (this.transport === 'offline' || this.peers.size === 0) return 0;
    const toSync = [...this.pending];
    this.pending = [];
    for (const packet of toSync) {
      packet.signature = `sync_${this.transport}_${packet.id}`;
      this.synced.push(packet);
    }
    return toSync.length;
  }

  getStatus(): SyncStatus {
    return {
      transport: this.transport,
      peers: this.getPeers(),
      pendingPackets: this.pending.length,
      syncedPackets: this.synced.length,
      lastSync: this.synced.length > 0
        ? this.synced[this.synced.length - 1].timestamp : null,
    };
  }

  getSyncedPackets(): SyncPacket[] {
    return [...this.synced];
  }

  clearSynced(): void {
    this.synced = [];
  }
}

export const syncManager = new SyncManager(
  crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)
);
