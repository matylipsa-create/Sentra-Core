import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../services/sentra_client.dart';
import '../services/state_notifier.dart';
import '../widgets/evidence_chain_view.dart';

/// Pantalla del modulo Evidencia (EVOLIS).
class EvidenceScreen extends StatefulWidget {
  final SentraStateNotifier notifier;
  final SentraClient client;

  const EvidenceScreen({super.key, required this.notifier, required this.client});

  @override
  State<EvidenceScreen> createState() => _EvidenceScreenState();
}

class _EvidenceScreenState extends State<EvidenceScreen> {
  List<Map<String, dynamic>> _entries = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadEvidence();
  }

  void _loadEvidence() async {
    setState(() => _loading = true);
    try {
      final resp = await widget.client.getEvidence();
      final list = (resp['entries'] as List?)
          ?.map((e) => e as Map<String, dynamic>)
          .toList();
      if (mounted) setState(() { _entries = list ?? []; _loading = false; });
    } catch {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Cadena de Evidencia EVOLIS',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: SentraTheme.textBright),
        ),
        const SizedBox(height: SentraTheme.space2),
        if (_loading)
          const Center(child: CircularProgressIndicator(color: SentraTheme.primary))
        else
          EvidenceChainView(
            entries: _entries,
            onVerify: () async {
              final valid = await widget.notifier.checkChain();
              if (!mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(valid
                      ? 'Cadena verificada: integridad y firmas OK'
                      : 'Cadena corrupta o firma invalida'),
                  backgroundColor: valid ? SentraTheme.accent : SentraTheme.error,
                ),
              );
            },
            onExport: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Exportacion iniciada en el backend')),
              );
            },
          ),
      ],
    );
  }
}
