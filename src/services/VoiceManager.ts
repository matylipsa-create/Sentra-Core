export interface VoiceCue {
  id: string;
  text: string;
  priority: number;
  timestamp: number;
}

export class VoiceManager {
  private synth: SpeechSynthesis | null = null;
  private queue: VoiceCue[] = [];
  private current: VoiceCue | null = null;
  private lastSpoken: Map<string, number> = new Map();
  private dedupeWindowMs = 5000;
  private enabled = true;

  constructor() {
    if ('speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.stop();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  speak(text: string, priority = 5): void {
    if (!this.enabled || !this.synth) return;
    const now = Date.now();
    const last = this.lastSpoken.get(text);
    if (last && now - last < this.dedupeWindowMs) return;
    this.lastSpoken.set(text, now);
    const cue: VoiceCue = {
      id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
      text, priority, timestamp: now,
    };
    this.queue.push(cue);
    this.queue.sort((a, b) => a.priority - b.priority);
    this.processQueue();
  }

  private processQueue(): void {
    if (!this.synth || this.current) return;
    const next = this.queue.shift();
    if (!next) return;
    this.current = next;
    const utterance = new SpeechSynthesisUtterance(next.text);
    utterance.lang = 'es-ES';
    utterance.rate = 1.0;
    utterance.onend = () => { this.current = null; this.processQueue(); };
    utterance.onerror = () => { this.current = null; this.processQueue(); };
    this.synth.speak(utterance);
  }

  stop(): void {
    if (this.synth) this.synth.cancel();
    this.current = null;
    this.queue = [];
  }

  pause(): void { if (this.synth) this.synth.pause(); }
  resume(): void { if (this.synth) this.synth.resume(); }
  getQueueLength(): number { return this.queue.length; }
  isSpeaking(): boolean { return this.current !== null; }
  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    return this.synth.getVoices();
  }
}

export const voiceManager = new VoiceManager();
