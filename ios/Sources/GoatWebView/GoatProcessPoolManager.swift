import Foundation
import WebKit

/**
 * Single owner of the `WKProcessPool` shared by every Goat WebView (Task 10154).
 *
 * Sharing one pool lets WebKit pool WebContent processes and reuse the network cache, resource-load
 * coordinator and TLS session state across instances, so moving between mini-app screens does not
 * renegotiate connections. Tenant isolation is unaffected: it comes from the per-`appId`
 * `WKWebsiteDataStore`, which is a separate axis from the process pool.
 *
 * `GoatWKWebView` already shared a pool, but `GoatView` and `GoatHeadlessWebView` each built a
 * `WKWebViewConfiguration` without one, so the main mini-app path was silently getting WebKit's
 * default per-configuration pool. This type exists so there is one place that cannot be forgotten.
 */
public final class GoatProcessPoolManager: @unchecked Sendable {

    public static let shared = GoatProcessPoolManager()

    /// The one pool. Every Goat configuration points at this instance.
    public let sharedProcessPool = WKProcessPool()

    public init() {}

    /**
     * The tenant-partitioned data store for `appId`.
     *
     * Delegates to `GoatCookieManager` rather than keeping a second cache, so there is a single
     * source of truth for which store a tenant gets.
     */
    public func dataStoreForApp(appId: String) -> WKWebsiteDataStore {
        GoatCookieManager.shared.dataStore(for: appId)
    }

    /**
     * Applies the shared pool, and the tenant's data store unless the caller already chose one.
     *
     * The data store is only assigned when the configuration still holds WebKit's default, so an
     * explicitly supplied (e.g. non-persistent) store is never silently replaced.
     */
    public func configure(_ configuration: WKWebViewConfiguration, appId: String) {
        configuration.processPool = sharedProcessPool
        if configuration.websiteDataStore == .default() {
            configuration.websiteDataStore = dataStoreForApp(appId: appId)
        }
    }
}

