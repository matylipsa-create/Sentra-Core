import {
  ReactNode, createContext, useContext, useState, useCallback, useEffect,
} from 'react';
import { evolis, EVOLISEvidence } from '../core/EVOLIS';
import { moralNode, MoralEvaluation } from '../core/MoralNode';
import { geminiService } from '../core/GeminiService';
import { TCREIResponse } from '../core/TCREIBridge';
import { perceptionEngine, PerceptionData } from '../core/PerceptionEngine';
import { syncManager, SyncTransport } from '../core/SyncManager';
import { voiceManager } from '../services/VoiceManager';
import { storageService } from '../services/StorageService';
import { PowerMode } from '../core/PowerManager';

export type ModuleName =
  | 'vision' | 'seguridad' | 'movimiento' | 'juego'
  | 'aprendizaje' | 'impacto' | 'silencio' | 'evidencia';

export interface AppState {
  activeModule: ModuleName;
  voiceEnabled: boolean;
  humanVeto: boolean;
  powerMode: PowerMode;
  syncTransport: SyncTransport;
  lastResponse: TCREIResponse | null;
  lastPerception: PerceptionData | null;
  lastMoralEval: MoralEvaluation | null;
  evidenceCount: number;
  geminiRemote: boolean;
}

interface AppContextValue extends AppState {
  setModule: (module: ModuleName) => void;
  toggleVoice: () => void;
  toggleHumanVeto: () => void;
  setPowerMode: (mode: PowerMode) => void;
  setSyncTransport: (transport: SyncTransport) => void;
  processCommand: (command: string, perception?: PerceptionData) => Promise<void>;
  setGeminiRemote: (enabled: boolean, apiKey?: string) => void;
  exportData: () => Promise<void>;
  getEvidence: () => EVOLISEvidence[];
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    activeModule: 'vision', voiceEnabled: true, humanVeto: false,
    powerMode: 'normal', syncTransport: 'offline',
    lastResponse: null, lastPerception: null, lastMoralEval: null,
    evidenceCount: 0, geminiRemote: false,
  });

  useEffect(() => {
    storageService.init().then(() => {
      storageService.getAllEvidence().then((entries) => {
        if (entries.length > 0) {
          evolis.importState(entries);
          setState((s) => ({ ...s, evidenceCount: entries.length }));
        }
      });
    });
  }, []);

  const setModule = useCallback((module: ModuleName) => {
    setState((s) => ({ ...s, activeModule: module }));
    voiceManager.speak(`Modulo ${module} activado`, 3);
  }, []);

  const toggleVoice = useCallback(() => {
    setState((s) => {
      const enabled = !s.voiceEnabled;
      voiceManager.setEnabled(enabled);
      return { ...s, voiceEnabled: enabled };
    });
  }, []);

  const toggleHumanVeto = useCallback(() => {
    setState((s) => {
      const veto = !s.humanVeto;
      moralNode.setHumanVeto(veto);
      if (veto) voiceManager.speak('Veto humano activado. Todas las acciones estan bloqueadas.', 1);
      else voiceManager.speak('Veto humano desactivado. Operacion normal.', 1);
      return { ...s, humanVeto: veto };
    });
  }, []);

  const setPowerMode = useCallback((mode: PowerMode) => {
    setState((s) => ({ ...s, powerMode: mode }));
  }, []);

  const setSyncTransport = useCallback((transport: SyncTransport) => {
    syncManager.setTransport(transport);
    setState((s) => ({ ...s, syncTransport: transport }));
  }, []);

  const setGeminiRemote = useCallback((enabled: boolean, apiKey?: string) => {
    if (enabled && apiKey) geminiService.setApiKey(apiKey);
    else geminiService.setApiKey('');
    setState((s) => ({ ...s, geminiRemote: enabled }));
  }, []);

  const processCommand = useCallback(async (command: string, perception?: PerceptionData) => {
    const eval_ = moralNode.evaluate(command);
    setState((s) => ({ ...s, lastMoralEval: eval_ }));
    if (!eval_.allowed) {
      const reason = eval_.decisions.find((d) => !d.passed)?.reason ?? 'Accion bloqueada';
      voiceManager.speak(`Accion bloqueada: ${reason}`, 1);
      return;
    }
    const perceptionData = perception ?? state.lastPerception;
    const perceptionSummary = perceptionData
      ? perceptionEngine.summarize(perceptionData) : 'Sin percepcion activa';
    const response = await geminiService.query(state.activeModule, perceptionSummary, command);
    await evolis.record(state.activeModule, 'command', command);
    const evidence = evolis.getEntries();
    await storageService.saveEvidence(evidence[evidence.length - 1]);
    setState((s) => ({
      ...s, lastResponse: response, evidenceCount: evidence.length,
    }));
    if (state.voiceEnabled) voiceManager.speak(response.text, 5);
  }, [state.activeModule, state.lastPerception, state.voiceEnabled]);

  const exportData = useCallback(async () => {
    await storageService.downloadExport();
  }, []);

  const getEvidence = useCallback(() => evolis.getEntries(), []);

  const value: AppContextValue = {
    ...state, setModule, toggleVoice, toggleHumanVeto,
    setPowerMode, setSyncTransport, processCommand, setGeminiRemote,
    exportData, getEvidence,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
