import { useEffect, useState } from 'react';
import { hardwareAutoAdjust, HardwareProfile } from '../core/HardwareAutoAdjust';
import { useDeviceCapabilities } from './useDeviceCapabilities';
import { usePowerMode } from './usePowerMode';

export function useHardwareAutoAdjust(): {
  profile: HardwareProfile | null;
  applied: boolean;
} {
  const { capabilities } = useDeviceCapabilities();
  const { setMode } = usePowerMode();
  const [hwProfile, setHwProfile] = useState<HardwareProfile | null>(null);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (!capabilities || applied) return;
    const profile = hardwareAutoAdjust.adjust(capabilities);
    setHwProfile(profile);
    setMode(profile.powerMode);
    setApplied(true);
  }, [capabilities, applied, setMode]);

  return { profile: hwProfile, applied };
}
