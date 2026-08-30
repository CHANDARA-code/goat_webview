import 'dart:convert';

/// Represents an IPC message recorded by the developer debug console.
class IpcMessageEntry {
  final String id;
  final DateTime timestamp;
  final String action;
  final String namespace;
  final String direction; // 'INBOUND', 'OUTBOUND', 'SPI_DISPATCH'
  final String status; // 'SUCCESS', 'ERROR', 'PENDING'
  final double durationMs;
  final bool isWarmPath; // < 5.0ms
  final Map<String, dynamic> requestPayload;
  final dynamic responsePayload;
  final String? error;

  IpcMessageEntry({
    required this.id,
    DateTime? timestamp,
    required this.action,
    String? namespace,
    this.direction = 'INBOUND',
    this.status = 'SUCCESS',
    this.durationMs = 0.0,
    bool? isWarmPath,
    this.requestPayload = const {},
    this.responsePayload,
    this.error,
  })  : timestamp = timestamp ?? DateTime.now(),
        namespace = namespace ?? _extractNamespace(action),
        isWarmPath = isWarmPath ?? (durationMs > 0 && durationMs < 5.0);

  static String _extractNamespace(String action) {
    if (action.contains('BIOMETRIC')) return 'biometrics';
    if (action.contains('BLE') || action.contains('BLUETOOTH')) return 'bluetooth';
    if (action.contains('LOCATION') || action.contains('GPS')) return 'location';
    if (action.contains('IMAGE') || action.contains('VIDEO') || action.contains('VOICE') || action.contains('RECORD')) return 'media';
    if (action.contains('NETWORK') || action.contains('SSL') || action.contains('PING')) return 'network';
    if (action.contains('PAYMENT') || action.contains('PAY')) return 'payments';
    if (action.contains('SCAN') || action.contains('BARCODE')) return 'scanner';
    return 'core';
  }

  /// Categorizes the round-trip latency into warm-path, standard, or slow.
  String get latencyTier {
    if (durationMs < 5.0) return 'WARM_PATH'; // <5ms
    if (durationMs <= 15.0) return 'STANDARD'; // 5-15ms
    return 'COLD_PATH'; // >15ms
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'timestamp': timestamp.millisecondsSinceEpoch,
      'action': action,
      'namespace': namespace,
      'direction': direction,
      'status': status,
      'durationMs': durationMs,
      'isWarmPath': isWarmPath,
      'request': requestPayload,
      'response': responsePayload,
      'error': error,
    };
  }

  String toJsonString() {
    return const JsonEncoder.withIndent('  ').convert(toMap());
  }

  factory IpcMessageEntry.fromMap(Map<String, dynamic> map) {
    final duration = (map['durationMs'] as num?)?.toDouble() ?? 0.0;
    return IpcMessageEntry(
      id: map['id']?.toString() ?? 'msg_${DateTime.now().millisecondsSinceEpoch}',
      timestamp: map['timestamp'] != null
          ? DateTime.fromMillisecondsSinceEpoch(map['timestamp'] as int)
          : DateTime.now(),
      action: map['action']?.toString() ?? 'UNKNOWN',
      namespace: map['namespace']?.toString(),
      direction: map['direction']?.toString() ?? 'INBOUND',
      status: map['status']?.toString() ?? 'SUCCESS',
      durationMs: duration,
      isWarmPath: map['isWarmPath'] as bool? ?? (duration > 0 && duration < 5.0),
      requestPayload: map['request'] != null ? Map<String, dynamic>.from(map['request'] as Map) : {},
      responsePayload: map['response'],
      error: map['error']?.toString(),
    );
  }
}

/// Statistics and analytics for IPC bridge round-trip latency benchmarking.
class IpcLatencyStats {
  final int totalCount;
  final int warmPathCount; // <5ms
  final int standardCount; // 5-15ms
  final int coldPathCount; // >15ms
  final double averageLatencyMs;
  final double minLatencyMs;
  final double maxLatencyMs;

  const IpcLatencyStats({
    this.totalCount = 0,
    this.warmPathCount = 0,
    this.standardCount = 0,
    this.coldPathCount = 0,
    this.averageLatencyMs = 0.0,
    this.minLatencyMs = 0.0,
    this.maxLatencyMs = 0.0,
  });

  double get warmPathPercentage =>
      totalCount > 0 ? (warmPathCount / totalCount) * 100.0 : 0.0;

  factory IpcLatencyStats.fromEntries(List<IpcMessageEntry> entries) {
    final timedEntries = entries.where((e) => e.durationMs > 0).toList();
    if (timedEntries.isEmpty) {
      return const IpcLatencyStats();
    }

    int warm = 0;
    int standard = 0;
    int cold = 0;
    double sum = 0.0;
    double min = double.infinity;
    double max = 0.0;

    for (final entry in timedEntries) {
      final d = entry.durationMs;
      sum += d;
      if (d < min) min = d;
      if (d > max) max = d;

      if (d < 5.0) {
        warm++;
      } else if (d <= 15.0) {
        standard++;
      } else {
        cold++;
      }
    }

    return IpcLatencyStats(
      totalCount: timedEntries.length,
      warmPathCount: warm,
      standardCount: standard,
      coldPathCount: cold,
      averageLatencyMs: sum / timedEntries.length,
      minLatencyMs: min == double.infinity ? 0.0 : min,
      maxLatencyMs: max,
    );
  }
}
