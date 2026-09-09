import Flutter
import UIKit
import WebKit
import GoatWebView

/**
 * iOS `FlutterPlatformView` embedding `GoatView` inside the Flutter widget tree (Task 10165),
 * the iOS counterpart of `GoatPlatformView.kt`. Exposes the same
 * `MethodChannel("com.goat.webview/bridge_<id>")` contract consumed by
 * `goat_webview/lib/src/goat_web_view_controller.dart` so `GoatWebViewController` behaves
 * identically regardless of platform.
 */
final class GoatPlatformView: NSObject, FlutterPlatformView {

    private let goatView: GoatView
    private let channel: FlutterMethodChannel

    init(frame: CGRect, viewId: Int64, args: Any?, messenger: FlutterBinaryMessenger) {
        goatView = GoatView(frame: frame)
        channel = FlutterMethodChannel(name: "com.goat.webview/bridge_\(viewId)", binaryMessenger: messenger)
        super.init()

        let creationParams = args as? [String: Any]
        let appId = (creationParams?["appId"] as? String) ?? "default"
        let assetBundleName = (creationParams?["assetBundleName"] as? String) ?? "miniapp.zip"
        let popupRoutingPolicy = creationParams?["popupRoutingPolicy"] as? String
        goatView.popupRoutingPolicy = GoatPopupRoutingPolicy(from: popupRoutingPolicy)

        goatView.onPopupRequest = { [weak self] req in
            DispatchQueue.main.async { [weak self] in
                self?.channel.invokeMethod("onPopupRequest", arguments: req.toDictionary())
            }
            return nil
        }

        goatView.onPageStarted = { [weak self] url in
            DispatchQueue.main.async { self?.channel.invokeMethod("onPageStarted", arguments: url) }
        }
        goatView.onPageFinished = { [weak self] url in
            DispatchQueue.main.async { self?.channel.invokeMethod("onPageFinished", arguments: url) }
        }
        goatView.onError = { [weak self] errorDesc in
            self?.channel.invokeMethod("onError", arguments: ["description": errorDesc])
        }
        goatView.onAppServiceReady = { [weak self] appId in
            self?.channel.invokeMethod("onAppServiceReady", arguments: ["appId": appId])
        }
        goatView.onAppServiceCrash = { [weak self] appId, error in
            self?.channel.invokeMethod("onAppServiceCrash", arguments: ["appId": appId, "error": error])
        }
        goatView.onAppServiceTerminate = { [weak self] appId in
            self?.channel.invokeMethod("onAppServiceTerminate", arguments: ["appId": appId])
        }

        // T7 compat: off unless a compat consumer explicitly sets these creation params.
        if let resolver = creationParams?["compatExternalSchemeResolver"] as? Bool {
            goatView.compatExternalSchemeResolver = resolver
        }
        if let allow = creationParams?["hostDomainAllowlist"] as? [String] {
            let hosts = Set(allow.filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty })
            if !hosts.isEmpty { goatView.hostDomainAllowlist = hosts }
        }
        if let hosts = creationParams?["compatExternalLinkHosts"] as? [String] {
            goatView.compatExternalLinkHosts = Set(hosts)
        }
        goatView.onExternalNavigation = { [weak self] url in
            DispatchQueue.main.async { self?.channel.invokeMethod("onExternalNavigation", arguments: url) }
        }

        // T8 compat (G7): only assigned when the widget says the Dart side supplied that
        // handler -- left nil (GoatView's default), the delegate methods skip the work.
        // onLoadResource/onUpdateVisitedHistory have no WKWebView primitive on iOS.
        if creationParams?["enableOnReceivedError"] as? Bool == true {
            goatView.onReceivedErrorCompat = { [weak self] url, errorCode, description in
                self?.channel.invokeMethod("onReceivedError", arguments: [
                    "url": url, "errorCode": errorCode, "description": description
                ])
            }
        }
        if creationParams?["enableOnReceivedHttpError"] as? Bool == true {
            goatView.onReceivedHttpErrorCompat = { [weak self] url, statusCode in
                self?.channel.invokeMethod("onReceivedHttpError", arguments: ["url": url, "statusCode": statusCode])
            }
        }
        if creationParams?["enableOnPageCommitVisible"] as? Bool == true {
            goatView.onPageCommitVisibleCompat = { [weak self] url in
                self?.channel.invokeMethod("onPageCommitVisible", arguments: url)
            }
        }
        if creationParams?["enableOnConsoleMessage"] as? Bool == true {
            goatView.onConsoleMessageCompat = { [weak self] message, level in
                self?.channel.invokeMethod("onConsoleMessage", arguments: ["message": message, "messageLevel": level])
            }
        }

        // T9 compat: off unless requested. When on but no custom-refresh callback is wired,
        // pulling to refresh does a plain native reload() -- zero Dart round-trip.
        if creationParams?["pullToRefreshEnabled"] as? Bool == true {
            goatView.pullToRefreshEnabled = true
            if creationParams?["enableOnPullToRefresh"] as? Bool == true {
                goatView.onPullToRefresh = { [weak self] in
                    self?.channel.invokeMethod("onPullToRefresh", arguments: nil)
                }
            }
        }

        goatView.onBridgeAction = { [weak self] action, payload in
            self?.channel.invokeMethod("onBridgeMessage", arguments: [
                "action": action,
                "payload": payload
            ])
            guard let self = self else {
                throw NSError(domain: "GoatWebView", code: -1, userInfo: [NSLocalizedDescriptionKey: "PlatformView disposed"])
            }
            return try await self.goatView.executeAction(action, payload: payload)
        }

        channel.setMethodCallHandler { [weak self] call, result in
            self?.handle(call, result: result)
        }

        let initialUrl = (creationParams?["initialUrl"] as? String)?.trimmingCharacters(in: .whitespaces)
        let userScripts = (creationParams?["initialUserScripts"] as? [String]) ?? []
        goatView.initialize(appId: appId,
                            initialUrl: (initialUrl?.isEmpty == false) ? initialUrl : nil,
                            userScripts: userScripts)
    }

    func view() -> UIView {
        goatView
    }

    private func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        let args = call.arguments as? [String: Any]

        switch call.method {
        case "evaluateJavascript":
            let script = args?["script"] as? String ?? ""
            goatView.evaluateJavascript(script) { value, _ in
                result(value.map { "\($0)" })
            }

        case "executeAction":
            let action = args?["action"] as? String ?? ""
            let payload = args?["payload"] as? [String: Any] ?? [:]

            Task { [weak self] in
                guard let self = self else { return }
                do {
                    let data = try await self.goatView.executeAction(action, payload: payload)
                    DispatchQueue.main.async {
                        result([
                            "id": "req_flutter_\(Date().timeIntervalSince1970)",
                            "success": true,
                            "data": data,
                            "error": NSNull()
                        ])
                    }
                } catch {
                    DispatchQueue.main.async {
                        result([
                            "id": "req_flutter_\(Date().timeIntervalSince1970)",
                            "success": false,
                            "data": NSNull(),
                            "error": error.localizedDescription
                        ])
                    }
                }
            }

        case "callJs":
            let action = args?["action"] as? String ?? ""
            let payload = args?["payload"] as? [String: Any] ?? [:]
            let actionEscaped = (try? JSONSerialization.data(withJSONObject: [action]))
                .flatMap { String(data: $0, encoding: .utf8) } ?? "[\"\"]"
            let actionClean = String(actionEscaped.dropFirst().dropLast())
            let payloadJson = (try? JSONSerialization.data(withJSONObject: payload))
                .flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
            let script = """
            (function() {
              if (window.nativeBridge) {
                window.dispatchEvent(new CustomEvent('native_call', {
                  detail: { action: \(actionClean), payload: \(payloadJson) }
                }));
              }
            })();
            """
            goatView.evaluateJavascript(script) { _, _ in
                result(["id": "req_flutter", "success": true])
            }

        case "setTheme":
            let isDark = args?["isDark"] as? Bool ?? true
            goatView.evaluateJavascript("document.documentElement.classList.toggle('dark', \(isDark));") { _, _ in
                result(true)
            }

        case "prewarm":
            result(true)

        case "openMiniApp":
            let url = (args?["url"] as? String) ?? ""
            if !url.isEmpty { goatView.switchMiniApp(url) }
            result(!url.isEmpty)

        case "goBack":
            let canBack = goatView.canGoBack()
            if canBack { goatView.goBack() }
            result(canBack)

        case "reload":
            goatView.reload()
            result(nil)

        case "getUrl":
            result(goatView.getUrl())

        case "getTitle":
            result(goatView.getTitle())

        case "canGoForward":
            result(goatView.canGoForward())

        case "goForward":
            goatView.goForward()
            result(nil)

        case "getCopyBackForwardList":
            result(goatView.getCopyBackForwardList())

        case "loadUrl":
            let url = (args?["url"] as? String) ?? ""
            if !url.isEmpty { goatView.loadUrl(url) }
            result(!url.isEmpty)

        case "pause":
            goatView.pause()
            result(true)

        case "resume":
            goatView.resume()
            result(true)

        case "setRefreshing":
            let refreshing = args?["refreshing"] as? Bool ?? false
            goatView.setRefreshing(refreshing)
            result(true)

        case "isRefreshing":
            result(goatView.isRefreshing)

        case "setPopupRoutingPolicy":
            let policyStr = args?["policy"] as? String
            goatView.popupRoutingPolicy = GoatPopupRoutingPolicy(from: policyStr)
            result(nil)

        default:
            result(FlutterMethodNotImplemented)
        }
    }

    deinit {
        channel.setMethodCallHandler(nil)
        goatView.destroy()
    }
}

private func assetBundleNameWithoutExtension(_ name: String) -> String {
    (name as NSString).deletingPathExtension
}
