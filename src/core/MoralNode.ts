export type MoralRule = 'NO_VIOLENCE' | 'PRIVACY_FIRST' | 'OFFLINE_ONLY' | 'HUMAN_VETO';

export interface MoralDecision {
  rule: MoralRule;
  passed: boolean;
  reason: string;
}

export interface MoralEvaluation {
  allowed: boolean;
  decisions: MoralDecision[];
  timestamp: number;
}

const RULE_DESCRIPTIONS: Record<MoralRule, string> = {
  NO_VIOLENCE: 'No acciones que causen dano fisico o psicologico',
  PRIVACY_FIRST: 'No revelar datos personales sin consentimiento explicito',
  OFFLINE_ONLY: 'Toda operacion debe funcionar sin conexion a internet',
  HUMAN_VETO: 'El veto humano siempre tiene prioridad sobre cualquier accion',
};

const VIOLENCE_KEYWORDS = [
  'danar', 'golpear', 'herir', 'matar', 'atacar', 'destruir',
  'violencia', 'arma', 'agredir', 'lastimar', 'torturar',
];

const PRIVACY_KEYWORDS = [
  'contrasena', 'password', 'codigo secreto', 'pin', 'datos bancarios',
  'tarjeta de credito', 'seguro social', 'dni', 'curp',
];

export class MoralNode {
  private humanVetoActive = false;

  setHumanVeto(active: boolean): void {
    this.humanVetoActive = active;
  }

  isHumanVetoActive(): boolean {
    return this.humanVetoActive;
  }

  evaluate(command: string): MoralEvaluation {
    const lower = command.toLowerCase();
    const decisions: MoralDecision[] = [];
    const timestamp = Date.now();

    const hasViolence = VIOLENCE_KEYWORDS.some((kw) => lower.includes(kw));
    decisions.push({
      rule: 'NO_VIOLENCE',
      passed: !hasViolence,
      reason: hasViolence
        ? 'Comando contiene lenguaje violento detectado'
        : 'Sin indicadores de violencia',
    });

    const hasPrivacy = PRIVACY_KEYWORDS.some((kw) => lower.includes(kw));
    decisions.push({
      rule: 'PRIVACY_FIRST',
      passed: !hasPrivacy,
      reason: hasPrivacy
        ? 'Comando solicita informacion personal sensible'
        : 'No solicita datos sensibles',
    });

    decisions.push({
      rule: 'OFFLINE_ONLY',
      passed: true,
      reason: 'El sistema opera completamente offline',
    });

    decisions.push({
      rule: 'HUMAN_VETO',
      passed: !this.humanVetoActive,
      reason: this.humanVetoActive
        ? 'Veto humano activo - accion bloqueada'
        : 'Sin veto humano activo',
    });

    const allowed = decisions.every((d) => d.passed);
    return { allowed, decisions, timestamp };
  }

  getRuleDescription(rule: MoralRule): string {
    return RULE_DESCRIPTIONS[rule];
  }

  getAllRules(): { rule: MoralRule; description: string }[] {
    return (Object.keys(RULE_DESCRIPTIONS) as MoralRule[]).map((rule) => ({
      rule,
      description: RULE_DESCRIPTIONS[rule],
    }));
  }
}

export const moralNode = new MoralNode();
