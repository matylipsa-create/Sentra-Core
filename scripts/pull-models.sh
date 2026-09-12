#!/usr/bin/env bash
# pull-models.sh — Descarga modelos IA cuantizados para Ollama
#
# Descarga modelos optimizados para Sentra Core v4.9.0_QUANTIZED_AI:
#   - Llama 3 8B (4-bit Q4_K_M) — visión, seguridad
#   - Qwen 2.5 7B (4-bit Q4_K_M) — bio, aprendizaje
#   - Gemma 3 (4-bit) — general
#
# Verifica VRAM antes de descargar y recomienda el nivel óptimo.
#
# Uso:
#   chmod +x scripts/pull-models.sh
#   ./scripts/pull-models.sh              # Descargar todos los recomendados
#   ./scripts/pull-models.sh --check      # Solo verificar VRAM y listar
#   ./scripts/pull-models.sh llama3:8b    # Descargar un modelo específico
#
# Cuando todo lo demás se apaga, la IA local sigue ahí.

set -euo pipefail

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
RESET="\033[0m"

info()  { echo -e "${CYAN}[INFO]${RESET} $1"; }
ok()    { echo -e "${GREEN}[OK]${RESET} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${RESET} $1"; }
error() { echo -e "${RED}[ERROR]${RESET} $1"; exit 1; }

echo -e "${BOLD}=== Sentra Core — Descarga de Modelos Cuantizados ===${RESET}"
echo ""

# ── Verificar Ollama ─────────────────────────────────────────────────────

if ! command -v ollama &>/dev/null; then
  error "Ollama no está instalado. Ejecuta scripts/setup-ollama.sh primero."
fi

if ! curl -s http://localhost:11434/v1/models &>/dev/null; then
  warn "Servicio Ollama no responde. Iniciando..."
  ollama serve &>/dev/null &
  sleep 3
  if ! curl -s http://localhost:11434/v1/models &>/dev/null; then
    error "No se pudo conectar a Ollama en http://localhost:11434"
  fi
fi

ok "Ollama activo"

# ── Detectar VRAM ────────────────────────────────────────────────────────

detect_vram() {
  local VRAM_GB=0

  if [[ "$(uname -s)" == "Darwin" ]]; then
    local RAM_BYTES
    RAM_BYTES=$(sysctl -n hw.memsize 2>/dev/null || echo 0)
    local RAM_GB=$(( RAM_BYTES / 1024 / 1024 / 1024 ))
    VRAM_GB=$(( RAM_GB * 60 / 100 ))
    echo "$VRAM_GB"
    return
  fi

  if command -v nvidia-smi &>/dev/null; then
    VRAM_GB=$(nvidia-smi --query-gpu=memory.total --format=csv,nounits,nounits 2>/dev/null | head -1 | awk '{print int($1)}')
    if [[ -n "$VRAM_GB" && "$VRAM_GB" -gt 0 ]]; then
      echo "$VRAM_GB"
      return
    fi
  fi

  local RAM_KB
  RAM_KB=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo 0)
  local RAM_GB=$(( RAM_KB / 1024 / 1024 ))
  VRAM_GB=$(( RAM_GB * 50 / 100 ))
  echo "$VRAM_GB"
}

VRAM_GB=$(detect_vram)
info "VRAM estimada: ${VRAM_GB}GB"

# ── Recomendar nivel de cuantización ─────────────────────────────────────

recommend_level() {
  local vram=$1
  if [[ "$vram" -ge 8 ]]; then
    echo "q5_K_M"
  elif [[ "$vram" -ge 6 ]]; then
    echo "q4_K_M"
  else
    echo "q4_K_M"
  fi
}

LEVEL=$(recommend_level "$VRAM_GB")
ok "Nivel recomendado: $LEVEL"

# ── Modelos ─────────────────────────────────────────────────────────────

MODELS_ALL=(
  "llama3:8b"
  "qwen2.5:7b"
  "gemma3:latest"
)

MODELS_LOW_VRAM=(
  "llama3:8b"
  "gemma3:latest"
)

# ── Modo --check ─────────────────────────────────────────────────────────

if [[ "$1" == "--check" ]]; then
  echo ""
  echo -e "${BOLD}=== Verificación de Hardware ===${RESET}"
  echo "  VRAM estimada: ${VRAM_GB}GB"
  echo "  Nivel recomendado: $LEVEL"
  echo ""
  echo "  Modelos recomendados:"
  if [[ "$VRAM_GB" -lt 6 ]]; then
    for m in "${MODELS_LOW_VRAM[@]}"; do
      echo "    - $m"
    done
  else
    for m in "${MODELS_ALL[@]}"; do
      echo "    - $m"
    done
  fi
  echo ""
  echo "  Modelos ya instalados:"
  ollama list 2>/dev/null || echo "    (ninguno)"
  echo ""
  ok "Verificación completada"
  exit 0
fi

# ── Selección de modelos a descargar ─────────────────────────────────────

if [[ -n "$1" && "$1" != "--force" ]]; then
  MODELS_TO_PULL=("$1")
else
  if [[ "$VRAM_GB" -lt 6 ]]; then
    warn "VRAM < 6GB. Descargando modelos optimizados para hardware modesto."
    MODELS_TO_PULL=("${MODELS_LOW_VRAM[@]}")
  else
    MODELS_TO_PULL=("${MODELS_ALL[@]}")
  fi
fi

echo ""
info "Modelos a descargar: ${#MODELS_TO_PULL[@]}"
for m in "${MODELS_TO_PULL[@]}"; do
  echo "  - $m"
done
echo ""

# ── Descargar ────────────────────────────────────────────────────────────

for model in "${MODELS_TO_PULL[@]}"; do
  info "Descargando $model..."
  if ollama pull "$model"; then
    ok "$model descargado correctamente"
  else
    warn "Error al descargar $model. Continuando con el siguiente..."
  fi
  echo ""
done

# ── Verificación final ──────────────────────────────────────────────────

echo -e "${BOLD}=== Resumen ===${RESET}"
echo ""
info "Modelos instalados:"
ollama list 2>/dev/null || echo "  (no se pudieron listar)"
echo ""
ok "Descarga completada."
echo ""
echo "  Próximo paso: Iniciar Sentra Core."
echo "  La IA local se conectará automáticamente a Ollama."
echo ""
ok "Cuando todo lo demás se apaga, la IA local sigue ahí."
