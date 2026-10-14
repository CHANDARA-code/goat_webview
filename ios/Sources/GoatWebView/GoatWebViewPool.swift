#if os(iOS)
import Foundation
import WebKit
#if canImport(UIKit)
import UIKit
#endif

/**
 * iOS counterpart of `com.goat.webview.GoatFastPool` (Android).
 *
 * Holds up to `maxHot` fully-warm `GoatWKWebView` instances — WebContent process live, JS heap and
 * the mini-app page still rendered — parked by `tenant|entryURL`. Re-acquiring one is a `UIView`
 * re-parent, not a navigation, so a same-tenant remount / in-place switch completes in a few
 * milliseconds instead of the ~250–300 ms a fresh `WKWebViewConfiguration` build + network/parse
 * costs. Evicted wholesale on `UIApplication.didReceiveMemoryWarningNotification`.
 */
public final class GoatWebViewPool {

    public static let shared = GoatWebViewPool()

    /// Each parked instance keeps a ~30–40 MB WebContent process, so this is deliberately small.
    public var maxHot = 2

    /// A parked instance held past this many seconds without any acquire/park is trimmed — its
    /// WebContent process (~30–40 MB each) is pure resident cost once the user has stopped
    /// switching between mini-apps. Bursty switching keeps re-arming it, so the warm path is
    /// unaffected; only genuine idle pays.
    public var idleTrimSeconds: TimeInterval = 60

    private var hot: [(key: String, webView: GoatWKWebView)] = []
    private var idleGeneration = 0
    private let lock = NSLock()

    private init() {
        #if canImport(UIKit)
        NotificationCenter.default.addObserver(
            self, selector: #selector(onMemoryWarning),
            name: UIApplication.didReceiveMemoryWarningNotification, object: nil)
        NotificationCenter.default.addObserver(
            self, selector: #selector(onMemoryWarning),
            name: UIApplication.didEnterBackgroundNotification, object: nil)
        #endif
    }

    @objc private func onMemoryWarning() { trimAll() }

    /// Parks `webView` under `key`, detached from any view hierarchy. Evicts the least-recently
    /// parked instance (destroying it) if the pool is full.
    public func park(_ key: String, _ webView: GoatWKWebView) {
        lock.lock(); defer { lock.unlock() }
        hot.removeAll { $0.webView === webView }
        if let existingIdx = hot.firstIndex(where: { $0.key == key }) {
            destroy(hot.remove(at: existingIdx).webView)
        }
        while hot.count >= maxHot { destroy(hot.removeFirst().webView) }
        if Thread.isMainThread {
            #if canImport(UIKit)
            webView.scrollView.refreshControl = nil
            #endif
            webView.removeFromSuperview()
            webView.navigationDelegate = nil
            webView.uiDelegate = nil
        } else {
            DispatchQueue.main.async {
                #if canImport(UIKit)
                webView.scrollView.refreshControl = nil
                #endif
                webView.removeFromSuperview()
                webView.navigationDelegate = nil
                webView.uiDelegate = nil
            }
        }
        hot.append((key, webView))
        armIdleTrimLocked()
    }

    /// Returns a parked instance for `key` (still rendered, JS context live), or `nil`.
    public func acquireHot(_ key: String) -> GoatWKWebView? {
        lock.lock(); defer { lock.unlock() }
        guard let idx = hot.firstIndex(where: { $0.key == key }) else { return nil }
        let wv = hot.remove(at: idx).webView
        armIdleTrimLocked()
        return wv
    }

    /// Re-arms the single idle-trim check. Call with `lock` held. No periodic timer — one
    /// `asyncAfter` guarded by a generation counter, so repeated pool activity just supersedes
    /// the pending check.
    private func armIdleTrimLocked() {
        idleGeneration &+= 1
        let gen = idleGeneration
        let delay = idleTrimSeconds
        DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self else { return }
            self.lock.lock()
            let stale = self.idleGeneration == gen && !self.hot.isEmpty
            self.lock.unlock()
            if stale { self.trimAll() }
        }
    }

    public func hasHot(_ key: String) -> Bool {
        lock.lock(); defer { lock.unlock() }
        return hot.contains { $0.key == key }
    }

    /// Pre-builds one warm instance so the very first mount also takes the fast path.
    public func prewarm(configFactory: () -> (String, GoatWKWebView)) {
        lock.lock(); let empty = hot.isEmpty; lock.unlock()
        guard empty else { return }
        let (key, wv) = configFactory()
        park(key, wv)
    }

    public func trimAll() {
        lock.lock()
        let all = hot
        hot.removeAll()
        lock.unlock()
        guard !all.isEmpty else { return }
        DispatchQueue.main.async {
            all.forEach { self.destroy($0.webView) }
        }
    }

    private func destroy(_ webView: GoatWKWebView) {
        DispatchQueue.main.async { [weak webView] in
            guard let webView else { return }
            webView.stopLoading()
            webView.configuration.userContentController.removeAllScriptMessageHandlers()
            webView.navigationDelegate = nil
            webView.uiDelegate = nil
            #if canImport(UIKit)
            webView.scrollView.refreshControl = nil
            #endif
            webView.removeFromSuperview()
            webView.load(URLRequest(url: URL(string: "about:blank")!))
        }
    }
}
#endif // os(iOS)
