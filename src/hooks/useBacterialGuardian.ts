import { useEffect, useState, useCallback } from 'react';
import { bacterialGuardian, GuardianStatus, GuardianAlert } from '../core/BacterialGuardian';

export function useBacterialGuardian(): {
  status: GuardianStatus | null;
  activate: () => void;
  deactivate: () => void;
  resolveAlert: (id: string) => void;
  clearAlerts: () => void;
  dismissQuarantine: () => void;
  checkChain: () => Promise<boolean>;
} {
  const [status, setStatus] = useState<GuardianStatus | null>(null);

  useEffect(() => {
    const unsubscribe = bacterialGuardian.subscribe((s) => setStatus(s));
    return unsubscribe;
  }, []);

  const activate = useCallback(() => bacterialGuardian.activate(), []);
  const deactivate = useCallback(() => bacterialGuardian.deactivate(), []);
  const resolveAlert = useCallback((id: string) => bacterialGuardian.resolveAlert(id), []);
  const clearAlerts = useCallback(() => bacterialGuardian.clearAlerts(), []);
  const dismissQuarantine = useCallback(() => bacterialGuardian.dismissQuarantine(), []);
  const checkChain = useCallback(() => bacterialGuardian.checkChain(), []);

  return { status, activate, deactivate, resolveAlert, clearAlerts, dismissQuarantine, checkChain };
}
