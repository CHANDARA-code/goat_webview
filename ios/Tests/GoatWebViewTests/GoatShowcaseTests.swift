import XCTest
import SwiftUI
@testable import GoatWebView

/**
 * Test Suite for iOS SwiftUI Showcase, Mini-App Launcher, and Floating Debug HUD (Milestone 2 / Showcase R1-R3).
 */
final class GoatShowcaseTests: XCTestCase {

    override func setUp() {
        super.setUp()
        GoatAbuseGuard.shared.recordUserGesture()
        GoatHardwareOverrideManager.shared.resetAll()
        GoatTelemetryManager.shared.clear()
    }

    override func tearDown() {
        GoatHardwareOverrideManager.shared.resetAll()
        GoatTelemetryManager.shared.clear()
        super.tearDown()
    }

    // MARK: - 1. Showcase Tab Routing & Contracts

    func testShowcaseTabDefinitionsAndMetadata() {
        let tabs = GoatShowcaseTab.allCases
        XCTAssertEqual(tabs.count, 5, "Expected 5 domain showcase tabs")

        // E-Commerce Tab
        let ecommerce = GoatShowcaseTab.ecommerce
        XCTAssertEqual(ecommerce.appId, "com.goat.ecommerce")
        XCTAssertEqual(ecommerce.initialRoute, "#/ecommerce")
        XCTAssertEqual(ecommerce.title, "E-Commerce")
        XCTAssertFalse(ecommerce.subtitle.isEmpty)
        XCTAssertEqual(ecommerce.themeColorHex, "#10B981")
        XCTAssertEqual(ecommerce.assetUrlString, "goat://assets/com.goat.ecommerce/index.html#/ecommerce")
        XCTAssertEqual(ecommerce.directAssetUrlString, "goat://com.goat.ecommerce/assets/index.html#/ecommerce")

        // IoT Tab
        let iot = GoatShowcaseTab.iot
        XCTAssertEqual(iot.appId, "com.goat.iot")
        XCTAssertEqual(iot.initialRoute, "#/iot")
        XCTAssertEqual(iot.title, "IoT & Hardware")
        XCTAssertEqual(iot.themeColorHex, "#3B82F6")

        // Field Service Tab
        let field = GoatShowcaseTab.fieldservice
        XCTAssertEqual(field.appId, "com.goat.fieldservice")
        XCTAssertEqual(field.initialRoute, "#/fieldservice")
        XCTAssertEqual(field.title, "Field Service")
        XCTAssertEqual(field.themeColorHex, "#F59E0B")

        // Secure Vault Tab
        let vault = GoatShowcaseTab.vault
        XCTAssertEqual(vault.appId, "com.goat.vault")
        XCTAssertEqual(vault.initialRoute, "#/vault")
        XCTAssertEqual(vault.title, "Secure Vault")
        XCTAssertEqual(vault.themeColorHex, "#8B5CF6")

        // Diagnostics Tab
        let diag = GoatShowcaseTab.diagnostics
        XCTAssertEqual(diag.appId, "com.goat.diagnostics")
        XCTAssertEqual(diag.initialRoute, "#/diagnostics")
        XCTAssertEqual(diag.title, "Diagnostics")
        XCTAssertEqual(diag.themeColorHex, "#06B6D4")
    }

    // MARK: - 2. GoatTelemetryManager & Latency Benchmarking

    func testTelemetryManagerRecordingAndWarmPathClassification() {
        let telemetry = GoatTelemetryManager.shared

        // Record warm path call (<5ms)
        telemetry.record(
            id: "msg-1",
            action: "GET_DEVICE_INFO",
            requestPayload: ["key": "test"],
            responsePayload: ["model": "iPhone", "os": "iOS"],
            durationMs: 2.4
        )

        XCTAssertEqual(telemetry.totalRequests, 1)
        XCTAssertEqual(telemetry.warmPathCount, 1)
        XCTAssertEqual(telemetry.errorCount, 0)
        XCTAssertEqual(telemetry.warmPathPercentage, 100.0)
        XCTAssertEqual(telemetry.logs.count, 1)

        let log1 = telemetry.logs.first!
        XCTAssertEqual(log1.action, "GET_DEVICE_INFO")
        XCTAssertEqual(log1.status, "SUCCESS")
        XCTAssertTrue(log1.isWarmPath)
        XCTAssertEqual(log1.latencyLevel, .warmPath)
        XCTAssertTrue(log1.formattedRequestJson.contains("test"))
        XCTAssertTrue(log1.formattedResponseJson.contains("iPhone"))

        // Record standard latency call (5-15ms)
        telemetry.record(
            id: "msg-2",
            action: "REQUEST_PAYMENT",
            requestPayload: ["provider": "bakong", "amount": 25.0],
            responsePayload: ["txHash": "0x123"],
            durationMs: 8.5
        )

        XCTAssertEqual(telemetry.totalRequests, 2)
        XCTAssertEqual(telemetry.warmPathCount, 1)
        XCTAssertEqual(telemetry.warmPathPercentage, 50.0)
        let log2 = telemetry.logs.first!
        XCTAssertEqual(log2.latencyLevel, .standard)
        XCTAssertFalse(log2.isWarmPath)

        // Record cold latency / error call (>15ms)
        telemetry.record(
            id: "msg-3",
            action: "BLE_CONNECT",
            requestPayload: ["deviceId": "peripheral-1"],
            errorMessage: "Connection timed out",
            durationMs: 22.0
        )

        XCTAssertEqual(telemetry.totalRequests, 3)
        XCTAssertEqual(telemetry.errorCount, 1)
        let log3 = telemetry.logs.first!
        XCTAssertEqual(log3.status, "ERROR")
        XCTAssertEqual(log3.latencyLevel, .cold)
        XCTAssertEqual(log3.errorMessage, "Connection timed out")
    }

    func testTelemetryBenchmarkSummaryComputation() {
        let telemetry = GoatTelemetryManager.shared

        // Record 10 samples
        for i in 1...10 {
            let duration = Double(i) * 1.5 // 1.5, 3.0, 4.5, 6.0, 7.5, 9.0, 10.5, 12.0, 13.5, 15.0
            telemetry.record(
                id: "bench-\(i)",
                action: "CAN_I_USE",
                requestPayload: ["schema": "STORAGE_SET"],
                responsePayload: ["available": true],
                durationMs: duration
            )
        }

        let summary = telemetry.computeBenchmarkSummary()
        XCTAssertEqual(summary.totalCalls, 10)
        XCTAssertEqual(summary.warmPathCount, 3) // 1.5, 3.0, 4.5
        XCTAssertEqual(summary.warmPathPercentage, 30.0)
        XCTAssertEqual(summary.minDurationMs, 1.5)
        XCTAssertEqual(summary.maxDurationMs, 15.0)
        XCTAssertGreaterThan(summary.avgDurationMs, 0.0)
        XCTAssertGreaterThan(summary.p95DurationMs, 0.0)

        // JSON export check
        let jsonString = telemetry.exportJsonString()
        XCTAssertTrue(jsonString.contains("CAN_I_USE"))
        XCTAssertTrue(jsonString.contains("bench-1"))

        // Clear test
        telemetry.clear()
        XCTAssertEqual(telemetry.totalRequests, 0)
        XCTAssertEqual(telemetry.logs.count, 0)
    }

    // MARK: - 3. Hardware Override Manager Tests

    func testHardwareOverrideManagerPresetsAndReset() {
        let overrideMgr = GoatHardwareOverrideManager.shared

        // Initial state
        XCTAssertFalse(overrideMgr.isOffline)
        XCTAssertFalse(overrideMgr.isGpsSpoofingEnabled)
        XCTAssertEqual(overrideMgr.biometricMockMode, .auto)
        XCTAssertNil(overrideMgr.getSpoofedLocationDictionary())

        // Apply Apple Park preset
        let applePark = GoatHardwareOverrideManager.defaultPresets[0]
        overrideMgr.applyPreset(applePark)

        XCTAssertTrue(overrideMgr.isGpsSpoofingEnabled)
        XCTAssertEqual(overrideMgr.spoofedLatitude, applePark.latitude, accuracy: 0.0001)
        XCTAssertEqual(overrideMgr.spoofedLongitude, applePark.longitude, accuracy: 0.0001)

        let spoofedDict = overrideMgr.getSpoofedLocationDictionary()
        XCTAssertNotNil(spoofedDict)
        XCTAssertEqual((spoofedDict?["latitude"] as? Double) ?? 0.0, applePark.latitude, accuracy: 0.0001)
        XCTAssertEqual((spoofedDict?["isSpoofed"] as? Bool), true)

        // Set offline and biometric mock
        overrideMgr.isOffline = true
        overrideMgr.biometricMockMode = .forceSuccess

        XCTAssertTrue(overrideMgr.isOffline)
        XCTAssertEqual(overrideMgr.biometricMockMode, .forceSuccess)

        // Reset
        overrideMgr.resetAll()
        XCTAssertFalse(overrideMgr.isOffline)
        XCTAssertFalse(overrideMgr.isGpsSpoofingEnabled)
        XCTAssertEqual(overrideMgr.biometricMockMode, .auto)
        XCTAssertNil(overrideMgr.getSpoofedLocationDictionary())
    }

    // MARK: - 4. Bridge Integration with Hardware Overrides

    func testBridgeNetworkHandlersRespectOfflineOverride() async throws {
        let handler = GoatScriptMessageHandler(appId: "com.goat.test")

        // 1. Online state
        GoatHardwareOverrideManager.shared.isOffline = false
        let onlineConn = try await handler.dispatchDirect(action: "IS_CONNECTED", payload: [:])
        XCTAssertEqual(onlineConn["isConnected"] as? Bool, true)

        let onlineNet = try await handler.dispatchDirect(action: "GET_NETWORK_TYPE", payload: [:])
        XCTAssertEqual(onlineNet["isConnected"] as? Bool, true)
        XCTAssertEqual(onlineNet["networkType"] as? String, "wifi")

        // 2. Offline simulated state
        GoatHardwareOverrideManager.shared.isOffline = true
        let offlineConn = try await handler.dispatchDirect(action: "IS_CONNECTED", payload: [:])
        XCTAssertEqual(offlineConn["isConnected"] as? Bool, false)

        let offlineNet = try await handler.dispatchDirect(action: "GET_NETWORK_TYPE", payload: [:])
        XCTAssertEqual(offlineNet["isConnected"] as? Bool, false)
        XCTAssertEqual(offlineNet["networkType"] as? String, "none")
    }

    func testBridgeLocationHandlerRespectsGpsSpoofingOverride() async throws {
        GoatAbuseGuard.shared.recordUserGesture()
        let handler = GoatScriptMessageHandler(appId: "com.goat.fieldservice")

        // Enable GPS spoofing to Tokyo Station
        let tokyoPreset = GoatGpsPreset(name: "Tokyo", latitude: 35.6812, longitude: 139.7671, accuracy: 2.5)
        GoatHardwareOverrideManager.shared.applyPreset(tokyoPreset)

        let location = try await handler.dispatchDirect(action: "GET_LOCATION", payload: [:])
        XCTAssertEqual((location["latitude"] as? Double) ?? 0.0, 35.6812, accuracy: 0.001)
        XCTAssertEqual((location["longitude"] as? Double) ?? 0.0, 139.7671, accuracy: 0.001)
        XCTAssertEqual((location["accuracy"] as? Double) ?? 0.0, 2.5, accuracy: 0.1)
        XCTAssertEqual(location["isSpoofed"] as? Bool, true)
    }

    func testBridgeBiometricHandlersRespectMockModes() async throws {
        let handler = GoatScriptMessageHandler(appId: "com.goat.vault")

        // Force Success
        GoatAbuseGuard.shared.recordUserGesture()
        GoatHardwareOverrideManager.shared.biometricMockMode = .forceSuccess
        let successSupport = try await handler.dispatchDirect(action: "CHECK_BIOMETRIC_SUPPORT", payload: [:])
        XCTAssertEqual(successSupport["supported"] as? Bool, true)

        let successAuth = try await handler.dispatchDirect(action: "BIOMETRIC_AUTH", payload: ["title": "Unlock Vault"])
        XCTAssertEqual(successAuth["authenticated"] as? Bool, true)

        // Force Error
        GoatAbuseGuard.shared.recordUserGesture()
        GoatHardwareOverrideManager.shared.biometricMockMode = .forceError
        do {
            _ = try await handler.dispatchDirect(action: "BIOMETRIC_AUTH", payload: [:])
            XCTFail("Expected authFailed error for forceError mode")
        } catch let err as GoatBridgeError {
            XCTAssertEqual(err, .authFailed("AUTH_FAILED"))
        }

        // Locked Out
        GoatAbuseGuard.shared.recordUserGesture()
        GoatHardwareOverrideManager.shared.biometricMockMode = .lockedOut
        do {
            _ = try await handler.dispatchDirect(action: "BIOMETRIC_AUTH", payload: [:])
            XCTFail("Expected authFailed error for lockedOut mode")
        } catch let err as GoatBridgeError {
            XCTAssertEqual(err, .authFailed("BIOMETRIC_LOCKOUT"))
        }

        // Not Enrolled
        GoatAbuseGuard.shared.recordUserGesture()
        GoatHardwareOverrideManager.shared.biometricMockMode = .notEnrolled
        let notEnrolledSupport = try await handler.dispatchDirect(action: "CHECK_BIOMETRIC_SUPPORT", payload: [:])
        XCTAssertEqual(notEnrolledSupport["supported"] as? Bool, false)
        XCTAssertEqual(notEnrolledSupport["biometryType"] as? String, "none")
    }

    // MARK: - 5. Navigation Bar Customization

    func testNavBarStateAndButtonActions() {
        let state = GoatNavBarState(
            title: "Original Title",
            subtitle: "Original Subtitle",
            backgroundColorHex: "#0F172A",
            textColorHex: "#FFFFFF",
            leftButton: .back,
            rightButtons: [.more, .close]
        )

        var clickedButton: GoatNavBarButtonType?
        state.onButtonClicked = { btn in
            clickedButton = btn
        }

        state.onButtonClicked?(.back)
        XCTAssertEqual(clickedButton, .back)

        state.onButtonClicked?(.close)
        XCTAssertEqual(clickedButton, .close)

        state.setProgress(visible: true, progress: 0.75)
        XCTAssertTrue(state.isProgressVisible)
        XCTAssertEqual(state.progress, 0.75)
    }

    // MARK: - 6. SwiftUI Views Instantiation

    func testShowcaseViewsInstantiation() {
        let mainView = GoatShowcaseMainView(initialTab: .ecommerce)
        XCTAssertNotNil(mainView)

        let containerView = GoatShowcaseContainerView(
            tab: .iot,
            navBarState: GoatNavBarState()
        )
        XCTAssertNotNil(containerView)

        let hudView = GoatFloatingDebugHUD()
        XCTAssertNotNil(hudView)

        let appView = GoatShowcaseAppView()
        XCTAssertNotNil(appView)
    }
}
