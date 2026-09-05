export type BioProtocol =
  | 'active_inference'
  | 'cognitive_placebo'
  | 'cognitive_reframing'
  | 'neuroplasticity'
  | 'epigenetics'
  | 'cardiac_coherence';

export interface BioProtocolDef {
  id: BioProtocol;
  label: string;
  description: string;
  icon: string;
  defaultDuration: number;
}

export interface BioSession {
  id: string;
  protocol: BioProtocol;
  startedAt: number;
  endedAt: number | null;
  duration: number;
  metrics: BioSessionMetrics;
  reframes: string[];
  completed: boolean;
}

export interface BioSessionMetrics {
  coherenceScore: number;
  placeboAdherence: number;
  reframingCount: number;
  breathCycles: number;
  avgHeartRate: number | null;
  stressLevel: number;
  focusLevel: number;
}

export interface BioState {
  activeProtocol: BioProtocol | null;
  currentSession: BioSession | null;
  sessions: BioSession[];
  cardiacCoherence: number;
  stressLevel: number;
  focusLevel: number;
  enabled: boolean;
}

export const BIO_PROTOCOLS: BioProtocolDef[] = [
  {
    id: 'cardiac_coherence',
    label: 'Coherencia Cardiaca',
    description: 'Respiracion guiada 5.5 bpm para sincronizar corazon y cerebro',
    icon: '\u{1F49C}',
    defaultDuration: 300,
  },
  {
    id: 'cognitive_placebo',
    label: 'Placebo Cognitivo',
    description: 'Refuerzo de expectativas positivas para optimizar el hardware biologico',
    icon: '\u{1F9E0}',
    defaultDuration: 180,
  },
  {
    id: 'cognitive_reframing',
    label: 'Reencuadre Cognitivo',
    description: 'Cambio de perspectiva ante situaciones de estres o ansiedad',
    icon: '\u{1F504}',
    defaultDuration: 240,
  },
  {
    id: 'active_inference',
    label: 'Inferencia Activa',
    description: 'Prediccion y minimizacion de error de prediccion del cerebro',
    icon: '\u{1F4A1}',
    defaultDuration: 200,
  },
  {
    id: 'neuroplasticity',
    label: 'Neuroplasticidad',
    description: 'Ejercicios de formacion de nuevas conexiones neuronales',
    icon: '\u{1F9DF}',
    defaultDuration: 360,
  },
  {
    id: 'epigenetics',
    label: 'Epigenetica',
    description: 'Modulacion de expresion genetica mediante habits y entorno',
    icon: '\u{1F9EC}',
    defaultDuration: 420,
  },
];

const REFRAMES: Record<BioProtocol, string[]> = {
  cardiac_coherence: [
    'Inhala 4 segundos, exhala 6 segundos. Tu corazon encuentra su ritmo natural.',
    'Cada respiracion sincroniza tu sistema nervioso. Estas en coherencia.',
    'Tu variabilidad cardiaca mejora con cada ciclo. Sigue asi.',
  ],
  cognitive_placebo: [
    'Tu cerebro responde a la expectativa. Creer en la mejoria activa la mejoria.',
    'El tratamiento que recibes es real para tu cerebro. Deja que sane.',
    'Tu cuerpo tiene la capacidad de repararse. Confia en el proceso.',
  ],
  cognitive_reframing: [
    'Esta situacion no es una amenaza, es un desafio que puedes manejar.',
    'Lo que sientes como estres es energia disponible para actuar.',
    'Cada dificultad es informacion. Usala para adaptarte, no para sufrir.',
  ],
  active_inference: [
    'Tu cerebro predice lo que va a pasar. Actualiza la prediccion con lo que ves.',
    'La sorpresa es informacion. Integrarla reduce la incertidumbre.',
    'No reaccionas al mundo, lo predices. Mejora tus predicciones.',
  ],
  neuroplasticity: [
    'Cada repeticion fortalece una conexion neuronal. Estas construyendo tu cerebro.',
    'Tu cerebro se reorganiza hasta los 100 anos. Nunca es tarde para cambiar.',
    'La practica deliberada crea nuevas rutas. Hoy es una nueva ruta.',
  ],
  epigenetics: [
    'Tus genes son el piano, tus habits son las manos que tocan. Tu eliges la melodia.',
    'El estres cronico activa genes inflamatorios. La calma los silencia.',
    'Lo que comes, como duermes y como piensas modulan tu expresion genetica.',
  ],
};

const BREATH_CYCLE_MS = 11000;

export class BioSoftwareInterface {
  private state: BioState;
  private breathStart: number | null = null;
  private breathCycles: number = 0;

  constructor() {
    this.state = {
      activeProtocol: null,
      currentSession: null,
      sessions: [],
      cardiacCoherence: 0.5,
      stressLevel: 0.5,
      focusLevel: 0.5,
      enabled: false,
    };
  }

  setEnabled(enabled: boolean): void {
    this.state.enabled = enabled;
    if (!enabled && this.state.currentSession) {
      this.stopSession();
    }
  }

  isEnabled(): boolean {
    return this.state.enabled;
  }

  getState(): BioState {
    return { ...this.state };
  }

  getProtocols(): BioProtocolDef[] {
    return BIO_PROTOCOLS;
  }

  getProtocolDef(id: BioProtocol): BioProtocolDef | undefined {
    return BIO_PROTOCOLS.find((p) => p.id === id);
  }

  startSession(protocol: BioProtocol): BioSession | null {
    if (!this.state.enabled) return null;
    if (this.state.currentSession) this.stopSession();
    const def = this.getProtocolDef(protocol);
    if (!def) return null;
    const session: BioSession = {
      id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
      protocol,
      startedAt: Date.now(),
      endedAt: null,
      duration: def.defaultDuration,
      metrics: {
        coherenceScore: 0,
        placeboAdherence: 0,
        reframingCount: 0,
        breathCycles: 0,
        avgHeartRate: null,
        stressLevel: this.state.stressLevel,
        focusLevel: this.state.focusLevel,
      },
      reframes: [],
      completed: false,
    };
    this.state.activeProtocol = protocol;
    this.state.currentSession = session;
    this.breathStart = Date.now();
    this.breathCycles = 0;
    return session;
  }

  stopSession(): BioSession | null {
    const session = this.state.currentSession;
    if (!session) return null;
    session.endedAt = Date.now();
    session.completed = true;
    session.metrics.breathCycles = this.breathCycles;
    session.metrics.coherenceScore = this.computeCoherence();
    session.metrics.placeboAdherence = this.computePlaceboAdherence();
    session.metrics.stressLevel = this.state.stressLevel;
    session.metrics.focusLevel = this.state.focusLevel;
    this.state.sessions = [...this.state.sessions, session];
    this.state.currentSession = null;
    this.state.activeProtocol = null;
    this.breathStart = null;
    this.breathCycles = 0;
    return session;
  }

  tick(elapsedMs: number): void {
    if (!this.state.currentSession) return;
    const session = this.state.currentSession;
    if (this.breathStart !== null) {
      const cycles = Math.floor((Date.now() - this.breathStart) / BREATH_CYCLE_MS);
      if (cycles > this.breathCycles) {
        this.breathCycles = cycles;
        session.metrics.breathCycles = cycles;
        this.state.cardiacCoherence = Math.min(1, 0.5 + cycles * 0.03);
        session.metrics.coherenceScore = this.state.cardiacCoherence;
        this.state.stressLevel = Math.max(0, 0.5 - cycles * 0.02);
        this.state.focusLevel = Math.min(1, 0.5 + cycles * 0.025);
      }
    }
    if (elapsedMs >= session.duration * 1000) {
      this.stopSession();
    }
  }

  getReframe(): string | null {
    if (!this.state.activeProtocol) return null;
    const pool = REFRAMES[this.state.activeProtocol];
    const idx = Math.floor(Math.random() * pool.length);
    const text = pool[idx];
    if (this.state.currentSession) {
      this.state.currentSession.reframes.push(text);
      this.state.currentSession.metrics.reframingCount++;
    }
    return text;
  }

  private computeCoherence(): number {
    if (!this.state.currentSession) return 0;
    const minutes = (Date.now() - this.state.currentSession.startedAt) / 60000;
    return Math.min(1, 0.3 + minutes * 0.1 + this.breathCycles * 0.02);
  }

  private computePlaceboAdherence(): number {
    if (!this.state.currentSession) return 0;
    const reframeCount = this.state.currentSession.metrics.reframingCount;
    return Math.min(1, 0.4 + reframeCount * 0.1);
  }

  getProgress(): number {
    if (!this.state.currentSession) return 0;
    const elapsed = (Date.now() - this.state.currentSession.startedAt) / 1000;
    return Math.min(1, elapsed / this.state.currentSession.duration);
  }

  getBreathPhase(): 'inhale' | 'hold' | 'exhale' | null {
    if (!this.state.currentSession || this.breathStart === null) return null;
    const elapsed = (Date.now() - this.breathStart) % BREATH_CYCLE_MS;
    if (elapsed < 4000) return 'inhale';
    if (elapsed < 5000) return 'hold';
    if (elapsed < 10000) return 'exhale';
    return 'hold';
  }

  getSessionHistory(): BioSession[] {
    return [...this.state.sessions];
  }

  getStats(): { totalSessions: number; avgCoherence: number; totalReframes: number; totalBreathCycles: number } {
    const sessions = this.state.sessions;
    if (sessions.length === 0) {
      return { totalSessions: 0, avgCoherence: 0, totalReframes: 0, totalBreathCycles: 0 };
    }
    const avgCoherence = sessions.reduce((acc, s) => acc + s.metrics.coherenceScore, 0) / sessions.length;
    const totalReframes = sessions.reduce((acc, s) => acc + s.metrics.reframingCount, 0);
    const totalBreathCycles = sessions.reduce((acc, s) => acc + s.metrics.breathCycles, 0);
    return { totalSessions: sessions.length, avgCoherence, totalReframes, totalBreathCycles };
  }

  clearHistory(): void {
    this.state.sessions = [];
  }
}

export const bioSoftware = new BioSoftwareInterface();
