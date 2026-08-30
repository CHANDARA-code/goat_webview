import Foundation
#if canImport(UIKit)
import UIKit
#endif
#if canImport(AVFoundation)
import AVFoundation
#endif
#if canImport(CoreLocation)
import CoreLocation
#endif
#if canImport(Photos)
import Photos
#endif

/**
 * Native Permission Status enumeration.
 */
public enum GoatPermissionStatus: String, Codable, Sendable {
    case notDetermined = "notDetermined"
    case authorized = "authorized"
    case denied = "denied"
    case permanentlyDenied = "permanentlyDenied"
}

/**
 * Two-stage permission priming dialog with automatic Settings fallback for iOS (Task 10198 / Pillar 1).
 *
 * Presents a themed rationale dialog before triggering the OS authorization request, and swaps
 * to an "Open Settings" deep-link CTA if the permission is denied or permanently denied.
 */
public final class GoatPermissionPrimingDialog {

    private static let lock = NSLock()
    // In-memory tenant permissions cache: appId -> [scope: Bool]
    private static var tenantPermissions: [String: [String: Bool]] = [:]

    /**
     * Checks OS-level authorization status for a permission scope string.
     */
    public static func checkStatus(scope: String) -> GoatPermissionStatus {
        switch scope {
        case "scope.camera":
            #if canImport(AVFoundation)
            let status = AVCaptureDevice.authorizationStatus(for: .video)
            switch status {
            case .authorized: return .authorized
            case .denied: return .permanentlyDenied
            case .restricted: return .denied
            case .notDetermined: return .notDetermined
            @unknown default: return .notDetermined
            }
            #else
            return .notDetermined
            #endif

        case "scope.record":
            #if canImport(AVFoundation)
            let status = AVCaptureDevice.authorizationStatus(for: .audio)
            switch status {
            case .authorized: return .authorized
            case .denied: return .permanentlyDenied
            case .restricted: return .denied
            case .notDetermined: return .notDetermined
            @unknown default: return .notDetermined
            }
            #else
            return .notDetermined
            #endif

        case "scope.userLocation":
            #if canImport(CoreLocation)
            let locManager = CLLocationManager()
            let status: CLAuthorizationStatus
            if #available(iOS 14.0, *) {
                status = locManager.authorizationStatus
            } else {
                status = CLLocationManager.authorizationStatus()
            }
            switch status {
            case .authorizedAlways, .authorizedWhenInUse: return .authorized
            case .denied: return .permanentlyDenied
            case .restricted: return .denied
            case .notDetermined: return .notDetermined
            @unknown default: return .notDetermined
            }
            #else
            return .notDetermined
            #endif

        case "scope.writePhotosAlbum":
            #if canImport(Photos)
            let status: PHAuthorizationStatus
            if #available(iOS 14.0, *) {
                status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
            } else {
                status = PHPhotoLibrary.authorizationStatus()
            }
            switch status {
            case .authorized, .limited: return .authorized
            case .denied: return .permanentlyDenied
            case .restricted: return .denied
            case .notDetermined: return .notDetermined
            @unknown default: return .notDetermined
            }
            #else
            return .notDetermined
            #endif

        default:
            return .notDetermined
        }
    }

    /**
     * Requests the real OS-level authorization for a permission scope (Task 10198). Injectable so
     * tests can fake the OS decision without triggering a real system prompt; defaults to the
     * real AVFoundation/CoreLocation/Photos APIs in production. Scopes with no underlying OS
     * permission (e.g. `scope.userInfo`, `scope.bluetooth`, `scope.contact`) resolve `true`
     * immediately — they are app-level only.
     */
    public static var osPermissionRequester: @Sendable (String) async -> Bool = { scope in
        // Defense in depth: never let an unoverridden test path fire a real system permission
        // prompt (which can hang or crash a test host lacking hardware/usage-description
        // entitlements) — regardless of which test file/class happens to run first.
        if ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil {
            return true
        }
        return await requestRealOsPermission(scope: scope)
    }

    private static func requestRealOsPermission(scope: String) async -> Bool {
        switch scope {
        case "scope.camera":
            #if canImport(AVFoundation)
            return await withCheckedContinuation { continuation in
                AVCaptureDevice.requestAccess(for: .video) { granted in
                    continuation.resume(returning: granted)
                }
            }
            #else
            return false
            #endif

        case "scope.record":
            #if canImport(AVFoundation)
            return await withCheckedContinuation { continuation in
                AVCaptureDevice.requestAccess(for: .audio) { granted in
                    continuation.resume(returning: granted)
                }
            }
            #else
            return false
            #endif

        case "scope.userLocation":
            #if canImport(CoreLocation)
            return await requestLocationPermission()
            #else
            return false
            #endif

        case "scope.writePhotosAlbum":
            #if canImport(Photos)
            return await withCheckedContinuation { continuation in
                if #available(iOS 14.0, *) {
                    PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
                        continuation.resume(returning: status == .authorized || status == .limited)
                    }
                } else {
                    PHPhotoLibrary.requestAuthorization { status in
                        continuation.resume(returning: status == .authorized)
                    }
                }
            }
            #else
            return false
            #endif

        default:
            // No OS-level permission underlies this scope — app-level grant only.
            return true
        }
    }

    #if canImport(CoreLocation)
    private final class LocationPermissionDelegate: NSObject, CLLocationManagerDelegate, @unchecked Sendable {
        private let continuation: CheckedContinuation<Bool, Never>
        private var resumed = false
        private let lock = NSLock()

        init(continuation: CheckedContinuation<Bool, Never>) {
            self.continuation = continuation
        }

        private func resumeOnce(_ granted: Bool) {
            lock.lock()
            defer { lock.unlock() }
            guard !resumed else { return }
            resumed = true
            continuation.resume(returning: granted)
        }

        func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
            let status = manager.authorizationStatus
            if status != .notDetermined {
                resumeOnce(status == .authorizedAlways || status == .authorizedWhenInUse)
            }
        }
    }

    private static let locationDelegateLock = NSLock()
    nonisolated(unsafe) private static var activeLocationDelegate: LocationPermissionDelegate?

    private static func requestLocationPermission() async -> Bool {
        await withCheckedContinuation { continuation in
            let manager = CLLocationManager()
            let delegate = LocationPermissionDelegate(continuation: continuation)
            locationDelegateLock.lock()
            activeLocationDelegate = delegate
            locationDelegateLock.unlock()
            manager.delegate = delegate
            manager.requestWhenInUseAuthorization()
        }
    }
    #endif

    /**
     * Resolves a user's "Allow" tap by invoking the real OS permission requester and persisting
     * the actual result — directly unit-testable without needing real `UIAlertAction` interaction
     * (a well-known XCTest limitation for `UIAlertController`).
     */
    @MainActor
    public static func resolveGrant(appId: String, scope: String) async -> Bool {
        let granted = await osPermissionRequester(scope)
        setPermission(appId: appId, scope: scope, granted: granted)
        return granted
    }

    /**
     * Checks if tenant has been granted in-memory permission for scope.
     */
    public static func isPermissionGranted(appId: String, scope: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return tenantPermissions[appId]?[scope] ?? false
    }

    /**
     * Sets tenant in-memory permission grant status.
     */
    public static func setPermission(appId: String, scope: String, granted: Bool) {
        lock.lock()
        defer { lock.unlock() }
        var map = tenantPermissions[appId] ?? [:]
        map[scope] = granted
        tenantPermissions[appId] = map
    }

    /**
     * Clears all in-memory permissions for a tenant.
     */
    public static func clearPermissions(appId: String) {
        lock.lock()
        defer { lock.unlock() }
        tenantPermissions.removeValue(forKey: appId)
    }

    #if canImport(UIKit) && !os(watchOS)
    /**
     * Shows the permission priming dialog or routes directly to settings if permanently denied.
     */
    @MainActor
    public static func show(
        from presenter: UIViewController?,
        appId: String,
        scope: String,
        rationale: String? = nil,
        onAccept: @escaping () -> Void,
        onDenied: @escaping () -> Void
    ) {
        let status = checkStatus(scope: scope)

        if status == .authorized {
            setPermission(appId: appId, scope: scope, granted: true)
            onAccept()
            return
        }

        let isPermanentlyDenied = (status == .permanentlyDenied || status == .denied)
        let displayRationale = rationale ?? (
            isPermanentlyDenied
                ? "Mini-App '\(appId)' requires '\(scope)' access. Please enable it in Settings."
                : "Mini-App '\(appId)' is requesting access to '\(scope)' to enable required features."
        )

        guard let presenter = presenter else {
            // In headless/mock context, delegate directly
            if isPermanentlyDenied {
                setPermission(appId: appId, scope: scope, granted: false)
                onDenied()
            } else {
                Task { @MainActor in
                    let granted = await resolveGrant(appId: appId, scope: scope)
                    if granted { onAccept() } else { onDenied() }
                }
            }
            return
        }

        let alert = UIAlertController(
            title: "Permission Request: \(scope)",
            message: displayRationale,
            preferredStyle: .alert
        )

        if isPermanentlyDenied {
            let settingsAction = UIAlertAction(title: "Open Settings", style: .default) { _ in
                openAppSettings()
                setPermission(appId: appId, scope: scope, granted: false)
                onDenied()
            }
            let cancelAction = UIAlertAction(title: "Cancel", style: .cancel) { _ in
                setPermission(appId: appId, scope: scope, granted: false)
                onDenied()
            }
            alert.addAction(settingsAction)
            alert.addAction(cancelAction)
        } else {
            let allowAction = UIAlertAction(title: "Allow", style: .default) { _ in
                Task { @MainActor in
                    let granted = await resolveGrant(appId: appId, scope: scope)
                    if granted { onAccept() } else { onDenied() }
                }
            }
            let denyAction = UIAlertAction(title: "Don't Allow", style: .cancel) { _ in
                setPermission(appId: appId, scope: scope, granted: false)
                onDenied()
            }
            alert.addAction(allowAction)
            alert.addAction(denyAction)
        }

        presenter.present(alert, animated: true, completion: nil)
    }

    /**
     * Deep links to the app's iOS Settings page via UIApplication.openSettingsURLString.
     */
    @MainActor
    public static func openAppSettings() {
        if let settingsUrl = URL(string: UIApplication.openSettingsURLString),
           UIApplication.shared.canOpenURL(settingsUrl) {
            UIApplication.shared.open(settingsUrl, options: [:], completionHandler: nil)
        }
    }
    #else
    public static func openAppSettings() {
        // No-op for non-UIKit platforms
    }
    #endif
}
