export interface N8NEvent {
  event: string;
  module: string;
  data: unknown;
  timestamp: number;
  deviceId: string;
}

export interface N8NResponse {
  decision: string;
  action?: string;
  message?: string;
  veto?: boolean;
}

export class N8NService {
  private webhookUrl: string = '';
  private enabled: boolean = false;
  private deviceId: string;

  constructor(deviceId: string) {
    this.deviceId = deviceId;
  }

  setWebhookUrl(url: string): void {
    this.webhookUrl = url;
    this.enabled = !!url;
  }

  is_enabled(): boolean {
    return this.enabled;
  }

  getWebhookUrl(): string {
    return this.webhookUrl;
  }

  async sendEvent(event: string, module: string, data: unknown): Promise<N8NResponse | null> {
    if (!this.enabled || !this.webhookUrl) return null;

    const payload: N8NEvent = {
      event,
      module,
      data,
      timestamp: Date.now(),
      deviceId: this.deviceId,
    };

    try {
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return null;
      const response = await res.json() as N8NResponse;
      return response;
    } catch {
      return null;
    }
  }

  async sendDetection(detections: { class: string; score: number }[]): Promise<N8NResponse | null> {
    return this.sendEvent('evento_deteccion', 'vision', detections);
  }

  async sendAlert(message: string): Promise<N8NResponse | null> {
    return this.sendEvent('alerta_seguridad', 'seguridad', { message });
  }

  async sendCommand(command: string): Promise<N8NResponse | null> {
    return this.sendEvent('comando_usuario', 'aprendizaje', { command });
  }
}

export const n8nService = new N8NService(
  crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)
);
