/**
 * EventRouter — Router de eventos interno.
 *
 * Enruta eventos segun contexto, intensidad y evaluacion moral.
 * Reemplaza los nodos Filter y Switch de n8n.
 */

import { moralNode } from './MoralNode';
import { ternaryEthics, tritToValue, Trit } from './TernaryMath';

export type RouteActionType = 'voice' | 'vibrate' | 'evolis_record' | 'alert' | 'log' | 'block';

export interface RouteDecision {
  actionType: RouteActionType;
  target: string;
  priority: number;
  intensity: number;
  moralAllowed: boolean;
  ternaryLabel: string;
  reason: string;
}

export interface RoutableEvent {
  id: string;
  source: string;
  category: string;
  message: string;
  level: 'info' | 'warning' | 'critical';
  data?: Record<string, unknown>;
  timestamp: number;
}

const CATEGORY_ACTION_MAP: Record<string, RouteActionType> = {
  ambient: 'log',
  motion: 'alert',
  vision: 'voice',
  audio: 'alert',
  contact: 'alert',
  gas: 'alert',
  flow: 'alert',
  location: 'log',
  system: 'log',
};

class EventRouter {
  route(event: RoutableEvent): RouteDecision {
    const moralEval = moralNode.evaluate(event.message);
    const intensity = this.evaluateIntensity(event);
    const ternaryResult = ternaryEthics.evaluate(
      moralEval.allowed,
      false,
      true,
      true,
    );

    let actionType: RouteActionType = CATEGORY_ACTION_MAP[event.category] ?? 'log';
    if (!moralEval.allowed) {
      actionType = 'block';
    } else if (event.level === 'critical') {
      actionType = 'alert';
    } else if (event.level === 'warning' && intensity > 0.7) {
      actionType = 'alert';
    }

    return {
      actionType,
      target: this.resolveTarget(event, actionType),
      priority: this.intensityToPriority(intensity),
      intensity,
      moralAllowed: moralEval.allowed,
      ternaryLabel: tritToValue(ternaryResult.value as Trit),
      reason: moralEval.allowed
        ? `Enrutado a ${actionType} (intensidad ${(intensity * 100).toFixed(0)}%)`
        : moralEval.decisions.find((d) => !d.passed)?.reason ?? 'Bloqueado',
    };
  }

  filter(event: RoutableEvent): boolean {
    if (!event.message || event.message.trim().length === 0) return false;
    const moralEval = moralNode.evaluate(event.message);
    return moralEval.allowed;
  }

  evaluateIntensity(event: RoutableEvent): number {
    let base = 0.3;
    if (event.level === 'critical') base = 0.9;
    else if (event.level === 'warning') base = 0.6;
    else base = 0.3;

    if (event.data) {
      const keys = Object.keys(event.data);
      if (keys.length > 5) base += 0.05;
      const hasNumeric = Object.values(event.data).some((v) => typeof v === 'number');
      if (hasNumeric) base += 0.05;
    }

    return Math.min(1, base);
  }

  enrich(event: RoutableEvent): RoutableEvent {
    const intensity = this.evaluateIntensity(event);
    const moralEval = moralNode.evaluate(event.message);
    return {
      ...event,
      data: {
        ...event.data,
        enriched: true,
        intensity,
        moralAllowed: moralEval.allowed,
        timestamp: Date.now(),
      },
    };
  }

  private resolveTarget(_event: RoutableEvent, actionType: RouteActionType): string {
    if (actionType === 'block') return 'moral_node';
    if (actionType === 'voice') return 'voice_manager';
    if (actionType === 'vibrate') return 'device_manager';
    if (actionType === 'evolis_record') return 'evolis';
    if (actionType === 'alert') return 'alert_module';
    return 'offline_logger';
  }

  private intensityToPriority(intensity: number): number {
    if (intensity >= 0.8) return 1;
    if (intensity >= 0.5) return 2;
    return 3;
  }

  private _priorityCooldowns: Record<string, number> = {
    CRITICAL: 500,
    NAVIGATION: 1500,
    DESCRIPTIVE: 3000,
  };
  private _lastEventTime: Record<string, number> = {};
  private _contextGovernor: any = null;

  public setContextGovernor(g: any): void {
    this._contextGovernor = g;
  }

  public routeWithPriority(
    level: 'CRITICAL' | 'NAVIGATION' | 'DESCRIPTIVE',
    handler: () => void
  ): boolean {
    const now = Date.now();
    const cooldown = this._priorityCooldowns[level] || 1000;
    const last = this._lastEventTime[level] || 0;
    if (now - last < cooldown) return false;
    if (level !== 'CRITICAL' && this._contextGovernor?.isCriticalActive?.()) return false;
    this._lastEventTime[level] = now;
    handler();
    return true;
  }
}

export const eventRouter = new EventRouter();
