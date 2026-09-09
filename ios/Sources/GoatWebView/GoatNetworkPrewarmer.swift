import Foundation
import Network

/**
 * DNS and TCP pre-warm for hosts a mini-app is about to talk to (Task 10146, iOS side).
 *
 * The counterpart of Android's `GoatNetworkPrewarmer`. Resolving a host here populates the system
 * resolver cache that WebKit's networking process also queries, so the WebView's first request to
 * that host skips the lookup. The connection itself is deliberately not kept -- nothing here is
 * reused as a socket; the resolution is the part that pays.
 */
public enum GoatNetworkPrewarmer {

    private static let connectTimeout: TimeInterval = 0.8

    /// Bounded, finite retry schedule -- deliberately not a periodic ticker. Matches Android's.
    internal static let retryDelays: [TimeInterval] = [1.0, 2.0, 4.0]

    private static let queue = DispatchQueue(label: "com.goat.webview.prewarm", qos: .utility)

    private static let onceLock = NSLock()
    private static var hasWarmedConfiguredHosts = false

    /**
     * Warms `GoatConfig.shared.preconnectHosts` the first time it is called and never again.
     *
     * Android gets this for free from its androidx.startup initializer; iOS has no equivalent
     * process-start hook, so this is driven from the first GoatView initialization instead. The
     * once-guard is what makes that safe -- every mini-app mount would otherwise re-dial the same
     * hosts.
     */
    public static func prewarmConfiguredHostsOnce() {
        onceLock.lock()
        if hasWarmedConfiguredHosts {
            onceLock.unlock()
            return
        }
        hasWarmedConfiguredHosts = true
        onceLock.unlock()
        prewarm(hosts: GoatConfig.shared.preconnectHosts)
    }

    /// Test hook: clears the once-guard so a subsequent call warms again.
    internal static func resetOnceGuardForTesting() {
        onceLock.lock()
        hasWarmedConfiguredHosts = false
        onceLock.unlock()
    }

    /// Test hook: whether the configured-hosts warm has already run this process.
    internal static var didWarmConfiguredHosts: Bool {
        onceLock.lock()
        defer { onceLock.unlock() }
        return hasWarmedConfiguredHosts
    }

    /// Strips scheme, path and port, matching the Android implementation's parsing.
    internal static func normalizeHost(_ rawHost: String) -> String {
        var host = rawHost.trimmingCharacters(in: .whitespacesAndNewlines)
        if let schemeRange = host.range(of: "://") {
            host = String(host[schemeRange.upperBound...])
        }
        host = String(host.prefix(while: { $0 != "/" }))
        host = String(host.prefix(while: { $0 != ":" }))
        return host
    }

    /**
     * Fire-and-forget. Hosts are independent, so each is warmed on its own connection rather than
     * serially -- the Android side had to be fixed for exactly this, where N hosts each cost the
     * full connect timeout back to back.
     */
    public static func prewarm(hosts: [String]) {
        for rawHost in hosts {
            let host = normalizeHost(rawHost)
            guard !host.isEmpty else { continue }
            warm(host)
        }
    }

    private static func warm(_ host: String, attempt: Int = 0) {
        guard let port = NWEndpoint.Port(rawValue: 443) else { return }
        let connection = NWConnection(
            host: NWEndpoint.Host(host),
            port: port,
            using: .tcp
        )
        // Held until the state handler releases it; NWConnection does not retain itself.
        let done = DispatchWorkItem { connection.cancel() }
        connection.stateUpdateHandler = { state in
            switch state {
            case .ready, .cancelled:
                done.cancel()
                connection.stateUpdateHandler = nil
                connection.cancel()
            case .failed:
                done.cancel()
                connection.stateUpdateHandler = nil
                connection.cancel()
                // A failure at startup is usually "connectivity has not settled yet" rather than
                // "this host does not exist" -- without a retry the warm is lost for the whole
                // process lifetime. Bounded and finite, so this never becomes a poller.
                if attempt < retryDelays.count {
                    queue.asyncAfter(deadline: .now() + retryDelays[attempt]) {
                        warm(host, attempt: attempt + 1)
                    }
                }
            default:
                break
            }
        }
        connection.start(queue: queue)
        queue.asyncAfter(deadline: .now() + connectTimeout, execute: done)
    }
}
