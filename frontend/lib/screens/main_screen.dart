import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/app_state.dart';
import '../services/sentra_client.dart';
import '../services/state_notifier.dart';
import '../models/module_def.dart';
import '../widgets/accessible_header.dart';
import '../widgets/voice_orb_button.dart';
import '../widgets/module_drawer.dart';
import '../widgets/response_banner.dart';
import '../widgets/status_chips.dart';
import 'bio_screen.dart';
import 'evidence_screen.dart';
import 'guardian_screen.dart';
import 'learning_screen.dart';
import 'vision_screen.dart';
import 'silence_screen.dart';

/// Pantalla principal de Sentra Core: header + contenido + barra de voz.
class MainScreen extends StatefulWidget {
  final SentraStateNotifier notifier;
  final SentraClient client;

  const MainScreen({
    super.key,
    required this.notifier,
    required this.client,
  });

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  VoiceOrbState _orbState = VoiceOrbState.idle;
  String _orbLabel = 'Toca para hablar';

  @override
  void initState() {
    super.initState();
    widget.notifier.init();
  }

  @override
  void dispose() {
    widget.client.dispose();
    super.dispose();
  }

  void _onOrbTap() {
    setState(() {
      if (_orbState == VoiceOrbState.idle) {
        _orbState = VoiceOrbState.listening;
        _orbLabel = 'Escuchando...';
      } else if (_orbState == VoiceOrbState.listening) {
        _orbState = VoiceOrbState.idle;
        _orbLabel = 'Toca para hablar';
      }
    });
  }

  void _onOrbDoubleTap() {
    setState(() {
      if (_orbState == VoiceOrbState.disabled) {
        _orbState = VoiceOrbState.idle;
        _orbLabel = 'Toca para hablar';
      } else {
        _orbState = VoiceOrbState.disabled;
        _orbLabel = 'Voz apagada';
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.notifier,
      builder: (context, _) {
        final state = widget.notifier.state;

        return Scaffold(
          body: SafeArea(
            child: Column(
              children: [
                AccessibleHeader(
                  activeModule: state.activeModule,
                  humanVeto: state.humanVeto,
                  bioEnabled: state.bioEnabled,
                  bioCoherence: state.bioEnabled
                      ? (state.bioState.cardiacCoherence * 100).round()
                      : null,
                  geminiRemote: state.geminiRemote,
                  evidenceCount: state.evidenceCount,
                  isOnline: state.connected,
                ),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(SentraTheme.space2),
                    child: _buildModuleContent(state),
                  ),
                ),
                ResponseBanner(
                  responseText: state.lastResponseText,
                  responseSource: state.lastResponseSource,
                  moralBlockReason: state.moralBlockReason,
                ),
                _buildVoiceBar(state),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildModuleContent(AppStateData state) {
    switch (state.activeModule) {
      case 'bio':
        return BioScreen(notifier: widget.notifier, client: widget.client);
      case 'evidencia':
        return EvidenceScreen(notifier: widget.notifier, client: widget.client);
      case 'guardian':
        return GuardianScreen(notifier: widget.notifier, client: widget.client);
      case 'aprendizaje':
        return LearningScreen(notifier: widget.notifier);
      case 'vision':
        return const VisionScreen();
      case 'silencio':
        return const SilenceScreen();
      default:
        return Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.construction, size: 48, color: SentraTheme.textDim),
              const SizedBox(height: SentraTheme.space2),
              Text(
                'Modulo "${state.activeModule}" en desarrollo',
                style: const TextStyle(color: SentraTheme.textDim),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        );
    }
  }

  Widget _buildVoiceBar(AppStateData state) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: SentraTheme.space2,
        vertical: SentraTheme.space1,
      ),
      decoration: const BoxDecoration(
        color: SentraTheme.bgCard,
        border: Border(top: BorderSide(color: SentraTheme.border)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Drawer trigger
          Semantics(
            button: true,
            label: 'Abrir menu de modulos. Modulo activo: ${state.activeModule}',
            child: InkWell(
              onTap: () => ModuleDrawer.show(
                context,
                modules: defaultModules,
                activeModuleId: state.activeModule,
                onSelect: (id) => widget.notifier.setModule(id),
              ),
              borderRadius: BorderRadius.circular(SentraTheme.radiusSm),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: SentraTheme.bgElevated,
                  border: Border.all(color: SentraTheme.border),
                  borderRadius: BorderRadius.circular(SentraTheme.radiusSm),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.dashboard, size: 20, color: SentraTheme.textDim),
                    const SizedBox(height: 2),
                    Text(
                      state.activeModule,
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: SentraTheme.textDim,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          // Voice orb
          VoiceOrbButton(
            state: _orbState,
            label: _orbLabel,
            onTap: _onOrbTap,
            onDoubleTap: _onOrbDoubleTap,
          ),
          // Status chips
          StatusChips(
            humanVeto: state.humanVeto,
            bioEnabled: state.bioEnabled,
            bioCoherence: state.bioEnabled
                ? (state.bioState.cardiacCoherence * 100).round()
                : null,
            evidenceCount: state.evidenceCount,
          ),
        ],
      ),
    );
  }
}
