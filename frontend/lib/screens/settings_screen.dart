import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../services/state_notifier.dart';

/// Pantalla de configuracion de Sentra Core.
class SettingsScreen extends StatelessWidget {
  final SentraStateNotifier notifier;

  const SettingsScreen({super.key, required this.notifier});

  @override
  Widget build(BuildContext context) {
    final state = notifier.state;

    return Scaffold(
      appBar: AppBar(title: const Text('Configuracion')),
      body: ListView(
        padding: const EdgeInsets.all(SentraTheme.space2),
        children: [
          _SettingTile(
            icon: Icons.record_voice_over,
            title: 'Voz habilitada',
            value: state.voiceEnabled,
            onChanged: (_) {},
          ),
          _SettingTile(
            icon: Icons.gavel,
            title: 'Veto humano',
            value: state.humanVeto,
            onChanged: (_) => notifier.toggleHumanVeto(),
          ),
          _SettingTile(
            icon: Icons.biotech,
            title: 'BioSoftware',
            value: state.bioEnabled,
            onChanged: (_) => notifier.toggleBio(),
          ),
          _SettingTile(
            icon: Icons.cloud,
            title: 'Conexion al mundo',
            value: state.worldEnabled,
            onChanged: (_) => notifier.toggleWorldConnection(),
          ),
          _SettingTile(
            icon: Icons.smart_toy,
            title: 'Gemini remoto',
            value: state.geminiRemote,
            onChanged: (_) => notifier.toggleGeminiRemote(),
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.info_outline, color: SentraTheme.primary),
            title: const Text('Sentra Core v4.0.0_BIO'),
            subtitle: const Text('Navaja Suiza Soberana Multiplataforma\n'
                'Backend: TypeScript + WebSocket/REST\n'
                'Frontend: Flutter (Dart)'),
          ),
        ],
      ),
    );
  }
}

class _SettingTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _SettingTile({
    required this.icon,
    required this.title,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      secondary: Icon(icon, color: SentraTheme.primary),
      title: Text(title),
      value: value,
      onChanged: onChanged,
      activeColor: SentraTheme.primary,
    );
  }
}
