import Flutter
import UIKit
import WebKit
import GoatWebView

/**
 * Main Flutter plugin registration for Goat WebView on iOS (Task 10165), mirroring
 * `GoatWebViewPlugin.kt` on Android: exposes the `com.goat.webview/global` method channel
 * (`prewarm`, `clearCache`, `getBundleVersion`) and registers the `GoatPlatformViewFactory`
 * that `GoatWebView` (`lib/src/goat_web_view_widget.dart`) mounts via `PlatformViewLink`.
 */
public class GoatWebViewPlugin: NSObject, FlutterPlugin {

    /// Kept alive for the process lifetime so `prewarm()` isn't deallocated the instant it
    /// finishes initializing, which would tear the `WKWebView` down before it actually warms up.
    private static var prewarmedView: GoatView?

    public static func register(with registrar: FlutterPluginRegistrar) {
        let channel = FlutterMethodChannel(name: "com.goat.webview/global", binaryMessenger: registrar.messenger())
        let instance = GoatWebViewPlugin()
        registrar.addMethodCallDelegate(instance, channel: channel)

        registrar.register(
            GoatPlatformViewFactory(messenger: registrar.messenger()),
            withId: "com.goat.webview/platform_view"
        )
    }

    public func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        switch call.method {
        case "setTheme":
            let map = (call.arguments as? [String: Any]) ?? [:]
            GoatThemeManager.shared.updateTheme { t in
                var n = t
                if let v = map["colorScheme"] as? String { n.colorScheme = v }
                if let v = map["bg_color"] as? String { n.bgColor = v }
                if let v = map["text_color"] as? String { n.textColor = v }
                if let v = map["hint_color"] as? String { n.hintColor = v }
                if let v = map["link_color"] as? String { n.linkColor = v }
                if let v = map["button_color"] as? String { n.buttonColor = v }
                if let v = map["button_text_color"] as? String { n.buttonTextColor = v }
                if let v = map["secondary_bg_color"] as? String { n.secondaryBgColor = v }
                if let v = map["header_bg_color"] as? String { n.headerBgColor = v }
                if let v = map["accent_text_color"] as? String { n.accentTextColor = v }
                if let v = map["section_bg_color"] as? String { n.sectionBgColor = v }
                if let v = map["section_header_text_color"] as? String { n.sectionHeaderTextColor = v }
                if let v = map["subtitle_text_color"] as? String { n.subtitleTextColor = v }
                if let v = map["destructive_text_color"] as? String { n.destructiveTextColor = v }
                return n
            }
            result(true)

        case "setColorScheme":
            let dark = ((call.arguments as? [String: Any])?["dark"] as? Bool) ?? false
            GoatThemeManager.shared.setColorScheme(dark: dark)
            result(true)

        case "getTheme":
            let t = GoatThemeManager.shared.current
            var out = Dictionary(uniqueKeysWithValues: t.toPairs())
            out["colorScheme"] = t.colorScheme
            result(out)

        case "setDesign":
            let map = (call.arguments as? [String: Any]) ?? [:]
            GoatDesignManager.shared.updateDesign { d in
                var n = d
                if let v = map["font_family"] as? String { n.fontFamily = v }
                if let v = map["font_size_base"] as? String { n.fontSizeBase = v }
                if let v = map["font_size_small"] as? String { n.fontSizeSmall = v }
                if let v = map["font_size_large"] as? String { n.fontSizeLarge = v }
                if let v = map["line_height"] as? String { n.lineHeight = v }
                if let v = map["spacing_unit"] as? String { n.spacingUnit = v }
                if let v = map["radius_small"] as? String { n.radiusSmall = v }
                if let v = map["radius_medium"] as? String { n.radiusMedium = v }
                if let v = map["radius_large"] as? String { n.radiusLarge = v }
                if let v = map["border_width"] as? String { n.borderWidth = v }
                if let v = map["elevation_low"] as? String { n.elevationLow = v }
                if let v = map["elevation_high"] as? String { n.elevationHigh = v }
                if let v = map["motion_fast"] as? String { n.motionFast = v }
                if let v = map["motion_normal"] as? String { n.motionNormal = v }
                if let v = map["motion_easing"] as? String { n.motionEasing = v }
                return n
            }
            result(true)

        case "getDesign":
            result(Dictionary(uniqueKeysWithValues: GoatDesignManager.shared.current.toPairs()))

        case "setDesignVerbose":
            let v = ((call.arguments as? [String: Any])?["verbose"] as? Bool) ?? false
            GoatThemeManager.shared.verbose = v
            GoatDesignManager.shared.verbose = v
            result(true)

        case "prewarm":
            DispatchQueue.main.async {
                let warm = GoatView(frame: CGRect(x: 0, y: 0, width: 1, height: 1))
                warm.initialize()
                Self.prewarmedView = warm
                result(true)
            }

        case "clearCache":
            let dataStore = WKWebsiteDataStore.default()
            let types = WKWebsiteDataStore.allWebsiteDataTypes()
            dataStore.fetchDataRecords(ofTypes: types) { records in
                dataStore.removeData(ofTypes: types, for: records) {
                    result(true)
                }
            }

        case "getBundleVersion":
            result("1.0.0-goat")

        // Cookies are partitioned per mini-app tenant (GoatCookieManager.dataStore(for:)), same as
        // every WKWebView goat creates — there is no single shared jar to clear "globally", so
        // these operate on the caller's appId (default "default"). Lazy: the tenant's
        // WKWebsiteDataStore is only resolved when one of these is first called, and only on
        // @MainActor — WKWebsiteDataStore(forIdentifier:) traps off the main thread.
        case "removeSessionCookies":
            let appId = (call.arguments as? [String: Any])?["appId"] as? String ?? "default"
            Task { @MainActor in
                let ok = (try? await GoatCookieManager.shared.removeSessionCookies(appId: appId)) ?? false
                result(ok)
            }

        case "deleteAllCookies":
            let appId = (call.arguments as? [String: Any])?["appId"] as? String ?? "default"
            Task { @MainActor in
                let ok = (try? await GoatCookieManager.shared.clearTenantCookies(appId: appId)) ?? false
                result(ok)
            }

        case "deleteCookies":
            let args = call.arguments as? [String: Any]
            let url = (args?["url"] as? String) ?? ""
            let name = (args?["name"] as? String) ?? ""
            let appId = (args?["appId"] as? String) ?? "default"
            if url.isEmpty || name.isEmpty {
                result(false)
            } else {
                Task { @MainActor in
                    let ok = (try? await GoatCookieManager.shared.deleteCookie(appId: appId, url: url, name: name)) ?? false
                    result(ok)
                }
            }

        default:
            result(FlutterMethodNotImplemented)
        }
    }
}
