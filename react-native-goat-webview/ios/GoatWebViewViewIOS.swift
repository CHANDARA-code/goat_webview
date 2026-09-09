import Foundation
import GoatWebView
import React

/**
 * `UIView` bridged into React Native's old-architecture view manager (Task 10164).
 *
 * Wraps the shared `GoatView` engine (from the `GoatWebView` CocoaPod) and forwards its
 * lifecycle callbacks to the RN prop-event contract already defined on Android in
 * `GoatWebViewManager.kt` — `onBridgeMessage`, `onPageLoaded`, `onError` — so `<GoatWebView />`
 * behaves identically on both platforms per `react-native-goat-webview/src/types.ts`.
 */
@objc(GoatWebViewViewIOS)
public final class GoatWebViewViewIOS: UIView {

    private let goatView = GoatView(frame: .zero)

    @objc public var onBridgeMessage: RCTDirectEventBlock?
    @objc public var onPageStarted: RCTDirectEventBlock?
    @objc public var onPageLoaded: RCTDirectEventBlock?
    @objc public var onProgressChanged: RCTDirectEventBlock?
    @objc public var onReceivedTitle: RCTDirectEventBlock?
    @objc public var onInsetsChange: RCTDirectEventBlock?
    @objc public var onSheetStateChange: RCTDirectEventBlock?
    @objc public var onError: RCTDirectEventBlock?
    @objc public var onAppServiceReady: RCTDirectEventBlock?
    @objc public var onAppServiceCrash: RCTDirectEventBlock?
    @objc public var onAppServiceTerminate: RCTDirectEventBlock?
    @objc public var onPopupRequest: RCTDirectEventBlock?
    @objc public var onHttpError: RCTDirectEventBlock?
    @objc public var onRenderProcessGone: RCTDirectEventBlock?
    @objc public var onContentProcessDidTerminate: RCTDirectEventBlock?
    @objc public var onScroll: RCTDirectEventBlock?
    @objc public var onExternalNavigation: RCTDirectEventBlock?

    /// KVC-set by `RCT_EXPORT_VIEW_PROPERTY(appId, NSString)` in `GoatWebViewManager.m`.
    @objc public var appId: NSString? {
        didSet { loadIfNeeded() }
    }

    /// KVC-set by `RCT_EXPORT_VIEW_PROPERTY(assetBundleName, NSString)` in `GoatWebViewManager.m`.
    @objc public var assetBundleName: NSString? {
        didSet { loadIfNeeded() }
    }

    @objc public var initialUrl: NSString? {
        didSet { loadIfNeeded() }
    }

    @objc public var initialUserScripts: [String] = [] {
        didSet { loadIfNeeded() }
    }

    /// Set before loadIfNeeded runs, because GoatView.initialize reads it -- assigning it
    /// afterwards would be a silent no-op.
    @objc public var hostDomainAllowlist: [String] = [] {
        didSet {
            let hosts = Set(hostDomainAllowlist.filter {
                !$0.trimmingCharacters(in: .whitespaces).isEmpty
            })
            goatView.hostDomainAllowlist = hosts.isEmpty ? nil : hosts
            loadIfNeeded()
        }
    }

    /// KVC-set by `RCT_EXPORT_VIEW_PROPERTY(popupRoutingPolicy, NSString)` in `GoatWebViewManager.m`.
    @objc public var popupRoutingPolicy: NSString? {
        didSet {
            goatView.popupRoutingPolicy = GoatPopupRoutingPolicy(from: popupRoutingPolicy as String?)
        }
    }

    // Navigation Bar Props
    @objc public var navBarTitle: NSString?
    @objc public var navBarSubtitle: NSString?
    @objc public var navBarBackgroundColor: NSString?
    @objc public var navBarTextColor: NSString?
    @objc public var navBarVisible: Bool = true
    @objc public var navBarProgress: NSNumber?

    // Bottom Sheet Props
    @objc public var bottomSheetSnapPoints: NSArray?
    @objc public var bottomSheetInitialSnap: NSNumber?
    @objc public var bottomSheetDismissible: Bool = true
    @objc public var bottomSheetShowDragHandle: Bool = true
    @objc public var bottomSheetVisible: Bool = false

    @objc public var pullToRefreshEnabled: Bool = false {
        didSet {
            goatView.pullToRefreshEnabled = pullToRefreshEnabled
        }
    }

    @objc public var incognito: Bool = false {
        didSet {
            goatView.incognito = incognito
            loadIfNeeded()
        }
    }

    @objc public var compatExternalSchemeResolver: Bool = false {
        didSet {
            goatView.compatExternalSchemeResolver = compatExternalSchemeResolver
        }
    }

    @objc public var originWhitelist: NSArray?
    @objc public var hasOnScroll: Bool = false
    @objc public var hasOnHttpError: Bool = false

    @objc public func goBack() {
        goatView.goBack()
    }

    @objc public func goForward() {
        goatView.goForward()
    }

    @objc public func reload() {
        goatView.reload()
    }

    @objc public func stopLoading() {
        goatView.stopLoading()
    }

    @objc public func injectJavaScript(_ script: String) {
        goatView.evaluateJavascript(script, completion: nil)
    }

    @objc public func requestFocus() {
        goatView.requestFocus()
    }

    @objc public func postMessage(_ data: String) {
        guard let jsonData = try? JSONSerialization.data(withJSONObject: [data]),
              let jsonStr = String(data: jsonData, encoding: .utf8) else {
            return
        }
        let js = "window.__rnwReceive && window.__rnwReceive(\(jsonStr)[0]);"
        goatView.evaluateJavascript(js, completion: nil)
    }

    @objc public func clearFormData() {
    }

    @objc public func clearHistory() {
    }

    @objc public func clearCache(_ includeDiskFiles: Bool) {
        goatView.clearCache(includeDiskFiles)
    }

    public override init(frame: CGRect) {
        super.init(frame: frame)
        addSubview(goatView)
        goatView.translatesAutoresizingMaskIntoConstraints = true
        goatView.autoresizingMask = [.flexibleWidth, .flexibleHeight]

        goatView.onPageStarted = { [weak self] url in
            self?.onPageStarted?(["url": url])
            guard let self else { return }
            self.onPageStarted?([
                "url": url,
                "title": self.goatView.getTitle() ?? "",
                "loading": true,
                "canGoBack": self.goatView.canGoBack(),
                "canGoForward": self.goatView.canGoForward()
            ])
        }
        goatView.onPageFinished = { [weak self] url in
            self?.onPageLoaded?(["url": url])
            guard let self else { return }
            self.onPageLoaded?([
                "url": url,
                "title": self.goatView.getTitle() ?? "",
                "loading": false,
                "canGoBack": self.goatView.canGoBack(),
                "canGoForward": self.goatView.canGoForward()
            ])
        }
        goatView.onError = { [weak self] description in
            self?.onError?(["description": description])
        }
        goatView.onReceivedHttpErrorCompat = { [weak self] url, statusCode in
            self?.onHttpError?([
                "url": url,
                "statusCode": Double(statusCode),
                "description": "HTTP \(statusCode)"
            ])
        }
        goatView.onExternalNavigation = { [weak self] url in
            self?.onExternalNavigation?(["url": url])
        }
        goatView.onAppServiceCrash = { [weak self] _, _ in
            self?.onContentProcessDidTerminate?([:])
            self?.onRenderProcessGone?(["didCrash": true])
        }
        goatView.onPopupRequest = { [weak self] req in
            DispatchQueue.main.async { [weak self] in
                var dict = req.toDictionary()
                if let wf = req.windowFeatures {
                    dict["windowFeaturesJson"] = (try? JSONSerialization.data(withJSONObject: wf.toDictionary())).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
                }
                self?.onPopupRequest?(dict)
            }
            return nil
        }
        // Delegate to the underlying GoatView handler so all built-in bridge actions execute correctly,
        // then forward the completed result to React Native as a post-execution observation.
        goatView.onBridgeAction = { [weak self] action, payload in
            guard let self else { throw GoatBridgeError.viewDisposed }
            let result = try await self.goatView.executeAction(action, payload: payload)
            DispatchQueue.main.async { [weak self] in
                self?.onBridgeMessage?(["action": action, "payload": payload, "result": result])
            }
            return result
        }
    }

    public required init?(coder: NSCoder) {
        super.init(coder: coder)
    }

    public override func layoutSubviews() {
        super.layoutSubviews()
        goatView.frame = bounds
    }

    private func loadIfNeeded() {
        let effectiveAppId = (appId as String?) ?? (assetBundleName as String?) ?? "default"
        goatView.initialize(appId: effectiveAppId)
        goatView.incognito = incognito
        goatView.compatExternalSchemeResolver = compatExternalSchemeResolver
        let effectiveAppId = (appId as String?) ?? "default"
        if let initialUrlStr = initialUrl as String?, !initialUrlStr.isEmpty {
            goatView.initialize(appId: effectiveAppId, initialUrl: initialUrlStr, userScripts: initialUserScripts)
        } else {
            let bundle = (assetBundleName as String?) ?? effectiveAppId
            goatView.initialize(appId: bundle, userScripts: initialUserScripts)
        }
    }

    deinit {
        goatView.destroy()
    }
}
