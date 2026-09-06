import 'package:flutter/material.dart';
import 'config/theme.dart';
import 'services/sentra_client.dart';
import 'services/state_notifier.dart';
import 'screens/main_screen.dart';
import 'screens/settings_screen.dart';

/// Punto de entrada de Sentra Core Frontend (Flutter).
void main() {
  runApp(const SentraApp());
}

class SentraApp extends StatelessWidget {
  const SentraApp({super.key});

  @override
  Widget build(BuildContext context) {
    final client = SentraClient();
    final notifier = SentraStateNotifier(client);

    return MaterialApp(
      title: 'Sentra Core',
      debugShowCheckedModeBanner: false,
      theme: SentraTheme.darkTheme,
      home: MainScreen(notifier: notifier, client: client),
      routes: {
        '/settings': (ctx) => SettingsScreen(notifier: notifier),
      },
    );
  }
}
