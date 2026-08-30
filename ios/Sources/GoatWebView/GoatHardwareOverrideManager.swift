import Foundation
#if canImport(Combine)
import Combine
#endif
#if canImport(CoreLocation)
import CoreLocation
#endif

/**
 * Biometric authentication mock simulation mode (Pillar 3 & Showcase R3).
 */
public enum GoatBiometricMockMode: String, CaseIterable, Codable, Sendable {
    case auto = "AUTO"
    case forceSuccess = "FORCE_SUCCESS"
    case forceError = "FORCE_ERROR"
    case lockedOut = "LOCKED_OUT"
    case notEnrolled = "NOT_ENROLLED"
}

/**
 * Coordinate preset for GPS location simulation.
 */
public struct GoatGpsPreset: Identifiable, Hashable, Sendable {
    public var id: String { name }
    public let name: String
    public let latitude: Double
    public let longitude: Double
    public let accuracy: Double

    public init(name: String, latitude: Double, longitude: Double, accuracy: Double = 5.0) {
        self.name = name
        self.latitude = latitude
        self.longitude = longitude
        self.accuracy = accuracy
    }
}

/**
 * Global Hardware Override & Device Mocking Manager for Developer Debug HUD (Task Showcase R3).
 *
 * Provides real-time dynamic hardware simulation:
 * 1. Offline Network Simulation (`isOffline`)
 * 2. GPS Location Spoofing with real-time coordinate overrides and presets
 * 3. Biometric Authentication Outcome Mocking (Success, Error, Lockout, Not Enrolled)
 */
public final class GoatHardwareOverrideManager: ObservableObject, @unchecked Sendable {
    public static let shared = GoatHardwareOverrideManager()

    private let lock = NSLock()

    // MARK: - Network Override
    @Published public var isOffline: Bool = false

    // MARK: - GPS Spoofing Override
    @Published public var isGpsSpoofingEnabled: Bool = false
    @Published public var spoofedLatitude: Double = 37.7749 // San Francisco
    @Published public var spoofedLongitude: Double = -122.4194
    @Published public var spoofedAccuracy: Double = 4.5

    // MARK: - Biometric Mock Override
    @Published public var biometricMockMode: GoatBiometricMockMode = .auto

    // MARK: - Standard Presets
    public static let defaultPresets: [GoatGpsPreset] = [
        GoatGpsPreset(name: "Apple Park, Cupertino", latitude: 37.3349, longitude: -122.0090, accuracy: 3.0),
        GoatGpsPreset(name: "San Francisco, CA", latitude: 37.7749, longitude: -122.4194, accuracy: 5.0),
        GoatGpsPreset(name: "Tokyo Station, Japan", latitude: 35.6812, longitude: 139.7671, accuracy: 4.0),
        GoatGpsPreset(name: "Big Ben, London", latitude: 51.5007, longitude: -0.1246, accuracy: 6.0),
        GoatGpsPreset(name: "Marina Bay, Singapore", latitude: 1.2840, longitude: 103.8590, accuracy: 3.5)
    ]

    public init() {}

    // MARK: - State Accessors

    public func applyPreset(_ preset: GoatGpsPreset) {
        lock.lock()
        defer { lock.unlock() }
        isGpsSpoofingEnabled = true
        spoofedLatitude = preset.latitude
        spoofedLongitude = preset.longitude
        spoofedAccuracy = preset.accuracy
    }

    public func getSpoofedLocationDictionary() -> [String: Any]? {
        lock.lock()
        defer { lock.unlock() }
        guard isGpsSpoofingEnabled else { return nil }
        return [
            "latitude": spoofedLatitude,
            "longitude": spoofedLongitude,
            "accuracy": spoofedAccuracy,
            "altitude": 12.0,
            "speed": 0.0,
            "course": 0.0,
            "timestamp": Date().timeIntervalSince1970,
            "isSpoofed": true
        ]
    }

    public func resetAll() {
        lock.lock()
        defer { lock.unlock() }
        isOffline = false
        isGpsSpoofingEnabled = false
        spoofedLatitude = 37.7749
        spoofedLongitude = -122.4194
        spoofedAccuracy = 4.5
        biometricMockMode = .auto
    }
}
