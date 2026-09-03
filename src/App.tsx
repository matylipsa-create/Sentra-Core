import { useRef, useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { AdaptiveUI } from './components/AdaptiveUI';
import { AccessibleMinimalUI } from './components/AccessibleMinimalUI';
import { CameraStream } from './components/CameraStream';
import { DemoModeBanner } from './components/DemoModeBanner';
import { useRealModeSensors } from './hooks/useRealModeSensors';
import { usePowerMode } from './hooks/usePowerMode';
import { useDeviceCapabilities } from './hooks/useDeviceCapabilities';
import { useSensorService } from './hooks/useSensorService';
import { moduleManager } from './modules/ModuleManager';
import { evolis } from './core/EVOLIS';
import { syncManager, SyncTransport } from './core/SyncManager';
import { deviceManager } from './core/DeviceManager';
import { PowerMode } from './core/PowerManager';

function EvidenceView() {
  const { getEvidence, exportData } = useApp();
  const { showToast } = useToast();
  const evidence = getEvidence();

  return (
    <div className="module-content evidence-view">
      <h2>Cadena de Evidencia EVOLIS</h2>
      <p className="evidence-count">{evidence.length} entradas registradas</p>
      {evidence.length === 0 ? (
        <p className="empty-state">No hay evidencia registrada todavia.</p>
      ) : (
        <div className="evidence-chain">
          {evidence.slice(-20).reverse().map((e) => (
            <div key={e.id} className="evidence-entry">
              <div className="evidence-header">
                <span className="evidence-index">#{e.entry.index}</span>
                <span className="evidence-module">{e.module}</span>
                <span className="evidence-action">{e.action}</span>
              </div>
              <div className="evidence-hash">{e.entry.hash.slice(0, 24)}{'...'}</div>
              <div className="evidence-time">
                {new Date(e.entry.timestamp).toLocaleString('es-ES')}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="evidence-actions">
        <button
          className="action-btn"
          onClick={async () => {
            const valid = await evolis.verify();
            showToast(
              valid ? 'Cadena verificada: integridad y firmas OK' : 'Cadena corrupta o firma invalida',
              valid ? 'success' : 'error'
            );
          }}
        >
          Verificar integridad
        </button>
        <button className="action-btn" onClick={() => exportData()}>
          Exportar respaldo
        </button>
      </div>
    </div>
  );
}

function LearningView() {
  const { processCommand, lastResponse } = useApp();
  const [question, setQuestion] = useState('');

  return (
    <div className="module-content learning-view">
      <h2>Aprendizaje</h2>
      <p>Haz una pregunta y recibiras una respuesta contextual.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) {
            processCommand(question.trim());
            setQuestion('');
          }
        }}
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Que quieres saber?"
          aria-label="Pregunta"
        />
        <button type="submit">Preguntar</button>
      </form>
      {lastResponse && (
        <div className="learning-response">
          <span className="response-source">{lastResponse.source}</span>
          <p>{lastResponse.text}</p>
        </div>
      )}
    </div>
  );
}

type GameScene = 'intro' | 'forest' | 'cave' | 'village' | 'end';

const GAME_SCENES: Record<GameScene, {
  text: string;
  options: { label: string; next: GameScene; command?: string }[];
}> = {
  intro: {
    text: 'Te encuentras en un camino de tierra. A tu izquierda hay un bosque oscuro. A tu derecha, una cueva. Al frente, un pueblo lejano.',
    options: [
      { label: 'Entrar al bosque', next: 'forest', command: 'ir al bosque' },
      { label: 'Explorar la cueva', next: 'cave', command: 'explorar la cueva' },
      { label: 'Caminar al pueblo', next: 'village', command: 'caminar al pueblo' },
    ],
  },
  forest: {
    text: 'El bosque es denso y humedo. Escuchas ruidos entre los arboles. Encuentras un sendero que se divide en dos.',
    options: [
      { label: 'Seguir el sendero', next: 'village', command: 'seguir el sendero' },
      { label: 'Volver al camino', next: 'intro', command: 'volver' },
    ],
  },
  cave: {
    text: 'La cueva es fria y oscura. Ves una tenue luz mas adentro. Algo brilla en el suelo.',
    options: [
      { label: 'Recoger el objeto', next: 'end', command: 'recoger el objeto' },
      { label: 'Salir de la cueva', next: 'intro', command: 'salir' },
    ],
  },
  village: {
    text: 'Llegas al pueblo. Los habitantes te miran con curiosidad. Un anciano te invita a descansar.',
    options: [
      { label: 'Aceptar el descanso', next: 'end', command: 'descansar' },
      { label: 'Volver al camino', next: 'intro', command: 'volver al camino' },
    ],
  },
  end: {
    text: 'Tu aventura llega a su fin por ahora. Sentra Core ha registrado tu travesia.',
    options: [
      { label: 'Empezar de nuevo', next: 'intro', command: 'reiniciar' },
    ],
  },
};

function GameView() {
  const { processCommand, lastResponse } = useApp();
  const [storyState, setStoryState] = useState<GameScene>('intro');
  const [history, setHistory] = useState<string[]>([]);

  const scene = GAME_SCENES[storyState];

  const handleChoice = (option: { label: string; next: GameScene; command?: string }) => {
    setHistory((h) => [...h, scene.text]);
    setStoryState(option.next);
    if (option.command) {
      processCommand(option.command);
    }
  };

  return (
    <div className="module-content game-view">
      <h2>Narrativa Adaptativa</h2>
      <div className="game-scene" aria-live="polite">
        <p className="scene-text">{scene.text}</p>
      </div>
      <div className="game-options">
        {scene.options.map((opt, i) => (
          <button
            key={i}
            className="game-option-btn"
            onClick={() => handleChoice(opt)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {history.length > 0 && (
        <div className="game-history">
          <h3>Historial</h3>
          {history.slice(-3).map((h, i) => (
            <p key={i} className="history-entry">{h}</p>
          ))}
        </div>
      )}
      {lastResponse && (
        <div className="game-response">
          <span className="response-source">{lastResponse.source}</span>
          <p>{lastResponse.text}</p>
        </div>
      )}
    </div>
  );
}

function SilenceView() {
  return (
    <div className="module-content silence-view">
      <h2>Modo Silencio</h2>
      <p>Comunicacion no verbal. Usa vibracion para interactuar.</p>
      <div className="silence-pad">
        <button className="vibrate-btn" onClick={() => deviceManager.vibrate([100])}>
          Pulso corto
        </button>
        <button className="vibrate-btn" onClick={() => deviceManager.vibrate([200, 100, 200])}>
          Pulso doble
        </button>
        <button className="vibrate-btn" onClick={() => deviceManager.vibrate([500])}>
          Pulso largo
        </button>
      </div>
    </div>
  );
}

function MovementView() {
  const [sensorData, setSensorData] = useState<{
    gps: { latitude: number; longitude: number; accuracy: number } | null;
    orientation: { alpha: number; beta: number; gamma: number } | null;
    accel: { x: number; y: number; z: number } | null;
  }>({ gps: null, orientation: null, accel: null });
  const { reading } = useSensorService();

  useEffect(() => {
    let watchId: number | null = null;
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition((pos) => {
        setSensorData((s) => ({
          ...s,
          gps: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
        }));
      });
    }
    const handleOrient = (e: DeviceOrientationEvent) => {
      setSensorData((s) => ({
        ...s,
        orientation: { alpha: e.alpha ?? 0, beta: e.beta ?? 0, gamma: e.gamma ?? 0 },
      }));
    };
    const handleMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (a) {
        setSensorData((s) => ({
          ...s,
          accel: { x: a.x ?? 0, y: a.y ?? 0, z: a.z ?? 0 },
        }));
      }
    };
    window.addEventListener('deviceorientation', handleOrient);
    window.addEventListener('devicemotion', handleMotion);
    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      window.removeEventListener('deviceorientation', handleOrient);
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, []);

  return (
    <div className="module-content movement-view">
      <h2>Navegacion y Orientacion</h2>
      <div className="sensor-grid">
        <div className="sensor-card">
          <h3>GPS</h3>
          {sensorData.gps ? (
            <div>
              <p>Lat: {sensorData.gps.latitude.toFixed(4)}</p>
              <p>Lon: {sensorData.gps.longitude.toFixed(4)}</p>
              <p>Precision: {Math.round(sensorData.gps.accuracy)}m</p>
            </div>
          ) : (
            <p className="sensor-unavailable">GPS no disponible</p>
          )}
        </div>
        <div className="sensor-card">
          <h3>Orientacion</h3>
          {sensorData.orientation ? (
            <div>
              <p>Alpha: {Math.round(sensorData.orientation.alpha)} grados</p>
              <p>Beta: {Math.round(sensorData.orientation.beta)} grados</p>
              <p>Gamma: {Math.round(sensorData.orientation.gamma)} grados</p>
            </div>
          ) : (
            <p className="sensor-unavailable">Sin datos</p>
          )}
        </div>
        <div className="sensor-card">
          <h3>Acelerometro</h3>
          {sensorData.accel ? (
            <div>
              <p>X: {sensorData.accel.x.toFixed(2)}</p>
              <p>Y: {sensorData.accel.y.toFixed(2)}</p>
              <p>Z: {sensorData.accel.z.toFixed(2)}</p>
            </div>
          ) : (
            <p className="sensor-unavailable">Sin datos</p>
          )}
        </div>
      </div>
      {reading?.compass && (
        <div className="sensor-card" style={{ marginTop: '16px' }}>
          <h3>Brujula</h3>
          <p>Heading: {Math.round(reading.compass.heading)} grados</p>
        </div>
      )}
    </div>
  );
}

function PowerControls() {
  const { mode, setMode, allProfiles, batteryLevel, isCharging } = usePowerMode();

  return (
    <div className="power-controls">
      <div className="battery-status">
        <span className="battery-label">Bateria</span>
        <div className="battery-bar">
          <div
            className="battery-fill"
            style={{ width: `${batteryLevel !== null ? batteryLevel * 100 : 100}%` }}
          />
        </div>
        <span>
          {batteryLevel !== null ? Math.round(batteryLevel * 100) : '?'}%
          {isCharging ? ' \u{26A1}' : ''}
        </span>
      </div>
      <div className="power-modes">
        {allProfiles.map((p) => (
          <button
            key={p.mode}
            className={`power-mode-btn ${mode === p.mode ? 'active' : ''}`}
            onClick={() => setMode(p.mode as PowerMode)}
          >
            <strong>{p.label}</strong>
            <span>{p.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ImpactView() {
  return (
    <div className="module-content impact-view">
      <h2>Gestion de Energia</h2>
      <PowerControls />
    </div>
  );
}

function SyncControls() {
  const { syncTransport, setSyncTransport } = useApp();
  const syncStatus = syncManager.getStatus();
  const transports: { id: SyncTransport; label: string }[] = [
    { id: 'offline', label: 'Offline' },
    { id: 'syncthing', label: 'Syncthing' },
    { id: 'bluetooth_mesh', label: 'Bluetooth Mesh' },
    { id: 'lora', label: 'LoRa' },
  ];

  return (
    <div className="sync-controls">
      <h3>Sincronizacion P2P</h3>
      <div className="transport-selector">
        {transports.map((t) => (
          <button
            key={t.id}
            className={`transport-btn ${syncTransport === t.id ? 'active' : ''}`}
            onClick={() => setSyncTransport(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="sync-stats">
        <p>Transporte activo: <strong>{syncStatus.transport}</strong></p>
        <p>Pares conectados: <strong>{syncStatus.peers.length}</strong></p>
        <p>Paquetes pendientes: <strong>{syncStatus.pendingPackets}</strong></p>
        <p>Paquetes sincronizados: <strong>{syncStatus.syncedPackets}</strong></p>
        <p>Bluetooth: <strong>{syncStatus.bluetoothConnected ? 'Conectado' : 'Desconectado'}</strong></p>
      </div>
      {syncTransport === 'bluetooth_mesh' && (
        <div className="sync-actions">
          <button
            className="action-btn"
            onClick={async () => {
              const ok = await syncManager.connectBluetooth();
              if (!ok) {
                /* toast handled by caller in real usage */
              }
            }}
          >
            Conectar Bluetooth
          </button>
          <button
            className="action-btn"
            onClick={() => syncManager.disconnectBluetooth()}
          >
            Desconectar
          </button>
        </div>
      )}
    </div>
  );
}

function SecurityView() {
  return (
    <div className="module-content security-view">
      <h2>Monitoreo de Seguridad</h2>
      <SyncControls />
    </div>
  );
}

function VisionView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { activeModule } = useApp();
  const { profile } = usePowerMode();
  const isActive = activeModule === 'vision' && profile.enableVision;
  const sensorState = useRealModeSensors(videoRef, isActive, profile.visionIntervalMs || 5000);

  return (
    <div className="module-content vision-view">
      {sensorState.loading && <p className="loading-text">Cargando modelo de vision</p>}
      {sensorState.error && <p className="error-text">Error: {sensorState.error}</p>}
      <CameraStream
        active={isActive}
        detections={sensorState.detections}
        onVideoReady={(v: HTMLVideoElement) => { (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = v; }}
      />
      {!isActive && <p className="vision-disabled">Vision deshabilitada en modo {profile.label}</p>}
      {sensorState.perception?.vision && (
        <div className="vision-description" aria-live="polite">
          <p>{sensorState.perception.vision.description}</p>
        </div>
      )}
    </div>
  );
}

function MainContent() {
  const { activeModule } = useApp();
  const { capabilities } = useDeviceCapabilities();
  const { showToast } = useToast();

  useEffect(() => {
    if (!capabilities) return;
    const def = moduleManager.getModule(activeModule);
    if (!def) return;
    const canRun = moduleManager.canRun(activeModule, {
      hasCamera: capabilities.hasCamera,
      hasGPS: capabilities.hasGPS,
      hasAccelerometer: capabilities.hasAccelerometer,
    });
    if (!canRun) {
      showToast(`Tu dispositivo no soporta el modulo ${def.label}`, 'warning');
    }
  }, [activeModule, capabilities, showToast]);

  if (activeModule === 'vision') return <VisionView />;
  if (activeModule === 'evidencia') return <EvidenceView />;
  if (activeModule === 'aprendizaje') return <LearningView />;
  if (activeModule === 'juego') return <GameView />;
  if (activeModule === 'silencio') return <SilenceView />;
  if (activeModule === 'movimiento') return <MovementView />;
  if (activeModule === 'impacto') return <ImpactView />;
  if (activeModule === 'seguridad') return <SecurityView />;
  return null;
}

function SettingsPanel() {
  const { geminiRemote, setGeminiRemote, humanVeto, toggleHumanVeto, voiceEnabled, toggleVoice } = useApp();
  const [apiKey, setApiKey] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <div className={`settings-panel ${panelOpen ? 'open' : ''}`}>
      <button
        className="settings-toggle"
        onClick={() => setPanelOpen(!panelOpen)}
        aria-label="Configuracion"
        aria-expanded={panelOpen}
      >
        {panelOpen ? '\u{2715}' : '\u{2699}'}
      </button>
      {panelOpen && (
        <div className="settings-content">
          <h3>Configuracion</h3>
          <div className="setting-row">
            <label>
              <input type="checkbox" checked={voiceEnabled} onChange={toggleVoice} />
              Voz habilitada
            </label>
          </div>
          <div className="setting-row">
            <label>
              <input type="checkbox" checked={humanVeto} onChange={toggleHumanVeto} />
              Veto humano
            </label>
          </div>
          <div className="setting-row">
            <label>
              <input
                type="checkbox"
                checked={geminiRemote}
                onChange={(e) => {
                  if (e.target.checked && apiKey) setGeminiRemote(true, apiKey);
                  else setGeminiRemote(false);
                }}
              />
              Gemini remoto
            </label>
          </div>
          {geminiRemote && (
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Gemini API Key"
              aria-label="Gemini API Key"
            />
          )}
        </div>
      )}
    </div>
  );
}

function ToastContainer() {
  const { toasts, dismissToast } = useToast();
  return (
    <div className="toast-container" role="alert" aria-live="assertive">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.type}`}
          onClick={() => dismissToast(t.id)}
          role="alert"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

function AppInner() {
  return (
    <AdaptiveUI>
      <DemoModeBanner />
      <main className="app-main">
        <MainContent />
      </main>
      <AccessibleMinimalUI />
      <SettingsPanel />
      <ToastContainer />
    </AdaptiveUI>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <AppInner />
      </AppProvider>
    </ToastProvider>
  );
}
