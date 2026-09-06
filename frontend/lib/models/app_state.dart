import 'bio_session.dart';
import 'guardian_status.dart';

/// Estado global de la aplicacion Sentra Core.
class AppStateData {
  final String activeModule;
  final bool voiceEnabled;
  final bool humanVeto;
  final String powerMode;
  final String syncTransport;
  final bool geminiRemote;
  final bool worldEnabled;
  final bool bioEnabled;
  final int evidenceCount;
  final BioState bioState;
  final GuardianState guardianState;
  final String? lastResponseText;
  final String? lastResponseSource;
  final String? moralBlockReason;
  final bool connected;

  const AppStateData({
    this.activeModule = 'vision',
    this.voiceEnabled = true,
    this.humanVeto = false,
    this.powerMode = 'normal',
    this.syncTransport = 'offline',
    this.geminiRemote = false,
    this.worldEnabled = false,
    this.bioEnabled = false,
    this.evidenceCount = 0,
    this.bioState = const BioState(),
    this.guardianState = GuardianState.dormant,
    this.lastResponseText,
    this.lastResponseSource,
    this.moralBlockReason,
    this.connected = false,
  });

  AppStateData copyWith({
    String? activeModule,
    bool? voiceEnabled,
    bool? humanVeto,
    String? powerMode,
    String? syncTransport,
    bool? geminiRemote,
    bool? worldEnabled,
    bool? bioEnabled,
    int? evidenceCount,
    BioState? bioState,
    GuardianState? guardianState,
    String? lastResponseText,
    String? lastResponseSource,
    String? moralBlockReason,
    bool? connected,
  }) {
    return AppStateData(
      activeModule: activeModule ?? this.activeModule,
      voiceEnabled: voiceEnabled ?? this.voiceEnabled,
      humanVeto: humanVeto ?? this.humanVeto,
      powerMode: powerMode ?? this.powerMode,
      syncTransport: syncTransport ?? this.syncTransport,
      geminiRemote: geminiRemote ?? this.geminiRemote,
      worldEnabled: worldEnabled ?? this.worldEnabled,
      bioEnabled: bioEnabled ?? this.bioEnabled,
      evidenceCount: evidenceCount ?? this.evidenceCount,
      bioState: bioState ?? this.bioState,
      guardianState: guardianState ?? this.guardianState,
      lastResponseText: lastResponseText ?? this.lastResponseText,
      lastResponseSource: lastResponseSource ?? this.lastResponseSource,
      moralBlockReason: moralBlockReason,
      connected: connected ?? this.connected,
    );
  }
}
