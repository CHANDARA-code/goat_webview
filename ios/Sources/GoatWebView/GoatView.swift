import Foundation
import WebKit
import Security
#if canImport(UIKit)
import UIKit
#endif

/**
 * Enterprise-grade iOS `UIView` container for Goat WebView (Task 10164 / 10165).
 *
 * Mirrors `com.goat.webview.view.GoatView` (Android) so the same lifecycle, bridge, and
 * asset-loading surface can be reused without duplication by `react-native-goat-webview/ios`
 * and `goat_webview/ios`, matching the "Core Decoupling & Reusability Guarantee" (pre-docs.md
 * Section 8.3) that was previously satisfied only on Android.
 */
#if canImport(UIKit)
public final class GoatView: UIView {

    public static let bridgeName = "nativeBridge"

    /// JS shim injected at document start so the shared `miniapp-bridge.ts` SDK (which looks for
    /// `window.nativeBridge`) works unmodified against `WKScriptMessageHandlerWithReply` on iOS,
    /// exactly as `WebViewCompat.addWebMessageListener` auto-injects `window.nativeBridge` on Android.
    private static let bridgeShimSource = """
    (function () {
      if (window.nativeBridge) { return; }
      var listeners = [];
      window.nativeBridge = {
        postMessage: function (payloadString) {
          var payload;
          var rawId = '';
          try {
            payload = JSON.parse(payloadString);
            rawId = payload.id || '';
          } catch (e) {
            var match = payloadString.match(/"id"\\s*:\\s*"([^"]+)"/);
            rawId = match ? match[1] : '';
            payload = { id: rawId, action: '', payload: {} };
          }
          window.webkit.messageHandlers.\(bridgeName).postMessage(payload)
            .then(function (response) {
              var evt = { data: typeof response === 'string' ? response : JSON.stringify(response) };
              listeners.forEach(function (fn) { try { fn(evt); } catch (e) {} });
            })
            .catch(function (err) {
              var errResponse = {
                id: rawId,
                success: false,
                data: null,
                error: (err && err.message) ? err.message : String(err)
              };
              var evt = { data: JSON.stringify(errResponse) };
              listeners.forEach(function (fn) { try { fn(evt); } catch (e) {} });
            });
        },
        addEventListener: function (type, fn) {
          if (type === 'message') { listeners.push(fn); }
        }
      };
    })();
    """

    /// T8 compat: WKWebView has no native console API, so `onConsoleMessageCompat` is backed by
    /// overriding `console.*` in JS and posting each call to this handler. Only injected/registered
    /// when that callback is actually set (see `initialize`) — G7 holds.
    private static let consoleMessageHandlerName = "goatConsole"
    private static let consoleOverrideSource = """
    (function () {
      if (window.__goatConsoleOverridden) { return; }
      window.__goatConsoleOverridden = true;
      ['log', 'warn', 'error', 'info', 'debug'].forEach(function (level) {
        var original = console[level] ? console[level].bind(console) : function () {};
        console[level] = function () {
          try {
            var msg = Array.prototype.slice.call(arguments).map(function (a) {
              try { return typeof a === 'string' ? a : JSON.stringify(a); } catch (e) { return String(a); }
            }).join(' ');
            window.webkit.messageHandlers.\(consoleMessageHandlerName).postMessage({ message: msg, level: level });
          } catch (e) {}
          original.apply(console, arguments);
        };
      });
    })();
    """

    private var webView: GoatWKWebView?
    private var messageRouter: MessageRouter?
    private var consoleMessageRouter: ConsoleMessageRouter?
    /// internal rather than private so the manifest-policy wiring can be asserted in tests --
    /// the properties it sets were shipped unassigned once already.
    let coreScriptMessageHandler = GoatScriptMessageHandler()
    private let navigationRouter = NavigationRouter()
    @objc public let lifecycleManager = GoatLifecycleManager()
    private var _findInPageController: GoatFindInPageController?
    private var findInPageController: GoatFindInPageController {
        if let existing = _findInPageController { return existing }
        let controller = GoatFindInPageController()
        _findInPageController = controller
        return controller
    }

    /// Backing store for [findInPageOverlay]. Explicit rather than `lazy var` so
    /// `dismissFindOverlayIfPresent()` can ask whether an overlay exists *without* creating one.
    private var _findInPageOverlay: GoatFindInPageOverlay?

    /// Find-in-page UI, built on first actual use. Previously a stored `let`, so every GoatView
    /// constructed a UIView for a feature almost no mini-app invokes; the delegate wiring that
    /// used to live in `setupLifecycleWiring()` moved in here for the same reason, since assigning
    /// those closures at mount time would construct it anyway. Mirrors the Android fix.
    private var findInPageOverlay: GoatFindInPageOverlay {
        if let existing = _findInPageOverlay { return existing }
        let overlay = GoatFindInPageOverlay()
        overlay.onNext = { [weak self] in
            Task { @MainActor in _ = await self?.handleFindNext(true) }
        }
        overlay.onPrevious = { [weak self] in
            Task { @MainActor in _ = await self?.handleFindNext(false) }
        }
        overlay.onClose = { [weak self] in
            self?.handleFindClear()
        }
        _findInPageOverlay = overlay
        return overlay
    }

    /// Dismissing an overlay that was never built is a no-op, but *reading* `findInPageOverlay`
    /// would build one — and `handleFindClear()` runs on every SPA route change, so that read
    /// alone would defeat the laziness for any navigating mini-app.
    private func dismissFindOverlayIfPresent() {
        _findInPageOverlay?.dismiss()
    }

    private var cachedFindAdapter: RealWKWebViewFindAdapter?
    private weak var cachedFindAdapterWebView: WKWebView?
    private lazy var printController = GoatPrintController()
    private lazy var printStorageManager = GoatStorageManager()

    public private(set) var appId: String = "default"
    public private(set) var assetDir: URL? = nil

    /// Overrides the bundle manifest's `security.allowedDomains`. Required for URL-mode mini-apps,
    /// which have no manifest. Matches Android's `GoatView.hostDomainAllowlist`.
    public var hostDomainAllowlist: Set<String>? = nil
    public private(set) var popupManager: GoatPopupManager?
    public var popupRoutingPolicy: GoatPopupRoutingPolicy = .auto {
        didSet {
            popupManager?.defaultPolicy = popupRoutingPolicy
        }
    }

    public var underlyingWKWebView: WKWebView? { webView }
    public var underlyingGoatWKWebView: GoatWKWebView? { webView }

    public var onPopupRequest: ((GoatPopupRequest) -> GoatPopupRoutingPolicy?)?
    public var onPopupCreated: ((GoatView) -> Void)?
    public var onPopupClosed: ((GoatView?) -> Void)?

    public var onBridgeAction: ((String, [String: Any]) async throws -> [String: Any])?
    public var onBridgeMessageNotification: ((String, [String: Any]) -> Void)?

    /// Exposes the underlying `GoatScriptMessageHandler` to eliminate duplicate handler allocations.
    public var scriptMessageHandler: GoatScriptMessageHandler { coreScriptMessageHandler }

    /// Executes a bridge action directly through the view's core message handler.
    public func executeAction(_ action: String, payload: [String: Any] = [:]) async throws -> [String: Any] {
        return try await coreScriptMessageHandler.dispatchDirect(action: action, payload: payload)
    }
    public var onPageStarted: ((String) -> Void)?
    public var onPageFinished: ((String) -> Void)?
    public var onError: ((String) -> Void)?
    public var onAppServiceReady: ((String) -> Void)?
    public var onAppServiceCrash: ((String, String) -> Void)?
    public var onAppServiceTerminate: ((String) -> Void)?

    /// T7 compat: off by default. When true, `tel/mailto/sms/geo` (always silently handled)
    /// plus `tg/fb/whatsapp/comgooglemaps` and any host in [compatExternalLinkHosts] resolve
    /// directly to an external app/browser instead of the sandbox's warning dialog, and
    /// [onExternalNavigation] fires — fire-and-forget, no blocking round-trip.
    public var compatExternalSchemeResolver: Bool = false
    public var incognito: Bool = false
    public var compatExternalLinkHosts: Set<String> = ["t.me"]
    public var onExternalNavigation: ((String) -> Void)?

    /// T8 compat: each fires only when set — off by default, no extra native work when the
    /// embedder didn't ask for that event. `onLoadResource`/`onUpdateVisitedHistory` have no
    /// WKWebView primitive on iOS (Android-only for now — see
    /// TASK_PORTABLE_PLUG_AND_PLAY_ADAPTER.md T8).
    public var onReceivedErrorCompat: ((String, Int, String) -> Void)?
    public var onReceivedHttpErrorCompat: ((String, Int) -> Void)?
    public var onPageCommitVisibleCompat: ((String) -> Void)?
    public var onConsoleMessageCompat: ((String, String) -> Void)?

    /// When true, the document-start Web3 provider runtime (EIP-6963 `window.ethereum`, Solana
    /// Wallet Standard `window.navigator.wallets`, TonConnect `window.tonconnect`) is injected.
    /// Off by default: a host with no wallet features injects no provider surface and its
    /// mini-apps parse none of the runtime. Set before `initialize`.
    public var web3ProvidersEnabled: Bool = false

    /// T9 compat: off by default — no `UIRefreshControl` exists on the WebView's scrollView at
    /// all unless this is true. Must be set before the first `initialize`/`switchMiniApp` call.
    public var pullToRefreshEnabled: Bool = false

    /// Fires on every pull-to-refresh gesture. Default (unset) behavior is a plain reload with
    /// no Dart round-trip; a compat consumer that wants custom refresh logic sets this instead.
    public var onPullToRefresh: (() -> Void)?

    /// Drives the refresh spinner programmatically (compat's `PullToRefreshController.begin/endRefreshing`). No-op when [pullToRefreshEnabled] is off.
    public func setRefreshing(_ refreshing: Bool) {
        guard let control = webView?.scrollView.refreshControl else { return }
        if refreshing {
            control.beginRefreshing()
        } else {
            control.endRefreshing()
        }
    }

    /// Real, live state — not cached — for compat's `PullToRefreshController.isRefreshing()`.
    public var isRefreshing: Bool {
        webView?.scrollView.refreshControl?.isRefreshing ?? false
    }

    private var refreshTarget: RefreshTarget?

    /// Thin `@objc` target for `UIRefreshControl`'s action selector — `GoatView` itself can't be
    /// the target without exposing Objective-C runtime machinery on a public Swift class.
    private final class RefreshTarget: NSObject {
        weak var owner: GoatView?
        init(owner: GoatView) { self.owner = owner }
        @objc func refreshTriggered() {
            guard let owner else { return }
            if let custom = owner.onPullToRefresh {
                custom()
            } else {
                owner.webView?.reload()
            }
        }
    }

    /// T9 compat: applies [pullToRefreshEnabled] to [wv]'s scrollView. Called at both attach
    /// sites (`initialize`, `attachExisting`) right after `webView = wv`.
    private func applyPullToRefresh(to wv: GoatWKWebView) {
        guard pullToRefreshEnabled else {
            wv.scrollView.refreshControl = nil
            return
        }
        let target = RefreshTarget(owner: self)
        refreshTarget = target
        let control = UIRefreshControl()
        control.addTarget(target, action: #selector(RefreshTarget.refreshTriggered), for: .valueChanged)
        wv.scrollView.refreshControl = control
    }

    public var onShowToast: ((_ title: String, _ icon: String, _ duration: Int, _ mask: Bool) -> Void)? {
        didSet { coreScriptMessageHandler.onShowToast = onShowToast }
    }
    public var onHideToast: (() -> Void)? {
        didSet { coreScriptMessageHandler.onHideToast = onHideToast }
    }
    public var onShowModal: ((_ title: String, _ content: String, _ showCancel: Bool, _ cancelText: String, _ confirmText: String) async -> (confirm: Bool, cancel: Bool))? {
        didSet { coreScriptMessageHandler.onShowModal = onShowModal }
    }
    public var onShowActionSheet: ((_ itemList: [String]) async -> Int)? {
        didSet { coreScriptMessageHandler.onShowActionSheet = onShowActionSheet }
    }
    public var onShowLoading: ((_ title: String, _ mask: Bool) -> Void)? {
        didSet { coreScriptMessageHandler.onShowLoading = onShowLoading }
    }
    public var onHideLoading: (() -> Void)? {
        didSet { coreScriptMessageHandler.onHideLoading = onHideLoading }
    }
    public var onMakePhoneCall: ((_ phoneNumber: String) -> Void)? {
        didSet { coreScriptMessageHandler.onMakePhoneCall = onMakePhoneCall }
    }
    public var onSendSms: ((_ phoneNumber: String, _ body: String) -> Void)? {
        didSet { coreScriptMessageHandler.onSendSms = onSendSms }
    }
    public var onScanCode: ((_ payload: [String: Any]) async -> [String: Any])? {
        didSet { coreScriptMessageHandler.onScanCode = onScanCode }
    }
    public var onRequestPushToken: (() -> Void)? {
        didSet { coreScriptMessageHandler.onRequestPushToken = onRequestPushToken }
    }
    public var onChooseFiles: ((_ payload: [String: Any]) async -> [String: Any])? {
        didSet { coreScriptMessageHandler.onChooseFiles = onChooseFiles }
    }
    public var onSetNavBarTitle: ((_ title: String, _ subtitle: String?) -> Void)? {
        didSet { coreScriptMessageHandler.onSetNavBarTitle = onSetNavBarTitle }
    }
    public var onSetNavBarColor: ((_ backgroundColor: String, _ textColor: String, _ isDark: Bool) -> Void)? {
        didSet { coreScriptMessageHandler.onSetNavBarColor = onSetNavBarColor }
    }
    public var onSetNavBarButtons: ((_ left: String?, _ right: [String]) -> Void)? {
        didSet { coreScriptMessageHandler.onSetNavBarButtons = onSetNavBarButtons }
    }
    public var onSetNavBarProgress: ((_ visible: Bool, _ progress: Double?) -> Void)? {
        didSet { coreScriptMessageHandler.onSetNavBarProgress = onSetNavBarProgress }
    }
    public var onExpandBottomSheet: (() -> [String: Any])? {
        didSet { coreScriptMessageHandler.onExpandBottomSheet = onExpandBottomSheet }
    }
    public var onCollapseBottomSheet: (() -> [String: Any])? {
        didSet { coreScriptMessageHandler.onCollapseBottomSheet = onCollapseBottomSheet }
    }
    public var onSetSheetSnapPoints: ((_ snapPoints: [Double], _ initialSnap: Double?, _ isDismissible: Bool) -> [String: Any])? {
        didSet { coreScriptMessageHandler.onSetSheetSnapPoints = onSetSheetSnapPoints }
    }
    public var onTabSwitch: ((_ tabId: String) -> Void)? {
        didSet { coreScriptMessageHandler.onTabSwitch = onTabSwitch }
    }
    public var onTabClose: ((_ tabId: String) -> Void)? {
        didSet { coreScriptMessageHandler.onTabClose = onTabClose }
    }
    public var onTabCloseAll: (() -> Void)? {
        didSet { coreScriptMessageHandler.onTabCloseAll = onTabCloseAll }
    }
    public var onTabGetActive: (() -> [String: Any]?)? {
        didSet { coreScriptMessageHandler.onTabGetActive = onTabGetActive }
    }
    public var onTabList: (() -> [[String: Any]])? {
        didSet { coreScriptMessageHandler.onTabList = onTabList }
    }
    public var onUploadProgress: ((_ uploadId: String, _ bytesSent: Int64, _ totalBytes: Int64) -> Void)? {
        didSet { coreScriptMessageHandler.onUploadProgress = onUploadProgress }
    }

    public override init(frame: CGRect) {
        super.init(frame: frame)
        setupLifecycleWiring()
        backgroundColor = .clear
        isOpaque = false
    }

    public required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupLifecycleWiring()
        backgroundColor = .clear
        isOpaque = false
    }

    private var themeListenerToken: UUID?
    private var designListenerToken: UUID?

    /**
     * Re-applies host tokens to a page that is already loaded.
     *
     * The document-start script only runs on navigation, so a host that changes theme while a
     * mini-app is open would otherwise show stale colours until the next load.
     */
    private func pushDesignTokens() {
        let js = GoatDesignBootstrap.buildUpdateScript(
            theme: GoatThemeManager.shared.current,
            design: GoatDesignManager.shared.current
        )
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    private func setupLifecycleWiring() {
        themeListenerToken = GoatThemeManager.shared.addListener { [weak self] _ in
            self?.pushDesignTokens()
        }
        designListenerToken = GoatDesignManager.shared.addListener { [weak self] _ in
            self?.pushDesignTokens()
        }
        lifecycleManager.scriptEvaluator = { [weak self] script in
            self?.evaluateJavascript(script, completion: nil)
        }
        coreScriptMessageHandler.onAppServiceReady = { [weak self] appId, _ in
            self?.onAppServiceReady?(appId)
        }
        coreScriptMessageHandler.onAppServiceCrash = { [weak self] appId, error, _ in
            self?.onAppServiceCrash?(appId, error)
        }
        coreScriptMessageHandler.onAppServiceTerminate = { [weak self] appId, _ in
            self?.onAppServiceTerminate?(appId)
        }
        coreScriptMessageHandler.onEvaluateJS = { [weak self] js in
            self?.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
        coreScriptMessageHandler.onEvaluateJSAsync = { [weak self] js in
            guard let self else { return }
            await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
                DispatchQueue.main.async {
                    guard let wv = self.webView else { cont.resume(); return }
                    wv.evaluateJavaScript(js) { _, _ in cont.resume() }
                }
            }
        }
        coreScriptMessageHandler.onFindInPage = { [weak self] query in
            guard let self else { return ["matchCount": 0, "activeMatchIndex": 0] }
            return await self.handleFindInPage(query)
        }
        coreScriptMessageHandler.onFindNext = { [weak self] forward in
            guard let self else { return ["matchCount": 0, "activeMatchIndex": 0] }
            return await self.handleFindNext(forward)
        }
        coreScriptMessageHandler.onFindClear = { [weak self] in
            self?.handleFindClear()
        }
        coreScriptMessageHandler.onPrintPage = { [weak self] jobName, mode in
            guard let self else { throw GoatPrintError.webViewUnavailable }
            return try await self.handlePrintPage(jobName: jobName, mode: mode)
        }
        coreScriptMessageHandler.onNavigateBack = { [weak self] in
            self?.webView?.goBack()
        }
    }

    private func findAdapter(for wv: WKWebView) -> RealWKWebViewFindAdapter {
        if cachedFindAdapterWebView !== wv {
            let adapter = RealWKWebViewFindAdapter(webView: wv)
            cachedFindAdapter = adapter
            cachedFindAdapterWebView = wv
        }
        return cachedFindAdapter!
    }

    private func updateFindOverlay(_ result: GoatFindResult) {
        if result.query.isEmpty {
            dismissFindOverlayIfPresent()
            return
        }
        findInPageOverlay.show(in: self, matchCount: result.matchCount, activeMatchIndex: result.activeMatchIndex)
    }

    /// Runs a native find-in-page query on the current WebView (FIND_IN_PAGE / Task 10184).
    @MainActor
    private func handleFindInPage(_ query: String) async -> [String: Any] {
        guard let wv = webView else { return ["matchCount": 0, "activeMatchIndex": 0] }
        let result = await findInPageController.findInPage(adapter: findAdapter(for: wv), query: query)
        updateFindOverlay(result)
        return ["matchCount": result.matchCount, "activeMatchIndex": result.activeMatchIndex]
    }

    /// Cycles the active find match forward/backward (FIND_NEXT).
    @MainActor
    private func handleFindNext(_ forward: Bool) async -> [String: Any] {
        guard let wv = webView else { return ["matchCount": 0, "activeMatchIndex": 0] }
        let result = await findInPageController.findNext(adapter: findAdapter(for: wv), forward: forward)
        updateFindOverlay(result)
        return ["matchCount": result.matchCount, "activeMatchIndex": result.activeMatchIndex]
    }

    /// Clears find highlights and dismisses the overlay (FIND_CLEAR, and on SPA route change).
    @MainActor
    private func handleFindClear() {
        dismissFindOverlayIfPresent()
        guard let controller = _findInPageController, let wv = webView else { return }
        Task { await controller.clear(adapter: findAdapter(for: wv)) }
    }

    /// Triggers the native system print sheet or a sandboxed PDF export of the current page
    /// (PRINT_PAGE / Task 10185).
    @MainActor
    private func handlePrintPage(jobName: String, mode: String) async throws -> [String: Any] {
        guard let wv = webView else { throw GoatPrintError.webViewUnavailable }
        guard mode == "EXPORT_PDF" else {
            let shown = presentSystemPrintSheet(webView: wv, jobName: jobName)
            return ["shown": shown]
        }

        let safeFileName = jobName.components(separatedBy: CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "_-")).inverted)
            .joined(separator: "_")
        let fileName = safeFileName.isEmpty ? "print_job" : safeFileName
        let adapter = RealWKWebViewPrintAdapter(webView: wv)
        let pdfData = try await printController.exportPdf(adapter: adapter)
        let relativePath = "exports/\(fileName).pdf"
        _ = try await printStorageManager.writeFile(appId: appId, relativePath: relativePath, data: pdfData)
        return ["pdfUri": "goat://fs/\(relativePath)"]
    }

    /// Presents the real OS system print sheet for `webView` (`SYSTEM_SHEET` mode). Uses
    /// `WKWebView.viewPrintFormatter()` so pagination and `@media print` CSS are handled by
    /// WebKit's own print pipeline.
    @MainActor
    private func presentSystemPrintSheet(webView: WKWebView, jobName: String) -> Bool {
        #if canImport(UIKit) && !os(watchOS)
        let printInfo = UIPrintInfo(dictionary: nil)
        printInfo.outputType = .general
        printInfo.jobName = jobName

        let printInteractionController = UIPrintInteractionController.shared
        printInteractionController.printInfo = printInfo
        printInteractionController.printFormatter = webView.viewPrintFormatter()

        if UIDevice.current.userInterfaceIdiom == .pad {
            printInteractionController.present(from: webView.bounds, in: webView, animated: true) { _, _, _ in }
        } else {
            printInteractionController.present(animated: true) { _, _, _ in }
        }
        return true
        #else
        return false
        #endif
    }

    /// Registers a modular `GoatBridgePlugin` with the underlying core dispatcher.
    public func registerPlugin(_ plugin: GoatBridgePlugin) {
        coreScriptMessageHandler.registerPlugin(plugin)
    }

    /**
     * Initializes and loads the WebView pointed at the sandboxed bundle directory for `appId`.
     *
     * - Parameters:
     *   - appId: Mini-app tenant identifier used to scope the `goat://` virtual origin sandbox.
     *   - assetDir: Optional override for the extracted bundle directory; defaults to
     *     `Documents/miniapps/<appId>` via `GoatURLSchemeHandler`.
     *   - initialRoute: SPA route appended as a URL fragment on load.
     */
    public func initialize(appId: String = "default", assetDir: URL? = nil, initialRoute: String = "/", initialUrl: String? = nil, userScripts: [String] = []) {
        let safeAppId = (try? GoatStorageManager.sanitizeIdentifier(appId)) ?? "default"

        // Android warms these from its androidx.startup initializer; iOS has no process-start hook,
        // so the first mount drives it. Guarded internally so later mounts do not re-dial.
        GoatNetworkPrewarmer.prewarmConfiguredHostsOnce()

        // Warm pool swap: a same-tenant instance for this exact entry URL is parked fully warm —
        // re-parent it and re-bind delegates instead of building a config and navigating.
        if let entry = initialUrl?.trimmingCharacters(in: .whitespaces), !entry.isEmpty {
            currentHotKey = "\(safeAppId)|\(entry)"
            if let hot = GoatWebViewPool.shared.acquireHot(currentHotKey!) {
                attachExisting(hot, safeAppId: safeAppId, entryUrl: entry, reload: false)
                return
            }
        } else {
            currentHotKey = nil
        }

        let config = WKWebViewConfiguration()
        // Shared WebContent process pool (10154). Without this the main mini-app path got WebKit's
        // default per-configuration pool, so every screen renegotiated its own connections.
        config.processPool = GoatProcessPoolManager.shared.sharedProcessPool
        config.websiteDataStore = GoatProcessPoolManager.shared.dataStoreForApp(appId: safeAppId)
        config.websiteDataStore = incognito ? WKWebsiteDataStore.nonPersistent() : GoatProcessPoolManager.shared.dataStoreForApp(appId: safeAppId)

        let schemeHandler = GoatURLSchemeHandler(appId: safeAppId, baseBundlePath: assetDir?.path)
        config.setURLSchemeHandler(schemeHandler, forURLScheme: "goat")

        let userContentController = WKUserContentController()
        // Host theme + design tokens, before the bridge shim so a mini-app's own stylesheet can
        // already read the CSS custom properties on first paint.
        userContentController.addUserScript(
            WKUserScript(
                source: GoatDesignBootstrap.buildScript(
                    theme: GoatThemeManager.shared.current,
                    design: GoatDesignManager.shared.current
                ),
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )

        let shim = WKUserScript(source: Self.bridgeShimSource, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        userContentController.addUserScript(shim)
        // Adapter-supplied shims (e.g. window.flutter_inappwebview) — injected after goat's own
        // bridge shim, still at document-start, so they see window.nativeBridge and run before the
        // page's scripts. Nothing is added when the list is empty.
        // Web3 provider runtime, before adapter shims so a dApp's own bundle already sees
        // window.ethereum / window.solana / window.tonconnect on first evaluation.
        if web3ProvidersEnabled {
            userContentController.addUserScript(
                WKUserScript(
                    source: GoatWeb3Bootstrap.buildScript(),
                    injectionTime: .atDocumentStart,
                    forMainFrameOnly: true
                )
            )
        }

        for source in userScripts where !source.isEmpty {
            userContentController.addUserScript(
                WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }

        let router = MessageRouter(owner: self)
        userContentController.addScriptMessageHandler(router, contentWorld: .page, name: Self.bridgeName)
        messageRouter = router

        // T8 compat: WKWebView has no native console API (unlike Android's onConsoleMessage) --
        // only inject the override + register the handler when a consumer actually asked for it
        // (G7): a page that never has this enabled pays nothing.
        if onConsoleMessageCompat != nil {
            let consoleRouter = ConsoleMessageRouter(owner: self)
            userContentController.add(consoleRouter, contentWorld: .page, name: Self.consoleMessageHandlerName)
            consoleMessageRouter = consoleRouter
            userContentController.addUserScript(
                WKUserScript(source: Self.consoleOverrideSource, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }

        // Register controller for declarative content blocking and compile initial manifest rules (Task 10205)
        GoatContentBlocker.register(userContentController: userContentController, for: safeAppId)
        let resolvedAssetDir = assetDir ?? FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first?.appendingPathComponent("miniapps/\(safeAppId)")
        let cleanAppId = safeAppId.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        if GoatContentBlocker.compiledRuleLists[cleanAppId] == nil {
            if let manifestPath = resolvedAssetDir?.appendingPathComponent("manifest.json"),
               FileManager.default.fileExists(atPath: manifestPath.path),
               let manifestData = try? Data(contentsOf: manifestPath) {
                let allowed = GoatContentBlocker.parseAllowedDomains(from: manifestData)
                if !allowed.isEmpty {
                    let ruleListId = "goat_content_rules_\(safeAppId)"
                    WKContentRuleListStore.default().compileContentRuleList(
                        forIdentifier: ruleListId,
                        encodedContentRuleList: GoatContentBlocker.generateRuleListJSON(allowedDomains: allowed, appId: safeAppId)
                    ) { ruleList, _ in
                        if let ruleList = ruleList {
                            GoatContentBlocker.applyRuleList(ruleList, for: safeAppId)
                        }
                    }
                }
            }
        }

        config.userContentController = userContentController

        config.preferences.javaScriptCanOpenWindowsAutomatically = true
        if #available(iOS 14.0, *) {
            config.defaultWebpagePreferences.allowsContentJavaScript = true
        }

        let wv = GoatWKWebView(frame: bounds, appId: safeAppId, configuration: config)
        wv.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        wv.navigationDelegate = navigationRouter
        navigationRouter.owner = self

        let pm = GoatPopupManager(owner: self, appId: safeAppId, defaultPolicy: popupRoutingPolicy)
        self.popupManager = pm
        wv.uiDelegate = pm

        self.appId = safeAppId
        coreScriptMessageHandler.updateAppId(safeAppId)
        self.assetDir = resolvedAssetDir
        applyManifestSecurityPolicy(appId: safeAppId, assetDir: resolvedAssetDir, initialUrl: initialUrl)

        webView = wv
        applyPullToRefresh(to: wv)
        subviews.forEach { $0.removeFromSuperview() }
        addSubview(wv)

        // Mini-app-by-URL fast path: a plain http(s)/file entry point loads directly, skipping the
        // goat:// virtual-origin scheme handler (no bundle extraction, no manifest scan).
        if let raw = initialUrl?.trimmingCharacters(in: .whitespaces), !raw.isEmpty,
           let direct = URL(string: raw),
           let scheme = direct.scheme?.lowercased(), scheme == "https" || scheme == "http" || scheme == "file" {
            self.hostEntryUrl = raw
            if scheme == "file" {
                wv.loadFileURL(direct, allowingReadAccessTo: direct.deletingLastPathComponent())
            } else {
                wv.load(URLRequest(url: direct))
            }
        } else if let url = URL(string: "goat://\(safeAppId)/assets/index.html#\(initialRoute)") {
            wv.load(URLRequest(url: url))
        } else if let fallbackUrl = URL(string: "goat://assets/index.html#\(initialRoute)") {
            wv.load(URLRequest(url: fallbackUrl))
        }
    }

    /// Last plain-URL entry point loaded via [initialize] / [switchMiniApp].
    public private(set) var hostEntryUrl: String? = nil {
        didSet {
            if let h = hostEntryUrl, let comps = URLComponents(string: h), let host = comps.host {
                miniAppOrigins.insert(host.lowercased())
            }
        }
    }

    /// Hosts whose `http(s)` navigations are the mini-app itself (not an external link), so the
    /// policy handler must let them through instead of showing the leaving-the-app interstitial.
    private var miniAppOrigins: Set<String> = []

    /// `tenant|entryURL` under which this view's WebView is parked in `GoatWebViewPool` on teardown.
    private var currentHotKey: String? = nil

    /**
     * Switches the mini-app shown in this *already-initialized* view to [urlString] in place — a
     * `WKWebView.load` on the existing instance, so no `WKWebViewConfiguration`, user-content
     * controller, scheme handler or content-blocker is rebuilt. The iOS counterpart of
     * `GoatView.hotSwapTo` on Android.
     */
    public func switchMiniApp(_ urlString: String) {
        let newKey = "\(appId)|\(urlString)"
        if newKey == currentHotKey {
            evaluateJavascript("try{window.dispatchEvent(new Event('goat:reactivate'))}catch(e){}")
            onPageStarted?(urlString); onPageFinished?(urlString)
            return
        }
        // Park the currently-shown WebView hot so switching back is instant too.
        if let cur = webView, let key = currentHotKey {
            GoatWebViewPool.shared.park(key, cur)
            webView = nil
        }
        currentHotKey = newKey
        if let hot = GoatWebViewPool.shared.acquireHot(newKey) {
            attachExisting(hot, safeAppId: appId, entryUrl: urlString, reload: false)
            return
        }
        // Cold: no parked instance for this target — full initialize once.
        initialize(appId: appId, initialUrl: urlString)
    }

    /// Re-parents an already-warm `GoatWKWebView` from the pool into this view and re-binds every
    /// delegate to `self`, without rebuilding the configuration or (unless `reload`) navigating.
    private func attachExisting(_ wv: GoatWKWebView, safeAppId: String, entryUrl: String, reload: Bool) {
        self.appId = safeAppId
        coreScriptMessageHandler.updateAppId(safeAppId)
        self.hostEntryUrl = entryUrl

        // Fresh message router bound to this view; the injected window.nativeBridge shim persists
        // in the page (WKUserScript at documentStart), so re-adding the handler re-connects it.
        let ucc = wv.configuration.userContentController
        ucc.removeScriptMessageHandler(forName: Self.bridgeName, contentWorld: .page)
        let router = MessageRouter(owner: self)
        ucc.addScriptMessageHandler(router, contentWorld: .page, name: Self.bridgeName)
        messageRouter = router

        wv.navigationDelegate = navigationRouter
        navigationRouter.owner = self
        let pm = GoatPopupManager(owner: self, appId: safeAppId, defaultPolicy: popupRoutingPolicy)
        self.popupManager = pm
        wv.uiDelegate = pm

        wv.frame = bounds
        wv.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView = wv
        applyPullToRefresh(to: wv)
        subviews.forEach { $0.removeFromSuperview() }
        addSubview(wv)

        if reload, let u = URL(string: entryUrl) {
            wv.load(URLRequest(url: u))
        } else {
            // Already rendered — signal ready now, fire the app-level re-render hook.
            wv.evaluateJavaScript("try{window.dispatchEvent(new Event('goat:reactivate'))}catch(e){}", completionHandler: nil)
            DispatchQueue.main.async { [weak self] in
                self?.onPageStarted?(entryUrl)
                self?.onPageFinished?(entryUrl)
            }
        }
    }

    /// Executes arbitrary JavaScript inside the loaded page.
    public func evaluateJavascript(_ script: String, completion: ((Any?, Error?) -> Void)? = nil) {
        webView?.evaluateJavaScript(script) { result, error in
            completion?(result, error)
        }
    }

    /// Can the WebView navigate back in history?
    public func canGoBack() -> Bool { webView?.canGoBack ?? false }

    /// Navigates back in history.
    public func goBack() { webView?.goBack() }

    /// Reloads the current page.
    public func reload() { webView?.reload() }

    /// Current page URL, or `nil` before any navigation.
    public func getUrl() -> String? { webView?.url?.absoluteString }

    /// Current page title, or `nil` before any navigation.
    public func getTitle() -> String? { webView?.title }

    /// Can the WebView navigate forward in history?
    public func canGoForward() -> Bool { webView?.canGoForward ?? false }

    /// Navigates forward in history.
    public func goForward() { webView?.goForward() }

    public func stopLoading() { webView?.stopLoading() }

    public func requestFocus() { webView?.becomeFirstResponder() }

    public func clearCache(_ includeDiskFiles: Bool = true) {
        var types: Set<String> = [WKWebsiteDataTypeMemoryCache, WKWebsiteDataTypeOfflineWebApplicationCache]
        if includeDiskFiles {
            types.formUnion(WKWebsiteDataStore.allWebsiteDataTypes())
        }
        WKWebsiteDataStore.default().removeData(ofTypes: types, modifiedSince: Date(timeIntervalSince1970: 0)) {}
    }

    public override func layoutSubviews() {
        super.layoutSubviews()
        let w = Int(bounds.width)
        let h = Int(bounds.height)
        if w > 0 && h > 0 {
            let orientation = w > h ? "landscape" : "portrait"
            lifecycleManager.dispatchWindowResize(width: w, height: h, windowWidth: w, windowHeight: h, orientation: orientation)
        }
    }

    /// Loads `urlString` directly on the live WebView — a raw navigation, not a mini-app switch.
    /**
     * Populates the bridge's security policy from the bundle's own `manifest.json` -- the same
     * `security.allowedDomains` field `GoatContentBlocker` compiles its rule list from, and the same
     * field Android reads in `GoatView.manifestAllowedDomains`, so one declaration governs both
     * platforms.
     *
     * `hostDomainAllowlist` takes precedence, and is the only route for URL-mode mini-apps, which
     * have no bundle and therefore no manifest.
     *
     * An absent, unreadable or malformed manifest leaves the allowlist empty, which means
     * unfiltered -- the behaviour every mini-app has had until now. Only an app that declares the
     * field opts into the restriction.
     */
    func applyManifestSecurityPolicy(appId: String, assetDir: URL?, initialUrl: String?) {
        GoatMiniAppManifestStore.shared.put(
            MiniAppSecurityManifest(appId: appId, allowedRpIds: Self.manifestAllowedRpIds(assetDir: assetDir))
        )
        coreScriptMessageHandler.manifestDomainAllowlist =
            hostDomainAllowlist ?? Set(Self.manifestAllowedDomains(assetDir: assetDir))
        coreScriptMessageHandler.allowedBridgeOrigins =
            Self.bridgeOrigins(appId: appId, assetDir: assetDir, initialUrl: initialUrl)
    }

    /// `security.allowedRpIds` from the bundle manifest. Empty means no passkey ceremony is
    /// permitted for this tenant, which is the safe default under the shared virtual origin.
    static func manifestAllowedRpIds(assetDir: URL?) -> [String] {
        guard let dir = assetDir else { return [] }
        let file = dir.appendingPathComponent("manifest.json")
        guard FileManager.default.fileExists(atPath: file.path),
              let data = try? Data(contentsOf: file) else { return [] }
        return GoatMiniAppManifestStore.parseAllowedRpIds(from: data)
    }

    /// `security.allowedDomains` from the bundle manifest, or empty when there is no readable one.
    static func manifestAllowedDomains(assetDir: URL?) -> [String] {
        guard let dir = assetDir else { return [] }
        let file = dir.appendingPathComponent("manifest.json")
        guard FileManager.default.fileExists(atPath: file.path),
              let data = try? Data(contentsOf: file) else { return [] }
        return GoatContentBlocker.parseAllowedDomains(from: data)
    }

    /**
     * Origins permitted to post bridge messages. A packaged bundle is served from its own
     * `goat://{appId}` origin. A URL-mode mini-app is pinned to the origin of the URL the host
     * asked for; if that cannot be parsed, the set stays empty, which the handler treats as
     * main-frame-only rather than allow-all.
     */
    static func bridgeOrigins(appId: String, assetDir: URL?, initialUrl: String?) -> Set<String> {
        if assetDir != nil, initialUrl == nil {
            return ["goat://\(appId)"]
        }
        if let raw = initialUrl, let origin = GoatScriptMessageHandler.normalizeOrigin(raw) {
            return [origin]
        }
        return []
    }

    public func loadUrl(_ urlString: String) {
        guard let wv = webView, let url = URL(string: urlString) else { return }
        if url.isFileURL {
            wv.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        } else {
            wv.load(URLRequest(url: url))
        }
    }

    /// Serializes the WebView's back-forward list: `{currentIndex, history:[{url,title}]}`.
    public func getCopyBackForwardList() -> [String: Any] {
        guard let bfl = webView?.backForwardList else { return ["currentIndex": -1, "history": []] }
        func entry(_ item: WKBackForwardListItem) -> [String: Any] {
            ["url": item.url.absoluteString, "title": item.title ?? ""]
        }
        var history = bfl.backList.map(entry)
        let currentIndex = history.count
        if let current = bfl.currentItem { history.append(entry(current)) }
        history.append(contentsOf: bfl.forwardList.map(entry))
        return ["currentIndex": currentIndex, "history": history]
    }

    /// Best-effort background RAM trimming: WebKit exposes no public JS-timer-pause API,
    /// so this suspends media playback and defers to the OS out-of-process WebContent lifecycle.
    public func pause() {
        lifecycleManager.enterBackground()
        if #available(iOS 15.0, *) {
            webView?.setAllMediaPlaybackSuspended(true, completionHandler: nil)
        }
    }

    /// Resumes media playback suspended by `pause()`.
    public func resume() {
        lifecycleManager.enterForeground()
        if #available(iOS 15.0, *) {
            webView?.setAllMediaPlaybackSuspended(false, completionHandler: nil)
        }
    }

    /// Disposes the WebView and its associated resources to prevent leaks.
    @objc public func onPause() {
        pause()
    }

    @objc public func onResume() {
        resume()
    }

    @objc public func onTrimMemory() {
        lifecycleManager.dispatchMemoryWarning(level: 80, memoryPressure: "warning")
    }

    public func destroy() {
        if let t = themeListenerToken { GoatThemeManager.shared.removeListener(t) }
        if let t = designListenerToken { GoatDesignManager.shared.removeListener(t) }
        // Hand the host back an unconstrained orientation. A mini-app that locked to landscape must
        // not leave the host app -- or the next mini-app -- stuck there (Task 10175, rule 1).
        lifecycleManager.terminate()
        GoatOrientationController.shared.releaseToHost()
        dismissFindOverlayIfPresent()
        _findInPageOverlay = nil
        _findInPageController = nil
        popupManager?.closeActivePopup(dismissedByUser: false)
        popupManager?.owner = nil
        popupManager = nil
        guard let wv = webView else { return }

        // Warm pool swap: a URL-hosted mini-app view keeps its WebView fully warm for the next
        // same-tenant mount (the iOS `hotSwapTo`). Cross-tenant / bundle views still tear down.
        if let key = currentHotKey {
            navigationRouter.owner = nil
            messageRouter?.owner = nil
            messageRouter = nil
            webView = nil
            GoatWebViewPool.shared.park(key, wv)
            return
        }

        wv.uiDelegate = nil
        GoatContentBlocker.unregister(userContentController: wv.configuration.userContentController, for: wv.appId)
        wv.stopLoading()
        wv.configuration.userContentController.removeAllScriptMessageHandlers()
        wv.load(URLRequest(url: URL(string: "about:blank")!))
        wv.navigationDelegate = nil
        wv.removeFromSuperview()
        webView = nil
        messageRouter = nil
    }

    fileprivate func handleBridgeMessage(action: String, payload: [String: Any]) async throws -> [String: Any] {
        onBridgeMessageNotification?(action, payload)
        if let custom = onBridgeAction {
            return try await custom(action, payload)
        }
        return try await coreScriptMessageHandler.dispatchDirect(action: action, payload: payload)
    }

    /// Bridges `WKScriptMessageHandlerWithReply` callbacks back into `GoatView` without exposing
    /// the view itself as an `NSObject`-based delegate target.
    private final class MessageRouter: NSObject, WKScriptMessageHandlerWithReply {
        weak var owner: GoatView?

        init(owner: GoatView) {
            self.owner = owner
        }

        @MainActor
        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage,
            replyHandler: @escaping (Any?, String?) -> Void
        ) {
            guard let body = message.body as? [String: Any],
                  let id = body["id"] as? String,
                  let action = body["action"] as? String else {
                replyHandler(["id": "", "success": false, "data": NSNull(), "error": "Invalid bridge request format"], nil)
                return
            }
            let payload = body["payload"] as? [String: Any] ?? [:]
            let startTime = CFAbsoluteTimeGetCurrent()

            Task { [weak owner] in
                guard let owner else {
                    let durationMs = (CFAbsoluteTimeGetCurrent() - startTime) * 1000.0
                    GoatTelemetryManager.shared.record(
                        id: id,
                        action: action,
                        requestPayload: payload,
                        errorMessage: "View disposed",
                        durationMs: durationMs
                    )
                    replyHandler(["id": id, "success": false, "data": NSNull(), "error": "View disposed"], nil)
                    return
                }
                do {
                    let result = try await owner.handleBridgeMessage(action: action, payload: payload)
                    let durationMs = (CFAbsoluteTimeGetCurrent() - startTime) * 1000.0
                    GoatTelemetryManager.shared.record(
                        id: id,
                        action: action,
                        requestPayload: payload,
                        responsePayload: result,
                        durationMs: durationMs
                    )
                    replyHandler(["id": id, "success": true, "data": result, "error": NSNull()], nil)
                } catch {
                    let durationMs = (CFAbsoluteTimeGetCurrent() - startTime) * 1000.0
                    GoatTelemetryManager.shared.record(
                        id: id,
                        action: action,
                        requestPayload: payload,
                        errorMessage: error.localizedDescription,
                        durationMs: durationMs
                    )
                    replyHandler(["id": id, "success": false, "data": NSNull(), "error": error.localizedDescription], nil)
                }
            }
        }
    }

    /// T8 compat: fire-and-forget console.* relay — no reply needed, unlike [MessageRouter].
    private final class ConsoleMessageRouter: NSObject, WKScriptMessageHandler {
        weak var owner: GoatView?

        init(owner: GoatView) {
            self.owner = owner
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any] else { return }
            let text = body["message"] as? String ?? ""
            let level = body["level"] as? String ?? "log"
            owner?.onConsoleMessageCompat?(text, level)
        }
    }

    /// Extends the existing crash-recovery delegate (Task 10117) with the page-lifecycle
    /// callbacks `GoatView` needs, instead of duplicating `WKNavigationDelegate` wiring.
    private final class NavigationRouter: GoatWebProcessTerminationHandler {
        weak var owner: GoatView?

        // These satisfy @objc-optional WKNavigationDelegate requirements, but the conformance is
        // declared on the superclass — so without an explicit @objc the ObjC runtime never sees
        // them and WebKit never calls them (page-lifecycle callbacks silently dead on iOS).
        @objc func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            // A new route must not inherit the previous one's closing behaviour, or a confirmation
            // armed on a form screen would keep blocking dismissal after navigating away (10173).
            GoatClosingBehaviorController.shared.resetForNewRoute()
            owner?.onPageStarted?(webView.url?.absoluteString ?? "")
        }

        @objc func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            owner?.setRefreshing(false)
            owner?.onPageFinished?(webView.url?.absoluteString ?? "")
        }

        /// T8 compat: reports [error]'s code/description plus the failing URL (from the error's
        /// own userInfo — `webView.url` may already have moved on by the time this fires).
        private func reportReceivedErrorCompat(_ webView: WKWebView, _ error: Error) {
            guard let cb = owner?.onReceivedErrorCompat else { return }
            let nsError = error as NSError
            let failingUrl = (nsError.userInfo[NSURLErrorFailingURLStringErrorKey] as? String)
                ?? webView.url?.absoluteString ?? ""
            cb(failingUrl, nsError.code, nsError.localizedDescription)
        }

        @objc func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            owner?.onError?(error.localizedDescription)
            reportReceivedErrorCompat(webView, error)
        }

        @objc func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            owner?.onError?(error.localizedDescription)
            reportReceivedErrorCompat(webView, error)
        }

        /// T8 compat: fires once the page is guaranteed visually committed, opt-in.
        @objc func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
            owner?.onPageCommitVisibleCompat?(webView.url?.absoluteString ?? "")
        }

        @objc func webView(
            _ webView: WKWebView,
            didReceive challenge: URLAuthenticationChallenge,
            completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
        ) {
            if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust {
                if let serverTrust = challenge.protectionSpace.serverTrust {
                    var secResult = SecTrustResultType.invalid
                    if #available(iOS 12.0, macOS 10.14, *) {
                        let isValid = SecTrustEvaluateWithError(serverTrust, nil)
                        if isValid {
                            completionHandler(.performDefaultHandling, nil)
                        } else {
                            completionHandler(.cancelAuthenticationChallenge, nil)
                        }
                    } else {
                        let status = SecTrustEvaluate(serverTrust, &secResult)
                        if status == errSecSuccess && (secResult == .proceed || secResult == .unspecified) {
                            completionHandler(.performDefaultHandling, nil)
                        } else {
                            completionHandler(.cancelAuthenticationChallenge, nil)
                        }
                    }
                } else {
                    completionHandler(.cancelAuthenticationChallenge, nil)
                }
            } else {
                let appId = (webView as? GoatWKWebView)?.appId ?? "default"
                if !GoatHttpAuthManager.shared.handleChallenge(appId: appId, challenge: challenge, completionHandler: completionHandler) {
                    completionHandler(.performDefaultHandling, nil)
                }
            }
        }

        @objc func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }
            let scheme = url.scheme?.lowercased() ?? ""
            if scheme == "goat" || scheme == "about" || scheme == "blob" || scheme == "data" {
                decisionHandler(.allow)
                return
            }
            // A URL-hosted mini-app is served over http(s) or file:// — its own origin, sub-frames
            // and same-origin navigations are the app, not an external link.
            let originAllowed: Bool = {
                if scheme == "file" { return owner?.hostEntryUrl?.hasPrefix("file:") ?? false }
                guard scheme == "http" || scheme == "https", let host = url.host?.lowercased() else { return false }
                if owner?.miniAppOrigins.contains(host) == true { return true }
                return navigationAction.targetFrame?.isMainFrame == false   // sub-resources / iframes
            }()
            if originAllowed {
                decisionHandler(.allow)
                return
            }
            if ["tel", "mailto", "sms", "geo"].contains(scheme) {
                #if canImport(UIKit) && !os(watchOS)
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
                #endif
                if owner?.compatExternalSchemeResolver == true { owner?.onExternalNavigation?(url.absoluteString) }
                decisionHandler(.cancel)
                return
            }
            // T7 compat: additional app-deep-link schemes + configured universal-link hosts,
            // resolved silently (no sandbox warning dialog) — only when opted in.
            if owner?.compatExternalSchemeResolver == true {
                let compatSchemes: Set<String> = ["tg", "fb", "whatsapp", "comgooglemaps"]
                let host = url.host?.lowercased()
                let isCompatHost = host != nil && owner?.compatExternalLinkHosts.contains(host!) == true
                if compatSchemes.contains(scheme) || isCompatHost {
                    #if canImport(UIKit) && !os(watchOS)
                    UIApplication.shared.open(url, options: [:], completionHandler: nil)
                    #endif
                    owner?.onExternalNavigation?(url.absoluteString)
                    decisionHandler(.cancel)
                    return
                }
            }
            // External navigation trust boundary interstitial (Task 10192)
            let appId = (webView as? GoatWKWebView)?.appId ?? "default"
            #if canImport(UIKit) && !os(watchOS)
            let topVC = UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap { $0.windows }
                .first { $0.isKeyWindow }?
                .rootViewController

            GoatExternalLinkWarningDialog.show(
                from: topVC,
                appId: appId,
                url: url,
                onWarningShown: nil,
                onConfirm: {
                    GoatExternalLinkWarningDialog.openInSystemBrowser(url: url)
                },
                onCancel: {}
            )
            #endif
            decisionHandler(.cancel)
        }

        /// T8 compat: main-frame HTTP error responses (4xx/5xx), opt-in via
        /// [onReceivedHttpErrorCompat]. Never vetoes the response — decidePolicyFor here only
        /// observes; the page still loads exactly as it would with no delegate at all.
        @objc func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationResponse: WKNavigationResponse,
            decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void
        ) {
            if navigationResponse.isForMainFrame,
               let cb = owner?.onReceivedHttpErrorCompat,
               let httpResponse = navigationResponse.response as? HTTPURLResponse,
               httpResponse.statusCode >= 400 {
                cb(navigationResponse.response.url?.absoluteString ?? "", httpResponse.statusCode)
            }
            decisionHandler(.allow)
        }

        override func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            super.webViewWebContentProcessDidTerminate(webView)
            owner?.onError?("Render process crashed: WebContent process terminated")
            let appId = (webView as? GoatWKWebView)?.appId ?? "default"
            owner?.onAppServiceCrash?(appId, "Render process crashed: WebContent process terminated")
        }
    }
}
#endif
