import { useEffect } from "react";
import { SensorDashboard } from "./SensorDashboard";
import { AccessibleSensorUI } from "./AccessibleSensorUI";
import { sensorHub } from "../core/SensorHub";
import { perceptionEngine } from "../core/PerceptionEngine";
import { sensorModule } from "../modules/SensorModule";
import { createSimulatedSensors } from "../sensors/SimulatedSensors";
import { createNativeSensors } from "../services/NativeSensorService";
import { createGPSSensor } from "../services/GPSSensorService";
import { sentraGuardianHub } from "../core/SentraGuardianHub";
import { BlindTactileQuadrants } from "./BlindTactileQuadrants";

export function BlindUnifiedUI() {
  useEffect(() => {
    // Wiring multimodal: conecta hub → governor, router, accessibility, voice
    sentraGuardianHub.initMultimodal();

    // Sensores reales nativos (Accelerometer, Gyroscope, AmbientLight, GPS)
    for (const sensor of createNativeSensors()) {
      try { sensorHub.register(sensor); } catch { /* id collision */ }
    }
    const gps = createGPSSensor();
    if (gps) {
      try { sensorHub.register(gps); } catch { /* id collision */ }
    }

    // Sensores simulados como fallback — siempre disponibles
    for (const sensor of createSimulatedSensors()) {
      try { sensorHub.register(sensor); } catch { /* id collision */ }
    }

    perceptionEngine.start();
    sensorModule.start();
    sensorHub.startAll();

    return () => {
      sensorHub.stopAll();
      perceptionEngine.stop();
      sensorModule.stop();
    };
  }, []);

  const handleQuadrantAction = (action: string, quadrant: string) => {
    switch (action) {
      case 'TOGGLE_EYES_MODE':
      case 'DESCRIBE_NOW':
        sentraGuardianHub.requestDescription();
        break;
      case 'SENTINEL_STATUS': {
        const state = sentraGuardianHub.getState();
        sentraGuardianHub.onSentinelEvent({
          severity: 'low',
          message: state.sentinelAlertActive
            ? 'Guardian en alerta. Perimetro comprometido.'
            : 'Perimetro seguro. Sin alertas.',
          source: 'quadrant',
        });
        break;
      }
      case 'PANIC_OR_PERIMETER':
        sentraGuardianHub.silenceAll();
        break;
    }
  };

  return (
    <main className="sentra-app-shell">
      <AccessibleSensorUI />
      <SensorDashboard />
      <BlindTactileQuadrants onAction={handleQuadrantAction} />
    </main>
  );
}

export default BlindUnifiedUI;