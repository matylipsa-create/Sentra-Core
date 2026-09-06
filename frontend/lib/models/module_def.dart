/// Definicion de modulo Sentra Core.

class ModuleDef {
  final String id;
  final String label;
  final String description;
  final String icon;
  final bool requiresCamera;
  final bool requiresGPS;
  final bool requiresSensors;

  const ModuleDef({
    required this.id,
    required this.label,
    required this.description,
    required this.icon,
    this.requiresCamera = false,
    this.requiresGPS = false,
    this.requiresSensors = false,
  });

  factory ModuleDef.fromJson(Map<String, dynamic> json) {
    return ModuleDef(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? '',
      description: json['description'] as String? ?? '',
      icon: json['icon'] as String? ?? '',
      requiresCamera: json['requiresCamera'] as bool? ?? false,
      requiresGPS: json['requiresGPS'] as bool? ?? false,
      requiresSensors: json['requiresSensors'] as bool? ?? false,
    );
  }
}

/// Modulos predefinidos (fallback cuando el backend no responde).
const List<ModuleDef> defaultModules = [
  ModuleDef(id: 'vision', label: 'Vision', description: 'Camara + COCO-SSD + descripcion por voz', icon: '\u{1F441}', requiresCamera: true),
  ModuleDef(id: 'seguridad', label: 'Seguridad', description: 'Sensores + alertas + EVOLIS + monitoreo', icon: '\u{1F6E1}', requiresSensors: true),
  ModuleDef(id: 'movimiento', label: 'Movimiento', description: 'GPS + IMU + orientacion + vibracion guia', icon: '\u{1F9ED}', requiresGPS: true, requiresSensors: true),
  ModuleDef(id: 'aprendizaje', label: 'Aprendizaje', description: 'GeminiService + preguntas + respuestas', icon: '\u{1F4DA}'),
  ModuleDef(id: 'bio', label: 'Bio', description: 'Inferencia activa, placebos, neuroplasticidad, coherencia cardiaca', icon: '\u{1F9EC}'),
  ModuleDef(id: 'evidencia', label: 'Evidencia', description: 'EVOLIS + hash chain + exportacion', icon: '\u{1F4CB}'),
  ModuleDef(id: 'guardian', label: 'Guardian', description: 'Guardian bacteriano: defensa USB + EVOLIS + logica ternaria', icon: '\u{1F9EA}'),
  ModuleDef(id: 'silencio', label: 'Silencio', description: 'Vibracion + LEDs (sin voz)', icon: '\u{1F507}', requiresSensors: true),
];
