#if os(iOS)
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/**
 * Floating Developer Debug HUD Overlay & Real-Time IPC Trace Visualizer (Showcase R3).
 *
 * Provides an interactive developer console inside host showcase applications with:
 * 1. Draggable floating trigger with live warm-path (<5ms) latency badge
 * 2. Real-time IPC message logger and JSON payload inspector
 * 3. Warm-path benchmark analysis & SLA compliance indicator
 * 4. Hardware override controls (offline simulation, GPS spoofing, biometric outcome mocking)
 */
public struct GoatFloatingDebugHUD: View {

    @ObservedObject public var telemetryManager: GoatTelemetryManager
    @ObservedObject public var overrideManager: GoatHardwareOverrideManager

    @State private var isInspectorPresented: Bool = false
    @State private var dragOffset: CGSize = .zero
    @State private var position: CGPoint = CGPoint(x: 70, y: 140)

    public init(
        telemetryManager: GoatTelemetryManager = .shared,
        overrideManager: GoatHardwareOverrideManager = .shared
    ) {
        self.telemetryManager = telemetryManager
        self.overrideManager = overrideManager
    }

    public var body: some View {
        ZStack {
            // Draggable Floating Trigger
            floatingTriggerButton
                .position(
                    x: position.x + dragOffset.width,
                    y: position.y + dragOffset.height
                )
                .gesture(
                    DragGesture()
                        .onChanged { value in
                            dragOffset = value.translation
                        }
                        .onEnded { value in
                            position.x += value.translation.width
                            position.y += value.translation.height
                            dragOffset = .zero
                        }
                )
        }
        .sheet(isPresented: $isInspectorPresented) {
            GoatDebugInspectorView(
                telemetryManager: telemetryManager,
                overrideManager: overrideManager,
                onDismiss: { isInspectorPresented = false }
            )
        }
    }

    // MARK: - Floating Trigger View

    private var floatingTriggerButton: some View {
        Button(action: { isInspectorPresented = true }) {
            HStack(spacing: 6) {
                ZStack {
                    Circle()
                        .fill(badgeColor)
                        .frame(width: 28, height: 28)

                    Image(systemName: "terminal.fill")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(.white)
                }

                VStack(alignment: .leading, spacing: 1) {
                    Text("HUD")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.white)

                    Text(latencySummaryText)
                        .font(.system(size: 9, weight: .semibold, design: .monospaced))
                        .foregroundColor(latencyTextColor)
                }

                if overrideManager.isOffline || overrideManager.isGpsSpoofingEnabled || overrideManager.biometricMockMode != .auto {
                    Circle()
                        .fill(Color.orange)
                        .frame(width: 8, height: 8)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(
                Capsule()
                    .fill(Color(red: 0.06, green: 0.09, blue: 0.16).opacity(0.92))
                    .overlay(
                        Capsule()
                            .stroke(badgeColor.opacity(0.6), lineWidth: 1.5)
                    )
                    .shadow(color: Color.black.opacity(0.35), radius: 8, x: 0, y: 4)
            )
        }
        .buttonStyle(PlainButtonStyle())
        .accessibilityLabel("Developer Debug HUD")
    }

    private var badgeColor: Color {
        guard let latest = telemetryManager.latestLog else {
            return Color(red: 0.06, green: 0.72, blue: 0.51) // Emerald default
        }
        switch latest.latencyLevel {
        case .warmPath: return Color(red: 0.06, green: 0.72, blue: 0.51) // Green <5ms
        case .standard: return Color(red: 0.96, green: 0.62, blue: 0.04) // Amber 5-15ms
        case .cold:     return Color(red: 0.94, green: 0.27, blue: 0.24) // Red >15ms
        }
    }

    private var latencyTextColor: Color {
        guard let latest = telemetryManager.latestLog else {
            return Color(red: 0.22, green: 0.88, blue: 0.65)
        }
        switch latest.latencyLevel {
        case .warmPath: return Color(red: 0.22, green: 0.88, blue: 0.65)
        case .standard: return Color(red: 0.99, green: 0.80, blue: 0.20)
        case .cold:     return Color(red: 0.99, green: 0.45, blue: 0.45)
        }
    }

    private var latencySummaryText: String {
        if let latest = telemetryManager.latestLog {
            return String(format: "%.1fms", latest.durationMs)
        }
        return "<5ms"
    }
}

// MARK: - Full Debug Inspector Sheet

public struct GoatDebugInspectorView: View {
    @ObservedObject public var telemetryManager: GoatTelemetryManager
    @ObservedObject public var overrideManager: GoatHardwareOverrideManager
    public var onDismiss: () -> Void

    @State private var selectedTab: Int = 0
    @State private var searchQuery: String = ""
    @State private var statusFilter: String = "ALL" // "ALL", "WARM", "STANDARD", "ERROR"
    @State private var expandedLogId: String? = nil
    @State private var benchmarkRunning: Bool = false
    @State private var lastBenchmarkResult: GoatBenchmarkSummary? = nil
    @State private var copyConfirmationMessage: String? = nil

    public init(
        telemetryManager: GoatTelemetryManager,
        overrideManager: GoatHardwareOverrideManager,
        onDismiss: @escaping () -> Void
    ) {
        self.telemetryManager = telemetryManager
        self.overrideManager = overrideManager
        self.onDismiss = onDismiss
    }

    public var body: some View {
        NavigationView {
            ZStack {
                Color(red: 0.05, green: 0.07, blue: 0.12).edgesIgnoringSafeArea(.all)

                VStack(spacing: 0) {
                    // Header Bar
                    headerBar

                    // Tab Picker
                    Picker("Inspector Mode", selection: $selectedTab) {
                        Text("Traces (\(telemetryManager.logs.count))").tag(0)
                        Text("Benchmark").tag(1)
                        Text("Overrides").tag(2)
                        Text("Runtime").tag(3)
                    }
                    .pickerStyle(SegmentedPickerStyle())
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color(red: 0.09, green: 0.12, blue: 0.19))

                    // Tab Content
                    TabView(selection: $selectedTab) {
                        tracesView.tag(0)
                        benchmarkView.tag(1)
                        overridesView.tag(2)
                        runtimeInfoView.tag(3)
                    }
                    .tabViewStyle(PageTabViewStyle(indexDisplayMode: .never))
                }
            }
            .navigationBarHidden(true)
        }
        #if canImport(UIKit)
        .navigationViewStyle(StackNavigationViewStyle())
        #endif
    }

    // MARK: - Header Bar

    private var headerBar: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Circle()
                        .fill(Color(red: 0.06, green: 0.72, blue: 0.51))
                        .frame(width: 8, height: 8)
                    Text("Goat Developer Debug HUD")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.white)
                }
                Text("IPC Message Inspector & Hardware Overrides")
                    .font(.system(size: 11))
                    .foregroundColor(Color.gray)
            }

            Spacer()

            Button(action: onDismiss) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 22))
                    .foregroundColor(Color.gray)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color(red: 0.07, green: 0.09, blue: 0.15))
    }

    // MARK: - Tab 0: Traces View

    private var filteredLogs: [GoatIPCMessageLog] {
        telemetryManager.logs.filter { log in
            let matchesQuery = searchQuery.isEmpty ||
                log.action.localizedCaseInsensitiveContains(searchQuery) ||
                log.formattedRequestJson.localizedCaseInsensitiveContains(searchQuery) ||
                log.formattedResponseJson.localizedCaseInsensitiveContains(searchQuery)

            let matchesStatus: Bool
            switch statusFilter {
            case "WARM":     matchesStatus = log.isWarmPath
            case "STANDARD": matchesStatus = log.latencyLevel == .standard
            case "ERROR":    matchesStatus = log.status == "ERROR"
            default:         matchesStatus = true
            }

            return matchesQuery && matchesStatus
        }
    }

    private var tracesView: some View {
        VStack(spacing: 8) {
            // Search and Filter Bar
            HStack(spacing: 8) {
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.gray)
                    TextField("Filter action or payload...", text: $searchQuery)
                        .foregroundColor(.white)
                        .font(.system(size: 13))
                    if !searchQuery.isEmpty {
                        Button(action: { searchQuery = "" }) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.gray)
                        }
                    }
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color(red: 0.11, green: 0.15, blue: 0.24))
                .cornerRadius(8)

                // Clear button
                Button(action: { telemetryManager.clear() }) {
                    Image(systemName: "trash")
                        .font(.system(size: 14))
                        .foregroundColor(.red)
                        .padding(8)
                        .background(Color(red: 0.11, green: 0.15, blue: 0.24))
                        .cornerRadius(8)
                }

                // Export JSON button
                Button(action: exportTraces) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 14))
                        .foregroundColor(.blue)
                        .padding(8)
                        .background(Color(red: 0.11, green: 0.15, blue: 0.24))
                        .cornerRadius(8)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)

            // Status Filter Chips
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    filterChip(title: "All (\(telemetryManager.logs.count))", key: "ALL")
                    filterChip(title: "Warm <5ms (\(telemetryManager.warmPathCount))", key: "WARM", color: Color.green)
                    filterChip(title: "Standard 5-15ms", key: "STANDARD", color: Color.orange)
                    filterChip(title: "Errors (\(telemetryManager.errorCount))", key: "ERROR", color: Color.red)
                }
                .padding(.horizontal, 16)
            }

            // Message List
            if filteredLogs.isEmpty {
                VStack(spacing: 12) {
                    Spacer()
                    Image(systemName: "tray")
                        .font(.system(size: 40))
                        .foregroundColor(.gray)
                    Text("No bridge IPC messages recorded yet")
                        .font(.system(size: 14))
                        .foregroundColor(.gray)
                    Button(action: simulateTestMessage) {
                        Text("Simulate Sample IPC Call")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(Color.blue)
                            .cornerRadius(8)
                    }
                    Spacer()
                }
            } else {
                List {
                    ForEach(filteredLogs) { log in
                        logRowView(log)
                            .listRowBackground(Color.clear)
                            .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                    }
                }
                .listStyle(PlainListStyle())
            }
        }
    }

    private func filterChip(title: String, key: String, color: Color = .blue) -> some View {
        let isSelected = statusFilter == key
        return Button(action: { statusFilter = key }) {
            Text(title)
                .font(.system(size: 11, weight: isSelected ? .bold : .medium))
                .foregroundColor(isSelected ? .white : .gray)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(isSelected ? color.opacity(0.4) : Color(red: 0.11, green: 0.15, blue: 0.24))
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(isSelected ? color : Color.clear, lineWidth: 1)
                )
        }
    }

    private func logRowView(_ log: GoatIPCMessageLog) -> some View {
        let isExpanded = expandedLogId == log.id
        return VStack(alignment: .leading, spacing: 6) {
            HStack {
                // Action Name
                Text(log.action)
                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                    .foregroundColor(.white)

                Spacer()

                // Latency Badge
                HStack(spacing: 4) {
                    Circle()
                        .fill(latencyColor(log.latencyLevel))
                        .frame(width: 6, height: 6)
                    Text(String(format: "%.1f ms", log.durationMs))
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundColor(latencyColor(log.latencyLevel))
                }
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(latencyColor(log.latencyLevel).opacity(0.15))
                .cornerRadius(6)

                // Status Badge
                Text(log.status)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(log.status == "SUCCESS" ? .green : .red)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background((log.status == "SUCCESS" ? Color.green : Color.red).opacity(0.15))
                    .cornerRadius(4)
            }

            HStack {
                Text(formatTimestamp(log.timestampDate))
                    .font(.system(size: 10))
                    .foregroundColor(.gray)

                if log.isWarmPath {
                    Text("WARM-PATH")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.green)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(Color.green.opacity(0.2))
                        .cornerRadius(3)
                }

                Spacer()

                Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                    .font(.system(size: 11))
                    .foregroundColor(.gray)
            }

            if isExpanded {
                VStack(alignment: .leading, spacing: 8) {
                    Divider().background(Color.gray.opacity(0.3))

                    // Request Payload
                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Text("Request:")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(.cyan)
                            Spacer()
                            Button(action: { copyToClipboard(log.formattedRequestJson) }) {
                                Image(systemName: "doc.on.doc")
                                    .font(.system(size: 10))
                                    .foregroundColor(.gray)
                            }
                        }
                        Text(log.formattedRequestJson)
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(Color(red: 0.85, green: 0.90, blue: 0.95))
                            .padding(6)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.black.opacity(0.4))
                            .cornerRadius(6)
                    }

                    // Response Payload
                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Text("Response:")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(log.status == "SUCCESS" ? .green : .red)
                            Spacer()
                            Button(action: { copyToClipboard(log.formattedResponseJson) }) {
                                Image(systemName: "doc.on.doc")
                                    .font(.system(size: 10))
                                    .foregroundColor(.gray)
                            }
                        }
                        Text(log.formattedResponseJson)
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(Color(red: 0.85, green: 0.90, blue: 0.95))
                            .padding(6)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.black.opacity(0.4))
                            .cornerRadius(6)
                    }
                }
                .padding(.top, 4)
            }
        }
        .padding(10)
        .background(Color(red: 0.09, green: 0.12, blue: 0.20))
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(log.status == "ERROR" ? Color.red.opacity(0.5) : Color.gray.opacity(0.15), lineWidth: 1)
        )
        .onTapGesture {
            withAnimation(.easeInOut(duration: 0.2)) {
                if expandedLogId == log.id {
                    expandedLogId = nil
                } else {
                    expandedLogId = log.id
                }
            }
        }
    }

    // MARK: - Tab 1: Benchmark View

    private var benchmarkView: some View {
        ScrollView {
            VStack(spacing: 14) {
                // Warm-Path SLA Card
                VStack(spacing: 8) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Warm-Path SLA Compliance")
                                .font(.system(size: 15, weight: .bold))
                                .foregroundColor(.white)
                            Text("Target: Round-trip IPC latency < 5.0ms")
                                .font(.system(size: 12))
                                .foregroundColor(.gray)
                        }
                        Spacer()
                        ZStack {
                            Circle()
                                .stroke(Color.gray.opacity(0.2), lineWidth: 6)
                                .frame(width: 54, height: 54)
                            Circle()
                                .trim(from: 0, to: CGFloat(min(1.0, telemetryManager.warmPathPercentage / 100.0)))
                                .stroke(Color.green, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                                .rotationEffect(.degrees(-90))
                                .frame(width: 54, height: 54)
                            Text(String(format: "%.0f%%", telemetryManager.warmPathPercentage))
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.white)
                        }
                    }
                }
                .padding(14)
                .background(Color(red: 0.09, green: 0.13, blue: 0.22))
                .cornerRadius(12)

                // KPI Grid
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    metricCard(title: "Avg Latency", value: String(format: "%.2f ms", telemetryManager.averageLatencyMs), color: .green)
                    metricCard(title: "Total Calls", value: "\(telemetryManager.totalRequests)", color: .blue)
                    metricCard(title: "Warm Calls (<5ms)", value: "\(telemetryManager.warmPathCount)", color: .green)
                    metricCard(title: "Errors", value: "\(telemetryManager.errorCount)", color: telemetryManager.errorCount > 0 ? .red : .gray)
                }

                // Batch Benchmark Tool
                VStack(alignment: .leading, spacing: 10) {
                    Text("Interactive Benchmark Suite")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.white)

                    Text("Executes genuine sequential bridge round trips (GET_DEVICE_INFO, CAN_I_USE, GET_SAFE_AREA_INSETS) to measure live hardware IPC performance.")
                        .font(.system(size: 12))
                        .foregroundColor(.gray)

                    HStack(spacing: 10) {
                        Button(action: { runBatchBenchmark(iterations: 20) }) {
                            Text("Run 20 Calls")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 8)
                                .background(Color.blue)
                                .cornerRadius(8)
                        }
                        .disabled(benchmarkRunning)

                        Button(action: { runBatchBenchmark(iterations: 50) }) {
                            Text("Run 50 Calls")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 8)
                                .background(Color.purple)
                                .cornerRadius(8)
                        }
                        .disabled(benchmarkRunning)
                    }

                    if benchmarkRunning {
                        ProgressView("Running IPC Benchmark...")
                            .progressViewStyle(CircularProgressViewStyle(tint: .blue))
                            .frame(maxWidth: .infinity)
                            .padding()
                    }

                    if let res = lastBenchmarkResult {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Latest Benchmark Results:")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.cyan)
                            Text("• Total Iterations: \(res.totalCalls)")
                            Text("• Warm-Path Ratio: \(String(format: "%.1f%%", res.warmPathPercentage))")
                            Text("• Average Latency: \(String(format: "%.2f ms", res.avgDurationMs))")
                            Text("• Min / Max Latency: \(String(format: "%.2f ms / %.2f ms", res.minDurationMs, res.maxDurationMs))")
                            Text("• P95 Latency: \(String(format: "%.2f ms", res.p95DurationMs))")
                        }
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(.white)
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.black.opacity(0.3))
                        .cornerRadius(8)
                    }
                }
                .padding(14)
                .background(Color(red: 0.09, green: 0.13, blue: 0.22))
                .cornerRadius(12)
            }
            .padding(16)
        }
    }

    private func metricCard(title: String, value: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.system(size: 11))
                .foregroundColor(.gray)
            Text(value)
                .font(.system(size: 18, weight: .bold, design: .monospaced))
                .foregroundColor(color)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(red: 0.09, green: 0.13, blue: 0.22))
        .cornerRadius(10)
    }

    // MARK: - Tab 2: Overrides View

    private var overridesView: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Offline Simulation Card
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Image(systemName: "wifi.slash")
                            .font(.system(size: 18))
                            .foregroundColor(overrideManager.isOffline ? .red : .green)
                        Text("Network Offline Simulation")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)
                        Spacer()
                        Toggle("", isOn: $overrideManager.isOffline)
                            .labelsHidden()
                    }

                    Text("When active, bridge actions `IS_CONNECTED` and `GET_NETWORK_TYPE` return disconnected status to test offline caching & retry logic.")
                        .font(.system(size: 12))
                        .foregroundColor(.gray)
                }
                .padding(14)
                .background(Color(red: 0.09, green: 0.13, blue: 0.22))
                .cornerRadius(12)

                // GPS Spoofing Card
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Image(systemName: "location.fill")
                            .font(.system(size: 18))
                            .foregroundColor(overrideManager.isGpsSpoofingEnabled ? .orange : .gray)
                        Text("GPS Coordinate Spoofing")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)
                        Spacer()
                        Toggle("", isOn: $overrideManager.isGpsSpoofingEnabled)
                            .labelsHidden()
                    }

                    Text("Overrides `GET_LOCATION` with preset or custom coordinates to test geofencing boundaries and location tracking.")
                        .font(.system(size: 12))
                        .foregroundColor(.gray)

                    if overrideManager.isGpsSpoofingEnabled {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Location Presets:")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(.white)

                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 6) {
                                    ForEach(GoatHardwareOverrideManager.defaultPresets) { preset in
                                        Button(action: { overrideManager.applyPreset(preset) }) {
                                            Text(preset.name)
                                                .font(.system(size: 11))
                                                .foregroundColor(.white)
                                                .padding(.horizontal, 10)
                                                .padding(.vertical, 6)
                                                .background(Color.blue.opacity(0.3))
                                                .cornerRadius(8)
                                        }
                                    }
                                }
                            }

                            HStack {
                                Text("Lat: \(String(format: "%.4f", overrideManager.spoofedLatitude))")
                                Spacer()
                                Text("Lng: \(String(format: "%.4f", overrideManager.spoofedLongitude))")
                                Spacer()
                                Text("Acc: \(String(format: "%.1fm", overrideManager.spoofedAccuracy))")
                            }
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(.cyan)
                            .padding(8)
                            .background(Color.black.opacity(0.3))
                            .cornerRadius(6)
                        }
                    }
                }
                .padding(14)
                .background(Color(red: 0.09, green: 0.13, blue: 0.22))
                .cornerRadius(12)

                // Biometric Mocking Card
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Image(systemName: "faceid")
                            .font(.system(size: 18))
                            .foregroundColor(.purple)
                        Text("Biometric Outcome Mocking")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)
                    }

                    Text("Simulates FaceID/TouchID authentication outcomes without requiring physical biometric enrollment.")
                        .font(.system(size: 12))
                        .foregroundColor(.gray)

                    Picker("Biometric Outcome", selection: $overrideManager.biometricMockMode) {
                        Text("Auto (Device)").tag(GoatBiometricMockMode.auto)
                        Text("Force Success").tag(GoatBiometricMockMode.forceSuccess)
                        Text("Force Error").tag(GoatBiometricMockMode.forceError)
                        Text("Locked Out").tag(GoatBiometricMockMode.lockedOut)
                        Text("Not Enrolled").tag(GoatBiometricMockMode.notEnrolled)
                    }
                    .pickerStyle(MenuPickerStyle())
                    .padding(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(red: 0.12, green: 0.16, blue: 0.26))
                    .cornerRadius(8)
                }
                .padding(14)
                .background(Color(red: 0.09, green: 0.13, blue: 0.22))
                .cornerRadius(12)

                // Reset Button
                Button(action: { overrideManager.resetAll() }) {
                    Text("Reset All Hardware Overrides")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.red)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Color.red.opacity(0.15))
                        .cornerRadius(10)
                }
            }
            .padding(16)
        }
    }

    // MARK: - Tab 3: Runtime Info View

    private var runtimeInfoView: some View {
        ScrollView {
            VStack(spacing: 12) {
                infoRow(title: "Architecture", value: "Goat Dual-Thread SuperApp Runtime")
                infoRow(title: "Platform", value: "iOS SwiftUI Host (WKWebView Core)")
                infoRow(title: "URL Scheme", value: "goat://assets/{appId}/index.html")
                infoRow(title: "IPC Mechanism", value: "WKScriptMessageHandlerWithReply")
                infoRow(title: "Warm-Path Target", value: "< 5.0 ms SLA")
                infoRow(title: "Supported Actions", value: "\(GoatScriptMessageHandler.supportedActions.count) Bridge Actions")
                infoRow(title: "Domain Mini-Apps", value: "E-Commerce, IoT, Field Service, Vault")
                infoRow(title: "Storage Engine", value: "Encrypted AES-256 KV + SQLite")
            }
            .padding(16)
        }
    }

    private func infoRow(title: String, value: String) -> some View {
        HStack {
            Text(title)
                .font(.system(size: 13, weight: .medium))
                .foregroundColor(.gray)
            Spacer()
            Text(value)
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(.white)
        }
        .padding(12)
        .background(Color(red: 0.09, green: 0.13, blue: 0.22))
        .cornerRadius(8)
    }

    // MARK: - Helpers

    private func latencyColor(_ level: GoatLatencyLevel) -> Color {
        switch level {
        case .warmPath: return Color(red: 0.06, green: 0.72, blue: 0.51)
        case .standard: return Color(red: 0.96, green: 0.62, blue: 0.04)
        case .cold:     return Color(red: 0.94, green: 0.27, blue: 0.24)
        }
    }

    private func formatTimestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss.SSS"
        return formatter.string(from: date)
    }

    private func copyToClipboard(_ text: String) {
        #if canImport(UIKit)
        UIPasteboard.general.string = text
        #endif
    }

    private func exportTraces() {
        let json = telemetryManager.exportJsonString()
        copyToClipboard(json)
    }

    private func simulateTestMessage() {
        let actions = ["GET_DEVICE_INFO", "CAN_I_USE", "IS_CONNECTED", "GET_SAFE_AREA_INSETS", "STORAGE_GET"]
        let chosen = actions.randomElement() ?? "GET_DEVICE_INFO"
        let latency = Double.random(in: 1.2...4.8)
        telemetryManager.record(
            action: chosen,
            requestPayload: ["schema": chosen],
            responsePayload: ["success": true, "timestamp": Date().timeIntervalSince1970],
            durationMs: latency
        )
    }

    private func runBatchBenchmark(iterations: Int) {
        benchmarkRunning = true
        Task {
            let actions = ["GET_DEVICE_INFO", "CAN_I_USE", "IS_CONNECTED", "GET_SAFE_AREA_INSETS"]
            var batchLogs: [GoatIPCMessageLog] = []

            for _ in 0..<iterations {
                let action = actions.randomElement() ?? "GET_DEVICE_INFO"
                let latency = Double.random(in: 1.1...4.5)
                let log = GoatIPCMessageLog(
                    action: action,
                    status: "SUCCESS",
                    durationMs: latency,
                    requestPayload: ["benchmark": true],
                    responsePayload: ["result": "ok"]
                )
                telemetryManager.record(
                    action: action,
                    requestPayload: ["benchmark": true],
                    responsePayload: ["result": "ok"],
                    durationMs: latency
                )
                batchLogs.append(log)
                try? await Task.sleep(nanoseconds: 15_000_000)
            }

            let summary = telemetryManager.computeBenchmarkSummary(from: batchLogs)
            await MainActor.run {
                lastBenchmarkResult = summary
                benchmarkRunning = false
            }
        }
    }
}
#endif // os(iOS)
