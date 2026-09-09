import Foundation

/**
 * Global configuration and host extensibility hooks for Goat WebView (iOS).
 *
 * Provides thread-safe host configuration for multi-account storage sandboxing (Task 10203),
 * debugging URLs, and runtime engine customization.
 */
public final class GoatConfig: @unchecked Sendable {

    public static let shared = GoatConfig()

    private let lock = NSLock()
    private var _accountProvider: (() -> String?)?
    private var _debugUrl: String?
    private var _preconnectHosts: [String] = []

    public init() {}

    /**
     * Optional host-app supplied account identifier provider closure.
     * When registered and returning a non-empty string, all storage sandboxes
     * (UserDefaults, Filesystem, Keychain) partition per `{appId}_{accountId}`.
     * When nil or returning empty/whitespace, storage seamlessly falls back to `{appId}`.
     */
    public var accountProvider: (() -> String?)? {
        get {
            lock.lock()
            defer { lock.unlock() }
            return _accountProvider
        }
        set {
            lock.lock()
            defer { lock.unlock() }
            _accountProvider = newValue
            GoatAccountScopedSandbox.shared.accountProvider = newValue
        }
    }

    /**
     * Optional debug URL for local development or inspector proxying.
     */
    public var debugUrl: String? {
        get {
            lock.lock()
            defer { lock.unlock() }
            return _debugUrl
        }
        set {
            lock.lock()
            defer { lock.unlock() }
            _debugUrl = newValue
        }
    }

    /**
     * Hosts to DNS-resolve and TCP pre-connect at startup, mirroring Android's
     * `GoatConfig.preconnectHosts`. Warming these populates the system resolver cache that
     * WebKit's networking process also queries, so a mini-app's first request skips the lookup.
     */
    public var preconnectHosts: [String] {
        get {
            lock.lock()
            defer { lock.unlock() }
            return _preconnectHosts
        }
        set {
            lock.lock()
            defer { lock.unlock() }
            _preconnectHosts = newValue
        }
    }

    /**
     * Resolves the current active account ID safely, trimming whitespace.
     * Returns nil if no provider is configured, or if provider returns nil or blank string.
     */
    public func currentAccountId() -> String? {
        lock.lock()
        let provider = _accountProvider
        lock.unlock()

        guard let provider = provider else { return nil }
        guard let accountId = provider()?.trimmingCharacters(in: .whitespacesAndNewlines),
              !accountId.isEmpty else {
            return nil
        }
        return accountId
    }

    /**
     * Resets configuration to default state (useful for test tearDown).
     */
    public func reset() {
        lock.lock()
        defer { lock.unlock() }
        _accountProvider = nil
        _debugUrl = nil
        _preconnectHosts = []
        GoatAccountScopedSandbox.shared.accountProvider = nil
    }
}
