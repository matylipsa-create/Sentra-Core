/**
 * LogModule — Modulo de registro local.
 *
 * Reemplaza las hojas de calculo externas y logs remotos de n8n.
 * Registra eventos en EVOLIS (hash chain) y permite exportacion local.
 */

import { evolis } from '../core/EVOLIS';
import { offlineLogger } from '../core/OfflineLogger';
import { storageService } from '../services/StorageService';

export interface LogModuleEntry {
  id: string;
  type: string;
  message: string;
  level: 'info' | 'warning' | 'critical';
  timestamp: number;
  data?: Record<string, unknown>;
  evolisHash?: string;
}

type LogModuleListener = (entries: LogModuleEntry[]) => void;

const STORE_KEY = 'log_module_entries';
const MAX_ENTRIES = 1000;

class LogModule {
  private entries: LogModuleEntry[] = [];
  private listeners = new Set<LogModuleListener>();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    try {
      await storageService.init();
      const saved = await storageService.loadState<LogModuleEntry[]>(STORE_KEY);
      if (saved && Array.isArray(saved)) {
        this.entries = saved;
      }
    } catch {
      // storage unavailable
    }
  }

  logEvent(event: {
    type: string;
    message: string;
    level?: LogModuleEntry['level'];
    data?: Record<string, unknown>;
  }): void {
    const entry: LogModuleEntry = {
      id: this.generateId(),
      type: event.type,
      message: event.message,
      level: event.level ?? 'info',
      timestamp: Date.now(),
      data: event.data,
    };

    this.entries.unshift(entry);
    if (this.entries.length > MAX_ENTRIES) this.entries.pop();

    void this.recordInEvolis(entry);
    offlineLogger.log({
      type: event.type,
      message: event.message,
      level: event.level ?? 'info',
      data: event.data,
    });

    void this.persist();
    this.notify();
  }

  async exportToFile(): Promise<void> {
    const data = JSON.stringify(this.entries, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentra-log-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async verifyChain(): Promise<boolean> {
    return evolis.verify();
  }

  getEntries(): LogModuleEntry[] {
    return [...this.entries];
  }

  getRecentEntries(count: number = 50): LogModuleEntry[] {
    return this.entries.slice(0, count);
  }

  subscribe(listener: LogModuleListener): () => void {
    this.listeners.add(listener);
    listener(this.getEntries());
    return () => this.listeners.delete(listener);
  }

  clear(): void {
    this.entries = [];
    void this.persist();
    this.notify();
  }

  private async recordInEvolis(entry: LogModuleEntry): Promise<void> {
    try {
      const evidence = await evolis.record('log_module', entry.type, JSON.stringify({
        message: entry.message,
        level: entry.level,
      }));
      entry.evolisHash = evidence.entry.hash;
    } catch {
      // EVOLIS may not be ready
    }
  }

  private async persist(): Promise<void> {
    try {
      await storageService.init();
      await storageService.saveState(STORE_KEY, this.entries);
    } catch {
      // storage unavailable
    }
  }

  private notify(): void {
    const snapshot = this.getEntries();
    for (const listener of this.listeners) listener(snapshot);
  }

  private generateId(): string {
    return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
  }
}

export const logModule = new LogModule();
