import Foundation
import WebKit
import GoatWebView
import React

/**
 * `RCTBridgeModule` exposing `TurboGoatWebViewSpec` (full 8-method specification)
 * to JavaScript on iOS (Task 10164), mirroring `GoatWebViewModule.kt` on Android so
 * `react-native-goat-webview/src/GoatBridge.ts`'s `GoatWebViewNativeModule` resolves identically
 * on both platforms.
 */
@objc(GoatWebViewModule)
public final class GoatWebViewModule: NSObject, RCTBridgeModule {

    /// Kept alive for the process lifetime so `prewarm()` has a warm `WKWebView` instance ready
    /// before the first `<GoatWebView />` mounts, matching the Android `WebViewWarmupManager` idea.
    private static var prewarmedView: GoatView?

    private let bridgeHandler = GoatScriptMessageHandler()

    private func getBridgeHandler(for appId: String?) -> GoatScriptMessageHandler {
        guard let appId = appId, !appId.isEmpty, appId != bridgeHandler.appId else {
            return bridgeHandler
        }
        return GoatScriptMessageHandler(appId: appId)
    }

    public static func moduleName() -> String! {
        "GoatWebViewModule"
    }

    public static func requiresMainQueueSetup() -> Bool {
        true
    }

    @objc(prewarm:rejecter:)
    public func prewarm(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            let warm = GoatView(frame: CGRect(x: 0, y: 0, width: 1, height: 1))
            warm.initialize()
            Self.prewarmedView = warm
            resolve(true)
        }
    }

    @objc(clearCache:rejecter:)
    public func clearCache(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            let dataStore = WKWebsiteDataStore.default()
            let types = WKWebsiteDataStore.allWebsiteDataTypes()
            dataStore.fetchDataRecords(ofTypes: types) { records in
                dataStore.removeData(ofTypes: types, for: records) {
                    resolve(true)
                }
            }
        }
    }

    @objc(getBundleVersion:rejecter:)
    public func getBundleVersion(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        resolve("1.0.0-goat")
    }

    @objc(executeAction:payload:appId:resolver:rejecter:)
    public func executeAction(
        _ action: String,
        payload: NSDictionary,
        appId: String?,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        let handler = getBridgeHandler(for: appId)
        let payloadDict = payload as? [String: Any] ?? [:]
        Task {
            do {
                let result = try await handler.dispatchDirect(action: action, payload: payloadDict)
                resolve(result as NSDictionary)
            } catch {
                reject("EXECUTE_ACTION_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc(triggerHaptic:style:notificationType:resolver:rejecter:)
    public func triggerHaptic(
        _ type: String?,
        style: String?,
        notificationType: String?,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        let payload: [String: Any] = [
            "type": type ?? "impact",
            "style": style ?? "medium",
            "notificationType": notificationType ?? "success"
        ]
        Task {
            do {
                let result = try await bridgeHandler.dispatchDirect(action: "HAPTIC_FEEDBACK", payload: payload)
                resolve(result as NSDictionary)
            } catch {
                reject("HAPTIC_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc(runHeadlessScript:appId:resolver:rejecter:)
    public func runHeadlessScript(
        _ script: String,
        appId: String?,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        let targetAppId = appId ?? "default"
        DispatchQueue.main.async {
            let headless = GoatHeadlessWebView(appId: targetAppId)
            Task { @MainActor in
                do {
                    let jsResult = try await headless.evaluateJavaScript(script)
                    let resultString: String
                    if let str = jsResult as? String {
                        resultString = str
                    } else if let jsResult = jsResult, !(jsResult is NSNull) {
                        if let data = try? JSONSerialization.data(withJSONObject: jsResult, options: []),
                           let jsonStr = String(data: data, encoding: .utf8) {
                            resultString = jsonStr
                        } else {
                            resultString = String(describing: jsResult)
                        }
                    } else {
                        resultString = ""
                    }
                    resolve(resultString)
                } catch {
                    reject("HEADLESS_SCRIPT_ERROR", error.localizedDescription, error)
                }
            }
        }
    }

    @objc(setNavBarState:appId:resolver:rejecter:)
    public func setNavBarState(
        _ state: NSDictionary,
        appId: String?,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        let handler = getBridgeHandler(for: appId)
        let stateDict = state as? [String: Any] ?? [:]
        Task {
            do {
                var handled = false
                if stateDict["backgroundColor"] != nil || stateDict["textColor"] != nil {
                    _ = try await handler.dispatchDirect(action: "SET_NAV_BAR_COLOR", payload: stateDict)
                    handled = true
                }
                if stateDict["title"] != nil || stateDict["subtitle"] != nil {
                    _ = try await handler.dispatchDirect(action: "SET_NAV_BAR_TITLE", payload: stateDict)
                    handled = true
                }
                if stateDict["progress"] != nil {
                    _ = try await handler.dispatchDirect(action: "SET_NAV_BAR_PROGRESS", payload: stateDict)
                    handled = true
                }
                if stateDict["left"] != nil || stateDict["right"] != nil {
                    _ = try await handler.dispatchDirect(action: "SET_NAV_BAR_BUTTONS", payload: stateDict)
                    handled = true
                }
                if !handled {
                    _ = try await handler.dispatchDirect(action: "SET_NAV_BAR_TITLE", payload: stateDict)
                }
                resolve(true)
            } catch {
                reject("NAV_BAR_STATE_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc(setBottomSheetState:appId:resolver:rejecter:)
    public func setBottomSheetState(
        _ state: NSDictionary,
        appId: String?,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        let handler = getBridgeHandler(for: appId)
        let stateDict = state as? [String: Any] ?? [:]
        Task {
            do {
                if stateDict["snapPoints"] != nil {
                    _ = try await handler.dispatchDirect(action: "SET_SHEET_SNAP_POINTS", payload: stateDict)
                } else if let expanded = stateDict["expanded"] as? Bool {
                    let action = expanded ? "EXPAND_BOTTOM_SHEET" : "COLLAPSE_BOTTOM_SHEET"
                    _ = try await handler.dispatchDirect(action: action, payload: stateDict)
                } else if let sheetState = stateDict["state"] as? String, sheetState.lowercased() == "collapsed" {
                    _ = try await handler.dispatchDirect(action: "COLLAPSE_BOTTOM_SHEET", payload: stateDict)
                } else {
                    _ = try await handler.dispatchDirect(action: "EXPAND_BOTTOM_SHEET", payload: stateDict)
                }
                resolve(true)
            } catch {
                reject("BOTTOM_SHEET_STATE_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc(notifyAppServiceReady:details:resolver:rejecter:)
    public func notifyAppServiceReady(
        _ appId: String?,
        details: NSDictionary?,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        let targetAppId = (appId?.isEmpty ?? true) ? "default" : appId!
        let handler = getBridgeHandler(for: targetAppId)
        var payload: [String: Any] = ["appId": targetAppId]
        if let details = details as? [String: Any] {
            payload["details"] = details
        }
        Task {
            do {
                _ = try await handler.dispatchDirect(action: "ON_APP_SERVICE_READY", payload: payload)
                resolve(true)
            } catch {
                reject("APP_SERVICE_READY_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc(notifyAppServiceCrash:error:resolver:rejecter:)
    public func notifyAppServiceCrash(
        _ appId: String?,
        error: String?,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        let targetAppId = (appId?.isEmpty ?? true) ? "default" : appId!
        let handler = getBridgeHandler(for: targetAppId)
        let payload: [String: Any] = ["appId": targetAppId, "error": error ?? "Unknown error"]
        Task {
            do {
                _ = try await handler.dispatchDirect(action: "ON_APP_SERVICE_CRASH", payload: payload)
                resolve(true)
            } catch {
                reject("APP_SERVICE_CRASH_ERROR", error.localizedDescription, error)
            }
        }
    }

    @objc(notifyAppServiceTerminate:resolver:rejecter:)
    public func notifyAppServiceTerminate(
        _ appId: String?,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        let targetAppId = (appId?.isEmpty ?? true) ? "default" : appId!
        let handler = getBridgeHandler(for: targetAppId)
        let payload: [String: Any] = ["appId": targetAppId]
        Task {
            do {
                _ = try await handler.dispatchDirect(action: "ON_APP_SERVICE_TERMINATE", payload: payload)
                resolve(true)
            } catch {
                reject("APP_SERVICE_TERMINATE_ERROR", error.localizedDescription, error)
            }
        }
    }
}
