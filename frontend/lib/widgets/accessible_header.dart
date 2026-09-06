import 'package:flutter/material.dart';
import '../config/theme.dart';

/// Cabecera accesible que muestra el modulo activo, estado de veto,
/// BioSoftware, IA y bateria.
class AccessibleHeader extends StatelessWidget {
  final String activeModule;
  final bool humanVeto;
  final bool bioEnabled;
  final int? bioCoherence;
  final bool geminiRemote;
  final int evidenceCount;
  final int? batteryLevel;
  final bool isCharging;
  final bool isOnline;

  const AccessibleHeader({
    super.key,
    required this.activeModule,
    this.humanVeto = false,
    this.bioEnabled = false,
    this.bioCoherence,
    this.geminiRemote = false,
    this.evidenceCount = 0,
    this.batteryLevel,
    this.isCharging = false,
    this.isOnline = false,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      header: true,
      label: 'Modulo activo: $activeModule. '
          '${humanVeto ? "Veto humano activo. " : ""}'
          '${bioEnabled ? "BioSoftware activo. " : ""}'
          '${geminiRemote ? "IA remota. " : "IA local. "}'
          '$evidenceCount registros EVOLIS. '
          '${isOnline ? "En linea" : "Sin conexion"}.',
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: SentraTheme.space2,
          vertical: SentraTheme.space1,
        ),
        decoration: const BoxDecoration(
          color: SentraTheme.bgElevated,
          border: Border(bottom: BorderSide(color: SentraTheme.border)),
        ),
        child: Row(
          children: [
            Expanded(
              flex: 2,
              child: Text(
                activeModule.toUpperCase(),
                style: const TextStyle(
                  color: SentraTheme.neonFocus,
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                  letterSpacing: 0.5,
                ),
              ),
            ),
            if (bioEnabled)
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: _Chip(
                  label: bioCoherence != null ? 'Bio $bioCoherence%' : 'Bio ON',
                  color: SentraTheme.accent,
                  borderColor: SentraTheme.accentDark,
                ),
              ),
            if (humanVeto)
              const Padding(
                padding: EdgeInsets.only(right: 6),
                child: _Chip(
                  label: 'Veto',
                  color: SentraTheme.error,
                  borderColor: SentraTheme.error,
                  bold: true,
                ),
              ),
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: _Chip(
                label: geminiRemote ? 'IA: Gemini' : 'IA: Local',
                color: SentraTheme.primary,
                borderColor: SentraTheme.border,
              ),
            ),
            Text(
              '$evidenceCount',
              style: const TextStyle(
                color: SentraTheme.primary,
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
            ),
            if (batteryLevel != null) ...[
              const SizedBox(width: 8),
              Text(
                '$batteryLevel%${isCharging ? ' \u{26A1}' : ''}',
                style: const TextStyle(
                  color: SentraTheme.textDim,
                  fontSize: 12,
                ),
              ),
            ],
            const SizedBox(width: 6),
            Icon(
              isOnline ? Icons.cloud_outlined : Icons.cloud_off,
              size: 16,
              color: SentraTheme.textDim,
              semanticLabel: isOnline ? 'En linea' : 'Sin conexion',
            ),
          ],
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final Color color;
  final Color borderColor;
  final bool bold;

  const _Chip({
    required this.label,
    required this.color,
    required this.borderColor,
    this.bold = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: borderColor),
        color: SentraTheme.bgCard,
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          color: color,
          fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
        ),
      ),
    );
  }
}
