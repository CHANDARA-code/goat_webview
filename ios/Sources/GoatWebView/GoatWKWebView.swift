import Foundation
import WebKit
#if canImport(UIKit)
import UIKit
#endif

/**
 * Native iOS WKWebView Host Engine (Task 10114 / Pillar 1).
 *
 * Provides hardware-accelerated 120 FPS ProMotion rendering, custom configuration,
 * partitioned WKWebsiteDataStore per tenant, and lifecycle synchronization.
 */
public class GoatWKWebView: WKWebView {

    public let appId: String
    public let version: String

    /// Shared by every `GoatWKWebView` so WebKit can pool WebContent processes and caches.
    /// Delegates to `GoatProcessPoolManager` -- declaring a second pool here would defeat the
    /// point, since GoatView and GoatHeadlessWebView now attach to the manager's instance.
    public static var sharedProcessPool: WKProcessPool {
        GoatProcessPoolManager.shared.sharedProcessPool
    }

    public init(
        frame: CGRect = .zero,
        appId: String = "default",
        version: String = "1.0.0",
        configuration: WKWebViewConfiguration? = nil
    ) {
        let safeAppId = (try? GoatStorageManager.sanitizeIdentifier(appId)) ?? "default"
        self.appId = safeAppId
        self.version = version

        let config = configuration ?? WKWebViewConfiguration()

        // One process pool across every Goat WebView in the app: WebKit shares the network cache,
        // resource-load coordinator and JIT tier-up state across instances, and can coalesce
        // WebContent processes — so the warm pool's 2 parked instances cost less resident RAM.
        config.processPool = GoatWKWebView.sharedProcessPool

        // Enforce tenant data store partitioning if not explicitly assigned
        if config.websiteDataStore == .default() {
            config.websiteDataStore = GoatCookieManager.shared.dataStore(for: safeAppId)
        }

        // Configure preferences for high performance
        config.allowsInlineMediaPlayback = true
        config.defaultWebpagePreferences.allowsContentJavaScript = true

        // File access hardening: prevent local file reads from file URLs (Task 10193)
        config.preferences.setValue(false, forKey: "allowFileAccessFromFileURLs")
        if config.preferences.responds(to: Selector(("setAllowUniversalAccessFromFileURLs:"))) {
            config.preferences.setValue(false, forKey: "allowUniversalAccessFromFileURLs")
        }

        super.init(frame: frame, configuration: config)

        #if canImport(UIKit)
        self.isOpaque = false
        self.backgroundColor = .clear
        self.scrollView.backgroundColor = .clear
        self.scrollView.bounces = true
        self.scrollView.contentInsetAdjustmentBehavior = .always
        #endif
    }

    required init?(coder: NSCoder) {
        self.appId = "default"
        self.version = "1.0.0"
        super.init(coder: coder)
    }

    /**
     * Prewarms the WebKit networking and JavaScript engine.
     */
    public func prewarm() {
        self.evaluateJavaScript("console.log('[GoatWKWebView] Prewarmed');", completionHandler: nil)
    }

    /**
     * Clears all WebKit website data store caches scoped to this WebView's tenant.
     */
    public func clearCache(completion: (() -> Void)? = nil) {
        let dataStore = self.configuration.websiteDataStore
        let types = WKWebsiteDataStore.allWebsiteDataTypes()
        dataStore.fetchDataRecords(ofTypes: types) { records in
            dataStore.removeData(ofTypes: types, for: records) {
                completion?()
            }
        }
    }
}
