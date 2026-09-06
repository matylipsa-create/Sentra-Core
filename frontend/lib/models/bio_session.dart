/// Sesion BioSoftware y protocolos.

class BioProtocolDef {
  final String id;
  final String label;
  final String description;
  final String icon;
  final int defaultDuration;

  const BioProtocolDef({
    required this.id,
    required this.label,
    required this.description,
    required this.icon,
    required this.defaultDuration,
  });

  factory BioProtocolDef.fromJson(Map<String, dynamic> json) {
    return BioProtocolDef(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? '',
      description: json['description'] as String? ?? '',
      icon: json['icon'] as String? ?? '',
      defaultDuration: json['defaultDuration'] as int? ?? 300,
    );
  }
}

class BioSessionMetrics {
  final double coherenceScore;
  final double placeboAdherence;
  final int reframingCount;
  final int breathCycles;
  final double? avgHeartRate;
  final double stressLevel;
  final double focusLevel;

  const BioSessionMetrics({
    this.coherenceScore = 0,
    this.placeboAdherence = 0,
    this.reframingCount = 0,
    this.breathCycles = 0,
    this.avgHeartRate,
    this.stressLevel = 0.5,
    this.focusLevel = 0.5,
  });

  factory BioSessionMetrics.fromJson(Map<String, dynamic> json) {
    return BioSessionMetrics(
      coherenceScore: (json['coherenceScore'] as num?)?.toDouble() ?? 0,
      placeboAdherence: (json['placeboAdherence'] as num?)?.toDouble() ?? 0,
      reframingCount: json['reframingCount'] as int? ?? 0,
      breathCycles: json['breathCycles'] as int? ?? 0,
      avgHeartRate: (json['avgHeartRate'] as num?)?.toDouble(),
      stressLevel: (json['stressLevel'] as num?)?.toDouble() ?? 0.5,
      focusLevel: (json['focusLevel'] as num?)?.toDouble() ?? 0.5,
    );
  }
}

class BioSession {
  final String id;
  final String protocol;
  final int startedAt;
  final int? endedAt;
  final int duration;
  final BioSessionMetrics metrics;
  final List<String> reframes;
  final bool completed;

  const BioSession({
    required this.id,
    required this.protocol,
    required this.startedAt,
    this.endedAt,
    required this.duration,
    required this.metrics,
    this.reframes = const [],
    this.completed = false,
  });

  factory BioSession.fromJson(Map<String, dynamic> json) {
    return BioSession(
      id: json['id'] as String? ?? '',
      protocol: json['protocol'] as String? ?? '',
      startedAt: json['startedAt'] as int? ?? 0,
      endedAt: json['endedAt'] as int?,
      duration: json['duration'] as int? ?? 0,
      metrics: BioSessionMetrics.fromJson(json['metrics'] as Map<String, dynamic>? ?? {}),
      reframes: (json['reframes'] as List?)?.map((e) => e.toString()).toList() ?? [],
      completed: json['completed'] as bool? ?? false,
    );
  }
}

class BioState {
  final String? activeProtocol;
  final BioSession? currentSession;
  final List<BioSession> sessions;
  final double cardiacCoherence;
  final double stressLevel;
  final double focusLevel;
  final bool enabled;

  const BioState({
    this.activeProtocol,
    this.currentSession,
    this.sessions = const [],
    this.cardiacCoherence = 0.5,
    this.stressLevel = 0.5,
    this.focusLevel = 0.5,
    this.enabled = false,
  });

  factory BioState.fromJson(Map<String, dynamic> json) {
    return BioState(
      activeProtocol: json['activeProtocol'] as String?,
      currentSession: json['currentSession'] != null
          ? BioSession.fromJson(json['currentSession'] as Map<String, dynamic>)
          : null,
      sessions: (json['sessions'] as List?)
              ?.map((e) => BioSession.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      cardiacCoherence: (json['cardiacCoherence'] as num?)?.toDouble() ?? 0.5,
      stressLevel: (json['stressLevel'] as num?)?.toDouble() ?? 0.5,
      focusLevel: (json['focusLevel'] as num?)?.toDouble() ?? 0.5,
      enabled: json['enabled'] as bool? ?? false,
    );
  }
}

class BioStats {
  final int totalSessions;
  final double avgCoherence;
  final int totalReframes;
  final int totalBreathCycles;

  const BioStats({
    this.totalSessions = 0,
    this.avgCoherence = 0,
    this.totalReframes = 0,
    this.totalBreathCycles = 0,
  });

  factory BioStats.fromJson(Map<String, dynamic> json) {
    return BioStats(
      totalSessions: json['totalSessions'] as int? ?? 0,
      avgCoherence: (json['avgCoherence'] as num?)?.toDouble() ?? 0,
      totalReframes: json['totalReframes'] as int? ?? 0,
      totalBreathCycles: json['totalBreathCycles'] as int? ?? 0,
    );
  }
}
