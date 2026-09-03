import { ReactNode, useEffect, useState } from 'react';
import { DeviceCapabilities } from '../core/DeviceManager';
import { useDeviceCapabilities } from '../hooks/useDeviceCapabilities';

interface AdaptiveUIProps {
  children: ReactNode;
}

export function AdaptiveUI({ children }: AdaptiveUIProps) {
  const { capabilities } = useDeviceCapabilities();
  const [isTouch, setIsTouch] = useState(false);
  const [viewport, setViewport] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  useEffect(() => {
    setIsTouch(capabilities?.touchscreen ?? false);
    setViewport(capabilities?.platform ?? 'desktop');
  }, [capabilities]);

  const className = [
    'adaptive-ui', isTouch ? 'touch' : 'mouse', `viewport-${viewport}`,
  ].join(' ');

  return (
    <div className={className} data-platform={capabilities?.platform ?? 'unknown'}>
      {children}
    </div>
  );
}

export function useAdaptiveLayout(): {
  isTouch: boolean;
  viewport: 'mobile' | 'tablet' | 'desktop';
  capabilities: DeviceCapabilities | null;
} {
  const { capabilities } = useDeviceCapabilities();
  return {
    isTouch: capabilities?.touchscreen ?? false,
    viewport: capabilities?.platform ?? 'desktop',
    capabilities,
  };
}
