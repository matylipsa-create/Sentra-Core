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
import { bioSoftware, BioProtocol, BioSession } from '../core/BioSoftwareInterface';

export type ModuleName =
  | 'vision' | 'seguridad' | 'movimiento' | 'juego'
  | 'aprendizaje' | 'impacto' | 'silencio' | 'evidencia' | 'bio';

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
  worldEnabled: boolean;
  isPassiveListening: boolean;
  bioEnabled: boolean;
  bioActiveProtocol: BioProtocol | null;
  bioCurrentSession: BioSession | null;
  bioSessions: BioSession[];
  bioReframe: string | null;
}

interface AppContextValue extends AppState {
  setModule: (module: ModuleName) => void;
  toggleVoice: () => void;
  toggleHumanVeto: () => void;
  setPowerMode: (mode: PowerMode) => void;
  setSyncTransport: (transport: SyncTransport) => void;
  processCommand: (command: string, perception?: PerceptionData) => Promise<void>;
  setGeminiRemote: (enabled: boolean, apiKey?: string) => void;
  toggleGeminiRemote: () => void;
  toggleWorldConnection: () => void;
  setLastPerception: (perception: PerceptionData) => void;
  togglePassiveListening: () => void;
  exportData: () => Promise<void>;
  getEvidence: () => EVOLISEvidence[];
  toggleBio: () => void;
  startBioSession: (protocol: BioProtocol) => void;
  stopBioSession: () => void;
  getBioReframe: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => {
    const envApiKey = import.meta.env.VITE_GEMINI_API_KEY ?? '';
    let savedGemini = false;
    let savedWorld = false;
    let savedApiKey = '';
    try {
      savedGemini = localStorage.getItem('sentra_gemini_enabled') === 'true';
      savedWorld = localStorage.getItem('sentra_world_enabled') === 'true';
      savedApiKey = localStorage.getItem('sentra_gemini_api_key') ?? '';
    } catch { /* localStorage unavailable */ }

    const effectiveKey = savedApiKey || envApiKey;
    const geminiOn = savedGemini || (!savedApiKey && !!envApiKey);

    if (effectiveKey) geminiService.setApiKey(effectiveKey);
    geminiService.setRemoteEnabled(geminiOn && !!effectiveKey);
    geminiService.setWorldConnected(savedWorld);

    let savedBio = false;
    try {
      savedBio = localStorage.getItem('sentra_bio_enabled') === 'true';
    } catch { /* localStorage unavailable */ }
    bioSoftware.setEnabled(savedBio);

    return {
      activeModule: 'vision', voiceEnabled: true, humanVeto: false,
      powerMode: 'normal', syncTransport: 'offline',
      lastResponse: null, lastPerception: null, lastMoralEval: null,
      evidenceCount: 0, geminiRemote: geminiOn && !!effectiveKey,
      worldEnabled: savedWorld, isPassiveListening: false,
      bioEnabled: savedBio, bioActiveProtocol: null,
      bioCurrentSession: null, bioSessions: [], bioReframe: null,
    };
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
    const envApiKey = import.meta.env.VITE_GEMINI_API_KEY ?? '';
    if (enabled && apiKey) {
      geminiService.setApiKey(apiKey);
      geminiService.setRemoteEnabled(true);
      try { localStorage.setItem('sentra_gemini_enabled', 'true'); localStorage.setItem('sentra_gemini_api_key', apiKey); } catch { /* localStorage unavailable */ }
    } else if (enabled && envApiKey) {
      geminiService.setApiKey(envApiKey);
      geminiService.setRemoteEnabled(true);
      try { localStorage.setItem('sentra_gemini_enabled', 'true'); } catch { /* localStorage unavailable */ }
    } else {
      geminiService.setApiKey(envApiKey);
      geminiService.setRemoteEnabled(false);
      try { localStorage.setItem('sentra_gemini_enabled', 'false'); localStorage.removeItem('sentra_gemini_api_key'); } catch { /* localStorage unavailable */ }
    }
    setState((s) => ({ ...s, geminiRemote: enabled }));
  }, []);

  const toggleGeminiRemote = useCallback(() => {
    setState((s) => {
      const next = !s.geminiRemote;
      const envApiKey = import.meta.env.VITE_GEMINI_API_KEY ?? '';
      const savedApiKey = (() => { try { return localStorage.getItem('sentra_gemini_api_key') ?? ''; } catch { return ''; } })();
      const effectiveKey = savedApiKey || envApiKey;
      if (next && effectiveKey) {
        geminiService.setApiKey(effectiveKey);
        geminiService.setRemoteEnabled(true);
      } else {
        geminiService.setRemoteEnabled(false);
      }
      try { localStorage.setItem('sentra_gemini_enabled', String(next)); } catch { /* localStorage unavailable */ }
      voiceManager.speak(next ? 'Gemini activado' : 'Gemini desactivado, modo local', 1);
      return { ...s, geminiRemote: next };
    });
  }, []);

  const toggleWorldConnection = useCallback(() => {
    setState((s) => {
      const next = !s.worldEnabled;
      geminiService.setWorldConnected(next);
      try { localStorage.setItem('sentra_world_enabled', String(next)); } catch { /* localStorage unavailable */ }
      voiceManager.speak(next ? 'Conexion al mundo activada' : 'Conexion al mundo desactivada, modo offline', 1);
      return { ...s, worldEnabled: next };
    });
  }, []);

  const processCommand = useCallback(async (command: string, perception?: PerceptionData) => {
    const eval_ = moralNode.evaluate(command, { externalRequest: state.worldEnabled });
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

  const setLastPerception = useCallback((perception: PerceptionData) => {
    setState((s) => ({ ...s, lastPerception: perception }));
  }, []);

  const togglePassiveListening = useCallback(() => {
    setState((s) => {
      const next = !s.isPassiveListening;
      try { localStorage.setItem('sentra_passive_listening', String(next)); } catch { /* localStorage unavailable */ }
      voiceManager.speak(next ? 'Escucha pasiva activada' : 'Escucha pasiva desactivada', 1);
      return { ...s, isPassiveListening: next };
    });
  }, []);

  const exportData = useCallback(async () => {
    await storageService.downloadExport();
  }, []);

  const getEvidence = useCallback(() => evolis.getEntries(), []);

  const toggleBio = useCallback(() => {
    setState((s) => {
      const next = !s.bioEnabled;
      bioSoftware.setEnabled(next);
      try { localStorage.setItem('sentra_bio_enabled', String(next)); } catch { /* localStorage unavailable */ }
      voiceManager.speak(next ? 'BioSoftware activado' : 'BioSoftware desactivado', 1);
      return { ...s, bioEnabled: next };
    });
  }, []);

  const startBioSession = useCallback((protocol: BioProtocol) => {
    const session = bioSoftware.startSession(protocol);
    if (session) {
      const def = bioSoftware.getProtocolDef(protocol);
      voiceManager.speak(`Sesion de ${def?.label ?? protocol} iniciada. Respira y sigue las indicaciones.`, 2);
    }
    setState((s) => ({
      ...s,
      bioActiveProtocol: protocol,
      bioCurrentSession: session,
    }));
  }, []);

  const stopBioSession = useCallback(() => {
    const session = bioSoftware.stopSession();
    if (session) {
      voiceManager.speak(`Sesion completada. Coherencia: ${Math.round(session.metrics.coherenceScore * 100)}%.`, 2);
    }
    const stats = bioSoftware.getState();
    setState((s) => ({
      ...s,
      bioActiveProtocol: null,
      bioCurrentSession: null,
      bioSessions: stats.sessions,
    }));
  }, []);

  const getBioReframe = useCallback(() => {
    const reframe = bioSoftware.getReframe();
    if (reframe) voiceManager.speak(reframe, 3);
    setState((s) => ({ ...s, bioReframe: reframe }));
  }, []);

  const value: AppContextValue = {
    ...state, setModule, toggleVoice, toggleHumanVeto,
    setPowerMode, setSyncTransport, processCommand, setGeminiRemote,
    toggleGeminiRemote, toggleWorldConnection, setLastPerception,
    togglePassiveListening,
    exportData, getEvidence,
    toggleBio, startBioSession, stopBioSession, getBioReframe,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
