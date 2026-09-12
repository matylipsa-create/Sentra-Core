/**
 * LocalAIService — Servicio de IA local con Ollama como backend principal.
 *
 * Fallback a GeminiService (ya existente) si Ollama no está disponible.
 * Prioriza respuestas locales (offline, soberanas, baja latencia).
 * Solo usa Gemini remoto si el usuario lo activa explícitamente.
 */

import { ollamaService, type OllamaMessage } from './OllamaService';
import { geminiService } from '../core/GeminiService';
import { type TCREIResponse } from '../core/TCREIBridge';

export type AISource = 'ollama' | 'gemini' | 'local-fallback';
export type AITask = 'vision' | 'bio' | 'security' | 'learning' | 'general';

export interface LocalAIRequest {
  prompt: string;
  task: AITask;
  context?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LocalAIResponse {
  text: string;
  source: AISource;
  model: string;
  latencyMs: number;
  confidence: number;
}

export interface LocalAIStatus {
  ollamaAvailable: boolean;
  activeModel: string | null;
  source: AISource;
  lastLatencyMs: number;
}

type LocalAIListener = (status: LocalAIStatus) => void;

const DEFAULT_SYSTEM_PROMPT = 'Eres Sentra Core, un asistente soberano y offline-first. Respondes en español, de forma clara y concisa.';

const TASK_MODEL_MAP: Record<AITask, string> = {
  vision: 'llama3:8b',
  bio: 'qwen2.5:7b',
  security: 'llama3:8b',
  learning: 'qwen2.5:7b',
  general: 'gemma3:latest',
};

export class LocalAIService {
  private activeModel: string | null = null;
  private ollamaAvailable = false;
  private lastLatencyMs = 0;
  private listeners = new Set<LocalAIListener>();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    this.ollamaAvailable = await ollamaService.isAvailable();
    ollamaService.subscribe((available) => {
      this.ollamaAvailable = available;
      if (!available) this.activeModel = null;
      this.notify();
    });
    if (this.ollamaAvailable) {
      await this.selectBestModel();
    }
    this.notify();
  }

  // ── Respuesta de IA ────────────────────────────────────────────────────

  async generateResponse(request: LocalAIRequest): Promise<LocalAIResponse> {
    await this.init();

    if (this.ollamaAvailable && this.activeModel) {
      try {
        return await this.generateWithOllama(request);
      } catch {
        return await this.generateWithFallback(request);
      }
    }

    return await this.generateWithFallback(request);
  }

  // ── Respuesta contextual (con percepción) ──────────────────────────────

  async generateContextual(
    module: string,
    perception: string,
    command: string,
    systemOverride?: string,
  ): Promise<TCREIResponse> {
    await this.init();

    const systemPrompt = systemOverride ?? DEFAULT_SYSTEM_PROMPT;
    const userPrompt = `Contexto: ${module}\nPercepción: ${perception}\nComando: ${command}`;

    if (this.ollamaAvailable && this.activeModel) {
      try {
        const result = await ollamaService.chat({
          model: this.activeModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          maxTokens: 256,
          temperature: 0.7,
        });
        this.lastLatencyMs = result.latencyMs;
        this.notify();
        return {
          text: result.text,
          confidence: 0.85,
          source: 'local',
        };
      } catch {
        return await geminiService.query(module, perception, command);
      }
    }

    return await geminiService.query(module, perception, command);
  }

  // ── Generar alerta contextual ──────────────────────────────────────────

  async generateAlert(level: 'info' | 'warning' | 'critical', message: string): Promise<string> {
    const prompt = `Genera una alerta breve en español para el nivel "${level}": ${message}. Responde en menos de 30 palabras.`;
    const result = await this.generateResponse({
      prompt,
      task: 'security',
      systemPrompt: 'Generas alertas de seguridad breves y claras en español.',
      maxTokens: 64,
      temperature: 0.5,
    });
    return result.text;
  }

  // ── Selección de modelo ────────────────────────────────────────────────

  async selectModel(modelId: string): Promise<boolean> {
    await this.init();
    if (!this.ollamaAvailable) return false;
    const models = await ollamaService.listModels();
    const exists = models.some((m) => m.id === modelId);
    if (!exists) return false;
    this.activeModel = modelId;
    this.notify();
    return true;
  }

  async selectBestModel(task: AITask = 'general'): Promise<string | null> {
    await this.init();
    if (!this.ollamaAvailable) return null;

    const preferred = TASK_MODEL_MAP[task];
    const models = await ollamaService.listModels();
    const modelIds = models.map((m) => m.id);

    if (modelIds.includes(preferred)) {
      this.activeModel = preferred;
      this.notify();
      return preferred;
    }

    const fallbackOrder = ['gemma3:latest', 'qwen2.5:7b', 'llama3:8b'];
    for (const fallback of fallbackOrder) {
      if (modelIds.includes(fallback)) {
        this.activeModel = fallback;
        this.notify();
        return fallback;
      }
    }

    if (modelIds.length > 0) {
      this.activeModel = modelIds[0];
      this.notify();
      return modelIds[0];
    }

    return null;
  }

  getActiveModel(): string | null {
    return this.activeModel;
  }

  // ── Estado ────────────────────────────────────────────────────────────

  getStatus(): LocalAIStatus {
    return {
      ollamaAvailable: this.ollamaAvailable,
      activeModel: this.activeModel,
      source: this.ollamaAvailable && this.activeModel ? 'ollama' : 'local-fallback',
      lastLatencyMs: this.lastLatencyMs,
    };
  }

  subscribe(listener: LocalAIListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  // ── Internos ──────────────────────────────────────────────────────────

  private async generateWithOllama(request: LocalAIRequest): Promise<LocalAIResponse> {
    const messages: OllamaMessage[] = [
      { role: 'system', content: request.systemPrompt ?? DEFAULT_SYSTEM_PROMPT },
      { role: 'user', content: request.context ? `${request.context}\n\n${request.prompt}` : request.prompt },
    ];
    const result = await ollamaService.chat({
      model: this.activeModel!,
      messages,
      maxTokens: request.maxTokens ?? 256,
      temperature: request.temperature ?? 0.7,
    });
    this.lastLatencyMs = result.latencyMs;
    this.notify();
    return {
      text: result.text,
      source: 'ollama',
      model: result.model,
      latencyMs: result.latencyMs,
      confidence: 0.85,
    };
  }

  private async generateWithFallback(request: LocalAIRequest): Promise<LocalAIResponse> {
    const start = performance.now();
    const response = await geminiService.query(
      request.task,
      request.context ?? 'Sin percepción activa',
      request.prompt,
    );
    const latencyMs = Math.round(performance.now() - start);
    this.lastLatencyMs = latencyMs;
    this.notify();
    return {
      text: response.text,
      source: response.source === 'gemini' ? 'gemini' : 'local-fallback',
      model: response.source === 'gemini' ? 'gemini-2.0-flash' : 'local-knowledge',
      latencyMs,
      confidence: response.confidence,
    };
  }

  private notify(): void {
    const status = this.getStatus();
    for (const listener of this.listeners) listener(status);
  }
}

export const localAIService = new LocalAIService();
