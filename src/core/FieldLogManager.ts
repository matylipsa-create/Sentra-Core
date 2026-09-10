import { evolis } from './EVOLIS';
import { voiceManager } from '../services/VoiceManager';
import { storageService } from '../services/StorageService';

export interface FieldLogEntry {
  id: string;
  type: 'voice_note' | 'marker' | 'step_complete' | 'milestone';
  label: string;
  context: string;
  timestamp: number;
  audioBlobId: string | null;
  location: { lat: number; lon: number } | null;
}

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  order: number;
}

export interface Checklist {
  id: string;
  taskId: string;
  title: string;
  steps: ChecklistItem[];
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
  private checklists: Map<string, Checklist> = new Map();
  private listeners = new Set<FieldLogListener>();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    try {
      const saved = await storageService.loadState<FieldLogState>(STORE_KEY);
      if (saved) {
        this.entries = saved.entries ?? [];
        if (saved.checklists) {
          for (const cl of saved.checklists) this.checklists.set(cl.taskId, cl);
        }
      }
    } catch { /* storage unavailable */ }
  }

  async addVoiceNote(audio: Blob, context: string): Promise<FieldLogEntry> {
    const audioBlobId = `audio-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      await storageService.saveState(`audio_${audioBlobId}`, audio);
    } catch { /* storage unavailable */ }

    const entry: FieldLogEntry = {
      id: this.generateId(),
      type: 'voice_note',
      label: 'Nota de voz',
      context,
      timestamp: Date.now(),
      audioBlobId,
      location: null,
    };
    this.addEntry(entry);
    await evolis.record('bitacora', 'voice_note', context);
    voiceManager.speak('Nota de voz registrada', 3);
    return entry;
  }

  async addMarker(label: string, location: { lat: number; lon: number } | null): Promise<FieldLogEntry> {
    const entry: FieldLogEntry = {
      id: this.generateId(),
      type: 'marker',
      label,
      context: `Marcador: ${label}`,
      timestamp: Date.now(),
      audioBlobId: null,
      location,
    };
    this.addEntry(entry);
    await evolis.record('bitacora', 'marker', label);
    voiceManager.speak(`Marcador ${label} agregado`, 3);
    return entry;
  }

  getChecklist(taskId: string): ChecklistItem[] {
    const checklist = this.checklists.get(taskId);
    return checklist ? [...checklist.steps] : [];
  }

  createChecklist(taskId: string, title: string, steps: { label: string; description: string }[]): void {
    const checklist: Checklist = {
      id: this.generateId(),
      taskId,
      title,
      createdAt: Date.now(),
      steps: steps.map((s, i) => ({
        id: `step-${i}`,
        label: s.label,
        description: s.description,
        completed: false,
        order: i,
      })),
    };
    this.checklists.set(taskId, checklist);
    this.notify();
    this.persist();
    voiceManager.speak(`Checklist ${title} creado con ${steps.length} pasos`, 3);
  }

  completeStep(taskId: string, stepId: string): void {
    const checklist = this.checklists.get(taskId);
    if (!checklist) return;
    const step = checklist.steps.find((s) => s.id === stepId);
    if (!step) return;
    step.completed = true;
    const allDone = checklist.steps.every((s) => s.completed);
    const entry: FieldLogEntry = {
      id: this.generateId(),
      type: 'step_complete',
      label: step.label,
      context: `Paso completado: ${step.label}`,
      timestamp: Date.now(),
      audioBlobId: null,
      location: null,
    };
    this.addEntry(entry);
    if (allDone) {
      const milestone: FieldLogEntry = {
        id: this.generateId(),
        type: 'milestone',
        label: checklist.title,
        context: `Checklist completado: ${checklist.title}`,
        timestamp: Date.now(),
        audioBlobId: null,
        location: null,
      };
      this.addEntry(milestone);
      voiceManager.speak(`Checklist ${checklist.title} completado`, 2);
    } else {
      voiceManager.speak(`Paso ${step.label} completado`, 3);
    }
    this.notify();
    this.persist();
  }

  getEntries(): FieldLogEntry[] {
    return [...this.entries];
  }

  getRecentEntries(count: number = 20): FieldLogEntry[] {
    return this.entries.slice(0, count);
  }

  getAllChecklists(): Checklist[] {
    return Array.from(this.checklists.values());
  }

  async exportLog(): Promise<void> {
    const data = JSON.stringify({ entries: this.entries, checklists: Array.from(this.checklists.values()) }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentra-bitacora-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    await evolis.record('bitacora', 'export', 'field_log_export');
  }

  subscribe(listener: FieldLogListener): () => void {
    this.listeners.add(listener);
    listener({ entries: this.getEntries(), checklists: this.getAllChecklists() });
    return () => this.listeners.delete(listener);
  }

  private addEntry(entry: FieldLogEntry): void {
    this.entries.unshift(entry);
    if (this.entries.length > MAX_ENTRIES) this.entries.pop();
    this.notify();
    this.persist();
  }

  private notify(): void {
    const snapshot = { entries: this.getEntries(), checklists: this.getAllChecklists() };
    for (const listener of this.listeners) listener(snapshot);
  }

  private async persist(): Promise<void> {
    try {
      await storageService.saveState(STORE_KEY, {
        entries: this.entries,
        checklists: Array.from(this.checklists.values()),
      });
    } catch { /* storage unavailable */ }
  }

  private generateId(): string {
    return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
  }
}

export const fieldLogManager = new FieldLogManager();
