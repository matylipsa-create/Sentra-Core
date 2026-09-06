import 'package:flutter/material.dart';
import '../config/theme.dart';

/// Vista de la cadena de evidencia EVOLIS.
class EvidenceChainView extends StatelessWidget {
  final List<Map<String, dynamic>> entries;
  final VoidCallback onVerify;
  final VoidCallback onExport;

  const EvidenceChainView({
    super.key,
    required this.entries,
    required this.onVerify,
    required this.onExport,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '${entries.length} entradas registradas',
          style: const TextStyle(fontSize: 13, color: SentraTheme.textDim),
        ),
        const SizedBox(height: SentraTheme.space2),
        if (entries.isEmpty)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(SentraTheme.space4),
              child: Text(
                'No hay evidencia registrada.',
                style: TextStyle(color: SentraTheme.textDim),
              ),
            ),
          )
        else
          Flexible(
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: entries.length,
              itemBuilder: (context, index) {
                final e = entries[index];
                final entry = e['entry'] as Map<String, dynamic>?;
                final hash = (entry?['hash'] as String?) ?? '';
                final ts = (entry?['timestamp'] as int?) ?? 0;
                return Container(
                  margin: const EdgeInsets.only(bottom: 6),
                  padding: const EdgeInsets.symmetric(
                    horizontal: SentraTheme.space2,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: SentraTheme.bgCard,
                    border: Border.all(color: SentraTheme.border),
                    borderRadius: BorderRadius.circular(SentraTheme.radiusSm),
                  ),
                  child: Row(
                    children: [
                      Text(
                        '#${entry?['index'] ?? index}',
                        style: const TextStyle(
                          color: SentraTheme.primary,
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(width: SentraTheme.space1),
                      Text(
                        e['module'] as String? ?? '',
                        style: const TextStyle(color: SentraTheme.accent, fontSize: 12),
                      ),
                      const Spacer(),
                      Text(
                        hash.isNotEmpty ? '${hash.substring(0, 16)}...' : '',
                        style: const TextStyle(
                          fontFamily: 'Courier New',
                          fontSize: 10,
                          color: SentraTheme.textDim,
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        const SizedBox(height: SentraTheme.space2),
        Row(
          children: [
            Expanded(
              child: ElevatedButton.icon(
                onPressed: onVerify,
                icon: const Icon(Icons.verified, size: 18),
                label: const Text('Verificar'),
              ),
            ),
            const SizedBox(width: SentraTheme.space1),
            Expanded(
              child: ElevatedButton.icon(
                onPressed: onExport,
                icon: const Icon(Icons.download, size: 18),
                label: const Text('Exportar'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
