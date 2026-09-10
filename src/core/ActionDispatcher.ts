/**
 * ActionDispatcher — Dispatcher de acciones locales.
 *
 * Ejecuta acciones nativas: voz, vibracion, registro en EVOLIS
 * y alertas internas. Reemplaza los nodos de accion externos de n8n.
 */

import { voiceManager } from '../services/VoiceManager';
import { deviceManager } from './DeviceManager';
import { evolis } from './EVOLIS';
import { offlineLogger } from './OfflineLogger';

export type ActionType = 'voice' | 'vibrate' | 'evolis_record' | 'alert' | 'log';

export interface DispatchAction {
  type: ActionType;
  level: 'info' | 'warning' | 'critical';
  message: string;
  category: string;
  data?: Record<string, unknown>;
}

type ActionListener = (action: DispatchAction) => void;

class ActionDispatcher {
  private listeners = new Set<ActionListener>();
  private actionLog: DispatchAction[] = [];
  private readonly maxLog = 200;

  dispatch(action: DispatchAction): void {
    this.actionLog.unshift(action);
    if (this.actionLog.length > this.maxLog) this.actionLog.pop();

    switch (action.type) {
      case 'voice':
        this.doVoice(action);
        break;
      case 'vibrate':
        this.doVibrate(action);
        break;
      case 'evolis_record':
        void this.doEvolisRecord(action);
        break;
      case 'alert':
        this.doAlert(action);
        break;
      case 'log':
        this.doLog(action);
        break;
    }

    for (const listener of this.listeners) listener(action);
  }

  sendAlert(level: DispatchAction['level'], message: string): void {
    this.dispatch({
      type: 'alert',
      level,
      message,
      category: 'system',
    });
  }

  logEvent(event: { type: string; message: string; data?: unknown }): void {
    this.dispatch({
      type: 'log',
      level: 'info',
      message: event.message,
      category: event.type,
      data: event.data as Record<string, unknown> | undefined,
    });
  }

  getActionLog(): DispatchAction[] {
    return [...this.actionLog];
  }

  subscribe(listener: ActionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private doVoice(action: DispatchAction): void {
    const priority = action.level === 'critical' ? 1 : action.level === 'warning' ? 2 : 3;
    voiceManager.speak(action.message, priority);
  }

  private doVibrate(action: DispatchAction): void {
    const pattern: number | number[] = action.level === 'critical'
      ? [200, 100, 200, 100, 200]
      : action.level === 'warning'
        ? [100, 50, 100]
        : 80;
    deviceManager.vibrate(pattern);
  }

  private async doEvolisRecord(action: DispatchAction): Promise<void> {
    await evolis.record('dispatcher', action.type, JSON.stringify({
      category: action.category,
      message: action.message,
      level: action.level,
    }));
  }

  private doAlert(action: DispatchAction): void {
    offlineLogger.log({
      type: 'alert',
      message: action.message,
      level: action.level,
    });
    if (action.level === 'critical' || action.level === 'warning') {
      deviceManager.vibrate(action.level === 'critical' ? [200, 100, 200] : 100);
    }
  }

  private doLog(action: DispatchAction): void {
    offlineLogger.log({
      type: action.category,
      message: action.message,
      data: action.data,
    });
  }
}

export const actionDispatcher = new ActionDispatcher();
