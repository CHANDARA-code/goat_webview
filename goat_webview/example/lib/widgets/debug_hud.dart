import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:goat_webview/goat_webview.dart';
import '../models/ipc_message.dart';
import '../models/hardware_overrides.dart';
import '../services/telemetry_service.dart';

/// Floating Developer Debug HUD Overlay with real-time IPC logging,
/// warm-path latency benchmarking (<5ms), and hardware override controls (R3).
class FloatingDebugHud extends StatefulWidget {
  final Widget child;

  const FloatingDebugHud({super.key, required this.child});

  @override
  State<FloatingDebugHud> createState() => _FloatingDebugHudState();
}

class _FloatingDebugHudState extends State<FloatingDebugHud> {
  Offset _position = const Offset(16, 120);

  void _openConsole(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => const DebugHudConsoleSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final screenSize = MediaQuery.of(context).size;

    return Stack(
      children: [
        widget.child,
        AnimatedBuilder(
          animation: TelemetryService.instance,
          builder: (context, _) {
            final stats = TelemetryService.instance.latencyStats;
            final count = TelemetryService.instance.allLogs.length;
            final isWarm = stats.averageLatencyMs > 0 && stats.averageLatencyMs < 5.0;
            final isAmber = stats.averageLatencyMs >= 5.0 && stats.averageLatencyMs <= 15.0;

            final badgeColor = isWarm
                ? const Color(0xFF10B981) // Green <5ms
                : (isAmber ? const Color(0xFFF59E0B) : const Color(0xFF6366F1));

            return Positioned(
              left: _position.dx.clamp(0.0, screenSize.width - 150.0),
              top: _position.dy.clamp(50.0, screenSize.height - 100.0),
              child: GestureDetector(
                onPanUpdate: (details) {
                  setState(() {
                    _position += details.delta;
                  });
                },
                child: Material(
                  elevation: 8,
                  borderRadius: BorderRadius.circular(24),
                  color: const Color(0xFF0F172A).withValues(alpha: 0.92),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(24),
                    onTap: () => _openConsole(context),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(
                          color: badgeColor.withValues(alpha: 0.7),
                          width: 1.5,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 10,
                            height: 10,
                            decoration: BoxDecoration(
                              color: badgeColor,
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: badgeColor.withValues(alpha: 0.6),
                                  blurRadius: 6,
                                  spreadRadius: 2,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Text(
                                'DEBUG HUD',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.5,
                                ),
                              ),
                              Text(
                                stats.totalCount > 0
                                    ? '${stats.averageLatencyMs.toStringAsFixed(1)}ms | $count msgs'
                                    : 'Ready | $count msgs',
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.8),
                                  fontSize: 10,
                                  fontFamily: 'monospace',
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(width: 4),
                          const Icon(
                            Icons.terminal_rounded,
                            size: 14,
                            color: Colors.white70,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}

/// Comprehensive Developer Console Bottom Sheet Modal.
class DebugHudConsoleSheet extends StatefulWidget {
  const DebugHudConsoleSheet({super.key});

  @override
  State<DebugHudConsoleSheet> createState() => _DebugHudConsoleSheetState();
}

class _DebugHudConsoleSheetState extends State<DebugHudConsoleSheet>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final height = MediaQuery.of(context).size.height * 0.85;

    return Container(
      height: height,
      decoration: const BoxDecoration(
        color: Color(0xFF0F172A),
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        boxShadow: [
          BoxShadow(
            color: Colors.black54,
            blurRadius: 20,
            offset: Offset(0, -4),
          ),
        ],
      ),
      child: Column(
        children: [
          // Drag handle and header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: const BoxDecoration(
              border: Border(
                bottom: BorderSide(color: Color(0xFF334155), width: 1),
              ),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF6366F1).withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(
                    Icons.terminal_rounded,
                    color: Color(0xFF818CF8),
                    size: 18,
                  ),
                ),
                const SizedBox(width: 10),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Goat Developer Debug HUD',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        'R3 Bridge Inspector, Latency Benchmarking & Hardware Overrides',
                        style: TextStyle(color: Color(0xFF94A3B8), fontSize: 10),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white70),
                  onPressed: () => Navigator.of(context).pop(),
                  tooltip: 'Close HUD',
                ),
              ],
            ),
          ),

          // Tab Bar
          Container(
            color: const Color(0xFF1E293B),
            child: TabBar(
              controller: _tabController,
              indicatorColor: const Color(0xFF6366F1),
              labelColor: const Color(0xFF818CF8),
              unselectedLabelColor: const Color(0xFF94A3B8),
              labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
              tabs: const [
                Tab(icon: Icon(Icons.list_alt_rounded, size: 16), text: 'IPC Logs'),
                Tab(icon: Icon(Icons.speed_rounded, size: 16), text: 'Latency <5ms'),
                Tab(icon: Icon(Icons.tune_rounded, size: 16), text: 'Overrides'),
                Tab(icon: Icon(Icons.extension_rounded, size: 16), text: '7 Plugins'),
              ],
            ),
          ),

          // Tab Content
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildIpcLogsTab(),
                _buildLatencyTab(),
                _buildOverridesTab(),
                _buildPluginsTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // -------------------------------------------------------------
  // TAB 1: Real-Time IPC Logs & Message Inspector
  // -------------------------------------------------------------
  Widget _buildIpcLogsTab() {
    return AnimatedBuilder(
      animation: TelemetryService.instance,
      builder: (context, _) {
        final logs = TelemetryService.instance.filteredLogs;
        final namespaces = [
          'all',
          'biometrics',
          'bluetooth',
          'location',
          'media',
          'network',
          'payments',
          'scanner',
          'core',
        ];

        return Column(
          children: [
            // Filter Bar & Search
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              color: const Color(0xFF1E293B).withValues(alpha: 0.6),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _searchController,
                          onChanged: (v) => TelemetryService.instance.setSearchQuery(v),
                          style: const TextStyle(color: Colors.white, fontSize: 12),
                          decoration: InputDecoration(
                            hintText: 'Search action or payload...',
                            hintStyle: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                            prefixIcon: const Icon(Icons.search, size: 16, color: Color(0xFF64748B)),
                            filled: true,
                            fillColor: const Color(0xFF0F172A),
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(vertical: 8),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: BorderSide.none,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton(
                        icon: const Icon(Icons.delete_sweep_outlined, color: Colors.white70, size: 20),
                        tooltip: 'Clear IPC Logs',
                        onPressed: () => TelemetryService.instance.clearLogs(),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  SingleChildScrollView(
                    key: const PageStorageKey('filter_chips'),
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: namespaces.map((ns) {
                        final isSelected = (TelemetryService.instance.filterNamespace == null && ns == 'all') ||
                            TelemetryService.instance.filterNamespace == ns;
                        return Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: FilterChip(
                            label: Text(ns.toUpperCase()),
                            labelStyle: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: isSelected ? Colors.white : const Color(0xFF94A3B8),
                            ),
                            selected: isSelected,
                            selectedColor: const Color(0xFF6366F1),
                            backgroundColor: const Color(0xFF0F172A),
                            checkmarkColor: Colors.white,
                            onSelected: (_) {
                              TelemetryService.instance.setFilterNamespace(ns == 'all' ? null : ns);
                            },
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ],
              ),
            ),

            // Message List
            Expanded(
              child: logs.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.inbox_outlined, size: 40, color: Colors.grey.shade600),
                          const SizedBox(height: 8),
                          const Text(
                            'No IPC messages match the current filter',
                            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      itemCount: logs.length,
                      itemBuilder: (context, index) {
                        final entry = logs[index];
                        return _buildIpcLogItem(entry);
                      },
                    ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildIpcLogItem(IpcMessageEntry entry) {
    final isWarm = entry.isWarmPath;
    final isError = entry.status == 'ERROR';
    final badgeColor = isError
        ? const Color(0xFFEF4444)
        : (isWarm ? const Color(0xFF10B981) : const Color(0xFFF59E0B));

    return InkWell(
      onTap: () => _showPayloadInspectorDialog(entry),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: const BoxDecoration(
          border: Border(
            bottom: BorderSide(color: Color(0xFF1E293B), width: 1),
          ),
        ),
        child: Row(
          children: [
            // Status/Warm-path indicator badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
              decoration: BoxDecoration(
                color: badgeColor.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: badgeColor.withValues(alpha: 0.4)),
              ),
              child: Text(
                entry.durationMs > 0 ? '${entry.durationMs.toStringAsFixed(1)}ms' : 'SPI',
                style: TextStyle(
                  color: badgeColor,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  fontFamily: 'monospace',
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        entry.action,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                        decoration: BoxDecoration(
                          color: const Color(0xFF334155),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          entry.namespace,
                          style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 9),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${entry.timestamp.toIso8601String().substring(11, 19)} • ${entry.direction} • ID: ${entry.id}',
                    style: const TextStyle(color: Color(0xFF64748B), fontSize: 10),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: Color(0xFF64748B), size: 18),
          ],
        ),
      ),
    );
  }

  void _showPayloadInspectorDialog(IpcMessageEntry entry) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF0F172A),
          title: Row(
            children: [
              Text(
                entry.action,
                style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
              ),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.copy, size: 16, color: Color(0xFF818CF8)),
                tooltip: 'Copy JSON',
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: entry.toJsonString()));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('IPC Payload copied to clipboard')),
                  );
                },
              ),
            ],
          ),
          content: SizedBox(
            width: double.maxFinite,
            child: SingleChildScrollView(
              child: SelectableText(
                entry.toJsonString(),
                style: const TextStyle(
                  color: Color(0xFF38BDF8),
                  fontSize: 11,
                  fontFamily: 'monospace',
                ),
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Close'),
            ),
          ],
        );
      },
    );
  }

  // -------------------------------------------------------------
  // TAB 2: Warm-Path Latency Benchmarking Dashboard (<5ms)
  // -------------------------------------------------------------
  Widget _buildLatencyTab() {
    return AnimatedBuilder(
      animation: TelemetryService.instance,
      builder: (context, _) {
        final stats = TelemetryService.instance.latencyStats;
        final isBenchmarking = TelemetryService.instance.isBenchmarking;

        return SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Target Header Banner
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF1E1B4B), Color(0xFF0F172A)],
                  ),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF6366F1).withValues(alpha: 0.4)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.bolt_rounded, color: Color(0xFF818CF8), size: 28),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Warm-Path IPC Target: < 5.0 ms',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                          Text(
                            'Measures round-trip bridge latency across Flutter and Native Chromium platform views.',
                            style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Benchmark Metrics Cards
              Row(
                children: [
                  Expanded(
                    child: _buildMetricCard(
                      'Average Latency',
                      '${stats.averageLatencyMs.toStringAsFixed(2)} ms',
                      stats.averageLatencyMs > 0 && stats.averageLatencyMs < 5.0
                          ? const Color(0xFF10B981)
                          : const Color(0xFFF59E0B),
                      Icons.timer_outlined,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _buildMetricCard(
                      'Warm-Path Rate (<5ms)',
                      '${stats.warmPathPercentage.toStringAsFixed(1)}%',
                      stats.warmPathPercentage >= 80.0
                          ? const Color(0xFF10B981)
                          : const Color(0xFF6366F1),
                      Icons.check_circle_outline,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _buildMetricCard(
                      'Min Latency',
                      '${stats.minLatencyMs.toStringAsFixed(2)} ms',
                      const Color(0xFF38BDF8),
                      Icons.arrow_downward_rounded,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _buildMetricCard(
                      'Max Latency',
                      '${stats.maxLatencyMs.toStringAsFixed(2)} ms',
                      stats.maxLatencyMs > 15.0 ? const Color(0xFFEF4444) : const Color(0xFF38BDF8),
                      Icons.arrow_upward_rounded,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _buildMetricCard(
                      'Total Measured',
                      '${stats.totalCount}',
                      const Color(0xFF94A3B8),
                      Icons.analytics_outlined,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Latency Distribution Breakdown
              const Text(
                'Latency Tier Breakdown',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
              ),
              const SizedBox(height: 8),
              _buildDistributionRow(
                'Warm-Path (<5ms)',
                stats.warmPathCount,
                stats.totalCount,
                const Color(0xFF10B981),
              ),
              const SizedBox(height: 6),
              _buildDistributionRow(
                'Standard (5-15ms)',
                stats.standardCount,
                stats.totalCount,
                const Color(0xFFF59E0B),
              ),
              const SizedBox(height: 6),
              _buildDistributionRow(
                'Cold/Slow (>15ms)',
                stats.coldPathCount,
                stats.totalCount,
                const Color(0xFFEF4444),
              ),
              const SizedBox(height: 24),

              // Run Benchmark Action
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: isBenchmarking
                      ? null
                      : () => TelemetryService.instance.runWarmPathBenchmark(iterations: 20),
                  icon: isBenchmarking
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.play_arrow_rounded),
                  label: Text(
                    isBenchmarking
                        ? 'Running Benchmark (20 cycles)...'
                        : 'Run Warm-Path Latency Benchmark',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF6366F1),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildMetricCard(String label, String value, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFF334155)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: color),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  label,
                  style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 10),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.bold,
              fontSize: 16,
              fontFamily: 'monospace',
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDistributionRow(String label, int count, int total, Color color) {
    final double pct = total > 0 ? (count / total) : 0.0;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Text(label, style: const TextStyle(color: Colors.white, fontSize: 11)),
              const Spacer(),
              Text(
                '$count ($count / $total)',
                style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: pct,
              backgroundColor: const Color(0xFF0F172A),
              valueColor: AlwaysStoppedAnimation<Color>(color),
              minHeight: 6,
            ),
          ),
        ],
      ),
    );
  }

  // -------------------------------------------------------------
  // TAB 3: Hardware Overrides & Spoofing Controls
  // -------------------------------------------------------------
  Widget _buildOverridesTab() {
    return AnimatedBuilder(
      animation: TelemetryService.instance,
      builder: (context, _) {
        final overrides = TelemetryService.instance.hardwareOverrides;

        return SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Offline Mode Switch
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text(
                  'Simulate Offline Mode',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                ),
                subtitle: const Text(
                  'Intercepts network calls and returns offline connection errors.',
                  style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                ),
                value: overrides.isOffline,
                activeTrackColor: const Color(0xFFEF4444),
                onChanged: (val) => TelemetryService.instance.toggleOffline(val),
              ),
              const Divider(color: Color(0xFF334155)),
              const SizedBox(height: 8),

              // GPS Spoofing Toggle & Presets
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text(
                  'GPS Coordinate Spoofing',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                ),
                subtitle: Text(
                  overrides.mockGpsEnabled
                      ? 'Spoofing active: ${overrides.selectedGps.name}'
                      : 'Disabled (uses real geolocation).',
                  style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                ),
                value: overrides.mockGpsEnabled,
                activeTrackColor: const Color(0xFF10B981),
                onChanged: (val) => TelemetryService.instance.setGpsSpoofing(enabled: val),
              ),
              if (overrides.mockGpsEnabled) ...[
                const SizedBox(height: 8),
                const Text(
                  'Select GPS Preset Location:',
                  style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFF334155)),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<GpsPreset>(
                      value: overrides.selectedGps,
                      isExpanded: true,
                      dropdownColor: const Color(0xFF1E293B),
                      style: const TextStyle(color: Colors.white, fontSize: 12),
                      items: GpsPreset.defaultPresets.map((preset) {
                        return DropdownMenuItem(
                          value: preset,
                          child: Text('${preset.name} (${preset.latitude}, ${preset.longitude})'),
                        );
                      }).toList(),
                      onChanged: (preset) {
                        if (preset != null) {
                          TelemetryService.instance.setGpsSpoofing(enabled: true, preset: preset);
                        }
                      },
                    ),
                  ),
                ),
              ],
              const Divider(color: Color(0xFF334155)),
              const SizedBox(height: 8),

              // Biometric Outcome Mocking
              const Text(
                'Biometric Authentication Mock Mode',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
              ),
              const SizedBox(height: 4),
              const Text(
                'Forces the outcome of AUTHENTICATE_BIOMETRICS and Face ID prompts.',
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFF334155)),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<BiometricMockOutcome>(
                    value: overrides.mockBiometrics,
                    isExpanded: true,
                    dropdownColor: const Color(0xFF1E293B),
                    style: const TextStyle(color: Colors.white, fontSize: 12),
                    items: BiometricMockOutcome.values.map((outcome) {
                      return DropdownMenuItem(
                        value: outcome,
                        child: Text(outcome.label),
                      );
                    }).toList(),
                    onChanged: (outcome) {
                      if (outcome != null) {
                        TelemetryService.instance.setBiometricMockOutcome(outcome);
                      }
                    },
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  // -------------------------------------------------------------
  // TAB 4: 7 Companion Capability Packages & Action Tester
  // -------------------------------------------------------------
  Widget _buildPluginsTab() {
    final registry = GoatCapabilityRegistry.instance;
    final namespaces = registry.registeredNamespaces;

    final List<Map<String, dynamic>> testActions = [
      {'action': 'CHECK_BIOMETRICS', 'ns': 'biometrics', 'payload': <String, dynamic>{}},
      {'action': 'AUTHENTICATE_BIOMETRICS', 'ns': 'biometrics', 'payload': <String, dynamic>{}},
      {'action': 'GET_BLUETOOTH_DEVICES', 'ns': 'bluetooth', 'payload': <String, dynamic>{}},
      {'action': 'GET_LOCATION', 'ns': 'location', 'payload': <String, dynamic>{}},
      {'action': 'GET_NETWORK_TYPE', 'ns': 'network', 'payload': <String, dynamic>{}},
      {'action': 'REQUEST_PAYMENT', 'ns': 'payments', 'payload': {'amount': 25.00, 'currency': 'USD'}},
      {'action': 'SCAN_CODE', 'ns': 'scanner', 'payload': {'scanType': 'QR_CODE'}},
      {'action': 'CHOOSE_IMAGE', 'ns': 'media', 'payload': {'count': 3}},
    ];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Registered Companion Plugins (SPI)',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: namespaces.map((ns) {
              return Chip(
                avatar: const Icon(Icons.check_circle, size: 14, color: Color(0xFF10B981)),
                label: Text(
                  'goat_webview_$ns',
                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                ),
                backgroundColor: const Color(0xFF1E293B),
                side: const BorderSide(color: Color(0xFF334155)),
              );
            }).toList(),
          ),
          const SizedBox(height: 20),
          const Text(
            'Interactive Capability Action Runner',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
          ),
          const SizedBox(height: 4),
          const Text(
            'Directly triggers capability actions to inspect live responses in the HUD.',
            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
          ),
          const SizedBox(height: 12),
          ...testActions.map((item) {
            final action = item['action'] as String;
            final ns = item['ns'] as String;
            final payload = item['payload'] as Map<String, dynamic>;

            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFF334155)),
              ),
              child: Row(
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        action,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 12),
                      ),
                      Text(
                        'Namespace: $ns',
                        style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 10),
                      ),
                    ],
                  ),
                  const Spacer(),
                  Builder(
                    builder: (btnContext) {
                      return ElevatedButton(
                        onPressed: () async {
                          final messenger = ScaffoldMessenger.of(btnContext);
                          final res = await TelemetryService.instance.triggerCapabilityAction(action, payload);
                          messenger.showSnackBar(
                            SnackBar(
                              content: Text('$action => ${jsonEncode(res)}'),
                              duration: const Duration(seconds: 2),
                            ),
                          );
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF6366F1),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          minimumSize: const Size(60, 30),
                        ),
                        child: const Text('Trigger', style: TextStyle(fontSize: 11)),
                      );
                    },
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}
