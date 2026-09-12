#!/usr/bin/env bash
# setup-ollama.sh — Instalación de Ollama para Sentra Core v4.9.0_QUANTIZED_AI
#
# Instala Ollama en Linux/macOS, configura el servicio y verifica.
# Ollama ejecuta modelos IA cuantizados localmente (offline, soberano).
#
# Uso:
#   chmod +x scripts/setup-ollama.sh
#   ./scripts/setup-ollama.sh
#
# Requisitos:
#   - Linux (x86_64) o macOS (Apple Silicon / Intel)
#   - 4 GB RAM mínimo (8 GB recomendado)
#   - Conexión a internet solo para la descarga inicial
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

echo -e "${BOLD}=== Sentra Core — Instalación de Ollama ===${RESET}"
echo ""

# ── Detectar OS ──────────────────────────────────────────────────────────

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux*)  OS_NAME="linux";;
  Darwin*) OS_NAME="macos";;
  *)       error "Sistema operativo no soportado: $OS";;
esac

case "$ARCH" in
  x86_64|amd64) ARCH_NAME="amd64";;
  arm64|aarch64) ARCH_NAME="arm64";;
  *)             error "Arquitectura no soportada: $ARCH";;
esac

info "Sistema: $OS_NAME ($ARCH_NAME)"

# ── Verificar si ya está instalado ────────────────────────────────────────

if command -v ollama &>/dev/null; then
  VERSION=$(ollama --version 2>/dev/null || echo "desconocida")
  ok "Ollama ya está instalado (versión: $VERSION)"
  echo ""
  info "Para reinstalar, ejecuta: ./scripts/setup-ollama.sh --force"
  if [[ "$1" != "--force" ]]; then
    info "Verificando servicio..."
    if curl -s http://localhost:11434/v1/models &>/dev/null; then
      ok "Servicio Ollama activo en http://localhost:11434"
    else
      warn "Servicio no responde. Iniciando..."
      ollama serve &>/dev/null &
      sleep 3
      if curl -s http://localhost:11434/v1/models &>/dev/null; then
        ok "Servicio iniciado correctamente"
      else
        error "No se pudo iniciar el servicio Ollama"
      fi
    fi
    echo ""
    ok "Ollama listo. Ejecuta scripts/pull-models.sh para descargar modelos."
    exit 0
  fi
fi

# ── Verificar RAM ────────────────────────────────────────────────────────

RAM_GB=0
if [[ "$OS_NAME" == "macos" ]]; then
  RAM_GB=$(( $(sysctl -n hw.memsize) / 1024 / 1024 / 1024 ))
else
  if [[ -f /proc/meminfo ]]; then
    RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    RAM_GB=$(( RAM_KB / 1024 / 1024 ))
  fi
fi

if [[ "$RAM_GB" -lt 4 ]]; then
  warn "RAM detectada: ${RAM_GB}GB. Mínimo recomendado: 8GB."
  warn "Modelos 4-bit pueden funcionar con 4GB, pero con limitaciones."
else
  ok "RAM detectada: ${RAM_GB}GB"
fi

# ── Instalación ──────────────────────────────────────────────────────────

info "Descargando e instalando Ollama..."

if [[ "$OS_NAME" == "macos" ]]; then
  if command -v brew &>/dev/null; then
    info "Instalando via Homebrew..."
    brew install ollama
  else
    info "Instalando via script oficial..."
    curl -fsSL https://ollama.com/install.sh | sh
  fi
else
  curl -fsSL https://ollama.com/install.sh | sh
fi

ok "Ollama instalado"

# ── Configurar servicio (Linux) ──────────────────────────────────────────

if [[ "$OS_NAME" == "linux" ]]; then
  info "Configurando servicio systemd..."

  if systemctl is-active --quiet ollama 2>/dev/null; then
    ok "Servicio Ollama ya activo"
  else
    if systemctl list-unit-files | grep -q ollama; then
      sudo systemctl enable ollama
      sudo systemctl start ollama
      sleep 3
      if systemctl is-active --quiet ollama; then
        ok "Servicio Ollama iniciado"
      else
        warn "No se pudo iniciar via systemd. Iniciando manualmente..."
        ollama serve &>/dev/null &
        sleep 3
      fi
    else
      warn "Servicio systemd no encontrado. Iniciando manualmente..."
      ollama serve &>/dev/null &
      sleep 3
    fi
  fi
fi

# ── Verificación ────────────────────────────────────────────────────────

info "Verificando instalación..."

if ! command -v ollama &>/dev/null; then
  error "Ollama no se instaló correctamente"
fi

VERSION=$(ollama --version 2>/dev/null || echo "desconocida")
ok "Ollama versión: $VERSION"

MAX_RETRIES=10
for i in $(seq 1 $MAX_RETRIES); do
  if curl -s http://localhost:11434/v1/models &>/dev/null; then
    ok "Servicio activo en http://localhost:11434"
    break
  fi
  if [[ $i -eq $MAX_RETRIES ]]; then
    error "El servicio Ollama no responde en http://localhost:11434"
  fi
  warn "Esperando servicio... ($i/$MAX_RETRIES)"
  sleep 2
done

# ── Resumen ──────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}=== Instalación completada ===${RESET}"
echo ""
echo "  Ollama URL:    http://localhost:11434"
echo "  API endpoint:  http://localhost:11434/v1"
echo "  RAM:           ${RAM_GB}GB"
echo ""
echo "  Próximos pasos:"
echo "    1. ./scripts/pull-models.sh   — Descargar modelos cuantizados"
echo "    2. Iniciar Sentra Core        — La IA local se conecta automáticamente"
echo ""
ok "Cuando todo lo demás se apaga, la IA local sigue ahí."
