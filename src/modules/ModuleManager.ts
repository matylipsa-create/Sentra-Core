import { ModuleName } from '../context/AppContext';

export interface ModuleDef {
  id: ModuleName;
  label: string;
  description: string;
  icon: string;
  requiresCamera: boolean;
  requiresGPS: boolean;
  requiresSensors: boolean;
}

export const MODULE_DEFS: ModuleDef[] = [
  { id: 'vision', label: 'Vision', description: 'Camara + COCO-SSD + descripcion por voz', icon: '\u{1F441}', requiresCamera: true, requiresGPS: false, requiresSensors: false },
  { id: 'seguridad', label: 'Seguridad', description: 'Sensores + alertas + EVOLIS + monitoreo', icon: '\u{1F6E1}', requiresCamera: false, requiresGPS: false, requiresSensors: true },
  { id: 'movimiento', label: 'Movimiento', description: 'GPS + IMU + orientacion + vibracion guia', icon: '\u{1F9ED}', requiresCamera: false, requiresGPS: true, requiresSensors: true },
  { id: 'juego', label: 'Juego', description: 'Narrativa adaptativa', icon: '\u{1F3AE}', requiresCamera: false, requiresGPS: false, requiresSensors: false },
  { id: 'aprendizaje', label: 'Aprendizaje', description: 'GeminiService + preguntas + respuestas', icon: '\u{1F4DA}', requiresCamera: false, requiresGPS: false, requiresSensors: false },
  { id: 'impacto', label: 'Impacto', description: 'STF + ARS Evolved + energy harvesting', icon: '\u{26A1}', requiresCamera: false, requiresGPS: false, requiresSensors: true },
  { id: 'silencio', label: 'Silencio', description: 'Vibracion + LEDs (sin voz)', icon: '\u{1F507}', requiresCamera: false, requiresGPS: false, requiresSensors: true },
  { id: 'evidencia', label: 'Evidencia', description: 'EVOLIS + hash chain + exportacion', icon: '\u{1F4CB}', requiresCamera: false, requiresGPS: false, requiresSensors: false },
  { id: 'bio', label: 'Bio', description: 'Inferencia activa, placebos cognitivos, neuroplasticidad, coherencia cardiaca', icon: '\u{1F9EC}', requiresCamera: false, requiresGPS: false, requiresSensors: false },
];

export class ModuleManager {
  private defs: Map<ModuleName, ModuleDef> = new Map();

  constructor() {
    for (const def of MODULE_DEFS) this.defs.set(def.id, def);
  }

  getModule(id: ModuleName): ModuleDef | undefined {
    return this.defs.get(id);
  }

  getAllModules(): ModuleDef[] {
    return MODULE_DEFS;
  }

  canRun(id: ModuleName, capabilities: {
    hasCamera: boolean; hasGPS: boolean; hasAccelerometer: boolean;
  }): boolean {
    const def = this.defs.get(id);
    if (!def) return false;
    if (def.requiresCamera && !capabilities.hasCamera) return false;
    if (def.requiresGPS && !capabilities.hasGPS) return false;
    if (def.requiresSensors && !capabilities.hasAccelerometer) return false;
    return true;
  }

  parseCommand(text: string): ModuleName | null {
    const lower = text.toLowerCase();
    for (const def of MODULE_DEFS) {
      if (lower.includes(def.label.toLowerCase()) || lower.includes(def.id)) return def.id;
    }
    return null;
  }
}

export const moduleManager = new ModuleManager();
