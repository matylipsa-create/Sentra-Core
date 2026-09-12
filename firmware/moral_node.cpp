// moral_node.cpp — MoralNode en C++ para ESP32-S3 (Capa 0)
// Determinista: memoria estática, sin GC, sin new/malloc.
// evaluate() responde en <1 ms. Si detecta amenaza, bloquea todo.

#include <cstdint>
#include <cstring>

namespace sentra {

// ── Reglas éticas ──────────────────────────────────────────────────────

enum class MoralRule : uint8_t {
    NO_VIOLENCE    = 0,
    PRIVACY_FIRST  = 1,
    OFFLINE_ONLY   = 2,
    HUMAN_VETO     = 3,
};

enum class Trit : int8_t {
    NEGATIVE = -1,
    NEUTRAL  = 0,
    POSITIVE = 1,
};

struct MoralDecision {
    MoralRule rule;
    bool      passed;
    char      reason[64];
};

struct MoralEvaluation {
    bool            allowed;
    uint8_t         decisionCount;
    MoralDecision   decisions[4];
    uint64_t        timestamp;
};

// ── Tabla de palabras violentas (estática, en flash) ────────────────────

static const char* const VIOLENCE_KEYWORDS[] = {
    "danar", "golpear", "herir", "matar", "atacar", "destruir",
    "violencia", "arma", "agredir", "lastimar", "torturar",
    "apunal", "disparar", "estrangular", "envenenar", "secuestrar",
    "amenazar", "asaltar", "aplastar", "quemar", "ahogar",
};

static const uint8_t VIOLENCE_COUNT = sizeof(VIOLENCE_KEYWORDS) / sizeof(VIOLENCE_KEYWORDS[0]);

static const char* const PRIVACY_KEYWORDS[] = {
    "contrasena", "password", "pin", "dni", "curp",
    "tarjeta", "cvv", "clave", "token", "huella",
    "biometrico", "cuenta bancaria",
};

static const uint8_t PRIVACY_COUNT = sizeof(PRIVACY_KEYWORDS) / sizeof(PRIVACY_KEYWORDS[0]);

// ── Utilidades de texto (sin heap) ─────────────────────────────────────

static void toLowerStatic(char* buf, uint8_t maxLen) {
    for (uint8_t i = 0; i < maxLen && buf[i] != '\0'; i++) {
        if (buf[i] >= 'A' && buf[i] <= 'Z') {
            buf[i] = buf[i] + ('a' - 'A');
        }
    }
}

static bool containsKeyword(const char* text, const char* keyword) {
    // Búsqueda ingenua sin heap — suficiente para comandos cortos
    uint16_t textLen = strlen(text);
    uint16_t kwLen   = strlen(keyword);
    if (kwLen == 0 || kwLen > textLen) return false;
    for (uint16_t i = 0; i <= textLen - kwLen; i++) {
        uint16_t j = 0;
        while (j < kwLen && text[i + j] == keyword[j]) j++;
        if (j == kwLen) return true;
    }
    return false;
}

// ── MoralNode ──────────────────────────────────────────────────────────

class MoralNode {
private:
    bool humanVetoActive = false;
    bool offlineMode     = true;

public:
    void setHumanVeto(bool active) { humanVetoActive = active; }
    void setOfflineMode(bool offline) { offlineMode = offline; }
    bool isHumanVetoActive() const { return humanVetoActive; }

    // evaluate() — responde en <1 ms (sin heap, sin I/O, sin bloqueos)
    MoralEvaluation evaluate(const char* command, bool externalRequest = false) {
        MoralEvaluation eval = {};
        eval.decisionCount = 0;
        eval.timestamp = esp_timer_get_time(); // µs

        // Buffer estático en stack — máximo 256 bytes por comando
        static char lowerBuf[256];
        uint16_t cmdLen = strlen(command);
        if (cmdLen > 255) cmdLen = 255;
        memcpy(lowerBuf, command, cmdLen);
        lowerBuf[cmdLen] = '\0';
        toLowerStatic(lowerBuf, 255);

        // Regla 1: NO_VIOLENCE
        bool hasViolence = false;
        for (uint8_t i = 0; i < VIOLENCE_COUNT; i++) {
            if (containsKeyword(lowerBuf, VIOLENCE_KEYWORDS[i])) {
                hasViolence = true;
                break;
            }
        }
        eval.decisions[eval.decisionCount].rule = MoralRule::NO_VIOLENCE;
        eval.decisions[eval.decisionCount].passed = !hasViolence;
        strncpy(eval.decisions[eval.decisionCount].reason,
                hasViolence ? "Lenguaje violento detectado" : "Sin violencia",
                63);
        eval.decisionCount++;

        // Regla 2: PRIVACY_FIRST
        bool hasPrivacy = false;
        for (uint8_t i = 0; i < PRIVACY_COUNT; i++) {
            if (containsKeyword(lowerBuf, PRIVACY_KEYWORDS[i])) {
                hasPrivacy = true;
                break;
            }
        }
        eval.decisions[eval.decisionCount].rule = MoralRule::PRIVACY_FIRST;
        eval.decisions[eval.decisionCount].passed = !hasPrivacy;
        strncpy(eval.decisions[eval.decisionCount].reason,
                hasPrivacy ? "Solicita datos sensibles" : "Sin datos sensibles",
                63);
        eval.decisionCount++;

        // Regla 3: OFFLINE_ONLY
        bool offlineViolation = externalRequest && !offlineMode;
        eval.decisions[eval.decisionCount].rule = MoralRule::OFFLINE_ONLY;
        eval.decisions[eval.decisionCount].passed = !offlineViolation;
        strncpy(eval.decisions[eval.decisionCount].reason,
                offlineViolation ? "Solicitud externa sin conexion" : "Modo offline-first",
                63);
        eval.decisionCount++;

        // Regla 4: HUMAN_VETO
        eval.decisions[eval.decisionCount].rule = MoralRule::HUMAN_VETO;
        eval.decisions[eval.decisionCount].passed = !humanVetoActive;
        strncpy(eval.decisions[eval.decisionCount].reason,
                humanVetoActive ? "Veto humano activo" : "Sin veto",
                63);
        eval.decisionCount++;

        // Resultado: todas deben pasar
        eval.allowed = true;
        for (uint8_t i = 0; i < eval.decisionCount; i++) {
            if (!eval.decisions[i].passed) {
                eval.allowed = false;
                break;
            }
        }

        return eval;
    }

    // Evaluación ternaria — +1 (confiable), 0 (neutral), -1 (amenaza)
    Trit evaluateTernary(const MoralEvaluation& eval) const {
        if (!eval.allowed) return Trit::NEGATIVE;
        if (eval.decisionCount == 4 &&
            eval.decisions[0].passed &&
            eval.decisions[1].passed &&
            eval.decisions[2].passed &&
            eval.decisions[3].passed) {
            return Trit::POSITIVE;
        }
        return Trit::NEUTRAL;
    }
};

// Singleton estático — una sola instancia, sin heap
static MoralNode moralNode;

MoralNode& getMoralNode() { return moralNode; }

} // namespace sentra
