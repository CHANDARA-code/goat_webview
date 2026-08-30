import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Switch,
  Modal,
  Alert,
} from 'react-native';
import {
  IpcMessageEntry,
  HardwareOverridesState,
  AppServiceState,
  LatencyStats,
  GpsLocation,
  BiometricMockMode,
} from './types';
import { GPS_PRESETS, hardwareOverrides } from './HardwareOverrides';
import { ipcBenchmark } from './IpcBenchmark';
import { appServiceRuntime } from './AppServiceRuntime';

interface DebugHUDProps {
  messages: IpcMessageEntry[];
  onClearMessages: () => void;
  overrides: HardwareOverridesState;
  appService: AppServiceState;
  latencyStats: LatencyStats;
  onBenchmarkProgress?: (progress: number) => void;
  isDarkMode: boolean;
}

type HudTab = 'ipc' | 'latency' | 'overrides' | 'appservice';
type DomainFilter = 'ALL' | 'PAYMENT' | 'BLE' | 'GPS' | 'VAULT' | 'STORAGE' | 'APPSERVICE';

export const DebugHUD: React.FC<DebugHUDProps> = ({
  messages,
  onClearMessages,
  overrides,
  appService,
  latencyStats,
  isDarkMode,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<HudTab>('ipc');
  const [domainFilter, setDomainFilter] = useState<DomainFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchmarkProgress, setBenchmarkProgress] = useState(0);

  // GPS Spoofer local form state
  const [customLat, setCustomLat] = useState('37.3346');
  const [customLng, setCustomLng] = useState('-122.0090');
  const [customAcc, setCustomAcc] = useState('3.0');

  const currentTheme = isDarkMode ? darkTheme : lightTheme;

  // Filter messages based on domain and search query
  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      if (domainFilter === 'PAYMENT' && !msg.action.toLowerCase().includes('pay') && !msg.action.toLowerCase().includes('checkout') && !msg.action.toLowerCase().includes('order')) {
        return false;
      }
      if (domainFilter === 'BLE' && !msg.action.toLowerCase().includes('ble') && !msg.action.toLowerCase().includes('bluetooth') && !msg.action.toLowerCase().includes('nfc') && !msg.action.toLowerCase().includes('sensor') && !msg.action.toLowerCase().includes('motion')) {
        return false;
      }
      if (domainFilter === 'GPS' && !msg.action.toLowerCase().includes('gps') && !msg.action.toLowerCase().includes('location') && !msg.action.toLowerCase().includes('geofence') && !msg.action.toLowerCase().includes('nav')) {
        return false;
      }
      if (domainFilter === 'VAULT' && !msg.action.toLowerCase().includes('vault') && !msg.action.toLowerCase().includes('biometric') && !msg.action.toLowerCase().includes('auth') && !msg.action.toLowerCase().includes('cipher') && !msg.action.toLowerCase().includes('crypto')) {
        return false;
      }
      if (domainFilter === 'STORAGE' && !msg.action.toLowerCase().includes('storage') && !msg.action.toLowerCase().includes('kv') && !msg.action.toLowerCase().includes('file') && !msg.action.toLowerCase().includes('cache')) {
        return false;
      }
      if (domainFilter === 'APPSERVICE' && msg.lane !== 'AppService' && !msg.action.toLowerCase().includes('app_service') && !msg.action.toLowerCase().includes('worker') && !msg.action.toLowerCase().includes('vdom')) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesAction = msg.action.toLowerCase().includes(q);
        const matchesPayload = JSON.stringify(msg.request || {}).toLowerCase().includes(q);
        const matchesResp = JSON.stringify(msg.response || {}).toLowerCase().includes(q);
        return matchesAction || matchesPayload || matchesResp;
      }
      return true;
    });
  }, [messages, domainFilter, searchQuery]);

  const latestMessage = messages[0];
  const lastDuration = latestMessage ? latestMessage.durationMs : latencyStats.avgDurationMs;

  const getLatencyColor = (durationMs: number) => {
    if (durationMs < 5.0) return '#22C55E'; // Green (<5ms)
    if (durationMs <= 15.0) return '#EAB308'; // Amber (5-15ms)
    return '#EF4444'; // Red (>15ms)
  };

  const handleRun100xBenchmark = async () => {
    setIsBenchmarking(true);
    setBenchmarkProgress(0);
    try {
      await ipcBenchmark.runBatchBenchmark(
        100,
        (prog) => setBenchmarkProgress(prog),
        (entry) => {
          if (!isPaused) {
            // Emitted messages propagate through runtime listeners
          }
        }
      );
      Alert.alert(
        'Warm-Path Benchmark Complete',
        `100x IPC iterations completed!\nWarm-Path (<5ms): ${latencyStats.warmPathPercentage}%\nAvg Latency: ${latencyStats.avgDurationMs}ms\np95: ${latencyStats.p95DurationMs}ms`
      );
    } catch (err: any) {
      Alert.alert('Benchmark Error', err?.message || String(err));
    } finally {
      setIsBenchmarking(false);
      setBenchmarkProgress(100);
    }
  };

  const handleApplyCustomGps = () => {
    const lat = parseFloat(customLat);
    const lng = parseFloat(customLng);
    const acc = parseFloat(customAcc);
    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert('Invalid Coordinates', 'Please enter valid numerical latitude and longitude.');
      return;
    }
    const loc: GpsLocation = {
      latitude: lat,
      longitude: lng,
      accuracy: isNaN(acc) ? 5.0 : acc,
      label: 'Custom GPS Mock',
    };
    hardwareOverrides.setMockGps(loc);
    Alert.alert('GPS Spoofed', `Location set to ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
  };

  const handleTestBiometrics = () => {
    const res = hardwareOverrides.evaluateBiometrics('Vault Access Check');
    Alert.alert(
      res.success ? 'Biometric Authentication Succeeded' : 'Biometric Authentication Failed',
      `Mode: ${overrides.mockBiometrics}\nResult: ${res.success ? 'PASSED ✅' : 'FAILED ❌'}\n${res.error ? `Error: ${res.error}` : `Biometry: ${res.biometryType}`}`
    );
  };

  return (
    <>
      {/* Floating Pill / Mini Badge */}
      {!isExpanded && (
        <View style={styles.floatingContainer} pointerEvents="box-none">
          <TouchableOpacity
            testID="debug-hud-pill"
            style={[styles.floatingPill, { backgroundColor: currentTheme.pillBg, borderColor: currentTheme.border }]}
            onPress={() => setIsExpanded(true)}
            activeOpacity={0.85}
          >
            <View style={styles.pillLeft}>
              <View style={[styles.statusDot, { backgroundColor: getLatencyColor(lastDuration) }]} />
              <Text style={[styles.pillTitle, { color: currentTheme.text }]}>HUD</Text>
              <View style={[styles.badgeCounter, { backgroundColor: '#6366F1' }]}>
                <Text style={styles.badgeCounterText}>{messages.length}</Text>
              </View>
            </View>

            <View style={styles.pillCenter}>
              <Text style={[styles.pillLatencyText, { color: getLatencyColor(lastDuration) }]}>
                {lastDuration < 5.0 ? '⚡ <5ms' : `${lastDuration.toFixed(1)}ms`}
              </Text>
              <Text style={[styles.pillActionText, { color: currentTheme.subtext }]} numberOfLines={1}>
                {latestMessage ? latestMessage.action : 'IPC Ready'}
              </Text>
            </View>

            <Text style={styles.expandIcon}>🔍</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Expanded Full Developer Console Modal */}
      <Modal visible={isExpanded} animationType="slide" transparent onRequestClose={() => setIsExpanded(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.consoleCard, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.border }]}>
            {/* Console Header */}
            <View style={[styles.consoleHeader, { borderBottomColor: currentTheme.border }]}>
              <View style={styles.consoleHeaderLeft}>
                <Text style={styles.consoleLogo}>🐐</Text>
                <View>
                  <Text style={[styles.consoleTitle, { color: currentTheme.text }]}>Developer Debug HUD</Text>
                  <Text style={[styles.consoleSubtitle, { color: currentTheme.subtext }]}>
                    Warm-Path IPC Inspector • Hardware Overrides • Dual-Thread
                  </Text>
                </View>
              </View>

              <View style={styles.consoleHeaderActions}>
                <TouchableOpacity
                  testID="hud-clear-btn"
                  style={[styles.smallButton, { backgroundColor: currentTheme.buttonBg }]}
                  onPress={onClearMessages}
                >
                  <Text style={[styles.smallButtonText, { color: currentTheme.text }]}>Clear</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  testID="hud-close-btn"
                  style={[styles.closeButton, { backgroundColor: '#EF444422' }]}
                  onPress={() => setIsExpanded(false)}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Navigation Tabs */}
            <View style={[styles.tabBar, { borderBottomColor: currentTheme.border }]}>
              <TouchableOpacity
                testID="hud-tab-ipc"
                style={[styles.tabBtn, activeTab === 'ipc' && styles.tabBtnActive]}
                onPress={() => setActiveTab('ipc')}
              >
                <Text style={[styles.tabBtnText, { color: activeTab === 'ipc' ? '#6366F1' : currentTheme.subtext }]}>
                  📟 IPC ({messages.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="hud-tab-latency"
                style={[styles.tabBtn, activeTab === 'latency' && styles.tabBtnActive]}
                onPress={() => setActiveTab('latency')}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    { color: activeTab === 'latency' ? '#6366F1' : currentTheme.subtext },
                  ]}
                >
                  ⚡ Latency ({latencyStats.warmPathPercentage}%)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="hud-tab-overrides"
                style={[styles.tabBtn, activeTab === 'overrides' && styles.tabBtnActive]}
                onPress={() => setActiveTab('overrides')}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    { color: activeTab === 'overrides' ? '#6366F1' : currentTheme.subtext },
                  ]}
                >
                  🎛️ Overrides {overrides.isOffline || overrides.mockGps ? '●' : ''}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="hud-tab-appservice"
                style={[styles.tabBtn, activeTab === 'appservice' && styles.tabBtnActive]}
                onPress={() => setActiveTab('appservice')}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    { color: activeTab === 'appservice' ? '#6366F1' : currentTheme.subtext },
                  ]}
                >
                  🧵 Dual-Thread
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tab 1: IPC Message Inspector */}
            {activeTab === 'ipc' && (
              <View style={styles.tabContent}>
                {/* Search & Domain Filter Bar */}
                <View style={styles.filterBar}>
                  <TextInput
                    testID="ipc-search-input"
                    style={[styles.searchInput, { backgroundColor: currentTheme.inputBg, color: currentTheme.text, borderColor: currentTheme.border }]}
                    placeholder="Search action, request or response payload..."
                    placeholderTextColor={currentTheme.subtext}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />

                  <TouchableOpacity
                    style={[styles.pauseBtn, { backgroundColor: isPaused ? '#EF444422' : currentTheme.buttonBg }]}
                    onPress={() => setIsPaused(!isPaused)}
                  >
                    <Text style={[styles.pauseBtnText, { color: isPaused ? '#EF4444' : currentTheme.text }]}>
                      {isPaused ? '▶ Resume' : '⏸ Pause'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Domain Filter Pills */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.domainPillsScroll} contentContainerStyle={styles.domainPillsContent}>
                  {(['ALL', 'PAYMENT', 'BLE', 'GPS', 'VAULT', 'STORAGE', 'APPSERVICE'] as DomainFilter[]).map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.domainPill,
                        {
                          backgroundColor: domainFilter === d ? '#6366F1' : currentTheme.pillBg,
                          borderColor: currentTheme.border,
                        },
                      ]}
                      onPress={() => setDomainFilter(d)}
                    >
                      <Text
                        style={[
                          styles.domainPillText,
                          { color: domainFilter === d ? '#FFFFFF' : currentTheme.subtext },
                        ]}
                      >
                        {d}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Message Log List */}
                <ScrollView style={styles.messageList} showsVerticalScrollIndicator={true}>
                  {filteredMessages.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <Text style={[styles.emptyText, { color: currentTheme.subtext }]}>
                        No bridge messages matching filter criteria.
                      </Text>
                    </View>
                  ) : (
                    filteredMessages.map((msg) => {
                      const isSelected = selectedMessageId === msg.id;
                      const timeStr = new Date(msg.timestamp).toISOString().substring(11, 23);
                      const latencyColor = getLatencyColor(msg.durationMs);

                      return (
                        <TouchableOpacity
                          key={msg.id}
                          testID={`ipc-row-${msg.id}`}
                          style={[
                            styles.messageRow,
                            {
                              backgroundColor: isSelected ? currentTheme.selectedRowBg : currentTheme.rowBg,
                              borderColor: currentTheme.border,
                            },
                          ]}
                          onPress={() => setSelectedMessageId(isSelected ? null : msg.id)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.messageRowHeader}>
                            <View style={styles.rowTitleGroup}>
                              <View style={[styles.laneBadge, { backgroundColor: msg.lane === 'AppService' ? '#8B5CF622' : msg.lane === 'Host' ? '#10B98122' : '#06B6D422' }]}>
                                <Text
                                  style={[
                                    styles.laneBadgeText,
                                    { color: msg.lane === 'AppService' ? '#8B5CF6' : msg.lane === 'Host' ? '#10B981' : '#06B6D4' },
                                  ]}
                                >
                                  {msg.lane}
                                </Text>
                              </View>

                              <Text style={[styles.actionText, { color: currentTheme.text }]}>
                                {msg.action}
                              </Text>
                            </View>

                            <View style={styles.rowMetaGroup}>
                              <View style={[styles.latencyBadge, { backgroundColor: `${latencyColor}20` }]}>
                                <Text style={[styles.latencyBadgeText, { color: latencyColor }]}>
                                  {msg.durationMs < 5.0 ? `⚡ ${msg.durationMs}ms` : `${msg.durationMs}ms`}
                                </Text>
                              </View>

                              <Text style={[styles.timeText, { color: currentTheme.subtext }]}>{timeStr}</Text>
                            </View>
                          </View>

                          {/* Expanded JSON Payload Inspector */}
                          {isSelected && (
                            <View style={[styles.payloadContainer, { backgroundColor: currentTheme.codeBg, borderColor: currentTheme.border }]}>
                              <Text style={[styles.payloadLabel, { color: '#6366F1' }]}>Request Payload:</Text>
                              <Text style={[styles.payloadCode, { color: currentTheme.codeText }]}>
                                {JSON.stringify(msg.request || {}, null, 2)}
                              </Text>

                              <Text style={[styles.payloadLabel, { color: '#10B981', marginTop: 8 }]}>
                                Response / Event Data:
                              </Text>
                              <Text style={[styles.payloadCode, { color: currentTheme.codeText }]}>
                                {JSON.stringify(msg.response || (msg.error ? { error: msg.error } : {}), null, 2)}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            )}

            {/* Tab 2: Latency Benchmark */}
            {activeTab === 'latency' && (
              <ScrollView style={styles.tabContent}>
                <View style={styles.benchmarkSection}>
                  <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>
                    Warm-Path Latency Benchmarking (Target: &lt;5ms)
                  </Text>
                  <Text style={[styles.sectionDesc, { color: currentTheme.subtext }]}>
                    Measures JSI TurboModule IPC round-trip overhead across Fabric and worker lanes.
                  </Text>

                  {/* Latency KPI Cards */}
                  <View style={styles.kpiGrid}>
                    <View style={[styles.kpiCard, { backgroundColor: currentTheme.rowBg, borderColor: currentTheme.border }]}>
                      <Text style={[styles.kpiLabel, { color: currentTheme.subtext }]}>Warm-Path (&lt;5ms)</Text>
                      <Text style={[styles.kpiValue, { color: '#22C55E' }]}>
                        {latencyStats.warmPathPercentage}%
                      </Text>
                      <Text style={[styles.kpiSub, { color: currentTheme.subtext }]}>
                        {latencyStats.warmPathCalls} / {latencyStats.totalCalls} calls
                      </Text>
                    </View>

                    <View style={[styles.kpiCard, { backgroundColor: currentTheme.rowBg, borderColor: currentTheme.border }]}>
                      <Text style={[styles.kpiLabel, { color: currentTheme.subtext }]}>Average Duration</Text>
                      <Text style={[styles.kpiValue, { color: getLatencyColor(latencyStats.avgDurationMs) }]}>
                        {latencyStats.avgDurationMs}ms
                      </Text>
                      <Text style={[styles.kpiSub, { color: currentTheme.subtext }]}>
                        Min: {latencyStats.minDurationMs}ms • Max: {latencyStats.maxDurationMs}ms
                      </Text>
                    </View>

                    <View style={[styles.kpiCard, { backgroundColor: currentTheme.rowBg, borderColor: currentTheme.border }]}>
                      <Text style={[styles.kpiLabel, { color: currentTheme.subtext }]}>p50 Percentile</Text>
                      <Text style={[styles.kpiValue, { color: '#6366F1' }]}>
                        {latencyStats.p50DurationMs}ms
                      </Text>
                      <Text style={[styles.kpiSub, { color: currentTheme.subtext }]}>Median response</Text>
                    </View>

                    <View style={[styles.kpiCard, { backgroundColor: currentTheme.rowBg, borderColor: currentTheme.border }]}>
                      <Text style={[styles.kpiLabel, { color: currentTheme.subtext }]}>p95 / p99 Tail</Text>
                      <Text style={[styles.kpiValue, { color: '#F59E0B' }]}>
                        {latencyStats.p95DurationMs} / {latencyStats.p99DurationMs}ms
                      </Text>
                      <Text style={[styles.kpiSub, { color: currentTheme.subtext }]}>99th percentile</Text>
                    </View>
                  </View>

                  {/* Benchmark Runner Button */}
                  <TouchableOpacity
                    testID="run-benchmark-btn"
                    style={[styles.primaryActionBtn, { backgroundColor: isBenchmarking ? '#94A3B8' : '#6366F1' }]}
                    onPress={handleRun100xBenchmark}
                    disabled={isBenchmarking}
                  >
                    <Text style={styles.primaryActionBtnText}>
                      {isBenchmarking ? `Running Benchmark... (${benchmarkProgress}%)` : '🚀 Run 100x Warm-Path IPC Benchmark'}
                    </Text>
                  </TouchableOpacity>

                  {/* Recent Latency Trace Chart */}
                  <View style={[styles.chartCard, { backgroundColor: currentTheme.codeBg, borderColor: currentTheme.border }]}>
                    <Text style={[styles.chartTitle, { color: currentTheme.text }]}>Recent Latency Traces (ms)</Text>
                    <View style={styles.chartBars}>
                      {latencyStats.recentDurations.length === 0 ? (
                        <Text style={[styles.emptyText, { color: currentTheme.subtext }]}>
                          No latency samples recorded yet.
                        </Text>
                      ) : (
                        latencyStats.recentDurations.map((d, idx) => {
                          const barHeight = Math.min(60, Math.max(8, d * 5));
                          const barColor = getLatencyColor(d);
                          return (
                            <View key={idx} style={styles.barColumn}>
                              <View style={[styles.barFill, { height: barHeight, backgroundColor: barColor }]} />
                              <Text style={[styles.barLabel, { color: currentTheme.subtext }]}>{d}</Text>
                            </View>
                          );
                        })
                      )}
                    </View>
                  </View>
                </View>
              </ScrollView>
            )}

            {/* Tab 3: Hardware Overrides */}
            {activeTab === 'overrides' && (
              <ScrollView style={styles.tabContent}>
                <View style={styles.overridesSection}>
                  {/* Offline Mode Toggle */}
                  <View style={[styles.overrideCard, { backgroundColor: currentTheme.rowBg, borderColor: currentTheme.border }]}>
                    <View style={styles.overrideCardHeader}>
                      <View>
                        <Text style={[styles.overrideTitle, { color: currentTheme.text }]}>🌐 Offline Mode Simulator</Text>
                        <Text style={[styles.overrideDesc, { color: currentTheme.subtext }]}>
                          Forces network connectivity status to offline for mini-app runtime
                        </Text>
                      </View>
                      <Switch
                        testID="offline-switch"
                        value={overrides.isOffline}
                        onValueChange={(val) => hardwareOverrides.setOffline(val)}
                        trackColor={{ false: '#94A3B8', true: '#EF4444' }}
                      />
                    </View>
                  </View>

                  {/* GPS Spoofer */}
                  <View style={[styles.overrideCard, { backgroundColor: currentTheme.rowBg, borderColor: currentTheme.border }]}>
                    <Text style={[styles.overrideTitle, { color: currentTheme.text }]}>🛰️ GPS Coordinates Spoofer</Text>
                    <Text style={[styles.overrideDesc, { color: currentTheme.subtext }]}>
                      Inject custom or preset coordinates into the Location bridge domain
                    </Text>

                    {/* Presets */}
                    <Text style={[styles.subHeading, { color: currentTheme.text, marginTop: 8 }]}>Quick Presets:</Text>
                    <View style={styles.presetButtonsRow}>
                      {GPS_PRESETS.map((preset) => (
                        <TouchableOpacity
                          key={preset.name}
                          style={[styles.presetBtn, { backgroundColor: currentTheme.pillBg, borderColor: currentTheme.border }]}
                          onPress={() => hardwareOverrides.setMockGps(preset.location)}
                        >
                          <Text style={[styles.presetBtnText, { color: currentTheme.text }]}>{preset.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Custom Coordinates */}
                    <Text style={[styles.subHeading, { color: currentTheme.text, marginTop: 10 }]}>Custom Coordinates:</Text>
                    <View style={styles.customCoordRow}>
                      <TextInput
                        style={[styles.coordInput, { backgroundColor: currentTheme.inputBg, color: currentTheme.text, borderColor: currentTheme.border }]}
                        placeholder="Latitude"
                        placeholderTextColor={currentTheme.subtext}
                        value={customLat}
                        onChangeText={setCustomLat}
                      />
                      <TextInput
                        style={[styles.coordInput, { backgroundColor: currentTheme.inputBg, color: currentTheme.text, borderColor: currentTheme.border }]}
                        placeholder="Longitude"
                        placeholderTextColor={currentTheme.subtext}
                        value={customLng}
                        onChangeText={setCustomLng}
                      />
                      <TextInput
                        style={[styles.coordInput, { backgroundColor: currentTheme.inputBg, color: currentTheme.text, borderColor: currentTheme.border, flex: 0.7 }]}
                        placeholder="Accuracy"
                        placeholderTextColor={currentTheme.subtext}
                        value={customAcc}
                        onChangeText={setCustomAcc}
                      />
                    </View>

                    <View style={styles.coordActionsRow}>
                      <TouchableOpacity style={[styles.smallPrimaryBtn, { backgroundColor: '#10B981' }]} onPress={handleApplyCustomGps}>
                        <Text style={styles.smallPrimaryBtnText}>Apply Coordinates</Text>
                      </TouchableOpacity>

                      {overrides.mockGps && (
                        <TouchableOpacity style={[styles.smallPrimaryBtn, { backgroundColor: '#EF444422' }]} onPress={() => hardwareOverrides.setMockGps(null)}>
                          <Text style={[styles.smallPrimaryBtnText, { color: '#EF4444' }]}>Reset to Real GPS</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {overrides.mockGps && (
                      <View style={[styles.activeOverrideBadge, { backgroundColor: '#10B98115' }]}>
                        <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '600' }}>
                          Active Spoofed Location: {overrides.mockGps.latitude.toFixed(4)}, {overrides.mockGps.longitude.toFixed(4)} ({overrides.mockGps.label || 'Custom'})
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Biometric Outcome Switcher */}
                  <View style={[styles.overrideCard, { backgroundColor: currentTheme.rowBg, borderColor: currentTheme.border }]}>
                    <Text style={[styles.overrideTitle, { color: currentTheme.text }]}>🔒 Biometric Outcome Switcher</Text>
                    <Text style={[styles.overrideDesc, { color: currentTheme.subtext }]}>
                      Overrides native BiometricPrompt / FaceID authentication results
                    </Text>

                    <View style={styles.biometricModesRow}>
                      {(['AUTO', 'FORCE_SUCCESS', 'FORCE_ERROR', 'LOCKED_OUT', 'NOT_ENROLLED'] as BiometricMockMode[]).map((mode) => {
                        const isSelected = overrides.mockBiometrics === mode;
                        return (
                          <TouchableOpacity
                            key={mode}
                            testID={`bio-mode-${mode}`}
                            style={[
                              styles.bioModeBtn,
                              {
                                backgroundColor: isSelected ? '#8B5CF6' : currentTheme.pillBg,
                                borderColor: isSelected ? '#8B5CF6' : currentTheme.border,
                              },
                            ]}
                            onPress={() => hardwareOverrides.setBiometricMode(mode)}
                          >
                            <Text style={[styles.bioModeBtnText, { color: isSelected ? '#FFFFFF' : currentTheme.text }]}>
                              {mode}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <TouchableOpacity style={[styles.smallPrimaryBtn, { backgroundColor: '#8B5CF6', marginTop: 10 }]} onPress={handleTestBiometrics}>
                      <Text style={styles.smallPrimaryBtnText}>🧪 Test Biometric Prompt</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            )}

            {/* Tab 4: AppService Dual-Thread Monitor */}
            {activeTab === 'appservice' && (
              <ScrollView style={styles.tabContent}>
                <View style={styles.appServiceSection}>
                  <Text style={[styles.sectionTitle, { color: currentTheme.text }]}>
                    AppService Dual-Thread Worker Container
                  </Text>
                  <Text style={[styles.sectionDesc, { color: currentTheme.subtext }]}>
                    Simulates isolated worker thread executing mini-app logic separated from the AppView UI renderer.
                  </Text>

                  {/* Worker Status Overview */}
                  <View style={[styles.workerStatusCard, { backgroundColor: currentTheme.rowBg, borderColor: currentTheme.border }]}>
                    <View style={styles.workerStatusRow}>
                      <Text style={[styles.workerLabel, { color: currentTheme.subtext }]}>Worker Status:</Text>
                      <View style={[styles.statusPill, { backgroundColor: appService.status === 'READY' || appService.status === 'RUNNING' ? '#22C55E22' : '#EF444422' }]}>
                        <Text style={{ color: appService.status === 'READY' || appService.status === 'RUNNING' ? '#22C55E' : '#EF4444', fontWeight: '700', fontSize: 11 }}>
                          {appService.status}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.workerStatusRow}>
                      <Text style={[styles.workerLabel, { color: currentTheme.subtext }]}>Worker ID:</Text>
                      <Text style={[styles.workerValue, { color: currentTheme.text }]}>{appService.workerId}</Text>
                    </View>

                    <View style={styles.workerStatusRow}>
                      <Text style={[styles.workerLabel, { color: currentTheme.subtext }]}>VDOM Patches:</Text>
                      <Text style={[styles.workerValue, { color: '#6366F1', fontWeight: '700' }]}>
                        {appService.vdomPatchCount}
                      </Text>
                    </View>

                    <View style={styles.workerStatusRow}>
                      <Text style={[styles.workerLabel, { color: currentTheme.subtext }]}>Thread Lanes:</Text>
                      <Text style={[styles.workerValue, { color: currentTheme.subtext }]}>
                        Worker ({appService.laneCounts.appService}) • View ({appService.laneCounts.appView}) • Host ({appService.laneCounts.host})
                      </Text>
                    </View>
                  </View>

                  {/* Simulation Controls */}
                  <Text style={[styles.subHeading, { color: currentTheme.text, marginTop: 14 }]}>
                    Worker Simulation Controls:
                  </Text>
                  <View style={styles.workerActionsGrid}>
                    <TouchableOpacity
                      testID="worker-task-btn"
                      style={[styles.workerActionBtn, { backgroundColor: '#6366F1' }]}
                      onPress={() => appServiceRuntime.runSimulatedWorkerTask('CALCULATE_CART_TOTALS', { cartItems: 4 })}
                    >
                      <Text style={styles.workerActionBtnText}>🛒 Dispatch Cart Job</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      testID="worker-fusion-btn"
                      style={[styles.workerActionBtn, { backgroundColor: '#06B6D4' }]}
                      onPress={() => appServiceRuntime.runSimulatedWorkerTask('PROCESS_SENSOR_FUSION', { samples: 64 })}
                    >
                      <Text style={styles.workerActionBtnText}>📡 Sensor Fusion Task</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      testID="worker-crypto-btn"
                      style={[styles.workerActionBtn, { backgroundColor: '#8B5CF6' }]}
                      onPress={() => appServiceRuntime.runSimulatedWorkerTask('CIPHER_ENCRYPT_BLOCK', { bits: 256 })}
                    >
                      <Text style={styles.workerActionBtnText}>🔒 Crypto Block Cipher</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      testID="worker-crash-btn"
                      style={[styles.workerActionBtn, { backgroundColor: '#EF4444' }]}
                      onPress={() => appServiceRuntime.simulateWorkerCrash('Simulated Heap Overflow Crash')}
                    >
                      <Text style={styles.workerActionBtnText}>💥 Simulate Crash</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      testID="worker-restart-btn"
                      style={[styles.workerActionBtn, { backgroundColor: '#10B981' }]}
                      onPress={() => appServiceRuntime.restartWorker()}
                    >
                      <Text style={styles.workerActionBtnText}>🔄 Restart Worker</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const lightTheme = {
  cardBg: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  subtext: '#64748B',
  pillBg: '#FFFFFF',
  rowBg: '#F8FAFC',
  selectedRowBg: '#EEF2FF',
  codeBg: '#0F172A',
  codeText: '#E2E8F0',
  inputBg: '#F1F5F9',
  buttonBg: '#F1F5F9',
};

const darkTheme = {
  cardBg: '#1E293B',
  border: '#334155',
  text: '#F8FAFC',
  subtext: '#94A3B8',
  pillBg: '#1E293B',
  rowBg: '#0F172A',
  selectedRowBg: '#1E1B4B',
  codeBg: '#0B132B',
  codeText: '#A5B4FC',
  inputBg: '#334155',
  buttonBg: '#334155',
};

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    zIndex: 9999,
  },
  floatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
    gap: 8,
  },
  pillLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pillTitle: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  badgeCounter: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeCounterText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  pillCenter: {
    maxWidth: 120,
  },
  pillLatencyText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pillActionText: {
    fontSize: 9,
  },
  expandIcon: {
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  consoleCard: {
    height: '82%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  consoleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  consoleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  consoleLogo: {
    fontSize: 22,
  },
  consoleTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  consoleSubtitle: {
    fontSize: 10,
  },
  consoleHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smallButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  smallButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: 'bold',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 12,
  },
  tabBtn: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#6366F1',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
    padding: 12,
  },
  filterBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 11,
    borderWidth: 1,
  },
  pauseBtn: {
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderRadius: 8,
  },
  pauseBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  domainPillsScroll: {
    maxHeight: 32,
    marginBottom: 8,
  },
  domainPillsContent: {
    gap: 6,
  },
  domainPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  domainPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  messageList: {
    flex: 1,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    textAlign: 'center',
  },
  messageRow: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginBottom: 6,
  },
  messageRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  laneBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  laneBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  rowMetaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  latencyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  latencyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  timeText: {
    fontSize: 9,
  },
  payloadContainer: {
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  payloadLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  payloadCode: {
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  benchmarkSection: {
    gap: 12,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  sectionDesc: {
    fontSize: 11,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    minWidth: '46%',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 4,
  },
  kpiSub: {
    fontSize: 9,
  },
  primaryActionBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  chartCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  chartTitle: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 70,
    gap: 4,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 2,
  },
  barLabel: {
    fontSize: 7,
    marginTop: 2,
  },
  overridesSection: {
    gap: 12,
    paddingBottom: 20,
  },
  overrideCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  overrideCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overrideTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  overrideDesc: {
    fontSize: 10,
  },
  subHeading: {
    fontSize: 11,
    fontWeight: '700',
  },
  presetButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  presetBtnText: {
    fontSize: 10,
  },
  customCoordRow: {
    flexDirection: 'row',
    gap: 6,
  },
  coordInput: {
    flex: 1,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    fontSize: 11,
  },
  coordActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  smallPrimaryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  smallPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  activeOverrideBadge: {
    padding: 6,
    borderRadius: 6,
    marginTop: 4,
  },
  biometricModesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  bioModeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  bioModeBtnText: {
    fontSize: 10,
    fontWeight: '600',
  },
  appServiceSection: {
    gap: 12,
    paddingBottom: 20,
  },
  workerStatusCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  workerStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workerLabel: {
    fontSize: 11,
  },
  workerValue: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  workerActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  workerActionBtn: {
    flex: 1,
    minWidth: '46%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  workerActionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
