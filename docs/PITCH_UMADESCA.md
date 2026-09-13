# Sentra Core Vision — Pitch UMADESCA

## El problema

Las personas ciegas dependen de otros para moverse por su entorno. Las soluciones actuales (bastones, perros guía, apps con nube) tienen limitaciones:

- Bastón: solo detecta obstáculos a nivel del suelo
- Perro guía: costoso, requiere entrenamiento
- Apps con nube: dependen de internet, envían datos a terceros

## La solución

**Sentra Core Vision** es una app que devuelve autonomía a personas ciegas desde su celular.

### Cómo funciona

1. Usuario toca UN botón: "ACTIVAR VISIÓN"
2. Cámara del celular captura el entorno
3. IA local (COCO-SSD) detecta objetos (personas, autos, obstáculos)
4. Voz describe lo que hay: "Detectados: persona a la izquierda, auto a la derecha"
5. Vibración confirma cada detección

### Diferenciadores técnicos

- **100% offline**: no depende de internet ni de nube
- **Soberanía del dato**: la imagen nunca sale del dispositivo
- **Veto humano**: ninguna acción crítica se ejecuta sin confirmación
- **Trazabilidad inalterable**: cada evento se registra en cadena de hash (EVOLIS)
- **Accesibilidad nativa**: TalkBack (Android), VoiceOver (iOS), NVDA (Windows)
- **Un solo botón**: interfaz minimalista para persona ciega

### Estado actual

- Demo funcional: PWA + VoiceScreen con un solo botón
- Build: 1311 módulos, 0 errores TypeScript
- Flutter nativo: en desarrollo
- Validación: pendiente con UMADESCA

### Tracción

- Demo funcional en producción
- Código abierto en GitHub (matylipsa-create/Sentra-Core-Vision)
- Arquitectura validada: Motor + UI + Backend
- UMADESCA identificada como partner estratégico

### Modelo

- Open Core: núcleo open source
- SaaS B2C: suscripción mensual para características avanzadas
- B2G: licencias para instituciones (UMADESCA, defensa civil)
- Hardware: Tótem 2.0 para hogares y espacios públicos

### Equipo

- Fundador: Matías Ariel Lipari
- Stack: TypeScript, React, Flutter, C++, ESP32
- Repositorio: github.com/matylipsa-create/Sentra-Core

### El pedido

Financiamiento para:
1. Completar app Flutter nativa para Android
2. Piloto con 10 usuarios de UMADESCA
3. Certificaciones de accesibilidad WCAG 2.1 AA

### Contacto

Matías Ariel Lipari
matylipsa@argil.com
Buenos Aires, Argentina

---

> "Cuando todo lo demás se apaga, Sentra Core sigue ahí."
