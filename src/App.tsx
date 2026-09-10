import { useEffect } from "react";
import { SensorDashboard } from "./components/SensorDashboard";
import { AccessibleSensorUI } from "./components/AccessibleSensorUI";
import { deviceSensorManager } from "./core/DeviceSensorManager";
import { sensorHub } from "./core/SensorHub";
import { perceptionEngine } from "./core/PerceptionEngine";
import { sensorModule } from "./modules/SensorModule";
import { createSimulatedSensors } from "./sensors/SimulatedSensors";
import { createNativeSensors } from "./services/NativeSensorService";
import { createGPSSensor } from "./services/GPSSensorService";

export default function App() {
  useEffect(() => {
    deviceSensorManager.detectAvailableSensors();

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

  return <main className="sentra-app-shell"><AccessibleSensorUI /><SensorDashboard /></main>;
}
