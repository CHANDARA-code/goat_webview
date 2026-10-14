#if os(iOS)
import Foundation
import WebKit
#if canImport(UIKit)
import UIKit
#endif

/**
 * Headless WKWebView Engine for background task execution (Task 10114 / Milestone 1).
 *
 * Provides off-screen JavaScript execution without UI visibility while attaching
 * to the active UIWindow hierarchy with alpha = 0.01 to prevent WebKit WebContent
 * process throttling and background timer suspension.
 */
public class GoatHeadlessWebView {

    public static let bridgeName = "nativeBridge"


    public let appId: String
    public private(set) var isDestroyed: Bool = false
    private var webView: GoatWKWebView?
    private var scriptMessageHandler: GoatScriptMessageHandler?
    private var messageRouter: HeadlessMessageRouter?
    #if canImport(UIKit)
    private weak var attachedWindow: UIWindow?
    #endif

    public var onBridgeAction: ((String, [String: Any]) async throws -> [String: Any])?

    public init(
        appId: String = "default",
        baseBundlePath: String? = nil,
        initialRoute: String = "/",
        configuration: WKWebViewConfiguration? = nil
    ) {
        let safeAppId = (try? GoatStorageManager.sanitizeIdentifier(appId)) ?? "default"
        self.appId = safeAppId

        let config = configuration ?? WKWebViewConfiguration()

        // 1. Shared process pool (10154) + partitioned Website Data Store
        config.processPool = GoatProcessPoolManager.shared.sharedProcessPool
        config.websiteDataStore = GoatProcessPoolManager.shared.dataStoreForApp(appId: safeAppId)
        config.allowsInlineMediaPlayback = true
        config.defaultWebpagePreferences.allowsContentJavaScript = true

        // 2. Register Custom URL Scheme Handler
        let schemeHandler = GoatURLSchemeHandler(appId: safeAppId, baseBundlePath: baseBundlePath)
        config.setURLSchemeHandler(schemeHandler, forURLScheme: "goat")

        // 3. User Content Controller & Bridge Trampoline / Proxy
        let userContentController = WKUserContentController()
        userContentController.addUserScript(
            WKUserScript(
                source: GoatView.bridgeTrampolineSource,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true,
                in: GoatView.bridgeWorld
            )
        )
        userContentController.addUserScript(
            WKUserScript(
                source: GoatView.pageProxySource,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true,
                in: .page
            )
        )

        let msgHandler = GoatScriptMessageHandler(appId: safeAppId)
        self.scriptMessageHandler = msgHandler

        let router = HeadlessMessageRouter(owner: self)
        userContentController.addScriptMessageHandler(router, contentWorld: GoatView.bridgeWorld, name: Self.bridgeName)
        self.messageRouter = router
        config.userContentController = userContentController

        // 4. Instantiate GoatWKWebView with minimal offscreen frame
        let wv = GoatWKWebView(
            frame: CGRect(x: 0, y: 0, width: 1, height: 1),
            appId: safeAppId,
            configuration: config
        )
        wv.autoresizingMask = []
        self.webView = wv

        // 5. Attach to UIWindow with alpha = 0.01 to prevent WebKit process throttling
        prepareWindowAttachment(for: wv)

        // 6. Load entry point
        if let url = URL(string: "goat://\(safeAppId)/assets/index.html#\(initialRoute)") {
            wv.load(URLRequest(url: url))
        } else if let fallbackUrl = URL(string: "goat://assets/index.html#\(initialRoute)") {
            wv.load(URLRequest(url: fallbackUrl))
        }
    }

    private func prepareWindowAttachment(for view: GoatWKWebView) {
        #if canImport(UIKit)
        view.alpha = 0.01
        view.isHidden = false
        view.isUserInteractionEnabled = false

        DispatchQueue.main.async { [weak self, weak view] in
            guard let self = self, let view = view, !self.isDestroyed else { return }
            if let window = self.findKeyWindow() {
                window.insertSubview(view, at: 0)
                window.sendSubviewToBack(view)
                self.attachedWindow = window
            }
        }
        #endif
    }

    #if canImport(UIKit)
    private func findKeyWindow() -> UIWindow? {
        if #available(iOS 13.0, *) {
            let activeScenes = UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
            for scene in activeScenes {
                if let key = scene.windows.first(where: { $0.isKeyWindow }) {
                    return key
                }
                if let first = scene.windows.first {
                    return first
                }
            }
        }
        return UIApplication.shared.windows.first(where: { $0.isKeyWindow }) ?? UIApplication.shared.windows.first
    }
    #endif

    /**
     * Executes arbitrary JavaScript asynchronously inside the headless WebView.
     */
    @MainActor
    public func evaluateJavaScript(_ script: String) async throws -> Any? {
        guard !isDestroyed, let wv = webView else {
            throw GoatBridgeError.viewDisposed
        }
        return try await wv.evaluateJavaScript(script)
    }

    /**
     * Executes a native bridge action directly against the configured script message handler.
     */
    public func executeAction(action: String, payload: [String: Any]) async throws -> [String: Any] {
        guard !isDestroyed, let handler = scriptMessageHandler else {
            throw GoatBridgeError.viewDisposed
        }
        if let custom = onBridgeAction {
            return try await custom(action, payload)
        }
        return try await handler.dispatchDirect(action: action, payload: payload)
    }

    /**
     * Registers a modular plugin with the underlying script message handler.
     */
    public func registerPlugin(_ plugin: GoatBridgePlugin) {
        scriptMessageHandler?.registerPlugin(plugin)
    }

    /**
     * Registers a custom handler for a bridge action name.
     */
    public func registerHandler(action: String, handler: @escaping GoatScriptMessageHandler.ActionHandler) {
        scriptMessageHandler?.registerHandler(action: action, handler: handler)
    }

    /**
     * Tears down the headless WebView and frees all resources.
     */
    public func destroy() {
        guard !isDestroyed else { return }
        isDestroyed = true

        let wv = webView
        #if canImport(UIKit)
        if Thread.isMainThread {
            wv?.removeFromSuperview()
            wv?.stopLoading()
            if #available(iOS 14.0, *) {
                wv?.configuration.userContentController.removeScriptMessageHandler(forName: Self.bridgeName, contentWorld: GoatView.bridgeWorld)
                wv?.configuration.userContentController.removeAllScriptMessageHandlers(from: GoatView.bridgeWorld)
            }
            wv?.configuration.userContentController.removeAllScriptMessageHandlers()
            wv?.navigationDelegate = nil
        } else {
            DispatchQueue.main.async { [weak wv] in
                wv?.removeFromSuperview()
                wv?.stopLoading()
                if #available(iOS 14.0, *) {
                    wv?.configuration.userContentController.removeScriptMessageHandler(forName: Self.bridgeName, contentWorld: GoatView.bridgeWorld)
                    wv?.configuration.userContentController.removeAllScriptMessageHandlers(from: GoatView.bridgeWorld)
                }
                wv?.configuration.userContentController.removeAllScriptMessageHandlers()
                wv?.navigationDelegate = nil
            }
        }
        #else
        if Thread.isMainThread {
            wv?.stopLoading()
            if #available(iOS 14.0, *) {
                wv?.configuration.userContentController.removeScriptMessageHandler(forName: Self.bridgeName, contentWorld: GoatView.bridgeWorld)
                wv?.configuration.userContentController.removeAllScriptMessageHandlers(from: GoatView.bridgeWorld)
            }
            wv?.configuration.userContentController.removeAllScriptMessageHandlers()
            wv?.navigationDelegate = nil
        } else {
            DispatchQueue.main.async { [weak wv] in
                wv?.stopLoading()
                if #available(iOS 14.0, *) {
                    wv?.configuration.userContentController.removeScriptMessageHandler(forName: Self.bridgeName, contentWorld: GoatView.bridgeWorld)
                    wv?.configuration.userContentController.removeAllScriptMessageHandlers(from: GoatView.bridgeWorld)
                }
                wv?.configuration.userContentController.removeAllScriptMessageHandlers()
                wv?.navigationDelegate = nil
            }
        }
        #endif

        webView = nil
        scriptMessageHandler = nil
        messageRouter = nil
    }

    deinit {
        destroy()
    }

    private final class HeadlessMessageRouter: NSObject, WKScriptMessageHandlerWithReply {
        weak var owner: GoatHeadlessWebView?

        init(owner: GoatHeadlessWebView) {
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

            Task { [weak owner] in
                guard let owner = owner, !owner.isDestroyed else {
                    replyHandler(["id": id, "success": false, "data": NSNull(), "error": "WebView disposed"], nil)
                    return
                }
                do {
                    let result = try await owner.executeAction(action: action, payload: payload)
                    replyHandler(["id": id, "success": true, "data": result, "error": NSNull()], nil)
                } catch {
                    replyHandler(["id": id, "success": false, "data": NSNull(), "error": error.localizedDescription], nil)
                }
            }
        }
    }
}
#endif // os(iOS)
