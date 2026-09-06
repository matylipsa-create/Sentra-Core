import 'package:flutter/material.dart';
import '../config/theme.dart';

/// Pantalla del modulo Silencio (comunicacion no verbal).
class SilenceScreen extends StatelessWidget {
  const SilenceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const Text(
          'Modo Silencio',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: SentraTheme.textBright),
        ),
        const SizedBox(height: SentraTheme.space1),
        const Text(
          'Comunicacion no verbal. Usa vibracion para interactuar.',
          style: TextStyle(color: SentraTheme.textDim, fontSize: 13),
        ),
        const SizedBox(height: SentraTheme.space3),
        Wrap(
          spacing: SentraTheme.space2,
          runSpacing: SentraTheme.space2,
          alignment: WrapAlignment.center,
          children: [
            ElevatedButton.icon(
              onPressed: () => HapticFeedback.lightImpact(),
              icon: const Icon(Icons.vibration, size: 20),
              label: const Text('Pulso corto'),
            ),
            ElevatedButton.icon(
              onPressed: () { HapticFeedback.lightImpact(); HapticFeedback.mediumImpact(); },
              icon: const Icon(Icons.vibration, size: 20),
              label: const Text('Pulso doble'),
            ),
            ElevatedButton.icon(
              onPressed: () => HapticFeedback.heavyImpact(),
              icon: const Icon(Icons.vibration, size: 20),
              label: const Text('Pulso largo'),
            ),
          ],
        ),
      ],
    );
  }
}
