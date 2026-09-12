import { GuardianStatus } from '../core/BacterialGuardian';
import { EVOLISEvidence } from '../core/EVOLIS';

interface BlindSentinelPanelProps {
  guardianStatus: GuardianStatus | null;
  isBacterialGuardianActive: boolean;
  activateGuardian: () => void;
  deactivateGuardian: () => void;
  evidenceCount: number;
  getEvidence: () => EVOLISEvidence[];
  exportData: () => Promise<void>;
  humanVeto: boolean;
  toggleHumanVeto: () => void;
}

export function BlindSentinelPanel(_props: BlindSentinelPanelProps) {
  return null;
}
