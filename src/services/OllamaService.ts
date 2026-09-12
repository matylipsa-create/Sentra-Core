/**
 * OllamaService — Cliente HTTP para Ollama (API compatible OpenAI).
 *
 * Conecta a http://localhost:11434/v1 para ejecutar modelos cuantizados
 * localmente. Sin nube, sin dependencias externas. Offline-first.
 *
 * Endpoints:
 *   POST /v1/completions       — generación de texto
 *   POST /v1/chat/completions  — chat multi-turno
 *   GET  /v1/models           — listar modelos instalados
 *   POST /api/pull             — descargar modelo
 *   GET  /api/show             — info de un modelo
 */

const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_TIMEOUT_MS = 30000;

export interface OllamaModel {
  id: string;
  name: string;
  size?: number;
  quantization?: string;
  parameterSize?: string;
}

export interface OllamaCompletionRequest {
  model: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
}

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaCompletionResponse {
  text: string;
  model: string;
  tokensGenerated: number;
  latencyMs: number;
}

export interface OllamaChatResponse {
  text: string;
  model: string;
  role: string;
  tokensGenerated: number;
  latencyMs: number;
}

export interface OllamaModelInfo {
  name: string;
  quantization: string;
  parameterSize: string;
  sizeBytes: number;
  family: string;
  contextLength: number;
}

type OllamaStatusListener = (available: boolean) => void;

export class OllamaService {
  private baseUrl: string;
  private timeoutMs: number;
  private listeners = new Set<OllamaStatusListener>();
  private cachedAvailable: boolean | null = null;
  private lastCheckMs = 0;
  private readonly checkIntervalMs = 5000;

  constructor(baseUrl?: string, timeoutMs?: number) {
    this.baseUrl = (baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '');
    this.cachedAvailable = null;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  // ── Disponibilidad ────────────────────────────────────────────────────

  async isAvailable(): Promise<boolean> {
    const now = Date.now();
    if (this.cachedAvailable !== null && now - this.lastCheckMs < this.checkIntervalMs) {
      return this.cachedAvailable;
    }
    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/v1/models`, {
        method: 'GET',
      });
      const ok = res.ok;
      this.cachedAvailable = ok;
      this.lastCheckMs = now;
      this.notifyListeners(ok);
      return ok;
    } catch {
      this.cachedAvailable = false;
      this.lastCheckMs = now;
      this.notifyListeners(false);
      return false;
    }
  }

  subscribe(listener: OllamaStatusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(available: boolean): void {
    for (const listener of this.listeners) listener(available);
  }

  // ── Listar modelos ─────────────────────────────────────────────────────

  async listModels(): Promise<OllamaModel[]> {
    const res = await this.fetchWithTimeout(`${this.baseUrl}/v1/models`, {
      method: 'GET',
    });
    if (!res.ok) throw new Error(`Ollama listModels error: ${res.status}`);
    const data = await res.json();
    const models: OllamaModel[] = (data?.data ?? []).map((m: { id: string; object?: string; owned_by?: string }) => ({
      id: m.id,
      name: m.id,
    }));
    return models;
  }

  // ── Info de un modelo ──────────────────────────────────────────────────

  async getModelInfo(modelName: string): Promise<OllamaModelInfo | null> {
    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        name: data?.name ?? modelName,
        quantization: data?.quantization ?? 'unknown',
        parameterSize: data?.details?.parameter_size ?? 'unknown',
        sizeBytes: data?.details?.size ?? 0,
        family: data?.details?.family ?? 'unknown',
        contextLength: data?.model_config?.max_context_length ?? 4096,
      };
    } catch {
      return null;
    }
  }

  // ── Generación de texto ───────────────────────────────────────────────

  async generate(request: OllamaCompletionRequest): Promise<OllamaCompletionResponse> {
    const start = performance.now();
    const body = {
      model: request.model,
      prompt: request.prompt,
      max_tokens: request.maxTokens ?? 512,
      temperature: request.temperature ?? 0.7,
      top_p: request.topP ?? 0.9,
      stream: false,
    };
    const res = await this.fetchWithTimeout(`${this.baseUrl}/v1/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Ollama generate error: ${res.status}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.text ?? data?.choices?.[0]?.message?.content ?? '';
    const latencyMs = Math.round(performance.now() - start);
    return {
      text: text.trim(),
      model: data?.model ?? request.model,
      tokensGenerated: data?.usage?.completion_tokens ?? 0,
      latencyMs,
    };
  }

  // ── Chat multi-turno ──────────────────────────────────────────────────

  async chat(request: OllamaChatRequest): Promise<OllamaChatResponse> {
    const start = performance.now();
    const body = {
      model: request.model,
      messages: request.messages,
      max_tokens: request.maxTokens ?? 512,
      temperature: request.temperature ?? 0.7,
      top_p: request.topP ?? 0.9,
      stream: false,
    };
    const res = await this.fetchWithTimeout(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Ollama chat error: ${res.status}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? '';
    const latencyMs = Math.round(performance.now() - start);
    return {
      text: text.trim(),
      model: data?.model ?? request.model,
      role: data?.choices?.[0]?.message?.role ?? 'assistant',
      tokensGenerated: data?.usage?.completion_tokens ?? 0,
      latencyMs,
    };
  }

  // ── Descargar modelo ──────────────────────────────────────────────────

  async pullModel(modelName: string): Promise<boolean> {
    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: false }),
      }, 300000);
      return res.ok;
    } catch {
      return false;
    }
  }

  // ── Eliminar modelo ────────────────────────────────────────────────────

  async deleteModel(modelName: string): Promise<boolean> {
    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ── Health check rápido ───────────────────────────────────────────────

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number; models: number }> {
    const start = performance.now();
    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/v1/models`, {
        method: 'GET',
      }, 5000);
      const latencyMs = Math.round(performance.now() - start);
      if (!res.ok) return { ok: false, latencyMs, models: 0 };
      const data = await res.json();
      const models = data?.data?.length ?? 0;
      return { ok: true, latencyMs, models };
    } catch {
      return { ok: false, latencyMs: Math.round(performance.now() - start), models: 0 };
    }
  }

  // ── Internos ──────────────────────────────────────────────────────────

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs?: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = timeoutMs ?? this.timeoutMs;
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

export const ollamaService = new OllamaService();
