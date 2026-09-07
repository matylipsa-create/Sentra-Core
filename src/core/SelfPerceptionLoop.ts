export interface SessionMetrics {
  startedAt: number;
  commandsProcessed: number;
  detectionsMade: number;
  bioSessionsCompleted: number;
  evidenceRecorded: number;
  moralBlocks: number;
}

export interface AgentStats {
  totalCommands: number;
  totalDetections: number;
  totalBioSessions: number;
  totalEvidence: number;
  totalMoralBlocks: number;
  dailyCommands: number;
  dailyDate: string;
  avgCoherence: number;
  uptimeMs: number;
}

export class SelfPerceptionLoop {
  private sessionStart: number;
  private session: SessionMetrics;
  private totalCommands = 0;
  private totalDetections = 0;
  private totalBioSessions = 0;
  private totalEvidence = 0;
  private totalMoralBlocks = 0;
  private dailyCommands = 0;
  private dailyDate: string;
  private avgCoherence = 0.5;
  private coherenceSamples = 0;

  constructor() {
    this.sessionStart = Date.now();
    this.session = {
      startedAt: this.sessionStart,
      commandsProcessed: 0,
      detectionsMade: 0,
      bioSessionsCompleted: 0,
      evidenceRecorded: 0,
      moralBlocks: 0,
    };
    this.dailyDate = new Date().toDateString();
  }

  recordAction(action: string): void {
    this.rollDailyIfNeeded();
    switch (action) {
      case 'command':
        this.session.commandsProcessed++;
        this.totalCommands++;
        this.dailyCommands++;
        break;
      case 'detection':
        this.session.detectionsMade++;
        this.totalDetections++;
        break;
      case 'bio_session_complete':
        this.session.bioSessionsCompleted++;
        this.totalBioSessions++;
        break;
      case 'evidence':
        this.session.evidenceRecorded++;
        this.totalEvidence++;
        break;
      case 'moral_block':
        this.session.moralBlocks++;
        this.totalMoralBlocks++;
        break;
    }
  }

  recordCoherence(coherence: number): void {
    this.coherenceSamples++;
    this.avgCoherence = this.avgCoherence + (coherence - this.avgCoherence) / this.coherenceSamples;
  }

  private rollDailyIfNeeded(): void {
    const today = new Date().toDateString();
    if (today !== this.dailyDate) {
      this.dailyDate = today;
      this.dailyCommands = 0;
    }
  }

  getStats(): AgentStats {
    this.rollDailyIfNeeded();
    return {
      totalCommands: this.totalCommands,
      totalDetections: this.totalDetections,
      totalBioSessions: this.totalBioSessions,
      totalEvidence: this.totalEvidence,
      totalMoralBlocks: this.totalMoralBlocks,
      dailyCommands: this.dailyCommands,
      dailyDate: this.dailyDate,
      avgCoherence: this.avgCoherence,
      uptimeMs: Date.now() - this.sessionStart,
    };
  }

  getSessionMetrics(): SessionMetrics {
    return { ...this.session };
  }

  getAgentStatus(): string {
    const uptimeMin = Math.floor((Date.now() - this.sessionStart) / 60000);
    if (uptimeMin < 1) return 'Recien iniciado';
    if (uptimeMin < 5) return 'En calentamiento';
    if (this.totalCommands < 10) return 'En observacion';
    if (this.avgCoherence > 0.7) return 'Optimo';
    if (this.avgCoherence > 0.5) return 'Normal';
    return 'Bajo rendimiento';
  }

  getDailySummary(): string {
    const stats = this.getStats();
    const status = this.getAgentStatus();
    return `Hoy procese ${stats.dailyCommands} comandos. ` +
      `Total acumulado: ${stats.totalCommands} comandos, ${stats.totalEvidence} registros EVOLIS. ` +
      `Coherencia promedio: ${Math.round(stats.avgCoherence * 100)}%. ` +
      `Estado: ${status}.`;
  }

  getSelfReport(): string {
    const stats = this.getStats();
    const status = this.getAgentStatus();
    const session = this.getSessionMetrics();
    const uptimeMin = Math.floor(stats.uptimeMs / 60000);
    return `Soy ${this.identityName()}. ` +
      `Hoy procese ${stats.dailyCommands} comandos. ` +
      `En esta sesion: ${session.commandsProcessed} comandos, ${session.detectionsMade} detecciones. ` +
      `Coherencia promedio: ${Math.round(stats.avgCoherence * 100)}%. ` +
      `Estoy en modo ${status.toLowerCase()}. ` +
      `Tiempo activo: ${uptimeMin} minutos.`;
  }

  private identityName(): string {
    return 'Sentra Core';
  }

  resetStats(): void {
    this.totalCommands = 0;
    this.totalDetections = 0;
    this.totalBioSessions = 0;
    this.totalEvidence = 0;
    this.totalMoralBlocks = 0;
    this.dailyCommands = 0;
    this.avgCoherence = 0.5;
    this.coherenceSamples = 0;
    this.sessionStart = Date.now();
    this.session = {
      startedAt: this.sessionStart,
      commandsProcessed: 0,
      detectionsMade: 0,
      bioSessionsCompleted: 0,
      evidenceRecorded: 0,
      moralBlocks: 0,
    };
  }
}

export const selfPerceptionLoop = new SelfPerceptionLoop();
