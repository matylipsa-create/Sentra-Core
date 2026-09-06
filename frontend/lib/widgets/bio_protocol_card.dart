import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/bio_session.dart';

/// Tarjeta de protocolo BioSoftware para seleccion.
class BioProtocolCard extends StatelessWidget {
  final BioProtocolDef protocol;
  final VoidCallback onTap;

  const BioProtocolCard({
    super.key,
    required this.protocol,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Iniciar ${protocol.label}. ${protocol.description}. '
          '${(protocol.defaultDuration / 60).round()} minutos.',
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(SentraTheme.radius),
        child: Container(
          padding: const EdgeInsets.all(SentraTheme.space2),
          decoration: BoxDecoration(
            color: SentraTheme.bgCard,
            borderRadius: BorderRadius.circular(SentraTheme.radius),
            border: Border.all(color: SentraTheme.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(protocol.icon, style: const TextStyle(fontSize: 28)),
              const SizedBox(height: 6),
              Text(
                protocol.label,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: SentraTheme.accent,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                protocol.description,
                style: const TextStyle(
                  fontSize: 12,
                  color: SentraTheme.textDim,
                  height: 1.4,
                ),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: SentraTheme.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '${(protocol.defaultDuration / 60).round()} min',
                  style: const TextStyle(
                    fontSize: 11,
                    color: SentraTheme.primary,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
