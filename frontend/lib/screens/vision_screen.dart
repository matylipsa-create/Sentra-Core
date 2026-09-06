import 'package:flutter/material.dart';
import '../config/theme.dart';

/// Pantalla del modulo Vision (placeholder — la camara se procesa en el backend).
class VisionScreen extends StatelessWidget {
  const VisionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const Text(
          'Vision',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: SentraTheme.textBright),
        ),
        const SizedBox(height: SentraTheme.space2),
        Container(
          width: double.infinity,
          height: 240,
          decoration: BoxDecoration(
            color: Colors.black,
            borderRadius: BorderRadius.circular(SentraTheme.radius),
            border: Border.all(color: SentraTheme.border),
          ),
          child: const Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.videocam, size: 48, color: SentraTheme.textDim),
                SizedBox(height: SentraTheme.space2),
                Text(
                  'La deteccion de objetos (COCO-SSD) se ejecuta en el backend.\n'
                  'Las detecciones se reciben via WebSocket en tiempo real.',
                  style: TextStyle(color: SentraTheme.textDim, fontSize: 13),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
