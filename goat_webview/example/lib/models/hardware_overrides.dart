/// GPS Preset coordinate for hardware spoofing.
class GpsPreset {
  final String name;
  final double latitude;
  final double longitude;
  final double accuracy;

  const GpsPreset({
    required this.name,
    required this.latitude,
    required this.longitude,
    this.accuracy = 5.0,
  });

  static const GpsPreset defaultPreset = GpsPreset(
    name: 'San Francisco (Headquarters)',
    latitude: 37.7749,
    longitude: -122.4194,
    accuracy: 3.5,
  );

  static const List<GpsPreset> defaultPresets = [
    defaultPreset,
    GpsPreset(
      name: 'Tokyo (Shinjuku Station)',
      latitude: 35.6895,
      longitude: 139.6917,
      accuracy: 4.2,
    ),
    GpsPreset(
      name: 'London (Tower Bridge)',
      latitude: 51.5055,
      longitude: -0.0754,
      accuracy: 5.0,
    ),
    GpsPreset(
      name: 'Paris (Eiffel Tower)',
      latitude: 48.8584,
      longitude: 2.2945,
      accuracy: 3.0,
    ),
    GpsPreset(
      name: 'Phnom Penh (Bakong Tower)',
      latitude: 11.5564,
      longitude: 104.9282,
      accuracy: 4.0,
    ),
  ];

  Map<String, dynamic> toMap() => {
        'name': name,
        'latitude': latitude,
        'longitude': longitude,
        'accuracy': accuracy,
      };
}

/// Mock outcome modes for Biometric authentication.
enum BiometricMockOutcome {
  auto('AUTO', 'Real Hardware / Auto Response'),
  forceSuccess('FORCE_SUCCESS', 'Force Success (Always Authenticates)'),
  forceError('FORCE_ERROR', 'Force Error (Authentication Failed)'),
  lockedOut('LOCKED_OUT', 'Locked Out (Too Many Attempts)'),
  notEnrolled('NOT_ENROLLED', 'Not Enrolled (No Biometrics Registered)');

  final String code;
  final String label;
  const BiometricMockOutcome(this.code, this.label);

  static BiometricMockOutcome fromCode(String code) {
    for (final outcome in BiometricMockOutcome.values) {
      if (outcome.code == code) return outcome;
    }
    return BiometricMockOutcome.auto;
  }
}

/// State model for Hardware Overrides & Spoofing in Developer Debug HUD (R3).
class HardwareOverridesState {
  final bool isOffline;
  final bool mockGpsEnabled;
  final GpsPreset selectedGps;
  final BiometricMockOutcome mockBiometrics;
  final int artificialDelayMs;

  const HardwareOverridesState({
    this.isOffline = false,
    this.mockGpsEnabled = false,
    this.selectedGps = GpsPreset.defaultPreset,
    this.mockBiometrics = BiometricMockOutcome.auto,
    this.artificialDelayMs = 0,
  });

  HardwareOverridesState copyWith({
    bool? isOffline,
    bool? mockGpsEnabled,
    GpsPreset? selectedGps,
    BiometricMockOutcome? mockBiometrics,
    int? artificialDelayMs,
  }) {
    return HardwareOverridesState(
      isOffline: isOffline ?? this.isOffline,
      mockGpsEnabled: mockGpsEnabled ?? this.mockGpsEnabled,
      selectedGps: selectedGps ?? this.selectedGps,
      mockBiometrics: mockBiometrics ?? this.mockBiometrics,
      artificialDelayMs: artificialDelayMs ?? this.artificialDelayMs,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'isOffline': isOffline,
      'mockGps': mockGpsEnabled ? selectedGps.toMap() : null,
      'mockBiometrics': mockBiometrics.code,
      'artificialDelayMs': artificialDelayMs,
    };
  }
}
