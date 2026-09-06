import 'package:flutter/material.dart';
import '../config/theme.dart';

/// Banner de respuesta que muestra el texto del agente o el bloqueo etico.
class ResponseBanner extends StatelessWidget {
  final String? responseText;
  final String? responseSource;
  final String? moralBlockReason;

  const ResponseBanner({
    super.key,
    this.responseText,
    this.responseSource,
    this.moralBlockReason,
  });

  @override
  Widget build(BuildContext context) {
    if (moralBlockReason != null) {
      return Semantics(
        label: 'Filtro etico: accion bloqueada. $moralBlockReason',
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(
            horizontal: SentraTheme.space2,
            vertical: SentraTheme.space1,
          ),
          decoration: const BoxDecoration(
            color: SentraTheme.bgCard,
            border: Border(top: BorderSide(color: SentraTheme.border)),
          ),
          child: Container(
            padding: const EdgeInsets.only(left: SentraTheme.space1),
            decoration: const BoxDecoration(
              border: Border(left: BorderSide(color: SentraTheme.error, width: 3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Filtro etico: accion bloqueada',
                  style: TextStyle(
                    color: SentraTheme.error,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  moralBlockReason!,
                  style: const TextStyle(color: SentraTheme.text, fontSize: 13),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (responseText == null) {
      return const SizedBox.shrink();
    }

    final sourceLabel = responseSource == 'gemini' ? 'Gemini' : 'Local';

    return Semantics(
      label: 'Respuesta de $sourceLabel: $responseText',
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(
          horizontal: SentraTheme.space2,
          vertical: SentraTheme.space1,
        ),
        decoration: const BoxDecoration(
          color: SentraTheme.bgCard,
          border: Border(top: BorderSide(color: SentraTheme.border)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              sourceLabel.toUpperCase(),
              style: const TextStyle(
                fontSize: 10,
                color: SentraTheme.textDim,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              responseText!,
              style: const TextStyle(fontSize: 14, color: SentraTheme.text, height: 1.5),
            ),
          ],
        ),
      ),
    );
  }
}
