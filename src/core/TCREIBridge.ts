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
  movimiento: 'Navegacion y orientacion espacial',
  juego: 'Experiencia interactiva y narrativa',
  aprendizaje: 'Educacion y respuesta a preguntas',
  impacto: 'Gestion de energia y harvesting',
  silencio: 'Comunicacion no verbal',
  evidencia: 'Trazabilidad y registro inmutable',
};

export class TCREIBridge {
  buildPrompt(module: string, perception: string, command: string): TCREIPrompt {
    const context = MODULE_CONTEXTS[module] ?? 'Asistencia general';
    return {
      context,
      perception,
      command,
      structured: {
        role: 'Eres Sentra Core, un asistente soberano y offline-first',
        task: `Procesar comando "${command}" en contexto de ${context}`,
        constraints: [
          'Responder en espanol',
          'Ser conciso y directo',
          'No inventar datos no presentes en la percepcion',
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
