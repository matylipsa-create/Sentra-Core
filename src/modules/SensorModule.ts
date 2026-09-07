/**
 * SensorModule — Módulo de acción de SentraCore.
 *
 * Escucha los eventos de PerceptionEngine y dispara acciones según
 * las reglas configuradas. Cada regla asocia un patrón de evento con
 * una acción ejecutable.
 */

import {
  perceptionEngine,
  type PerceptionEvent,
  type PerceptionLevel,
} from "../core/PerceptionEngine";
import type { SensorCategory } from "../core/SensorHub";

// ──────────────────────────────────────────────────────────────────────────
// Tipos de acción
// ──────────────────────────────────────────────────────────────────────────

export type ActionType =
  | "alert"
  | "log"
  | "activate_ventilation"
  | "activate_alarm"
  | "shutdown_flow"
  | "notify_operator"
  | "start_recording"
  | "dispatch_security";

export interface SensorAction {
  type: ActionType;
  label: string;
  detail: string;
  timestamp: number;
  eventId: string;
}

export type ActionListener = (action: SensorAction) => void;

// ──────────────────────────────────────────────────────────────────────────
// Reglas
// ──────────────────────────────────────────────────────────────────────────

export interface Rule {
  id: string;
  name: string;
  category: SensorCategory | "*";
  minLevel: PerceptionLevel;
  /** Patrón de texto opcional que debe aparecer en el mensaje del evento. */
  messageContains?: string;
  action: ActionType;
  label: string;
  detail: string;
}

const LEVEL_ORDER: Record<PerceptionLevel, number> = {
  info: 0,
  warning: 1,
  critical: 2,
};

const DEFAULT_RULES: Rule[] = [
  {
    id: "rule-temp-high",
    name: "Temperatura elevada → Ventilación",
    category: "ambient",
    minLevel: "warning",
    messageContains: "Temperatura elevada",
    action: "activate_ventilation",
    label: "Ventilación automática activada",
    detail: "La temperatura superó el umbral; activando ventilación de refrigeración.",
  },
  {
    id: "rule-motion-impact",
    name: "Impacto crítico → Alarma",
    category: "motion",
    minLevel: "critical",
    action: "activate_alarm",
    label: "Alarma de impacto activada",
    detail: "Aceleración excesiva detectada. Alarma sonora y visual activada.",
  },
  {
    id: "rule-vision-motion",
    name: "Movimiento visual → Grabación",
    category: "vision",
    minLevel: "info",
    messageContains: "Movimiento visual",
    action: "start_recording",
    label: "Grabación iniciada",
    detail: "Movimiento detectado por cámara. Iniciando grabación de seguridad.",
  },
  {
    id: "rule-audio-loud",
    name: "Ruido elevado → Alerta",
    category: "audio",
    minLevel: "warning",
    action: "alert",
    label: "Alerta de ruido",
    detail: "Nivel sonoro por encima del umbral permitido.",
  },
  {
    id: "rule-contact-tamper",
    name: "Manipulación → Seguridad",
    category: "contact",
    minLevel: "critical",
    action: "dispatch_security",
    label: "Seguridad desplegada",
    detail: "Manipulación de sensor de contacto detectada. Despachando equipo de seguridad.",
  },
  {
    id: "rule-gas-co",
    name: "CO peligroso → Alarma + Ventilación",
    category: "gas",
    minLevel: "critical",
    action: "activate_alarm",
    label: "Alarma de gas activada",
    detail: "Monóxido de carbono en niveles peligrosos. Activando alarma y ventilación de emergencia.",
  },
  {
    id: "rule-gas-methane",
    name: "Metano → Cierre de flujo",
    category: "gas",
    minLevel: "critical",
    messageContains: "Metano",
    action: "shutdown_flow",
    label: "Cierre de flujo de gas",
    detail: "Metano detectado. Cerrando válvulas de flujo por seguridad.",
  },
  {
    id: "rule-flow-pressure",
    name: "Presión excesiva → Cierre de flujo",
    category: "flow",
    minLevel: "critical",
    action: "shutdown_flow",
    label: "Cierre de flujo por presión",
    detail: "Presión del fluido por encima del límite. Cerrando flujo para evitar rotura.",
  },
  {
    id: "rule-any-critical",
    name: "Cualquier evento crítico → Notificar operador",
    category: "*",
    minLevel: "critical",
    action: "notify_operator",
    label: "Operador notificado",
    detail: "Evento crítico detectado. Notificando al operador de turno.",
  },
  {
    id: "rule-any-warning",
    name: "Cualquier advertencia → Registro",
    category: "*",
    minLevel: "warning",
    action: "log",
    label: "Evento registrado",
    detail: "Advertencia registrada en el historial del sistema.",
  },
];

// ──────────────────────────────────────────────────────────────────────────
// SensorModule
// ──────────────────────────────────────────────────────────────────────────

class SensorModule {
  private rules: Rule[] = DEFAULT_RULES;
  private listeners = new Set<ActionListener>();
  private actionLog: SensorAction[] = [];
  private unsubscribe: (() => void) | null = null;
  private readonly maxLog = 500;

  // ── Configuración de reglas ───────────────────────────────────────────

  getRules(): Rule[] {
    return [...this.rules];
  }

  addRule(rule: Rule): void {
    this.rules.push(rule);
  }

  removeRule(id: string): void {
    this.rules = this.rules.filter((r) => r.id !== id);
  }

  // ── Suscripción a acciones ────────────────────────────────────────────

  onAction(listener: ActionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getActionLog(): SensorAction[] {
    return [...this.actionLog];
  }

  // ── Ciclo de vida ────────────────────────────────────────────────────

  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = perceptionEngine.onEvent((e) => this.handleEvent(e));
  }

  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  // ── Evaluación de reglas ─────────────────────────────────────────────

  private handleEvent(event: PerceptionEvent): void {
    for (const rule of this.rules) {
      if (this.matchesRule(rule, event)) {
        this.fireAction(rule, event);
      }
    }
  }

  private matchesRule(rule: Rule, event: PerceptionEvent): boolean {
    if (rule.category !== "*" && rule.category !== event.category) return false;
    if (LEVEL_ORDER[event.level] < LEVEL_ORDER[rule.minLevel]) return false;
    if (rule.messageContains && !event.message.includes(rule.messageContains)) {
      return false;
    }
    return true;
  }

  private fireAction(rule: Rule, event: PerceptionEvent): void {
    const action: SensorAction = {
      type: rule.action,
      label: rule.label,
      detail: rule.detail,
      timestamp: Date.now(),
      eventId: event.id,
    };
    this.actionLog.unshift(action);
    if (this.actionLog.length > this.maxLog) this.actionLog.pop();
    for (const listener of this.listeners) listener(action);
  }
}

// Singleton — un solo módulo para toda la aplicación.
export const sensorModule = new SensorModule();
