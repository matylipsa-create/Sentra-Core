import 'package:flutter/material.dart';
import '../config/theme.dart';

/// Chips de estado para la barra de voz (veto, bio, EVOLIS).
class StatusChips extends StatelessWidget {
  final bool humanVeto;
  final bool bioEnabled;
  final int? bioCoherence;
  final int evidenceCount;

  const StatusChips({
    super.key,
    this.humanVeto = false,
    this.bioEnabled = false,
    this.bioCoherence,
    this.evidenceCount = 0,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Estado: '
          '${humanVeto ? "Veto activo. " : ""}'
          '${bioEnabled ? "Bio ${bioCoherence ?? 0}%. " : ""}'
          '$evidenceCount registros.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (humanVeto)
            const _StatusChip(
              label: 'Veto',
              color: SentraTheme.error,
              borderColor: SentraTheme.error,
              bold: true,
            ),
          if (bioEnabled)
            _StatusChip(
              label: bioCoherence != null ? 'Bio $bioCoherence%' : 'Bio ON',
              color: SentraTheme.accent,
              borderColor: SentraTheme.accentDark,
            ),
          _StatusChip(
            label: '$evidenceCount',
            color: SentraTheme.primary,
            borderColor: SentraTheme.border,
          ),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String label;
  final Color color;
  final Color borderColor;
  final bool bold;

  const _StatusChip({
    required this.label,
    required this.color,
    required this.borderColor,
    this.bold = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: borderColor),
          color: SentraTheme.bgElevated,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 10,
            color: color,
            fontWeight: bold ? FontWeight.w700 : FontWeight.w400,
          ),
        ),
      ),
    );
  }
}
