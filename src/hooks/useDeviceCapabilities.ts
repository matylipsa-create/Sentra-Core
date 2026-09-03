import { useEffect, useState } from 'react';
import { DeviceManager, DeviceCapabilities } from '../core/DeviceManager';

const deviceManager = new DeviceManager();

export function useDeviceCapabilities(): {
  capabilities: DeviceCapabilities | null;
  loading: boolean;
} {
  const [capabilities, setCapabilities] = useState<DeviceCapabilities | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const caps = deviceManager.detect();
    setCapabilities(caps);
    setLoading(false);

    const handleOnline = () => setCapabilities({ ...caps, isOnline: true });
    const handleOffline = () => setCapabilities({ ...caps, isOnline: false });
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { capabilities, loading };
}
