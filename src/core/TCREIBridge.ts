export interface TCREIPrompt {
  context: string;
  perception: string;
  command: string;
  structured: {
    role: string;
    task: string;
    constraints: string[];
    expectedOutput: string;
  };
}

export interface TCREIResponse {
  text: string;
  confidence: number;
  source: 'local' | 'gemini';
}

const MODULE_CONTEXTS: Record<string, string> = {
  vision: 'Asistencia visual para personas con discapacidad visual',
  seguridad: 'Monitoreo de seguridad y alertas',
  movimiento: 'Navegación y orientación espacial',
  juego: 'Experiencia interactiva y narrativa',
  aprendizaje: 'Educación y respuesta a preguntas',
  impacto: 'Gestión de energía y harvesting',
  silencio: 'Comunicación no verbal',
  evidencia: 'Trazabilidad y registro inmutable',
  bio: 'BioSoftware: inferencia activa, placebos cognitivos, reencuadre cognitivo, neuroplasticidad, epigenética, coherencia cardíaca',
};

const COMMON_MISSPELLINGS: Record<string, string> = {
  'como': 'cómo', 'que': 'qué', 'estas': 'estás', 'donde': 'dónde',
  'cuando': 'cuándo', 'quien': 'quién', 'cual': 'cuál', 'cuanto': 'cuánto',
  'por que': 'por qué', 'para que': 'para qué',
};

function normalizeAccents(text: string): string {
  let result = text;
  for (const [wrong, correct] of Object.entries(COMMON_MISSPELLINGS)) {
    const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
    result = result.replace(regex, correct);
  }
  return result;
}

export class TCREIBridge {
  buildPrompt(module: string, perception: string, command: string): TCREIPrompt {
    const context = MODULE_CONTEXTS[module] ?? 'Asistencia general';
    const isBio = module === 'bio';
    const normalizedCommand = normalizeAccents(command);
    return {
      context,
      perception,
      command: normalizedCommand,
      structured: {
        role: 'Eres Sentra Core, un asistente soberano y offline-first',
        task: `Procesar comando "${normalizedCommand}" en contexto de ${context}`,
        constraints: [
          'Responder en español',
          'Ser conciso y directo',
          isBio ? 'Aplicar reencuadre cognitivo y placebo cognitivo cuando sea pertinente' : 'No inventar datos no presentes en la percepción',
          'Priorizar la seguridad del usuario',
        ],
        expectedOutput: 'Respuesta clara y accionable en menos de 100 palabras',
      },
    };
  }

  formatForLLM(prompt: TCREIPrompt): string {
    return [
      `Rol: ${prompt.structured.role}`,
      `Contexto: ${prompt.context}`,
      `Percepcion: ${prompt.perception}`,
      `Comando: ${prompt.command}`,
      `Tarea: ${prompt.structured.task}`,
      `Restricciones: ${prompt.structured.constraints.join('; ')}`,
      `Salida esperada: ${prompt.structured.expectedOutput}`,
    ].join('\n');
  }

  parseResponse(raw: string, source: 'local' | 'gemini'): TCREIResponse {
    const text = raw.trim();
    const confidence = source === 'gemini' ? 0.9 : 0.6;
    return { text, confidence, source };
  }
}

export const tcreiBridge = new TCREIBridge();
