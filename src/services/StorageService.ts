import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { EVOLISEvidence } from '../core/EVOLIS';

interface SentraDB extends DBSchema {
  evolis: { key: string; value: EVOLISEvidence };
  state: { key: string; value: unknown };
  settings: { key: string; value: unknown };
}

const DB_NAME = 'sentra-core';
const DB_VERSION = 1;

export class StorageService {
  private db: IDBPDatabase<SentraDB> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    this.db = await openDB<SentraDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('evolis'))
          db.createObjectStore('evolis', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('state'))
          db.createObjectStore('state');
        if (!db.objectStoreNames.contains('settings'))
          db.createObjectStore('settings');
      },
    });
  }

  async saveEvidence(evidence: EVOLISEvidence): Promise<void> {
    await this.init();
    await this.db!.put('evolis', evidence);
  }

  async getAllEvidence(): Promise<EVOLISEvidence[]> {
    await this.init();
    return this.db!.getAll('evolis');
  }

  async clearEvidence(): Promise<void> {
    await this.init();
    await this.db!.clear('evolis');
  }

  async saveState(key: string, value: unknown): Promise<void> {
    await this.init();
    await this.db!.put('state', value, key);
  }

  async loadState<T>(key: string): Promise<T | undefined> {
    await this.init();
    return this.db!.get('state', key) as Promise<T | undefined>;
  }

  async saveSetting(key: string, value: unknown): Promise<void> {
    await this.init();
    await this.db!.put('settings', value, key);
  }

  async loadSetting<T>(key: string): Promise<T | undefined> {
    await this.init();
    return this.db!.get('settings', key) as Promise<T | undefined>;
  }

  async exportAll(): Promise<{
    evidence: EVOLISEvidence[];
    state: { key: string; value: unknown }[];
    settings: { key: string; value: unknown }[];
  }> {
    await this.init();
    const evidence = await this.db!.getAll('evolis');
    const stateKeys = await this.db!.getAllKeys('state');
    const state = await Promise.all(
      stateKeys.map(async (key) => ({ key: key as string, value: await this.db!.get('state', key) }))
    );
    const settingKeys = await this.db!.getAllKeys('settings');
    const settings = await Promise.all(
      settingKeys.map(async (key) => ({ key: key as string, value: await this.db!.get('settings', key) }))
    );
    return { evidence, state, settings };
  }

  async importAll(data: {
    evidence: EVOLISEvidence[];
    state: { key: string; value: unknown }[];
    settings: { key: string; value: unknown }[];
  }): Promise<void> {
    await this.init();
    await this.db!.clear('evolis');
    for (const e of data.evidence) await this.db!.put('evolis', e);
    await this.db!.clear('state');
    for (const s of data.state) await this.db!.put('state', s.value, s.key);
    await this.db!.clear('settings');
    for (const s of data.settings) await this.db!.put('settings', s.value, s.key);
  }

  async downloadExport(): Promise<void> {
    const data = await this.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentra-core-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export const storageService = new StorageService();
