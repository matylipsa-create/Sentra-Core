/**
 * AlertModule — Modulo de alertas nativo.
 *
 * Reemplaza el envio a Telegram / notificaciones externas de n8n.
 * Genera alertas internas con niveles, historial y persistencia local.
 */

import { offlineLogger } from '../core/OfflineLogger';
import { actionDispatcher } from '../core/ActionDispatcher';
import { deviceManager } from '../core/DeviceManager';
import { voiceManager } from '../services/VoiceManager';

export type AlertLevel = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  level: AlertLevel;
  message: string;
  source: string;
  timestamp: number;
  acknowledged: boolean;
}

type AlertListener = (alerts: Alert[]) => void;

const MAX_HISTORY = 200;

class AlertModule {
  private alerts: Alert[] = [];
  private listeners = new Set<AlertListener>();

  alert(level: AlertLevel, message: string, source: string = 'system'): void {
    const entry: Alert = {
      id: this.generateId(),
      level,
      message,
      source,
      timestamp: Date.now(),
      acknowledged: false,
    };

    this.alerts.unshift(entry);
    if (this.alerts.length > MAX_HISTORY) this.alerts.pop();

    offlineLogger.log({
      type: 'alert',
      message,
      level,
      data: { source, alertId: entry.id },
    });

    this.triggerSideEffects(entry);
    this.notify();
  }

  getAlertHistory(): Alert[] {
    return [...this.alerts];
  }

  getActiveAlerts(): Alert[] {
    return this.alerts.filter((a) => !a.acknowledged);
  }

  acknowledge(id: string): void {
    const alert = this.alerts.find((a) => a.id === id);
    if (alert) {
      alert.acknowledged = true;
      this.notify();
    }
  }

  clearAll(): void {
    this.alerts = [];
    this.notify();
  }

  subscribe(listener: AlertListener): () => void {
    this.listeners.add(listener);
    listener(this.getAlertHistory());
    return () => this.listeners.delete(listener);
  }

  private triggerSideEffects(alert: Alert): void {
    if (alert.level === 'critical') {
      deviceManager.vibrate([200, 100, 200, 100, 200]);
      voiceManager.speak(alert.message, 1);
      actionDispatcher.sendAlert('critical', alert.message);
    } else if (alert.level === 'warning') {
      deviceManager.vibrate([100, 50, 100]);
      voiceManager.speak(alert.message, 2);
    }
  }

  private notify(): void {
    const snapshot = this.getAlertHistory();
    for (const listener of this.listeners) listener(snapshot);
  }

  private generateId(): string {
    return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
  }
}

export const alertModule = new AlertModule();
