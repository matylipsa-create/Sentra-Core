import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/guardian_status.dart';

/// Vista del Guardian Bacteriano: estado, confianza ternaria, alertas.
class GuardianView extends StatelessWidget {
  final GuardianStatus status;
  final VoidCallback onActivate;
  final VoidCallback onDeactivate;
  final VoidCallback onDismissQuarantine;
  final VoidCallback onCheckChain;
  final VoidCallback onClearAlerts;
  final ValueChanged<String> onResolveAlert;

  const GuardianView({
    super.key,
    required this.status,
    required this.onActivate,
    required this.onDeactivate,
    required this.onDismissQuarantine,
    required this.onCheckChain,
    required this.onClearAlerts,
    required this.onResolveAlert,
  });

  String get _stateLabel {
    switch (status.state) {
      case GuardianState.dormant: return 'Dormido';
      case GuardianState.active: return 'Activo';
      case GuardianState.alert: return 'Alerta';
      case GuardianState.quarantine: return 'Cuarentena';
    }
  }

  String get _stateIcon {
    switch (status.state) {
      case GuardianState.dormant: return '\u{1F634}';
      case GuardianState.active: return '\u{1F9EA}';
      case GuardianState.alert: return '\u{26A0}';
      case GuardianState.quarantine: return '\u{1F6AB}';
    }
  }

  Color get _stateColor {
    switch (status.state) {
      case GuardianState.dormant: return SentraTheme.textDim;
      case GuardianState.active: return SentraTheme.accent;
      case GuardianState.alert: return SentraTheme.warning;
      case GuardianState.quarantine: return SentraTheme.error;
    }
  }

  String _tritSymbol(int t) => t > 0 ? '+1' : t < 0 ? '-1' : '0';

  Color _tritColor(int t) =>
      t > 0 ? SentraTheme.accent : t < 0 ? SentraTheme.error : SentraTheme.textDim;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // State banner
        Container(
          padding: const EdgeInsets.all(SentraTheme.space2),
          decoration: BoxDecoration(
            color: SentraTheme.bgCard,
            border: Border.all(color: _stateColor),
            borderRadius: BorderRadius.circular(SentraTheme.radius),
          ),
          child: Row(
            children: [
              Text(_stateIcon, style: const TextStyle(fontSize: 28)),
              const SizedBox(width: SentraTheme.space2),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _stateLabel,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: SentraTheme.textBright,
                      ),
                    ),
                    Text(
                      status.state == GuardianState.dormant
                          ? 'Guardian inactivo. Activalo para comenzar el monitoreo.'
                          : status.state == GuardianState.active
                              ? 'Monitoreando USB y cadena EVOLIS. Todo en orden.'
                              : status.state == GuardianState.alert
                                  ? 'Amenaza detectada. Revisa las alertas.'
                                  : 'Alteracion critica. Sistema en cuarentena.',
                      style: const TextStyle(
                        fontSize: 12,
                        color: SentraTheme.textDim,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: SentraTheme.space2),

        // Controls
        Wrap(
          spacing: SentraTheme.space1,
          children: [
            if (status.state == GuardianState.dormant)
              ElevatedButton.icon(
                onPressed: onActivate,
                icon: const Icon(Icons.play_arrow, size: 18),
                label: const Text('Activar'),
              ),
            if (status.state != GuardianState.dormant && status.state != GuardianState.quarantine)
              ElevatedButton.icon(
                onPressed: onDeactivate,
                icon: const Icon(Icons.stop, size: 18),
                label: const Text('Desactivar'),
              ),
            if (status.state == GuardianState.quarantine)
              ElevatedButton.icon(
                onPressed: onDismissQuarantine,
                icon: const Icon(Icons.exit_to_app, size: 18),
                label: const Text('Salir de cuarentena'),
              ),
            ElevatedButton.icon(
              onPressed: onCheckChain,
              icon: const Icon(Icons.verified, size: 18),
              label: const Text('Verificar cadena'),
            ),
          ],
        ),
        const SizedBox(height: SentraTheme.space2),

        // Trust grid
        Row(
          children: [
            Expanded(child: _trustCard('Confianza USB', status.usbTrust)),
            const SizedBox(width: SentraTheme.space1),
            Expanded(child: _trustCard('Cadena EVOLIS', status.chainTrust)),
            if (status.overallTrustValue != null) ...[
              const SizedBox(width: SentraTheme.space1),
              Expanded(child: _trustCard('Global', status.overallTrustValue!, isOverall: true)),
            ],
          ],
        ),
        const SizedBox(height: SentraTheme.space2),

        // Alerts
        if (status.alerts.isNotEmpty) ...[
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Alertas (${status.alerts.length})',
                style: const TextStyle(
                  color: SentraTheme.error,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              TextButton(
                onPressed: onClearAlerts,
                child: const Text('Limpiar', style: TextStyle(fontSize: 12)),
              ),
            ],
          ),
          ...status.alerts.map((alert) => Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.symmetric(
                  horizontal: SentraTheme.space2,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: SentraTheme.bgElevated,
                  borderRadius: BorderRadius.circular(SentraTheme.radiusSm),
                  border: Border(
                    left: BorderSide(
                      color: alert.severity == 'critical' || alert.severity == 'high'
                          ? SentraTheme.error
                          : alert.severity == 'medium'
                              ? SentraTheme.warning
                              : SentraTheme.textDim,
                      width: 3,
                    ),
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            alert.message,
                            style: const TextStyle(fontSize: 13, color: SentraTheme.text),
                          ),
                          Text(
                            DateTime.fromMillisecondsSinceEpoch(alert.timestamp)
                                .toLocal()
                                .toString()
                                .substring(0, 19),
                            style: const TextStyle(
                              fontSize: 11,
                              color: SentraTheme.textDim,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => onResolveAlert(alert.id),
                      icon: const Icon(Icons.check, size: 18),
                      tooltip: 'Resolver',
                    ),
                  ],
                ),
              )),
        ],
      ],
    );
  }

  Widget _trustCard(String label, int trit, {bool isOverall = false}) {
    return Container(
      padding: const EdgeInsets.all(SentraTheme.space2),
      decoration: BoxDecoration(
        color: SentraTheme.bgCard,
        border: Border.all(
          color: isOverall ? SentraTheme.neonFocus : SentraTheme.border,
        ),
        borderRadius: BorderRadius.circular(SentraTheme.radius),
      ),
      child: Column(
        children: [
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              fontSize: 11,
              color: SentraTheme.textDim,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            _tritSymbol(trit),
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w700,
              fontFamily: 'Courier New',
              color: _tritColor(trit),
            ),
          ),
        ],
      ),
    );
  }
}
