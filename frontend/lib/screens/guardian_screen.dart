import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../services/sentra_client.dart';
import '../services/state_notifier.dart';
import '../models/guardian_status.dart';
import '../widgets/guardian_view.dart';

/// Pantalla del modulo Guardian Bacteriano.
class GuardianScreen extends StatefulWidget {
  final SentraStateNotifier notifier;
  final SentraClient client;

  const GuardianScreen({super.key, required this.notifier, required this.client});

  @override
  State<GuardianScreen> createState() => _GuardianScreenState();
}

class _GuardianScreenState extends State<GuardianScreen> {
  GuardianStatus? _status;

  @override
  void initState() {
    super.initState();
    _loadStatus();
    _listenGuardianEvents();
  }

  void _loadStatus() async {
    try {
      final resp = await widget.client.getGuardianStatus();
      if (mounted) setState(() => _status = GuardianStatus.fromJson(resp));
    } catch {
      // use default
    }
  }

  void _listenGuardianEvents() {
    widget.client.events
        .where((e) => e.event == 'guardian.state_change')
        .listen((e) {
      if (!mounted) return;
      final data = e.data as Map<String, dynamic>?;
      if (data != null) {
        setState(() => _status = GuardianStatus.fromJson(data));
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Guardian Bacteriano',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: SentraTheme.textBright),
        ),
        const SizedBox(height: SentraTheme.space1),
        const Text(
          'Defensa activa: monitorea puertos USB y la cadena de evidencia EVOLIS con logica ternaria (+1, 0, -1).',
          style: TextStyle(color: SentraTheme.textDim, fontSize: 13),
        ),
        const SizedBox(height: SentraTheme.space2),
        if (_status == null)
          const Center(child: CircularProgressIndicator(color: SentraTheme.accent))
        else
          GuardianView(
            status: _status!,
            onActivate: widget.notifier.activateGuardian,
            onDeactivate: widget.notifier.deactivateGuardian,
            onDismissQuarantine: widget.notifier.dismissQuarantine,
            onCheckChain: () async {
              final valid = await widget.notifier.checkChain();
              if (!mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(valid ? 'Cadena EVOLIS verificada: OK' : 'Cadena corrupta'),
                  backgroundColor: valid ? SentraTheme.accent : SentraTheme.error,
                ),
              );
            },
            onClearAlerts: widget.notifier.clearAlerts,
            onResolveAlert: widget.notifier.resolveAlert,
          ),
      ],
    );
  }
}
