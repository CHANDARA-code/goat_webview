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

    /// KVC-set by `RCT_EXPORT_VIEW_PROPERTY(appId, NSString)` in `GoatWebViewManager.m`.
    @objc public var appId: NSString? {
        didSet { loadIfNeeded() }
    }

    /// KVC-set by `RCT_EXPORT_VIEW_PROPERTY(assetBundleName, NSString)` in `GoatWebViewManager.m`.
    @objc public var assetBundleName: NSString? {
        didSet { loadIfNeeded() }
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

    /// Mirrors `GoatView`'s internal `coreScriptMessageHandler` for native bridge dispatch.
    /// Re-instantiated in `loadIfNeeded()` so its `appId` always matches `appId` or `assetBundleName`,
    /// preserving the multi-tenant storage isolation enforced by `resolveAuthorizedAppId`.
    private var bridgeHandler = GoatScriptMessageHandler()

    public override init(frame: CGRect) {
        super.init(frame: frame)
        addSubview(goatView)
        goatView.translatesAutoresizingMaskIntoConstraints = true
        goatView.autoresizingMask = [.flexibleWidth, .flexibleHeight]

        goatView.onPageStarted = { [weak self] url in
            self?.onPageStarted?(["url": url])
        }
        goatView.onPageFinished = { [weak self] url in
            self?.onPageLoaded?(["url": url])
        }
        goatView.onError = { [weak self] description in
            self?.onError?(["description": description])
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
        // Delegate to the native handler so all 141 built-in bridge actions execute correctly,
        // then forward the completed result to React Native as a post-execution observation.
        goatView.onBridgeAction = { [weak self] action, payload in
            guard let self else { throw GoatBridgeError.viewDisposed }
            // Execute natively — throws GoatBridgeError.unsupportedAction for unknown actions.
            let result = try await self.bridgeHandler.dispatchDirect(action: action, payload: payload)
            // Forward action + result to RN for observation (analytics, deep-links, etc.).
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
        bridgeHandler = GoatScriptMessageHandler(appId: effectiveAppId)
        goatView.initialize(appId: effectiveAppId)
    }

    deinit {
        goatView.destroy()
    }
}
