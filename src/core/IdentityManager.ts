import { evolis } from './EVOLIS';

export type AgentTone = 'formal' | 'casual' | 'poetico' | 'tecnico' | 'directo';
export type AgentStyle = 'directo' | 'reflexivo' | 'amigable';

export interface AgentIdentity {
  name: string;
  description: string;
  tone: AgentTone;
  style: AgentStyle;
  values: string[];
  createdAt: number;
  updatedAt: number;
}

export interface IdentityEvent {
  id: string;
  type: 'create' | 'update' | 'verify';
  timestamp: number;
  changes: Partial<AgentIdentity>;
  hash: string;
}

export interface IdentityConfig {
  tone: AgentTone;
  style: AgentStyle;
}

const IDENTITY_STORAGE_KEY = 'sentra_identity';
const IDENTITY_EVENT_STORE = 'identity_events';

const DEFAULT_IDENTITY: AgentIdentity = {
  name: 'Sentra Core',
  description: 'Motor de IA soberano, offline-first, con veto humano y trazabilidad inalterable.',
  tone: 'directo',
  style: 'directo',
  values: ['soberania', 'offline-first', 'veto-humano', 'trazabilidad', 'accesibilidad'],
  createdAt: 0,
  updatedAt: 0,
};

const TONE_DESCRIPTIONS: Record<AgentTone, string> = {
  formal: 'Respuestas estructuradas y precisas',
  casual: 'Respuestas cercanas y conversacionales',
  poetico: 'Respuestas con metaforas y ritmo',
  tecnico: 'Respuestas detalladas y tecnicas',
  directo: 'Respuestas claras y sin rodeos',
};

const STYLE_DESCRIPTIONS: Record<AgentStyle, string> = {
  directo: 'Va al punto sin rodeos',
  reflexivo: 'Considera matices antes de responder',
  amigable: 'Calido y colaborativo',
};

export class IdentityManager {
  private identity: AgentIdentity;
  private history: IdentityEvent[] = [];
  private initialized = false;

  constructor() {
    this.identity = { ...DEFAULT_IDENTITY, createdAt: Date.now(), updatedAt: Date.now() };
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    await this.loadIdentity();
    await this.loadHistory();
  }

  private async loadIdentity(): Promise<void> {
    try {
      const raw = localStorage.getItem(IDENTITY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AgentIdentity;
        this.identity = { ...DEFAULT_IDENTITY, ...parsed };
      }
    } catch {
      // localStorage unavailable
    }
  }

  private async loadHistory(): Promise<void> {
    try {
      const raw = localStorage.getItem(IDENTITY_EVENT_STORE);
      if (raw) {
        this.history = JSON.parse(raw) as IdentityEvent[];
      }
    } catch {
      // localStorage unavailable
    }
  }

  private async persistIdentityLocal(): Promise<void> {
    try {
      localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(this.identity));
    } catch {
      // localStorage unavailable
    }
  }

  private async persistHistoryLocal(): Promise<void> {
    try {
      localStorage.setItem(IDENTITY_EVENT_STORE, JSON.stringify(this.history));
    } catch {
      // localStorage unavailable
    }
  }

  createIdentity(
    name: string,
    description: string,
    tone: AgentTone,
    style: AgentStyle,
    values: string[]
  ): AgentIdentity {
    const now = Date.now();
    this.identity = {
      name: name.trim() || 'Sentra Core',
      description: description.trim() || DEFAULT_IDENTITY.description,
      tone,
      style,
      values: values.length > 0 ? values : DEFAULT_IDENTITY.values,
      createdAt: now,
      updatedAt: now,
    };
    return this.identity;
  }

  getIdentity(): AgentIdentity {
    return { ...this.identity };
  }

  updateIdentity(updates: Partial<AgentIdentity>): AgentIdentity {
    const changes: Partial<AgentIdentity> = {};
    for (const key of Object.keys(updates) as (keyof AgentIdentity)[]) {
      if (key === 'createdAt' || key === 'updatedAt') continue;
      const newVal = updates[key];
      const oldVal = this.identity[key];
      if (newVal !== undefined && newVal !== oldVal) {
        (this.identity as unknown as Record<string, unknown>)[key] = newVal;
        (changes as unknown as Record<string, unknown>)[key] = newVal;
      }
    }
    if (Object.keys(changes).length > 0) {
      this.identity.updatedAt = Date.now();
    }
    return this.identity;
  }

  async persistIdentity(): Promise<void> {
    await this.persistIdentityLocal();
    const event = await this.createIdentityEvent('update', this.identity);
    this.history.push(event);
    if (this.history.length > 100) this.history.shift();
    await this.persistHistoryLocal();
    await evolis.record('identity', 'persist', JSON.stringify(this.identity));
  }

  async persistInitialIdentity(): Promise<void> {
    await this.persistIdentityLocal();
    const event = await this.createIdentityEvent('create', this.identity);
    this.history.push(event);
    await this.persistHistoryLocal();
    await evolis.record('identity', 'create', JSON.stringify(this.identity));
  }

  verifyIdentityConsistency(): boolean {
    if (!this.identity.name || this.identity.name.trim().length === 0) return false;
    if (!this.identity.tone) return false;
    if (!this.identity.style) return false;
    if (!Array.isArray(this.identity.values)) return false;
    return true;
  }

  getIdentityHistory(): IdentityEvent[] {
    return [...this.history];
  }

  getToneDescription(tone: AgentTone): string {
    return TONE_DESCRIPTIONS[tone] ?? '';
  }

  getStyleDescription(style: AgentStyle): string {
    return STYLE_DESCRIPTIONS[style] ?? '';
  }

  getAllTones(): { id: AgentTone; label: string; description: string }[] {
    return (Object.keys(TONE_DESCRIPTIONS) as AgentTone[]).map((t) => ({
      id: t,
      label: t.charAt(0).toUpperCase() + t.slice(1),
      description: TONE_DESCRIPTIONS[t],
    }));
  }

  getAllStyles(): { id: AgentStyle; label: string; description: string }[] {
    return (Object.keys(STYLE_DESCRIPTIONS) as AgentStyle[]).map((s) => ({
      id: s,
      label: s.charAt(0).toUpperCase() + s.slice(1),
      description: STYLE_DESCRIPTIONS[s],
    }));
  }

  getSystemPromptFragment(): string {
    const id = this.identity;
    return `Eres ${id.name}. ${id.description}. Tono: ${id.tone}. Estilo: ${id.style}. Valores: ${id.values.join(', ')}.`;
  }

  private async createIdentityEvent(
    type: IdentityEvent['type'],
    data: Partial<AgentIdentity>
  ): Promise<IdentityEvent> {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(`${type}:${Date.now()}:${JSON.stringify(data)}`)
    );
    const hash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return {
      id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
      type,
      timestamp: Date.now(),
      changes: data,
      hash,
    };
  }
}

export const identityManager = new IdentityManager();
