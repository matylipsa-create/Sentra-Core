import { useState, useCallback } from 'react';
import { n8nService, N8NResponse } from '../services/N8NService';

export function useN8N(): {
  webhookUrl: string;
  setWebhookUrl: (url: string) => void;
  enabled: boolean;
  lastResponse: N8NResponse | null;
  sendEvent: (event: string, module: string, data: unknown) => Promise<N8NResponse | null>;
  sendDetection: (detections: { class: string; score: number }[]) => Promise<N8NResponse | null>;
  sendAlert: (message: string) => Promise<N8NResponse | null>;
  sendCommand: (command: string) => Promise<N8NResponse | null>;
} {
  const [webhookUrl, setUrl] = useState('');
  const [lastResponse, setLastResponse] = useState<N8NResponse | null>(null);

  const setWebhookUrl = useCallback((url: string) => {
    n8nService.setWebhookUrl(url);
    setUrl(url);
  }, []);

  const sendEvent = useCallback(async (event: string, module: string, data: unknown) => {
    const res = await n8nService.sendEvent(event, module, data);
    if (res) setLastResponse(res);
    return res;
  }, []);

  const sendDetection = useCallback(async (detections: { class: string; score: number }[]) => {
    const res = await n8nService.sendDetection(detections);
    if (res) setLastResponse(res);
    return res;
  }, []);

  const sendAlert = useCallback(async (message: string) => {
    const res = await n8nService.sendAlert(message);
    if (res) setLastResponse(res);
    return res;
  }, []);

  const sendCommand = useCallback(async (command: string) => {
    const res = await n8nService.sendCommand(command);
    if (res) setLastResponse(res);
    return res;
  }, []);

  return {
    webhookUrl,
    setWebhookUrl,
    enabled: n8nService.is_enabled(),
    lastResponse,
    sendEvent,
    sendDetection,
    sendAlert,
    sendCommand,
  };
}
