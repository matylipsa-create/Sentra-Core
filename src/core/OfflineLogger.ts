/**
 * OfflineLogger — Logger offline con trazabilidad inalterable.
 *
 * Registra eventos en EVOLIS (hash chain) y en memoria local.
 * Reemplaza las hojas de calculo externas y logs de n8n.
 */

import { evolis } from './EVOLIS';
import { storageService } from '../services/StorageService';

export interface LogEntry {
  id: string;
  type: string;
  message: string;
  level: 'info' | 'warning' | 'critical';
  timestamp: number;
  data?: Record<string, unknown>;
  evolisRecorded: boolean;
}

type LogListener = (entry: LogEntry) => void;

const STORE_KEY = 'offline_logs';
const MAX_IN_MEMORY = 500;

class OfflineLogger {
  private entries: LogEntry[] = [];
  private listeners = new Set<LogListener>();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    try {
      await storageService.init();
      const saved = await storageService.loadState<LogEntry[]>(STORE_KEY);
      if (saved && Array.isArray(saved)) {
        this.entries = saved;
      }
    } catch {
      // storage may be unavailable
    }
  }

  log(event: {
    type: string;
    message: string;
    level?: LogEntry['level'];
    data?: unknown;
    error?: string;
  }): void {
    const entry: LogEntry = {
      id: this.generateId(),
      type: event.type,
      message: event.error ?? event.message,
      level: event.level ?? 'info',
      timestamp: Date.now(),
      data: event.data as Record<string, unknown> | undefined,
      evolisRecorded: false,
    };

    this.entries.unshift(entry);
    if (this.entries.length > MAX_IN_MEMORY) this.entries.pop();

    void this.recordInEvolis(entry);
    void this.persist();

    for (const listener of this.listeners) listener(entry);
  }

  exportLogs(): string {
    return JSON.stringify(this.entries, null, 2);
  }

  async verifyIntegrity(): Promise<boolean> {
    return evolis.verify();
  }

  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  getRecentEntries(count: number = 50): LogEntry[] {
    return this.entries.slice(0, count);
  }

  getEntriesByType(type: string): LogEntry[] {
    return this.entries.filter((e) => e.type === type);
  }

  subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  clear(): void {
    this.entries = [];
    void this.persist();
  }

  private async recordInEvolis(entry: LogEntry): Promise<void> {
    try {
      await evolis.record('logger', entry.type, JSON.stringify({
        message: entry.message,
        level: entry.level,
      }));
      entry.evolisRecorded = true;
    } catch {
      // EVOLIS may not be initialized
    }
  }

  private async persist(): Promise<void> {
    try {
      await storageService.init();
      await storageService.saveState(STORE_KEY, this.entries);
    } catch {
      // storage may be unavailable
    }
  }

  private generateId(): string {
    return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
  }
}

export const offlineLogger = new OfflineLogger();
