import { TCREIBridge, TCREIResponse } from './TCREIBridge';

export interface GeminiConfig {
  apiKey?: string;
  model: string;
}

interface GeminiCandidate {
  text: string;
  score: number;
}

const LOCAL_KNOWLEDGE: { keywords: string[]; response: string }[] = [
  {
    keywords: ['hola', 'buenos', 'buenas', 'hey', 'saludos'],
    response: 'Hola, soy Sentra Core. Estoy listo para ayudarte. Dime que necesitas.',
  },
  {
    keywords: ['quien eres', 'que eres', 'que es sentra'],
    response: 'Soy Sentra Core, una navaja suiza soberana. Funciono offline, con veto humano y trazabilidad inalterable.',
  },
  {
    keywords: ['ayuda', 'help', 'comandos'],
    response: 'Puedes pedirme: describir lo que veo, navegar, registrar evidencia, o cambiar de modo.',
  },
  {
    keywords: ['bateria', 'energia'],
    response: 'Puedo gestionar el consumo en modos: ultra ahorro, normal y alto rendimiento.',
  },
  {
    keywords: ['persona', 'gente', 'alguien', 'cuerpo'],
    response: 'Detecto presencia de personas en el campo de vision.',
  },
  {
    keywords: ['peligro', 'riesgo', 'alerta', 'emergencia'],
    response: 'Alerta: situacion de riesgo detectada. Manten la calma y sigue mis indicaciones.',
  },
];

export class GeminiService {
  private config: GeminiConfig;
  private bridge: TCREIBridge;
  private useRemote = false;
  private worldConnected = false;

  constructor(config?: Partial<GeminiConfig>) {
    this.config = { model: 'gemini-2.0-flash', ...config };
    this.bridge = new TCREIBridge();
  }

  setApiKey(key: string): void {
    this.config.apiKey = key;
  }

  setRemoteEnabled(enabled: boolean): void {
    this.useRemote = enabled;
  }

  setWorldConnected(connected: boolean): void {
    this.worldConnected = connected;
  }

  isRemoteEnabled(): boolean {
    return this.useRemote;
  }

  isWorldConnected(): boolean {
    return this.worldConnected;
  }

  async query(module: string, perception: string, command: string): Promise<TCREIResponse> {
    const prompt = this.bridge.buildPrompt(module, perception, command);
    if (this.useRemote && this.config.apiKey) {
      try {
        const raw = await this.callRemote(prompt);
        return this.bridge.parseResponse(raw, 'gemini');
      } catch {
        return this.localResponse(prompt, command);
      }
    }
    return this.localResponse(prompt, command);
  }

  private async callRemote(prompt: ReturnType<TCREIBridge['buildPrompt']>): Promise<string> {
    const formatted = this.bridge.formatForLLM(prompt);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: formatted }] }],
      }),
    });
    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty Gemini response');
    return text;
  }

  private localResponse(
    prompt: ReturnType<TCREIBridge['buildPrompt']>,
    command: string
  ): TCREIResponse {
    const lower = command.toLowerCase();
    let best: GeminiCandidate | null = null;
    for (const entry of LOCAL_KNOWLEDGE) {
      const score = entry.keywords.reduce(
        (acc, kw) => acc + (lower.includes(kw) ? 1 : 0),
        0
      );
      if (score > 0 && (!best || score > best.score)) {
        best = { text: entry.response, score };
      }
    }
    const text = best
      ? best.text
      : `Procesando "${command}" en contexto de ${prompt.context}. Modo offline activo.`;
    return this.bridge.parseResponse(text, 'local');
  }
}

export const geminiService = new GeminiService();
