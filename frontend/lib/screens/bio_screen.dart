import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../services/sentra_client.dart';
import '../services/state_notifier.dart';
import '../models/bio_session.dart';
import '../widgets/bio_protocol_card.dart';
import '../widgets/bio_breath_guide.dart';

/// Pantalla del modulo BioSoftware.
class BioScreen extends StatefulWidget {
  final SentraStateNotifier notifier;
  final SentraClient client;

  const BioScreen({super.key, required this.notifier, required this.client});

  @override
  State<BioScreen> createState() => _BioScreenState();
}

class _BioScreenState extends State<BioScreen> {
  List<BioProtocolDef> _protocols = [];
  String? _breathPhase;
  double _progress = 0;
  int _breathCycles = 0;

  @override
  void initState() {
    super.initState();
    _loadProtocols();
    _listenBioTicks();
  }

  void _loadProtocols() async {
    try {
      final resp = await widget.client.getBioProtocols();
      final list = (resp['protocols'] as List?)
          ?.map((e) => BioProtocolDef.fromJson(e as Map<String, dynamic>))
          .toList();
      if (list != null && mounted) setState(() => _protocols = list);
    } catch {
      // use defaults
    }
  }

  void _listenBioTicks() {
    widget.client.events.where((e) => e.event == 'bio.tick').listen((e) {
      if (!mounted) return;
      final data = e.data as Map<String, dynamic>?;
      setState(() {
        _breathPhase = data?['breathPhase'] as String?;
        _progress = (data?['progress'] as num?)?.toDouble() ?? 0;
        _breathCycles = data?['breathCycles'] as int? ?? 0;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.notifier.state;
    final bio = state.bioState;

    if (!state.bioEnabled) {
      return Column(
        children: [
          const Text('BioSoftware', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: SentraTheme.textBright)),
          const SizedBox(height: SentraTheme.space4),
          const Text(
            'BioSoftware esta desactivado. Activalo con el boton Bio ON en los controles.',
            style: TextStyle(color: SentraTheme.textDim),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: SentraTheme.space2),
          ElevatedButton(
            onPressed: widget.notifier.toggleBio,
            child: const Text('Activar BioSoftware'),
          ),
        ],
      );
    }

    if (bio.activeProtocol == null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('BioSoftware', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: SentraTheme.textBright)),
          const SizedBox(height: SentraTheme.space1),
          const Text(
            'Inferencia activa, placebos cognitivos, reencuadre cognitivo, neuroplasticidad, epigenetica y coherencia cardiaca.',
            style: TextStyle(color: SentraTheme.textDim, fontSize: 13),
          ),
          const SizedBox(height: SentraTheme.space2),
          if (_protocols.isEmpty)
            const Center(child: CircularProgressIndicator(color: SentraTheme.accent))
          else
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 200,
                crossAxisSpacing: SentraTheme.space2,
                mainAxisSpacing: SentraTheme.space2,
              ),
              itemCount: _protocols.length,
              itemBuilder: (context, index) => BioProtocolCard(
                protocol: _protocols[index],
                onTap: () => widget.notifier.startBioSession(_protocols[index].id),
              ),
            ),
        ],
      );
    }

    // Active session
    return _buildActiveSession(bio);
  }

  Widget _buildActiveSession(BioState bio) {
    final protocolLabel = _protocols
        .where((p) => p.id == bio.activeProtocol)
        .map((p) => p.label)
        .firstOrDefault ?? bio.activeProtocol;

    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              protocolLabel,
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: SentraTheme.accent),
            ),
            ElevatedButton.icon(
              onPressed: widget.notifier.stopBioSession,
              icon: const Icon(Icons.stop, size: 18, color: SentraTheme.error),
              label: const Text('Detener', style: TextStyle(color: SentraTheme.error)),
            ),
          ],
        ),
        const SizedBox(height: SentraTheme.space2),
        if (bio.activeProtocol == 'cardiac_coherence' && _breathPhase != null)
          BioBreathGuide(phase: _breathPhase!, cycles: _breathCycles),
        const SizedBox(height: SentraTheme.space2),
        // Progress bar
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: _progress,
            minHeight: 8,
            backgroundColor: SentraTheme.bgElevated,
            color: SentraTheme.accent,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          '${(_progress * 100).round()}% completado',
          style: const TextStyle(fontSize: 12, color: SentraTheme.textDim),
        ),
        const SizedBox(height: SentraTheme.space2),
        // Metrics grid
        Row(
          children: [
            Expanded(child: _metricCard('Coherencia', '${(bio.cardiacCoherence * 100).round()}%')),
            const SizedBox(width: SentraTheme.space1),
            Expanded(child: _metricCard('Ciclos', '$_breathCycles')),
            const SizedBox(width: SentraTheme.space1),
            Expanded(child: _metricCard('Estres', '${(bio.stressLevel * 100).round()}%')),
            const SizedBox(width: SentraTheme.space1),
            Expanded(child: _metricCard('Enfoque', '${(bio.focusLevel * 100).round()}%')),
          ],
        ),
        const SizedBox(height: SentraTheme.space2),
        if (widget.notifier.state.lastResponseText != null)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(SentraTheme.space2),
            decoration: BoxDecoration(
              color: SentraTheme.bgElevated,
              borderRadius: BorderRadius.circular(SentraTheme.radiusSm),
              border: const Border(left: BorderSide(color: SentraTheme.accent, width: 3)),
            ),
            child: Text(
              widget.notifier.state.lastResponseText!,
              style: const TextStyle(fontSize: 14, color: SentraTheme.text, height: 1.5),
            ),
          ),
        const SizedBox(height: SentraTheme.space1),
        ElevatedButton.icon(
          onPressed: widget.notifier.getReframe,
          icon: const Icon(Icons.refresh, size: 18),
          label: const Text('Nuevo reencuadre'),
        ),
      ],
    );
  }

  Widget _metricCard(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(SentraTheme.space1),
      decoration: BoxDecoration(
        color: SentraTheme.bgElevated,
        borderRadius: BorderRadius.circular(SentraTheme.radiusSm),
        border: Border.all(color: SentraTheme.border),
      ),
      child: Column(
        children: [
          Text(label.toUpperCase(), style: const TextStyle(fontSize: 10, color: SentraTheme.textDim)),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: SentraTheme.accent),
          ),
        ],
      ),
    );
  }
}

extension _FirstOrDefault<T> on Iterable<T> {
  T? get firstOrDefault => isEmpty ? null : first;
}
