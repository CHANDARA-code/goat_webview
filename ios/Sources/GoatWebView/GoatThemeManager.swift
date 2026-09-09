import Foundation

/**
 * Host-owned theme, pushed down to mini-apps (Telegram `themeParams` parity).
 *
 * The direction matters. The engine already had SET_STATUS_BAR_THEME and SYNC_THEME_BACKGROUND,
 * which let a mini-app tell the host what to look like. This is the reverse: the host decides, and
 * every mini-app it opens inherits that decision.
 *
 * A mini-app is not required to participate. The injected bootstrap writes CSS custom properties
 * onto the document root, so a page that only ever writes `color: var(--goat-theme-text-color)`
 * stays consistent with the host without calling a bridge method or knowing goat exists.
 */
public final class GoatThemeManager: @unchecked Sendable {

    public static let shared = GoatThemeManager()

    public typealias Listener = (GoatThemeTokens) -> Void

    private let lock = NSLock()
    private var tokens: GoatThemeTokens = .defaultLight
    private var listeners: [(token: UUID, callback: Listener)] = []

    private var _verbose = false
    public var verbose: Bool {
        get { lock.lock(); defer { lock.unlock() }; return _verbose }
        set { lock.lock(); _verbose = newValue; lock.unlock() }
    }

    public init() {}

    public var current: GoatThemeTokens {
        lock.lock(); defer { lock.unlock() }
        return tokens
    }

    /**
     * Replaces the whole theme. A live mini-app is updated in place rather than needing a reload.
     */
    public func setTheme(_ next: GoatThemeTokens) {
        lock.lock()
        if tokens == next {
            let v = _verbose
            lock.unlock()
            if v { print("[GoatThemeManager] setTheme ignored; tokens identical") }
            return
        }
        tokens = next
        let snapshot = listeners
        let v = _verbose
        lock.unlock()

        if v { print("[GoatThemeManager] Theme -> \(next.colorScheme) bg=\(next.bgColor)") }
        for entry in snapshot { entry.callback(next) }
    }

    /// Convenience for the common case of following the host's light/dark state.
    public func setColorScheme(dark: Bool) {
        setTheme(dark ? .defaultDark : .defaultLight)
    }

    /**
     * Applies only the fields a host cares about, leaving the rest.
     *
     * Hosts rarely have opinions about all thirteen colours; forcing them to restate defaults would
     * mean their theme silently drifts from ours whenever a default changes.
     */
    public func updateTheme(_ transform: (GoatThemeTokens) -> GoatThemeTokens) {
        setTheme(transform(current))
    }

    @discardableResult
    public func addListener(_ listener: @escaping Listener) -> UUID {
        let id = UUID()
        lock.lock(); listeners.append((id, listener)); lock.unlock()
        return id
    }

    public func removeListener(_ id: UUID) {
        lock.lock(); listeners.removeAll { $0.token == id }; lock.unlock()
    }

    internal func resetForTesting() {
        lock.lock()
        tokens = .defaultLight
        listeners.removeAll()
        _verbose = false
        lock.unlock()
    }
}

/**
 * Host-owned design tokens (typography, spacing, radii, motion), pushed down the same way as
 * `GoatThemeManager`.
 */
public final class GoatDesignManager: @unchecked Sendable {

    public static let shared = GoatDesignManager()

    public typealias Listener = (GoatDesignTokens) -> Void

    private let lock = NSLock()
    private var tokens: GoatDesignTokens = .defaultTokens
    private var listeners: [(token: UUID, callback: Listener)] = []

    private var _verbose = false
    public var verbose: Bool {
        get { lock.lock(); defer { lock.unlock() }; return _verbose }
        set { lock.lock(); _verbose = newValue; lock.unlock() }
    }

    public init() {}

    public var current: GoatDesignTokens {
        lock.lock(); defer { lock.unlock() }
        return tokens
    }

    public func setDesign(_ next: GoatDesignTokens) {
        lock.lock()
        if tokens == next {
            let v = _verbose
            lock.unlock()
            if v { print("[GoatDesignManager] setDesign ignored; tokens identical") }
            return
        }
        tokens = next
        let snapshot = listeners
        let v = _verbose
        lock.unlock()

        if v { print("[GoatDesignManager] Design -> spacing=\(next.spacingUnit)") }
        for entry in snapshot { entry.callback(next) }
    }

    public func updateDesign(_ transform: (GoatDesignTokens) -> GoatDesignTokens) {
        setDesign(transform(current))
    }

    @discardableResult
    public func addListener(_ listener: @escaping Listener) -> UUID {
        let id = UUID()
        lock.lock(); listeners.append((id, listener)); lock.unlock()
        return id
    }

    public func removeListener(_ id: UUID) {
        lock.lock(); listeners.removeAll { $0.token == id }; lock.unlock()
    }

    internal func resetForTesting() {
        lock.lock()
        tokens = .defaultTokens
        listeners.removeAll()
        _verbose = false
        lock.unlock()
    }
}
