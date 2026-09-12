/**
 * PriorityQueue — Cola de eventos con 3 niveles jerárquicos.
 *
 * CRITICAL (1) > NAVIGATION (2) > DESCRIPTIVE (3)
 * Cooldowns por tipo: critical 500ms, navigation 1500ms, descriptive 3000ms.
 */

export type PriorityLevel = 'critical' | 'navigation' | 'descriptive';

export interface PriorityEvent {
  id: string;
  level: PriorityLevel;
  type: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

const LEVEL_VALUE: Record<PriorityLevel, number> = {
  critical: 1,
  navigation: 2,
  descriptive: 3,
};

const COOLDOWN_MS: Record<PriorityLevel, number> = {
  critical: 500,
  navigation: 1500,
  descriptive: 3000,
};

const MAX_QUEUE = 100;

class PriorityQueueManager {
  private queue: PriorityEvent[] = [];
  private lastDispatch: Map<string, number> = new Map();

  enqueue(event: Omit<PriorityEvent, 'id' | 'timestamp'>): PriorityEvent | null {
    const full: PriorityEvent = {
      ...event,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    const cooldownKey = `${event.level}:${event.type}`;
    const last = this.lastDispatch.get(cooldownKey) ?? 0;
    if (Date.now() - last < COOLDOWN_MS[event.level]) return null;

    this.lastDispatch.set(cooldownKey, Date.now());

    if (event.level === 'critical') {
      this.clearBelowLevel('critical');
      this.queue.unshift(full);
    } else {
      this.queue.push(full);
    }

    this.queue.sort((a, b) => LEVEL_VALUE[a.level] - LEVEL_VALUE[b.level]);
    if (this.queue.length > MAX_QUEUE) this.queue.length = MAX_QUEUE;
    return full;
  }

  dequeue(): PriorityEvent | null {
    return this.queue.shift() ?? null;
  }

  peek(): PriorityEvent | null {
    return this.queue[0] ?? null;
  }

  clearBelowLevel(level: PriorityLevel): void {
    const threshold = LEVEL_VALUE[level];
    this.queue = this.queue.filter((e) => LEVEL_VALUE[e.level] <= threshold);
  }

  clearAll(): void {
    this.queue = [];
  }

  size(): number {
    return this.queue.length;
  }

  hasCritical(): boolean {
    return this.queue.some((e) => e.level === 'critical');
  }

  private generateId(): string {
    return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
  }
}

export const priorityQueue = new PriorityQueueManager();
