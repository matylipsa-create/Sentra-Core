/**
 * ModelManager — Gestor de modelos IA locales (Ollama).
 *
 * Detecta modelos disponibles, carga/descarga, y selecciona el modelo
 * óptimo según la tarea (visión, bio, seguridad, aprendizaje, general).
 * Soporta Llama 3, Qwen 2.5 y Gemma 3 cuantizados.
 */

import { ollamaService, type OllamaModel, type OllamaModelInfo } from '../services/OllamaService';
import { type AITask } from '../services/LocalAIService';

export interface ManagedModel {
  id: string;
  label: string;
  task: AITask;
  parameterSize: string;
  quantization: string;
  sizeBytes: number;
  contextLength: number;
  installed: boolean;
  recommended: boolean;
}

export interface ModelManagerStatus {
  models: ManagedModel[];
  installedCount: number;
  activeModelId: string | null;
  ollamaAvailable: boolean;
}

type ModelManagerListener = (status: ModelManagerStatus) => void;

const RECOMMENDED_MODELS: { id: string; label: string; task: AITask }[] = [
  { id: 'llama3:8b', label: 'Llama 3 8B', task: 'vision' },
  { id: 'qwen2.5:7b', label: 'Qwen 2.5 7B', task: 'bio' },
  { id: 'gemma3:latest', label: 'Gemma 3', task: 'general' },
  { id: 'llama3:8b-q4_K_M', label: 'Llama 3 8B Q4_K_M', task: 'security' },
  { id: 'qwen2.5:7b-q4_K_M', label: 'Qwen 2.5 7B Q4_K_M', task: 'learning' },
];

const TASK_PREFERENCE: Record<AITask, string[]> = {
  vision: ['llama3:8b', 'llama3:8b-q4_K_M', 'gemma3:latest'],
  bio: ['qwen2.5:7b', 'qwen2.5:7b-q4_K_M', 'gemma3:latest'],
  security: ['llama3:8b-q4_K_M', 'llama3:8b', 'gemma3:latest'],
  learning: ['qwen2.5:7b-q4_K_M', 'qwen2.5:7b', 'gemma3:latest'],
  general: ['gemma3:latest', 'qwen2.5:7b', 'llama3:8b'],
};

export class ModelManager {
  private models: Map<string, ManagedModel> = new Map();
  private activeModelId: string | null = null;
  private listeners = new Set<ModelManagerListener>();
  private initialized = false;
  private ollamaAvailable = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    this.ollamaAvailable = await ollamaService.isAvailable();
    if (this.ollamaAvailable) {
      await this.refreshModels();
    }
    this.notify();
  }

  // ── Refrescar lista de modelos ─────────────────────────────────────────

  async refreshModels(): Promise<ManagedModel[]> {
    if (!this.ollamaAvailable) {
      this.notify();
      return [];
    }

    let installedModels: OllamaModel[] = [];
    try {
      installedModels = await ollamaService.listModels();
    } catch {
      this.ollamaAvailable = false;
      this.notify();
      return [];
    }

    const installedIds = new Set(installedModels.map((m) => m.id));

    this.models.clear();

    for (const rec of RECOMMENDED_MODELS) {
      const installed = installedIds.has(rec.id);
      let info: OllamaModelInfo | null = null;
      if (installed) {
        info = await ollamaService.getModelInfo(rec.id);
      }
      const managed: ManagedModel = {
        id: rec.id,
        label: rec.label,
        task: rec.task,
        parameterSize: info?.parameterSize ?? 'unknown',
        quantization: info?.quantization ?? 'unknown',
        sizeBytes: info?.sizeBytes ?? 0,
        contextLength: info?.contextLength ?? 4096,
        installed,
        recommended: true,
      };
      this.models.set(rec.id, managed);
    }

    for (const model of installedModels) {
      if (this.models.has(model.id)) continue;
      const info = await ollamaService.getModelInfo(model.id);
      this.models.set(model.id, {
        id: model.id,
        label: model.name,
        task: 'general',
        parameterSize: info?.parameterSize ?? 'unknown',
        quantization: info?.quantization ?? 'unknown',
        sizeBytes: info?.sizeBytes ?? 0,
        contextLength: info?.contextLength ?? 4096,
        installed: true,
        recommended: false,
      });
    }

    if (!this.activeModelId && installedIds.size > 0) {
      await this.selectBestForTask('general');
    }

    this.notify();
    return this.getModels();
  }

  // ── Selección de modelo ────────────────────────────────────────────────

  async selectModel(modelId: string): Promise<boolean> {
    const model = this.models.get(modelId);
    if (!model || !model.installed) return false;
    this.activeModelId = modelId;
    this.notify();
    return true;
  }

  async selectBestForTask(task: AITask): Promise<string | null> {
    const preferences = TASK_PREFERENCE[task];
    const installed = this.getInstalledModels();

    for (const preferred of preferences) {
      const match = installed.find((m) => m.id === preferred);
      if (match) {
        this.activeModelId = match.id;
        this.notify();
        return match.id;
      }
    }

    if (installed.length > 0) {
      this.activeModelId = installed[0].id;
      this.notify();
      return installed[0].id;
    }

    return null;
  }

  getActiveModelId(): string | null {
    return this.activeModelId;
  }

  getActiveModel(): ManagedModel | null {
    return this.activeModelId ? this.models.get(this.activeModelId) ?? null : null;
  }

  // ── Descarga / eliminación ────────────────────────────────────────────

  async pullModel(modelId: string): Promise<boolean> {
    const ok = await ollamaService.pullModel(modelId);
    if (ok) {
      await this.refreshModels();
    }
    return ok;
  }

  async deleteModel(modelId: string): Promise<boolean> {
    const ok = await ollamaService.deleteModel(modelId);
    if (ok) {
      this.models.delete(modelId);
      if (this.activeModelId === modelId) this.activeModelId = null;
      this.notify();
    }
    return ok;
  }

  // ── Getters ───────────────────────────────────────────────────────────

  getModels(): ManagedModel[] {
    return Array.from(this.models.values());
  }

  getInstalledModels(): ManagedModel[] {
    return Array.from(this.models.values()).filter((m) => m.installed);
  }

  getRecommendedModels(): ManagedModel[] {
    return Array.from(this.models.values()).filter((m) => m.recommended);
  }

  getStatus(): ModelManagerStatus {
    return {
      models: this.getModels(),
      installedCount: this.getInstalledModels().length,
      activeModelId: this.activeModelId,
      ollamaAvailable: this.ollamaAvailable,
    };
  }

  subscribe(listener: ModelManagerListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  // ── Internos ──────────────────────────────────────────────────────────

  private notify(): void {
    const status = this.getStatus();
    for (const listener of this.listeners) listener(status);
  }
}

export const modelManager = new ModelManager();
