# Quantized AI Architecture — Cuantización 4-bit + Ollama + n8n Offline

**Sentra Core v4.9.0_QUANTIZED_AI**

> Cuando todo lo demás se apaga, la IA local sigue ahí.

---

## Visión General

La arquitectura de IA Cuantizada integra modelos de lenguaje de 7B/8B parámetros
ejecutándose **localmente** mediante **Ollama** (API compatible OpenAI), con
cuantización de **4 bits** (Q4_K_M) para operar en hardware de gama media con
4-6 GB de VRAM.

Esto extiende la arquitectura Zero Latency definida en
`docs/ZERO_LATENCY_ARCHITECTURE.md` y opera junto al protocolo LoRa P2P definido
en `docs/LORA_PROTOCOL_ARCHITECTURE.md`.

### Principios

1. **Soberanía del dato**: El modelo corre local. Los datos no salen del dispositivo.
2. **Offline-first**: Sin internet, sin nube, sin API pay-per-call.
3. **Bajo costo**: Hardware gama media (4-6 GB VRAM).
4. **Baja latencia**: Respuesta casi instantánea (< 500 ms con 4-bit).
5. **API compatible OpenAI**: `http://localhost:11434/v1`.
6. **Cuantización 4-bit**: 7B/8B en 4-6 GB VRAM.

---

## Capas de Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    Capa 1 (TypeScript)                    │
│                                                          │
│  AIModule · LocalAIService · ModelManager                │
│  QuantizationManager · OllamaService                     │
│  Fallback: GeminiService (ya existente)                  │
│                                                          │
│  Integración n8n offline (OrchestratorEngine)            │
│  Trazabilidad: EVOLIS (hash chain + firmas)              │
│  Filtro ético: MoralNode (veto humano)                   │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP (localhost:11434/v1)
                         │ API compatible OpenAI
┌────────────────────────┴────────────────────────────────┐
│              Ollama (runtime local)                       │
│                                                          │
│  Modelos cuantizados:                                    │
│    Llama 3 8B  (Q4_K_M) — visión, seguridad              │
│    Qwen 2.5 7B (Q4_K_M) — bio, aprendizaje                │
│    Gemma 3      (Q4_K_M) — general                        │
│                                                          │
│  GPU: CUDA / Metal / ROCm                                │
│  CPU fallback: cuantización 4-bit en RAM                 │
└─────────────────────────────────────────────────────────┘
```

### Terminología

- **Capa 0**: Firmware C++/ESP-IDF en ESP32-S3 (determinista, <1 ms, sin GC).
  Definida en `docs/ZERO_LATENCY_ARCHITECTURE.md`.
- **Capa 1**: Orquestación TypeScript/Node.js (con GC, 10-50 ms).
  Donde opera la IA cuantizada, el orquestador n8n offline y la integración
  con Ollama.

---

## Cuantización

### Niveles Soportados

| Nivel | VRAM | Calidad | Velocidad | Uso |
|-------|------|---------|-----------|-----|
| **4-bit Q4_K_M** | 4-6 GB | 75% | 95% | Hardware modesto, máximo ahorro |
| **5-bit Q5_K_M** | 6-8 GB | 85% | 85% | Balance calidad/VRAM |
| **8-bit Q8_0** | 8-12 GB | 95% | 70% | Calidad excelente |

### Detección Automática

`QuantizationManager` detecta:

- **GPU**: NVIDIA, AMD, Intel, Apple Silicon (vía WebGL `WEBGL_debug_renderer_info`)
- **VRAM estimada**: Basada en GPU detectada y RAM del sistema
- **RAM total**: `navigator.deviceMemory` + `hardwareConcurrency`
- **Recomendación**: Selecciona el nivel óptimo según hardware

### Regla de Recomendación

```
VRAM >= 16 GB o RAM >= 32 GB  →  Q8_0 (8-bit)
VRAM >= 6 GB o RAM >= 16 GB   →  Q5_K_M (5-bit)
VRAM < 6 GB                   →  Q4_K_M (4-bit)
```

---

## Ollama — API Compatible OpenAI

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/v1/models` | Listar modelos instalados |
| POST | `/v1/completions` | Generación de texto |
| POST | `/v1/chat/completions` | Chat multi-turno |
| POST | `/api/pull` | Descargar modelo |
| POST | `/api/show` | Info de un modelo |
| DELETE | `/api/delete` | Eliminar modelo |

### Ejemplo de Integración n8n

```json
{
  "method": "POST",
  "url": "http://localhost:11434/v1/chat/completions",
  "headers": { "Content-Type": "application/json" },
  "body": {
    "model": "llama3:8b",
    "messages": [
      { "role": "system", "content": "Eres Sentra Core, un asistente soberano." },
      { "role": "user", "content": "¿Qué hay en la cámara?" }
    ],
    "max_tokens": 256,
    "temperature": 0.7,
    "stream": false
  }
}
```

El `OrchestratorEngine` (Capa 1) puede usar este endpoint como nodo de
generación de texto dentro de un flujo de orquestación offline, reemplazando
los nodos de OpenAI externos de n8n.

---

## Modelos Recomendados

| Modelo | Parámetros | Tarea | VRAM (4-bit) |
|--------|-----------|-------|-------------|
| **Llama 3 8B** | 8B | Visión, Seguridad | 4-6 GB |
| **Qwen 2.5 7B** | 7B | Bio, Aprendizaje | 4-6 GB |
| **Gemma 3** | 4B | General | 3-4 GB |

### Selección por Tarea

`ModelManager` selecciona automáticamente el modelo óptimo:

- **Visión** → Llama 3 8B (mejor descripción de escenas)
- **Bio** → Qwen 2.5 7B (mejor reencuadre cognitivo)
- **Seguridad** → Llama 3 8B Q4_K_M (mejor alertas)
- **Aprendizaje** → Qwen 2.5 7B Q4_K_M (mejor respuestas educativas)
- **General** → Gemma 3 (ligero, rápido)

---

## Fallback a GeminiService

Si Ollama no está disponible, `LocalAIService` hace fallback automático a
`GeminiService` (ya existente en `src/core/GeminiService.ts`):

1. **Ollama disponible** → Respuesta local (offline, soberano, ~200-500 ms)
2. **Ollama no disponible + Gemini remoto ON** → Respuesta de Gemini (online)
3. **Ollama no disponible + Gemini OFF** → Respuesta local basada en
   conocimiento embebido (offline, instantáneo)

El fallback es transparente para el usuario y se registra en EVOLIS.

---

## Integración con EVOLIS y MoralNode

### Trazabilidad (EVOLIS)

Cada consulta a la IA local se registra en la cadena EVOLIS:

```
aiModule.query() → evolis.record('ai_module', 'query', task:prompt)
aiModule.selectModel() → evolis.record('ai_module', 'select_model', modelId)
aiModule.pullModel() → evolis.record('ai_module', 'pull_model', modelId)
```

### Filtro Ético (MoralNode)

Antes de enviar cualquier prompt a Ollama, el `MoralNode` evalúa el comando:

- `NO_VIOLENCE`: Bloquea prompts con lenguaje violento
- `PRIVACY_FIRST`: Bloquea solicitudes de datos sensibles
- `OFFLINE_ONLY`: Verifica operación offline
- `HUMAN_VETO`: El veto humano bloquea todo

---

## Archivos

| Archivo | Responsabilidad |
|---------|-----------------|
| `src/services/OllamaService.ts` | Cliente HTTP a Ollama (API OpenAI) |
| `src/services/LocalAIService.ts` | Servicio IA local con fallback a Gemini |
| `src/core/ModelManager.ts` | Gestión de modelos (detectar, cargar, seleccionar) |
| `src/core/QuantizationManager.ts` | Detección de VRAM y recomendación de cuantización |
| `src/modules/AIModule.ts` | Módulo IA de alto nivel (integra los 4 anteriores) |
| `src/components/AIModelPanel.tsx` | Panel accesible (Voice-First, ARIA, 56px) |
| `scripts/setup-ollama.sh` | Instalación de Ollama (Linux/macOS) |
| `scripts/pull-models.sh` | Descarga de modelos cuantizados |

---

## Instalación

```bash
# 1. Instalar Ollama
./scripts/setup-ollama.sh

# 2. Descargar modelos cuantizados
./scripts/pull-models.sh

# 3. Verificar hardware y VRAM
./scripts/pull-models.sh --check
```

---

## Referencias

- `docs/ZERO_LATENCY_ARCHITECTURE.md` — Arquitectura de latencia cero (Capa 0 / Capa 1)
- `docs/LORA_PROTOCOL_ARCHITECTURE.md` — Protocolo P2P LoRa (SX1262)
- `src/core/GeminiService.ts` — Servicio de IA con fallback local (ya existente)
- `src/modules/SentraVisionAccessibility.ts` — Puente de accesibilidad (TalkBack, NVDA)

---

> Cuando todo lo demás se apaga, la IA local sigue ahí.
