import { useEffect, useRef, useState } from 'react';
import { sensorService, SensorReading } from '../services/SensorService';
import { usePowerMode } from './usePowerMode';

export function useSensorService(): {
  reading: SensorReading | null;
  active: boolean;
} {
  const { profile } = usePowerMode();
  const [reading, setReading] = useState<SensorReading | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    sensorService.setInterval(profile.sensorIntervalMs);

    if (!startedRef.current) {
      sensorService.start();
      startedRef.current = true;
    }

    const unsubscribe = sensorService.subscribe((r) => setReading(r));

    return () => {
      unsubscribe();
    };
  }, [profile.sensorIntervalMs]);

  useEffect(() => {
    return () => {
      if (startedRef.current) {
        sensorService.stop();
        startedRef.current = false;
      }
    };
  }, []);

  return { reading, active: startedRef.current };
}
