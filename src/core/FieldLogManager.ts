import { evolis } from './EVOLIS';
import { storageService } from '../services/StorageService';

export type FieldLogEntryType = 'voice_note' | 'marker' | 'step_complete' | 'milestone';

export interface FieldLogEntry {
  id: string;
  type: FieldLogEntryType;
  label: string;
  context: string | null;
  timestamp: number;
}

export interface ChecklistStep {
  id: string;
  label: string;
  description: string;
  completed: boolean;
}

export interface Checklist {
  taskId: string;
  title: string;
  steps: ChecklistStep[];
  createdAt: number;
}

export interface FieldLogState {
  entries: FieldLogEntry[];
  checklists: Checklist[];
}

type FieldLogListener = (state: FieldLogState) => void;

const STORE_KEY = 'field_log_state';
const MAX_ENTRIES = 500;

class FieldLogManager {
  private entries: FieldLogEntry[] = [];
  private checklists: Checklist[] = [];
  private listeners = new Set<FieldLogListener>();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    try {
      await storageService.init();
      const saved = await storageService.loadState<FieldLogState>(STORE_KEY);
      if (saved) {
        this.entries = saved.entries ?? [];
        this.checklists = saved.checklists ?? [];
      }
    } catch { /* storage unavailable */ }
  }

  getRecentEntries(count: number = 50): FieldLogEntry[] {
    return this.entries.slice(0, count);
  }

  getAllChecklists(): Checklist[] {
    return [...this.checklists];
  }

  subscribe(listener: FieldLogListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  addMarker(label: string, context: string | null): void {
    const entry: FieldLogEntry = {
      id: this.generateId(),
      type: 'marker',
      label,
      context,
      timestamp: Date.now(),
    };
    this.entries.unshift(entry);
    if (this.entries.length > MAX_ENTRIES) this.entries.pop();
    void this.recordAndNotify(entry);
  }

  createChecklist(taskId: string, title: string, steps: { label: string; description: string }[]): void {
    const checklist: Checklist = {
      taskId,
      title,
      steps: steps.map((s, i) => ({
        id: `step-${i}-${Date.now()}`,
        label: s.label,
        description: s.description,
        completed: false,
      })),
      createdAt: Date.now(),
    };
    this.checklists.push(checklist);
    void this.persistAndNotify();
  }

  completeStep(taskId: string, stepId: string): void {
    const checklist = this.checklists.find((c) => c.taskId === taskId);
    if (!checklist) return;
    const step = checklist.steps.find((s) => s.id === stepId);
    if (!step || step.completed) return;
    step.completed = true;
    const entry: FieldLogEntry = {
      id: this.generateId(),
      type: 'step_complete',
      label: step.label,
      context: checklist.title,
      timestamp: Date.now(),
    };
    this.entries.unshift(entry);
    if (this.entries.length > MAX_ENTRIES) this.entries.pop();
    void this.recordAndNotify(entry);
  }

  async exportLog(): Promise<void> {
    const data = JSON.stringify({ entries: this.entries, checklists: this.checklists }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentra-fieldlog-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private getState(): FieldLogState {
    return { entries: [...this.entries], checklists: [...this.checklists] };
  }

  private async recordAndNotify(entry: FieldLogEntry): Promise<void> {
    try { await evolis.record('field_log', entry.type, entry.label); } catch { /* evolis not ready */ }
    await this.persistAndNotify();
  }

  private async persistAndNotify(): Promise<void> {
    try {
      await storageService.saveState(STORE_KEY, this.getState());
    } catch { /* storage unavailable */ }
    const state = this.getState();
    for (const listener of this.listeners) listener(state);
  }

  private generateId(): string {
    return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
  }
}

export const fieldLogManager = new FieldLogManager();
