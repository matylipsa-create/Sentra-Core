import { contextGovernor } from './ContextGovernor';
import { bacterialGuardian } from './BacterialGuardian';
import { eventRouter } from './EventRouter';
import { voiceManager } from '../services/VoiceManager';
import sentraVisionAccessibility from '../modules/SentraVisionAccessibility';
import { deviceManager } from './DeviceManager';
import { cognitiveLoadManager } from './CognitiveLoadManager';

class MultimodalIntegration {
  private static _instance: MultimodalIntegration | null = null;
  private _initialized = false;

  public static getInstance(): MultimodalIntegration {
    if (!MultimodalIntegration._instance) {
      MultimodalIntegration._instance = new MultimodalIntegration();
    }
    return MultimodalIntegration._instance;
  }

  public init(): void {
    if (this._initialized) return;
    if (bacterialGuardian && typeof (bacterialGuardian as any).setContextGovernor === 'function') {
      (bacterialGuardian as any).setContextGovernor(contextGovernor);
    }
    if (eventRouter && typeof (eventRouter as any).setContextGovernor === 'function') {
      (eventRouter as any).setContextGovernor(contextGovernor);
    }
    if (sentraVisionAccessibility && typeof (sentraVisionAccessibility as any).setVoiceManager === 'function') {
      (sentraVisionAccessibility as any).setVoiceManager(voiceManager);
    }
    this._initialized = true;
    console.log('[MultimodalIntegration] Sistema conectado.');
  }

  public getGovernor() { return contextGovernor; }
  public getGuardian() { return bacterialGuardian; }
  public getRouter() { return eventRouter; }
  public getVoice() { return voiceManager; }
  public getAccessibility() { return sentraVisionAccessibility; }
  public getHaptics() { return deviceManager; }
  public getCognitiveLoad() { return cognitiveLoadManager; }
}

export const multimodalIntegration = MultimodalIntegration.getInstance();
export default MultimodalIntegration;
