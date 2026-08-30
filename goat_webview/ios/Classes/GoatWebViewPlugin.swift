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

        default:
            result(FlutterMethodNotImplemented)
        }
    }
}
