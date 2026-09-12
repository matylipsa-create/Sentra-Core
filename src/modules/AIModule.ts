/**
 * AIModule — Módulo IA de alto nivel que integra Ollama, modelos y cuantización.
 *
 * Expone funciones simplificadas para generar respuestas, seleccionar modelos
 * y gestionar la cuantización. Integra:
 *   - OllamaService (cliente HTTP)
 *   - LocalAIService (fallback a GeminiService)
 *   - ModelManager (gestión de modelos)
 *   - QuantizationManager (detección de VRAM y recomendaciones)
 */

import { localAIService, type AITask, type LocalAIResponse, type LocalAIStatus } from '../services/LocalAIService';
import { modelManager, type ManagedModel, type ModelManagerStatus } from '../core/ModelManager';
import { quantizationManager, type QuantizationRecommendation, type QuantizationStatus } from '../core/QuantizationManager';
import { ollamaService } from '../services/OllamaService';
import { evolis } from '../core/EVOLIS';
import { type TCREIResponse } from '../core/TCREIBridge';

export interface AIModuleStatus {
  localAI: LocalAIStatus;
  models: ModelManagerStatus;
  quantization: QuantizationStatus;
  ollamaHealth: { ok: boolean; latencyMs: number; models: number } | null;
}

type AIModuleListener = (status: AIModuleStatus) => void;

export interface AIQueryOptions {
  task: AITask;
  context?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export class AIModule {
  private listeners = new Set<AIModuleListener>();
  private initialized = false;
  private ollamaHealth: { ok: boolean; latencyMs: number; models: number } | null = null;
  private healthTimer: number | null = null;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    await Promise.all([
      localAIService.init(),
      modelManager.init(),
      quantizationManager.init(),
    ]);

    localAIService.subscribe(() => this.notify());
    modelManager.subscribe(() => this.notify());
    quantizationManager.subscribe(() => this.notify());

    await this.checkHealth();
    this.startHealthCheck();
    this.notify();
  }

  // ── Consultas de alto nivel ────────────────────────────────────────────

  async query(prompt: string, options: AIQueryOptions): Promise<LocalAIResponse> {
    await this.init();
    const result = await localAIService.generateResponse({
      prompt,
      task: options.task,
      context: options.context,
      systemPrompt: options.systemPrompt,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
    });
    await evolis.record('ai_module', 'query', `${options.task}:${prompt.substring(0, 100)}`);
    return result;
  }

  async queryContextual(
    module: string,
    perception: string,
    command: string,
    systemOverride?: string,
  ): Promise<TCREIResponse> {
    await this.init();
    const response = await localAIService.generateContextual(module, perception, command, systemOverride);
    await evolis.record('ai_module', 'contextual', `${module}:${command.substring(0, 100)}`);
    return response;
  }

  async generateAlert(level: 'info' | 'warning' | 'critical', message: string): Promise<string> {
    await this.init();
    return localAIService.generateAlert(level, message);
  }

  // ── Gestión de modelos ────────────────────────────────────────────────

  async selectModel(modelId: string): Promise<boolean> {
    await this.init();
    const ok = await modelManager.selectModel(modelId);
    if (ok) {
      const model = modelManager.getActiveModel();
      if (model) {
        await evolis.record('ai_module', 'select_model', model.id);
      }
    }
    return ok;
  }

  async selectBestForTask(task: AITask): Promise<string | null> {
    await this.init();
    const modelId = await modelManager.selectBestForTask(task);
    if (modelId) {
      await evolis.record('ai_module', 'select_best', `${task}:${modelId}`);
    }
    return modelId;
  }

  async pullModel(modelId: string): Promise<boolean> {
    await this.init();
    const ok = await modelManager.pullModel(modelId);
    if (ok) {
      await evolis.record('ai_module', 'pull_model', modelId);
    }
    return ok;
  }

  async deleteModel(modelId: string): Promise<boolean> {
    await this.init();
    const ok = await modelManager.deleteModel(modelId);
    if (ok) {
      await evolis.record('ai_module', 'delete_model', modelId);
    }
    return ok;
  }

  async refreshModels(): Promise<ManagedModel[]> {
    await this.init();
    return modelManager.refreshModels();
  }

  getModels(): ManagedModel[] {
    return modelManager.getModels();
  }

  getInstalledModels(): ManagedModel[] {
    return modelManager.getInstalledModels();
  }

  getActiveModel(): ManagedModel | null {
    return modelManager.getActiveModel();
  }

  // ── Cuantización ──────────────────────────────────────────────────────

  getQuantizationStatus(): QuantizationStatus {
    return quantizationManager.getStatus();
  }

  getRecommendation(): QuantizationRecommendation | null {
    return quantizationManager.getRecommendation();
  }

  // ── Health check ──────────────────────────────────────────────────────

  async checkHealth(): Promise<void> {
    this.ollamaHealth = await ollamaService.healthCheck();
    this.notify();
  }

  private startHealthCheck(): void {
    if (this.healthTimer !== null) return;
    this.healthTimer = window.setInterval(() => this.checkHealth(), 30000);
  }

  stopHealthCheck(): void {
    if (this.healthTimer !== null) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  // ── Estado ────────────────────────────────────────────────────────────

  getStatus(): AIModuleStatus {
    return {
      localAI: localAIService.getStatus(),
      models: modelManager.getStatus(),
      quantization: quantizationManager.getStatus(),
      ollamaHealth: this.ollamaHealth,
    };
  }

  subscribe(listener: AIModuleListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.stopHealthCheck();
    this.listeners.clear();
  }

  private notify(): void {
    const status = this.getStatus();
    for (const listener of this.listeners) listener(status);
  }
}

export const aiModule = new AIModule();
