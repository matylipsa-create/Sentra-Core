import { useEffect } from "react";
import { BlindUnifiedUI } from "./components/BlindUnifiedUI";
import { deviceSensorManager } from "./core/DeviceSensorManager";
import { sensorHub } from "./core/SensorHub";
import { perceptionEngine } from "./core/PerceptionEngine";
import { sensorModule } from "./modules/SensorModule";
import { createSimulatedSensors } from "./sensors/SimulatedSensors";
import { createNativeSensors } from "./services/NativeSensorService";
import { createGPSSensor } from "./services/GPSSensorService";
import { sentraGuardianHub } from "./core/SentraGuardianHub";

export default function App() {
  useEffect(() => {
    deviceSensorManager.detectAvailableSensors();
    sentraGuardianHub.initMultimodal();

    for (const sensor of createNativeSensors()) {
      try { sensorHub.register(sensor); } catch { /* id collision */ }
    }
    const gps = createGPSSensor();
    if (gps) {
      try { sensorHub.register(gps); } catch { /* id collision */ }
    }
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

  return <BlindUnifiedUI />;
}
