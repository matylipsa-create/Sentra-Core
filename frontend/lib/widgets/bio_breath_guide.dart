import 'package:flutter/material.dart';
import '../config/theme.dart';

/// Guia visual de respiracion para coherencia cardiaca.
///
/// Un circulo que se expande al inhalar, se contrae al exhalar y
/// se mantiene al retener. Incluye texto instructivo.
class BioBreathGuide extends StatelessWidget {
  final String phase; // 'inhale', 'hold', 'exhale'
  final int cycles;

  const BioBreathGuide({
    super.key,
    required this.phase,
    this.cycles = 0,
  });

  @override
  Widget build(BuildContext context) {
    final scale = phase == 'inhale'
        ? 1.15
        : phase == 'exhale'
            ? 0.9
            : 1.05;
    final color = phase == 'inhale'
        ? SentraTheme.primary
        : phase == 'exhale'
            ? SentraTheme.accent
            : SentraTheme.warning;
    final bg = phase == 'inhale'
        ? SentraTheme.primary.withValues(alpha: 0.12)
        : phase == 'exhale'
            ? SentraTheme.accent.withValues(alpha: 0.06)
            : SentraTheme.warning.withValues(alpha: 0.08);
    final text = phase == 'inhale'
        ? 'Inhala'
        : phase == 'exhale'
            ? 'Exhala'
            : 'Manten';

    return Semantics(
      label: 'Guia de respiracion: $text. $cycles ciclos completados.',
      child: Column(
        children: [
          AnimatedContainer(
            duration: Duration(
              milliseconds: phase == 'inhale' ? 4000 : phase == 'exhale' ? 5000 : 1000,
            ),
            curve: Curves.ease,
            width: 160 * scale,
            height: 160 * scale,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: bg,
              border: Border.all(color: color, width: 2),
            ),
            child: Center(
              child: Text(
                text,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w600,
                  color: SentraTheme.textBright,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
