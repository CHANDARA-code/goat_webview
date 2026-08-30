import Foundation
import WebKit
#if canImport(UIKit)
import UIKit
#endif

/**
 * Native Popup and New Window Interception Manager (Task 10183 / Pillar 1).
 *
 * Conforms to `WKUIDelegate` to intercept `window.open()` and `target="_blank"` link clicks:
 * - Enforces origin classification (same-origin modal vs cross-origin system browser).
 * - Manages `GoatWindowedContainer` modal presentation and storage sandbox sharing.
 * - Emits `ON_POPUP_REQUEST` bridge telemetry events via `GoatEventCoalescer`.
 * - Handles `webViewDidClose(_:)` lifecycle teardown and focus restoration.
 */
public final class GoatPopupManager: NSObject, WKUIDelegate {

    public weak var owner: GoatView?
    public let appId: String
    public var defaultPolicy: GoatPopupRoutingPolicy

    public private(set) var activeModalContainer: GoatWindowedContainer?
    public private(set) var activeChildGoatView: GoatView?
    public private(set) var activeChildWKWebView: WKWebView?

    /// Host callback to inspect and optionally override popup routing policy
    public var onPopupRequest: ((GoatPopupRequest) -> GoatPopupRoutingPolicy?)?

    /// Host callback when a same-origin modal popup is created and mounted
    public var onPopupCreated: ((GoatView) -> Void)?

    /// Host callback when a modal popup is closed and dismissed
    public var onPopupClosed: ((GoatView?) -> Void)?

    public init(
        owner: GoatView? = nil,
        appId: String = "default",
        defaultPolicy: GoatPopupRoutingPolicy = .auto
    ) {
        self.owner = owner
        self.appId = (try? GoatStorageManager.sanitizeIdentifier(appId)) ?? "default"
        self.defaultPolicy = defaultPolicy
        super.init()
    }

    // MARK: - Origin & Policy Classification

    /**
     * Determines whether the given URL belongs to the current mini-app's same-origin sandbox.
     */
    public func isSameOrigin(url: URL) -> Bool {
        let scheme = url.scheme?.lowercased() ?? ""
        if scheme == "goat" {
            let host = url.host?.lowercased() ?? ""
            return host == appId.lowercased() || host == "assets"
        }
        if scheme.isEmpty {
            return true
        }
        return false
    }

    /**
     * Classifies a target URL into its baseline routing policy based on origin and scheme security.
     */
    public func classifyOrigin(url: URL) -> GoatPopupRoutingPolicy {
        let urlString = url.absoluteString

        // 1. Dangerous inputs (null bytes, invalid characters)
        if urlString.contains("\0") {
            return .block
        }

        let scheme = url.scheme?.lowercased() ?? ""

        // 2. Hard block local file access and unsafe scripts
        if scheme == "file" || scheme == "javascript" {
            return .block
        }

        // 3. System URL schemes (tel, mailto, sms, geo) -> route to system handler
        if ["tel", "mailto", "sms", "geo"].contains(scheme) {
            return .systemBrowser
        }

        // 4. Same-origin virtual scheme
        if scheme == "goat" {
            let host = url.host?.lowercased() ?? ""
            if host == appId.lowercased() || host == "assets" {
                return .modal
            } else {
                // Cross-tenant navigation is blocked in popups
                return .block
            }
        }

        // 5. External HTTP / HTTPS web links
        if scheme == "http" || scheme == "https" {
            return .systemBrowser
        }

        // 6. In-memory data, blob, or about schemes
        if scheme == "about" || scheme == "blob" || scheme == "data" {
            return .modal
        }

        // 7. Relative paths (empty scheme)
        if scheme.isEmpty {
            return .modal
        }

        return .systemBrowser
    }

    // MARK: - WKUIDelegate Interception

    @MainActor
    public func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        guard let url = navigationAction.request.url else {
            return nil
        }

        let isUserGesture = (navigationAction.navigationType == .linkActivated) || GoatAbuseGuard.shared.isGestureFresh()
        let basePolicy = classifyOrigin(url: url)

        // Calculate policy based on defaultPolicy
        var effectivePolicy: GoatPopupRoutingPolicy
        if basePolicy == .block {
            effectivePolicy = .block
        } else if defaultPolicy == .auto {
            effectivePolicy = basePolicy
        } else {
            let scheme = url.scheme?.lowercased() ?? ""
            if ["tel", "mailto", "sms", "geo"].contains(scheme) {
                effectivePolicy = .systemBrowser
            } else {
                effectivePolicy = defaultPolicy
            }
        }

        let parsedFeatures = GoatWindowFeatures.fromWKWindowFeatures(windowFeatures)
        let target = navigationAction.targetFrame == nil ? "_blank" : (navigationAction.targetFrame?.isMainFrame == true ? "_main" : "_other")

        let request = GoatPopupRequest(
            url: url,
            target: target,
            policy: effectivePolicy,
            isUserGesture: isUserGesture,
            isDialog: false,
            windowFeatures: parsedFeatures
        )

        // Host interception & policy override
        let hostOverride = owner?.onPopupRequest?(request) ?? self.onPopupRequest?(request)
        let finalPolicy: GoatPopupRoutingPolicy
        if let hostOverride = hostOverride {
            if basePolicy == .block {
                finalPolicy = .block // Hard invariant: file:// and cross-tenant stay blocked
            } else {
                finalPolicy = hostOverride
            }
        } else {
            finalPolicy = effectivePolicy
        }

        // Emit telemetry event
        let emittedRequest = GoatPopupRequest(
            url: url,
            target: target,
            policy: finalPolicy,
            isUserGesture: isUserGesture,
            isDialog: false,
            windowFeatures: parsedFeatures
        )
        GoatEventCoalescer.shared.emit(
            eventKey: "ON_POPUP_REQUEST",
            payload: emittedRequest.toDictionary()
        ) { _, _ in }

        // Execute routing action
        switch finalPolicy {
        case .modal:
            return handleSameOriginModal(
                url: url,
                configuration: configuration,
                windowFeatures: windowFeatures
            )

        case .systemBrowser:
            handleCrossOriginSystemBrowser(url: url)
            return nil

        case .sameFrame:
            webView.load(URLRequest(url: url))
            return nil

        case .block:
            return nil

        case .auto:
            if isSameOrigin(url: url) {
                return handleSameOriginModal(
                    url: url,
                    configuration: configuration,
                    windowFeatures: windowFeatures
                )
            } else {
                handleCrossOriginSystemBrowser(url: url)
                return nil
            }
        }
    }

    @MainActor
    public func webViewDidClose(_ webView: WKWebView) {
        closeActivePopup(dismissedByUser: false)
    }

    // MARK: - Presentation Handlers

    @MainActor
    public func handleSameOriginModal(
        url: URL,
        configuration: WKWebViewConfiguration,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        #if canImport(UIKit) && !os(watchOS)
        guard let owner = owner else { return nil }

        // Prevent stacking overflow if another modal is active
        if activeModalContainer != nil {
            closeActivePopup(dismissedByUser: false)
        }

        let parsedFeatures = GoatWindowFeatures.fromWKWindowFeatures(windowFeatures)
        let windowConfig = parsedFeatures.toWindowConfig(title: "Modal")

        let childGoatView = GoatView(frame: .zero)
        let initialRoute = url.fragment ?? "/"
        childGoatView.initialize(appId: appId, assetDir: owner.assetDir, initialRoute: initialRoute)

        let container = GoatWindowedContainer(
            targetAppId: appId,
            parentAppId: appId,
            config: windowConfig
        )
        container.embeddedView = childGoatView

        container.onClose = { [weak self] _, dismissedByUser in
            self?.closeActivePopup(dismissedByUser: dismissedByUser)
        }

        if let window = owner.window ?? UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap({ $0.windows })
            .first(where: { $0.isKeyWindow }) {
            container.show(in: window)
        } else {
            container.show(in: owner)
        }

        self.activeModalContainer = container
        self.activeChildGoatView = childGoatView
        self.activeChildWKWebView = childGoatView.underlyingWKWebView

        owner.onPopupCreated?(childGoatView)
        self.onPopupCreated?(childGoatView)

        return childGoatView.underlyingWKWebView
        #else
        return nil
        #endif
    }

    @MainActor
    public func handleCrossOriginSystemBrowser(url: URL) {
        #if canImport(UIKit) && !os(watchOS)
        let scheme = url.scheme?.lowercased() ?? ""
        if ["tel", "mailto", "sms", "geo"].contains(scheme) {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
            return
        }

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
    }

    @MainActor
    public func closeActivePopup(dismissedByUser: Bool = false) {
        guard let container = activeModalContainer else { return }
        let childView = activeChildGoatView

        activeModalContainer = nil
        activeChildGoatView = nil
        activeChildWKWebView = nil

        container.dismiss(dismissedByUser: dismissedByUser)
        childView?.destroy()

        if let childView = childView {
            owner?.onPopupClosed?(childView)
            self.onPopupClosed?(childView)
        }

        #if canImport(UIKit) && !os(watchOS)
        owner?.underlyingWKWebView?.becomeFirstResponder()
        #endif
    }
}
