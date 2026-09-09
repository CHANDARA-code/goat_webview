import Foundation
#if canImport(UIKit) && !os(watchOS)
import UIKit
#endif

/**
 * Runtime screen-orientation lock for mini-apps (Task 10175, iOS side).
 *
 * Mirrors the Android controller's state machine so the bridge behaves identically, but the way it
 * takes effect differs by platform and that difference is deliberate:
 *
 * Android can set `Activity.requestedOrientation` directly. iOS cannot -- UIKit asks the top view
 * controller for `supportedInterfaceOrientations`, so an SDK cannot unilaterally impose one. The
 * host integrates by returning `GoatOrientationController.shared.supportedInterfaceOrientations`
 * from its own `application(_:supportedInterfaceOrientationsFor:)` (or the hosting view
 * controller's override). On iOS 16+ `applyToActiveScene()` additionally asks the window scene to
 * rotate now, so the change lands within a rotation cycle instead of waiting for the next query.
 */
public final class GoatOrientationController: @unchecked Sendable {

    public static let shared = GoatOrientationController()

    public static let portrait = "portrait"
    public static let landscape = "landscape"
    public static let auto = "auto"

    private let lock = NSLock()
    private var activeLock: String?
    private var manifestDefault: String = GoatOrientationController.auto

    public init() {}

    /// The lock a mini-app requested, or nil when only the manifest default is in effect.
    public var currentLock: String? {
        lock.lock()
        defer { lock.unlock() }
        return activeLock
    }

    internal static func normalize(_ raw: String?) -> String? {
        switch raw?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case portrait: return portrait
        case landscape: return landscape
        case auto: return auto
        default: return nil
        }
    }

    /// Records the manifest-declared default this mini-app falls back to on route unmount.
    public func rememberManifestDefault(_ orientation: String?) {
        guard let normalized = Self.normalize(orientation) else { return }
        lock.lock()
        manifestDefault = normalized
        lock.unlock()
    }

    /**
     * Applies a runtime lock. `"auto"` clears the lock and follows the device, per validation
     * rule 2 -- not the same as returning to the manifest default, which may itself be portrait
     * or landscape.
     *
     * @return false when `raw` is not one of the three documented values, leaving any existing
     *         lock untouched rather than silently clearing it on a typo.
     */
    @discardableResult
    public func setLock(_ raw: String?) -> Bool {
        guard let normalized = Self.normalize(raw) else { return false }
        lock.lock()
        activeLock = (normalized == Self.auto) ? nil : normalized
        lock.unlock()
        applyToActiveScene()
        return true
    }

    /// Route unmount: drop the runtime lock, back to the manifest default.
    public func releaseToManifestDefault() {
        lock.lock()
        activeLock = nil
        lock.unlock()
        applyToActiveScene()
    }

    /**
     * Mini-app teardown: drop everything so the host is unconstrained again.
     *
     * This is validation rule 1 -- without it a mini-app that locked to landscape would leave the
     * host, and the next mini-app, stuck there.
     */
    public func releaseToHost() {
        lock.lock()
        activeLock = nil
        manifestDefault = Self.auto
        lock.unlock()
        applyToActiveScene()
    }

    /// Test hook: clears recorded state so cases cannot bleed into one another.
    internal func resetForTesting() {
        lock.lock()
        activeLock = nil
        manifestDefault = Self.auto
        lock.unlock()
    }

    /// The effective orientation name: the runtime lock if one is held, else the manifest default.
    internal var effectiveOrientation: String {
        lock.lock()
        defer { lock.unlock() }
        return activeLock ?? manifestDefault
    }

    #if canImport(UIKit) && !os(watchOS)
    /// What the host should return from `application(_:supportedInterfaceOrientationsFor:)`.
    public var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        switch effectiveOrientation {
        case Self.portrait: return .portrait
        case Self.landscape: return .landscape
        default: return .all
        }
    }

    /// Best effort: ask the active scene to rotate now (iOS 16+), so the lock lands within a
    /// rotation cycle rather than at the next time UIKit happens to ask.
    public func applyToActiveScene() {
        let apply = {
            guard let scene = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .first(where: { $0.activationState == .foregroundActive })
                ?? UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first
            else { return }

            if #available(iOS 16.0, *) {
                let mask = self.supportedInterfaceOrientations
                scene.requestGeometryUpdate(.iOS(interfaceOrientations: mask))
                scene.windows
                    .first(where: { $0.isKeyWindow })?
                    .rootViewController?
                    .setNeedsUpdateOfSupportedInterfaceOrientations()
            } else {
                UIViewController.attemptRotationToDeviceOrientation()
            }
        }
        if Thread.isMainThread {
            apply()
        } else {
            DispatchQueue.main.async(execute: apply)
        }
    }
    #else
    public func applyToActiveScene() {}
    #endif
}
