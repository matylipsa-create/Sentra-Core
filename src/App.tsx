import { useEffect } from "react";
import { SensorDashboard } from "./components/SensorDashboard";
import { sensorHub } from "./core/SensorHub";
import { perceptionEngine } from "./core/PerceptionEngine";
import { sensorModule } from "./modules/SensorModule";
import { createSimulatedSensors } from "./sensors/SimulatedSensors";

export default function App() {
  useEffect(() => {
    for (const sensor of createSimulatedSensors()) {
      sensorHub.register(sensor);
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

  return <SensorDashboard />;
}
