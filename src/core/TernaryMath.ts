export type Trit = 1 | 0 | -1;

export type TernaryValue = 'positive' | 'neutral' | 'negative';

export const TRIT_POS: Trit = 1;
export const TRIT_NEUTRAL: Trit = 0;
export const TRIT_NEG: Trit = -1;

export function tritFromValue(v: TernaryValue): Trit {
  if (v === 'positive') return TRIT_POS;
  if (v === 'negative') return TRIT_NEG;
  return TRIT_NEUTRAL;
}

export function tritToValue(t: Trit): TernaryValue {
  if (t > 0) return 'positive';
  if (t < 0) return 'negative';
  return 'neutral';
}

export function tritFromBoolean(b: boolean): Trit {
  return b ? TRIT_POS : TRIT_NEG;
}

export function tritFromScore(score: number, threshold = 0.5): Trit {
  if (score > threshold) return TRIT_POS;
  if (score < -threshold) return TRIT_NEG;
  return TRIT_NEUTRAL;
}

export function ternaryNot(t: Trit): Trit {
  return (-t) as Trit;
}

export function ternaryAnd(a: Trit, b: Trit): Trit {
  if (a === TRIT_NEG || b === TRIT_NEG) return TRIT_NEG;
  if (a === TRIT_NEUTRAL || b === TRIT_NEUTRAL) return TRIT_NEUTRAL;
  return TRIT_POS;
}

export function ternaryOr(a: Trit, b: Trit): Trit {
  if (a === TRIT_POS || b === TRIT_POS) return TRIT_POS;
  if (a === TRIT_NEUTRAL || b === TRIT_NEUTRAL) return TRIT_NEUTRAL;
  return TRIT_NEG;
}

export function ternaryMul(a: Trit, b: Trit): Trit {
  return ternaryAnd(a, b);
}

export function ternaryConsensus(values: Trit[]): Trit {
  if (values.length === 0) return TRIT_NEUTRAL;
  let sum = 0;
  for (const v of values) sum += v;
  const avg = sum / values.length;
  if (avg > 0.25) return TRIT_POS;
  if (avg < -0.25) return TRIT_NEG;
  return TRIT_NEUTRAL;
}

export function ternaryWeightedConsensus(values: { trit: Trit; weight: number }[]): Trit {
  if (values.length === 0) return TRIT_NEUTRAL;
  let totalWeight = 0;
  let weightedSum = 0;
  for (const { trit, weight } of values) {
    weightedSum += trit * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) return TRIT_NEUTRAL;
  const avg = weightedSum / totalWeight;
  if (avg > 0.2) return TRIT_POS;
  if (avg < -0.2) return TRIT_NEG;
  return TRIT_NEUTRAL;
}

export interface TernaryEvaluation {
  value: Trit;
  label: TernaryValue;
  score: number;
  confidence: number;
  breakdown: { factor: string; trit: Trit; weight: number }[];
}

export class TernaryTrust {
  private history: { timestamp: number; trit: Trit }[] = [];
  private decayMs = 60000;

  evaluate(factors: { factor: string; score: number; weight: number; threshold?: number }[]): TernaryEvaluation {
    const breakdown = factors.map((f) => ({
      factor: f.factor,
      trit: tritFromScore(f.score, f.threshold ?? 0.5),
      weight: f.weight,
    }));
    const trit = ternaryWeightedConsensus(breakdown.map((b) => ({ trit: b.trit, weight: b.weight })));
    const score = breakdown.reduce((acc, b) => acc + b.trit * b.weight, 0) /
      (breakdown.reduce((acc, b) => acc + b.weight, 0) || 1);
    const confidence = Math.min(1, Math.abs(score));
    this.history.push({ timestamp: Date.now(), trit });
    if (this.history.length > 100) this.history.shift();
    return {
      value: trit,
      label: tritToValue(trit),
      score,
      confidence,
      breakdown,
    };
  }

  getRecentHistory(ms: number = this.decayMs): Trit[] {
    const cutoff = Date.now() - ms;
    return this.history.filter((h) => h.timestamp >= cutoff).map((h) => h.trit);
  }

  getTrend(): Trit {
    const recent = this.getRecentHistory();
    if (recent.length === 0) return TRIT_NEUTRAL;
    return ternaryConsensus(recent);
  }
}

export class TernaryEthics {
  evaluate(
    moralAllowed: boolean,
    humanVeto: boolean,
    chainValid: boolean,
    usbSafe: boolean
  ): TernaryEvaluation {
    const factors: { factor: string; score: number; weight: number }[] = [
      { factor: 'moral_filter', score: moralAllowed ? 1 : -1, weight: 3 },
      { factor: 'human_veto', score: humanVeto ? -1 : 1, weight: 4 },
      { factor: 'hash_chain_integrity', score: chainValid ? 1 : -1, weight: 3 },
      { factor: 'usb_guardian', score: usbSafe ? 1 : -1, weight: 2 },
    ];
    const trust = new TernaryTrust();
    return trust.evaluate(factors);
  }
}

export const ternaryTrust = new TernaryTrust();
export const ternaryEthics = new TernaryEthics();
