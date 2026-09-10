/**
 * OrchestratorEngine — Motor de orquestacion nativo offline-first.
 *
 * Reemplaza la dependencia externa de n8n con orquestacion interna:
 * escucha eventos del PerceptionEngine, los encadena en flujos y
 * ejecuta acciones via ActionDispatcher sin salir del sistema.
 */

import { perceptionEngine, PerceptionEvent } from './PerceptionEngine';
import { eventRouter, RouteDecision } from './EventRouter';
import { actionDispatcher, ActionType } from './ActionDispatcher';
import { failoverManager } from './FailoverManager';
import { offlineLogger } from './OfflineLogger';
import { moralNode } from './MoralNode';
import { evolis } from './EVOLIS';

export type StepType = 'trigger' | 'filter' | 'route' | 'action' | 'log' | 'alert';

export interface OrchestratorStep {
  id: string;
  name: string;
  type: StepType;
  handler: (event: OrchestratorEvent) => Promise<OrchestratorEvent | null>;
  nextStepId?: string;
  failoverStepId?: string;
}

export interface OrchestratorEvent {
  id: string;
  source: string;
  category: string;
  message: string;
  level: 'info' | 'warning' | 'critical';
  data?: Record<string, unknown>;
  timestamp: number;
}

export interface FlowNodeExecution {
  stepId: string;
  stepName: string;
  stepType: StepType;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt: number;
  endedAt: number | null;
  error?: string;
}

export interface FlowStatus {
  running: boolean;
  currentStepId: string | null;
  executedNodes: FlowNodeExecution[];
  totalEvents: number;
  failedEvents: number;
  lastEvent: OrchestratorEvent | null;
}

type FlowListener = (status: FlowStatus) => void;

class OrchestratorEngine {
  private steps = new Map<string, OrchestratorStep>();
  private entryStepId: string | null = null;
  private running = false;
  private unsubscribePerception: (() => void) | null = null;
  private status: FlowStatus = {
    running: false,
    currentStepId: null,
    executedNodes: [],
    totalEvents: 0,
    failedEvents: 0,
    lastEvent: null,
  };
  private listeners = new Set<FlowListener>();
  private maxExecutedHistory = 100;

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.registerStep({
      id: 'entry-trigger',
      name: 'Entrada de Evento',
      type: 'trigger',
      handler: async (event) => event,
      nextStepId: 'ethical-filter',
    });

    this.registerStep({
      id: 'ethical-filter',
      name: 'Filtro Etico (MoralNode)',
      type: 'filter',
      handler: async (event) => {
        const evalResult = moralNode.evaluate(event.message);
        if (!evalResult.allowed) {
          const reason = evalResult.decisions.find((d) => !d.passed)?.reason ?? 'Bloqueado por filtro etico';
          actionDispatcher.sendAlert('warning', `Evento bloqueado: ${reason}`);
          offlineLogger.log({ type: 'moral_block', message: reason, data: { event } });
          return null;
        }
        return event;
      },
      nextStepId: 'context-route',
    });

    this.registerStep({
      id: 'context-route',
      name: 'Router de Contexto',
      type: 'route',
      handler: async (event) => {
        const decision = eventRouter.route(event);
        event.data = { ...event.data, routeDecision: decision };
        return event;
      },
      nextStepId: 'dispatch-action',
    });

    this.registerStep({
      id: 'dispatch-action',
      name: 'Dispatcher de Accion',
      type: 'action',
      handler: async (event) => {
        const decision = event.data?.['routeDecision'] as RouteDecision | undefined;
        if (decision && decision.actionType !== 'block') {
          actionDispatcher.dispatch({
            type: decision.actionType as ActionType,
            level: event.level,
            message: event.message,
            category: event.category,
            data: event.data,
          });
        }
        return event;
      },
      nextStepId: 'evolis-record',
    });

    this.registerStep({
      id: 'evolis-record',
      name: 'Registro EVOLIS',
      type: 'log',
      handler: async (event) => {
        await evolis.record('orchestrator', event.level, JSON.stringify({
          source: event.source,
          category: event.category,
          message: event.message,
        }));
        offlineLogger.log({ type: 'orchestrator_event', message: event.message, data: { event } });
        return event;
      },
    });

    this.entryStepId = 'entry-trigger';
  }

  registerStep(step: OrchestratorStep): void {
    this.steps.set(step.id, step);
  }

  startOrchestration(): void {
    if (this.running) return;
    this.running = true;
    this.status.running = true;
    this.unsubscribePerception = perceptionEngine.onEvent((perceptionEvent) => {
      const orchEvent = this.fromPerceptionEvent(perceptionEvent);
      void this.executeFlow(orchEvent);
    });
    this.notifyListeners();
  }

  stopOrchestration(): void {
    this.running = false;
    this.status.running = false;
    this.status.currentStepId = null;
    if (this.unsubscribePerception) {
      this.unsubscribePerception();
      this.unsubscribePerception = null;
    }
    this.notifyListeners();
  }

  async executeFlow(event: OrchestratorEvent): Promise<void> {
    if (!this.running || !this.entryStepId) return;
    this.status.totalEvents++;
    this.status.lastEvent = event;

    let currentStepId: string | null = this.entryStepId;
    let currentEvent: OrchestratorEvent | null = event;

    while (currentStepId && currentEvent) {
      const step = this.steps.get(currentStepId);
      if (!step) break;

      const nodeExec: FlowNodeExecution = {
        stepId: step.id,
        stepName: step.name,
        stepType: step.type,
        status: 'running',
        startedAt: Date.now(),
        endedAt: null,
      };
      this.status.currentStepId = step.id;
      this.addNode(nodeExec);

      try {
        const result = await step.handler(currentEvent);
        nodeExec.status = result ? 'completed' : 'skipped';
        nodeExec.endedAt = Date.now();
        this.updateNode(nodeExec);

        if (!result) break;
        currentEvent = result;
        currentStepId = step.nextStepId ?? null;
      } catch (err) {
        nodeExec.status = 'failed';
        nodeExec.endedAt = Date.now();
        nodeExec.error = err instanceof Error ? err.message : 'Error desconocido';
        this.updateNode(nodeExec);
        this.status.failedEvents++;
        failoverManager.onError(err instanceof Error ? err : new Error(String(err)));
        currentStepId = step.failoverStepId ?? null;
      }
    }

    this.status.currentStepId = null;
    this.notifyListeners();
  }

  getFlowStatus(): FlowStatus {
    return { ...this.status, executedNodes: [...this.status.executedNodes] };
  }

  subscribe(listener: FlowListener): () => void {
    this.listeners.add(listener);
    listener(this.getFlowStatus());
    return () => this.listeners.delete(listener);
  }

  private fromPerceptionEvent(pe: PerceptionEvent): OrchestratorEvent {
    return {
      id: pe.id,
      source: pe.sensorId,
      category: pe.category,
      message: pe.message,
      level: pe.level,
      data: pe.data as Record<string, unknown> | undefined,
      timestamp: pe.timestamp,
    };
  }

  private addNode(node: FlowNodeExecution): void {
    this.status.executedNodes.unshift(node);
    if (this.status.executedNodes.length > this.maxExecutedHistory) {
      this.status.executedNodes.pop();
    }
    this.notifyListeners();
  }

  private updateNode(node: FlowNodeExecution): void {
    const idx = this.status.executedNodes.findIndex((n) => n.stepId === node.stepId && n.startedAt === node.startedAt);
    if (idx >= 0) {
      this.status.executedNodes[idx] = { ...node };
    }
    this.notifyListeners();
  }

  private notifyListeners(): void {
    const status = this.getFlowStatus();
    for (const listener of this.listeners) listener(status);
  }
}

export const orchestratorEngine = new OrchestratorEngine();
