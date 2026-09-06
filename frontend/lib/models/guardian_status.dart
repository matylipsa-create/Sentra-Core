/// Estado del Guardian Bacteriano.

enum GuardianState { dormant, active, alert, quarantine }

class GuardianAlert {
  final String id;
  final String type;
  final String severity;
  final String message;
  final int timestamp;
  final String? deviceKey;

  const GuardianAlert({
    required this.id,
    required this.type,
    required this.severity,
    required this.message,
    required this.timestamp,
    this.deviceKey,
  });

  factory GuardianAlert.fromJson(Map<String, dynamic> json) {
    return GuardianAlert(
      id: json['id'] as String? ?? '',
      type: json['type'] as String? ?? '',
      severity: json['severity'] as String? ?? 'low',
      message: json['message'] as String? ?? '',
      timestamp: json['timestamp'] as int? ?? 0,
      deviceKey: json['deviceKey'] as String?,
    );
  }
}

class GuardianStatus {
  final GuardianState state;
  final List<GuardianAlert> alerts;
  final int usbTrust;
  final int chainTrust;
  final int? overallTrustValue;
  final double? overallTrustConfidence;
  final bool monitoringUsb;
  final bool monitoringChain;
  final int? lastChainCheck;
  final int totalAlerts;

  const GuardianStatus({
    this.state = GuardianState.dormant,
    this.alerts = const [],
    this.usbTrust = 0,
    this.chainTrust = 1,
    this.overallTrustValue,
    this.overallTrustConfidence,
    this.monitoringUsb = false,
    this.monitoringChain = false,
    this.lastChainCheck,
    this.totalAlerts = 0,
  });

  factory GuardianStatus.fromJson(Map<String, dynamic> json) {
    return GuardianStatus(
      state: GuardianState.values.firstWhere(
        (e) => e.name == json['state'],
        orElse: () => GuardianState.dormant,
      ),
      alerts: (json['alerts'] as List?)
              ?.map((e) => GuardianAlert.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      usbTrust: json['usbTrust'] as int? ?? 0,
      chainTrust: json['chainTrust'] as int? ?? 1,
      overallTrustValue: (json['overallTrust']?['value']) as int?,
      overallTrustConfidence:
          (json['overallTrust']?['confidence'] as num?)?.toDouble(),
      monitoringUsb: json['monitoringUsb'] as bool? ?? false,
      monitoringChain: json['monitoringChain'] as bool? ?? false,
      lastChainCheck: json['lastChainCheck'] as int?,
      totalAlerts: json['totalAlerts'] as int? ?? 0,
    );
  }
}
