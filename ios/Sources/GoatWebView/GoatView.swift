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

    private var webView: GoatWKWebView?
    private var messageRouter: MessageRouter?
    private let coreScriptMessageHandler = GoatScriptMessageHandler()
    private let navigationRouter = NavigationRouter()
    private let findInPageController = GoatFindInPageController()
    private let findInPageOverlay = GoatFindInPageOverlay()
    private var cachedFindAdapter: RealWKWebViewFindAdapter?
    private weak var cachedFindAdapterWebView: WKWebView?
    private let printController = GoatPrintController()
    private let printStorageManager = GoatStorageManager()

    public private(set) var appId: String = "default"
    public private(set) var assetDir: URL? = nil
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
    public var onPageStarted: ((String) -> Void)?
    public var onPageFinished: ((String) -> Void)?
    public var onError: ((String) -> Void)?
    public var onAppServiceReady: ((String) -> Void)?
    public var onAppServiceCrash: ((String, String) -> Void)?
    public var onAppServiceTerminate: ((String) -> Void)?

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

    private func setupLifecycleWiring() {
        coreScriptMessageHandler.onAppServiceReady = { [weak self] appId, _ in
            self?.onAppServiceReady?(appId)
        }
        coreScriptMessageHandler.onAppServiceCrash = { [weak self] appId, error, _ in
            self?.onAppServiceCrash?(appId, error)
        }
        coreScriptMessageHandler.onAppServiceTerminate = { [weak self] appId, _ in
            self?.onAppServiceTerminate?(appId)
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
        findInPageOverlay.onNext = { [weak self] in
            Task { @MainActor in _ = await self?.handleFindNext(true) }
        }
        findInPageOverlay.onPrevious = { [weak self] in
            Task { @MainActor in _ = await self?.handleFindNext(false) }
        }
        findInPageOverlay.onClose = { [weak self] in
            self?.handleFindClear()
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
            findInPageOverlay.dismiss()
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
        guard let wv = webView else { return }
        Task { await findInPageController.clear(adapter: findAdapter(for: wv)) }
        findInPageOverlay.dismiss()
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
    public func initialize(appId: String = "default", assetDir: URL? = nil, initialRoute: String = "/") {
        let safeAppId = (try? GoatStorageManager.sanitizeIdentifier(appId)) ?? "default"
        let config = WKWebViewConfiguration()
        config.websiteDataStore = GoatCookieManager.shared.dataStore(for: safeAppId)

        let schemeHandler = GoatURLSchemeHandler(appId: safeAppId, baseBundlePath: assetDir?.path)
        config.setURLSchemeHandler(schemeHandler, forURLScheme: "goat")

        let userContentController = WKUserContentController()
        let shim = WKUserScript(source: Self.bridgeShimSource, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        userContentController.addUserScript(shim)

        let router = MessageRouter(owner: self)
        userContentController.addScriptMessageHandler(router, contentWorld: .page, name: Self.bridgeName)
        messageRouter = router

        // Register controller for declarative content blocking and compile initial manifest rules (Task 10205)
        GoatContentBlocker.register(userContentController: userContentController, for: safeAppId)
        let resolvedAssetDir = assetDir ?? FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first?.appendingPathComponent("miniapps/\(safeAppId)")
        if let manifestPath = resolvedAssetDir?.appendingPathComponent("manifest.json"),
           FileManager.default.fileExists(atPath: manifestPath.path),
           let manifestData = try? Data(contentsOf: manifestPath) {
            let allowed = GoatContentBlocker.parseAllowedDomains(from: manifestData)
            if !allowed.isEmpty {
                let ruleListId = "goat_content_rules_\(safeAppId)"
                WKContentRuleListStore.default().compileContentRuleList(
                    forIdentifier: ruleListId,
                    encodedContentRuleList: GoatContentBlocker.generateRuleListJSON(allowedDomains: allowed, appId: safeAppId)
                ) { [weak userContentController] ruleList, _ in
                    if let ruleList = ruleList {
                        userContentController?.add(ruleList)
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
        self.assetDir = resolvedAssetDir

        webView = wv
        subviews.forEach { $0.removeFromSuperview() }
        addSubview(wv)

        if let url = URL(string: "goat://\(safeAppId)/assets/index.html#\(initialRoute)") {
            wv.load(URLRequest(url: url))
        } else if let fallbackUrl = URL(string: "goat://assets/index.html#\(initialRoute)") {
            wv.load(URLRequest(url: fallbackUrl))
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

    /// Best-effort background RAM trimming: WebKit exposes no public JS-timer-pause API,
    /// so this suspends media playback and defers to the OS out-of-process WebContent lifecycle.
    public func pause() {
        if #available(iOS 15.0, *) {
            webView?.setAllMediaPlaybackSuspended(true, completionHandler: nil)
        }
    }

    /// Resumes media playback suspended by `pause()`.
    public func resume() {
        if #available(iOS 15.0, *) {
            webView?.setAllMediaPlaybackSuspended(false, completionHandler: nil)
        }
    }

    /// Disposes the WebView and its associated resources to prevent leaks.
    public func destroy() {
        popupManager?.closeActivePopup(dismissedByUser: false)
        popupManager?.owner = nil
        popupManager = nil
        guard let wv = webView else { return }
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

    /// Extends the existing crash-recovery delegate (Task 10117) with the page-lifecycle
    /// callbacks `GoatView` needs, instead of duplicating `WKNavigationDelegate` wiring.
    private final class NavigationRouter: GoatWebProcessTerminationHandler {
        weak var owner: GoatView?

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            owner?.onPageStarted?(webView.url?.absoluteString ?? "")
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            owner?.onPageFinished?(webView.url?.absoluteString ?? "")
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            owner?.onError?(error.localizedDescription)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            owner?.onError?(error.localizedDescription)
        }

        func webView(
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

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }
            let scheme = url.scheme?.lowercased() ?? ""
            if scheme == "file" {
                decisionHandler(.cancel)
                return
            }
            if scheme == "goat" || scheme == "about" || scheme == "blob" || scheme == "data" {
                decisionHandler(.allow)
                return
            }
            if ["tel", "mailto", "sms", "geo"].contains(scheme) {
                #if canImport(UIKit) && !os(watchOS)
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
                #endif
                decisionHandler(.cancel)
                return
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

        override func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            super.webViewWebContentProcessDidTerminate(webView)
            owner?.onError?("Render process crashed: WebContent process terminated")
            let appId = (webView as? GoatWKWebView)?.appId ?? "default"
            owner?.onAppServiceCrash?(appId, "Render process crashed: WebContent process terminated")
        }
    }
}
#endif
