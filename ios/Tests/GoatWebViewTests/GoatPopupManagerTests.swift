#if os(iOS)
import XCTest
import Foundation
import WebKit
#if canImport(UIKit)
#if canImport(UIKit)
import UIKit
#endif
#endif
@testable import GoatWebView

@MainActor
final class GoatPopupManagerTests: XCTestCase {

    override func setUp() {
        super.setUp()
        GoatExternalLinkWarningDialog.clearAllSessionOptOuts()
        GoatAbuseGuard.shared.reset()
        GoatEventCoalescer.shared.reset()
    }

    override func tearDown() {
        GoatExternalLinkWarningDialog.clearAllSessionOptOuts()
        GoatAbuseGuard.shared.reset()
        GoatEventCoalescer.shared.reset()
        super.tearDown()
    }

    // MARK: - 1. Routing Policy Enum & Parsing Tests

    func testGoatPopupRoutingPolicyValuesAndParsing() {
        XCTAssertEqual(GoatPopupRoutingPolicy.auto.rawValue, "AUTO")
        XCTAssertEqual(GoatPopupRoutingPolicy.systemBrowser.rawValue, "SYSTEM_BROWSER")
        XCTAssertEqual(GoatPopupRoutingPolicy.modal.rawValue, "MODAL")
        XCTAssertEqual(GoatPopupRoutingPolicy.sameFrame.rawValue, "SAME_FRAME")
        XCTAssertEqual(GoatPopupRoutingPolicy.block.rawValue, "BLOCK")

        // Case insensitivity and variants
        XCTAssertEqual(GoatPopupRoutingPolicy(from: "auto"), .auto)
        XCTAssertEqual(GoatPopupRoutingPolicy(from: "AUTO"), .auto)
        XCTAssertEqual(GoatPopupRoutingPolicy(from: "systemBrowser"), .systemBrowser)
        XCTAssertEqual(GoatPopupRoutingPolicy(from: "SYSTEM_BROWSER"), .systemBrowser)
        XCTAssertEqual(GoatPopupRoutingPolicy(from: "modal"), .modal)
        XCTAssertEqual(GoatPopupRoutingPolicy(from: "MODAL"), .modal)
        XCTAssertEqual(GoatPopupRoutingPolicy(from: "sameFrame"), .sameFrame)
        XCTAssertEqual(GoatPopupRoutingPolicy(from: "SAME_FRAME"), .sameFrame)
        XCTAssertEqual(GoatPopupRoutingPolicy(from: "block"), .block)
        XCTAssertEqual(GoatPopupRoutingPolicy(from: "CANCEL"), .block)
        XCTAssertEqual(GoatPopupRoutingPolicy(from: "REJECT"), .block)
        XCTAssertEqual(GoatPopupRoutingPolicy(from: nil), .auto)
        XCTAssertEqual(GoatPopupRoutingPolicy(from: "unknown_random_value"), .auto)

        // Codable serialization roundtrip
        let encoder = JSONEncoder()
        let decoder = JSONDecoder()
        for policy in GoatPopupRoutingPolicy.allCases {
            guard let data = try? encoder.encode(policy),
                  let decoded = try? decoder.decode(GoatPopupRoutingPolicy.self, from: data) else {
                XCTFail("Failed to encode/decode policy: \(policy)")
                return
            }
            XCTAssertEqual(decoded, policy)
        }
    }

    // MARK: - 2. Window Features Model & Parsing Tests

    func testWindowFeaturesParsingFullFeatureString() {
        let featureStr = "width=480,height=640,left=100,top=150,resizable=yes,menubar=no,status=yes,toolbar=no,scrollbars=yes"
        let wf = GoatWindowFeatures.parse(featureString: featureStr)

        XCTAssertEqual(wf.width, 480.0)
        XCTAssertEqual(wf.height, 640.0)
        XCTAssertEqual(wf.x, 100.0)
        XCTAssertEqual(wf.y, 150.0)
        XCTAssertEqual(wf.resizable, true)
        XCTAssertEqual(wf.menuBar, false)
        XCTAssertEqual(wf.statusBar, true)
        XCTAssertEqual(wf.toolbars, false)
        XCTAssertEqual(wf.scrollbars, true)
    }

    func testWindowFeaturesParsingAlternateKeys() {
        let featureStr = "innerWidth=500,innerHeight=700,screenX=30,screenY=40,resizable=1,status=1"
        let wf = GoatWindowFeatures.parse(featureString: featureStr)

        XCTAssertEqual(wf.width, 500.0)
        XCTAssertEqual(wf.height, 700.0)
        XCTAssertEqual(wf.x, 30.0)
        XCTAssertEqual(wf.y, 40.0)
        XCTAssertEqual(wf.resizable, true)
        XCTAssertEqual(wf.statusBar, true)
    }

    func testWindowFeaturesParsingMalformedStringRecovery() {
        let featureStr = "width=invalid,height=-50,resizable=true"
        let wf = GoatWindowFeatures.parse(featureString: featureStr)

        XCTAssertNil(wf.width)
        XCTAssertNil(wf.height)
        XCTAssertEqual(wf.resizable, true)

        let config = wf.toWindowConfig(title: "Custom Popup")
        XCTAssertEqual(config.width, 360.0) // Fallback default
        XCTAssertEqual(config.height, 520.0) // Fallback default
        XCTAssertEqual(config.title, "Custom Popup")
        XCTAssertEqual(config.resizable, true)
    }

    func testWindowFeaturesDictionaryRoundtrip() {
        let original = GoatWindowFeatures(
            width: 400,
            height: 600,
            x: 50,
            y: 80,
            menuBar: false,
            statusBar: true,
            toolbars: false,
            resizable: true,
            scrollbars: true
        )
        let dict = original.toDictionary()
        let reconstructed = GoatWindowFeatures.fromDictionary(dict)

        XCTAssertEqual(reconstructed.width, 400.0)
        XCTAssertEqual(reconstructed.height, 600.0)
        XCTAssertEqual(reconstructed.x, 50.0)
        XCTAssertEqual(reconstructed.y, 80.0)
        XCTAssertEqual(reconstructed.menuBar, false)
        XCTAssertEqual(reconstructed.statusBar, true)
        XCTAssertEqual(reconstructed.toolbars, false)
        XCTAssertEqual(reconstructed.resizable, true)
        XCTAssertEqual(reconstructed.scrollbars, true)
    }

    // MARK: - 3. Popup Request Model Tests

    func testGoatPopupRequestModelAndSerialization() {
        let url = URL(string: "https://example.com/oauth/authorize")!
        let wf = GoatWindowFeatures(width: 450, height: 550)
        let request = GoatPopupRequest(
            url: url,
            target: "_blank",
            policy: .systemBrowser,
            isUserGesture: true,
            isDialog: false,
            windowFeatures: wf
        )

        let dict = request.toDictionary()
        XCTAssertEqual(dict["url"] as? String, "https://example.com/oauth/authorize")
        XCTAssertEqual(dict["target"] as? String, "_blank")
        XCTAssertEqual(dict["policy"] as? String, "SYSTEM_BROWSER")
        XCTAssertEqual(dict["isUserGesture"] as? Bool, true)
        XCTAssertEqual(dict["isDialog"] as? Bool, false)

        guard let parsed = GoatPopupRequest.fromDictionary(dict) else {
            XCTFail("Failed to deserialize GoatPopupRequest")
            return
        }

        XCTAssertEqual(parsed.url, url)
        XCTAssertEqual(parsed.target, "_blank")
        XCTAssertEqual(parsed.policy, .systemBrowser)
        XCTAssertEqual(parsed.isUserGesture, true)
        XCTAssertEqual(parsed.windowFeatures?.width, 450.0)
        XCTAssertEqual(parsed.windowFeatures?.height, 550.0)
    }

    // MARK: - 4. Origin Classification Tests

    func testOriginClassificationSameOrigin() {
        let manager = GoatPopupManager(appId: "finance_app")

        let sameAppUrl = URL(string: "goat://finance_app/assets/subpage.html")!
        XCTAssertEqual(manager.classifyOrigin(url: sameAppUrl), .modal)
        XCTAssertTrue(manager.isSameOrigin(url: sameAppUrl))

        let assetsUrl = URL(string: "goat://assets/index.html#details")!
        XCTAssertEqual(manager.classifyOrigin(url: assetsUrl), .modal)
        XCTAssertTrue(manager.isSameOrigin(url: assetsUrl))

        let relativeUrl = URL(string: "/details/payment.html")!
        XCTAssertEqual(manager.classifyOrigin(url: relativeUrl), .modal)
        XCTAssertTrue(manager.isSameOrigin(url: relativeUrl))

        let aboutUrl = URL(string: "about:blank")!
        XCTAssertEqual(manager.classifyOrigin(url: aboutUrl), .modal)
    }

    func testOriginClassificationCrossOrigin() {
        let manager = GoatPopupManager(appId: "finance_app")

        let httpsUrl = URL(string: "https://auth.provider.com/login")!
        XCTAssertEqual(manager.classifyOrigin(url: httpsUrl), .systemBrowser)
        XCTAssertFalse(manager.isSameOrigin(url: httpsUrl))

        let httpUrl = URL(string: "http://example.org/api")!
        XCTAssertEqual(manager.classifyOrigin(url: httpUrl), .systemBrowser)
        XCTAssertFalse(manager.isSameOrigin(url: httpUrl))
    }

    func testOriginClassificationCustomSystemSchemes() {
        let manager = GoatPopupManager(appId: "finance_app")

        let telUrl = URL(string: "tel:18005550199")!
        XCTAssertEqual(manager.classifyOrigin(url: telUrl), .systemBrowser)

        let mailUrl = URL(string: "mailto:support@goat.dev")!
        XCTAssertEqual(manager.classifyOrigin(url: mailUrl), .systemBrowser)

        let smsUrl = URL(string: "sms:+1234567890")!
        XCTAssertEqual(manager.classifyOrigin(url: smsUrl), .systemBrowser)

        let geoUrl = URL(string: "geo:37.7749,-122.4194")!
        XCTAssertEqual(manager.classifyOrigin(url: geoUrl), .systemBrowser)
    }

    func testOriginClassificationDangerousSchemesBlocked() {
        let manager = GoatPopupManager(appId: "finance_app")

        // Local file scheme
        let fileUrl = URL(string: "file:///etc/passwd")!
        XCTAssertEqual(manager.classifyOrigin(url: fileUrl), .block)

        let fileDbUrl = URL(string: "file:///var/mobile/Containers/Data/Application/app.db")!
        XCTAssertEqual(manager.classifyOrigin(url: fileDbUrl), .block)

        // JavaScript scheme
        let jsUrl = URL(string: "javascript:alert(document.cookie)")!
        XCTAssertEqual(manager.classifyOrigin(url: jsUrl), .block)

        // Cross-tenant navigation is blocked in popups
        let crossTenantUrl = URL(string: "goat://other_tenant/assets/secret.html")!
        XCTAssertEqual(manager.classifyOrigin(url: crossTenantUrl), .block)
        XCTAssertFalse(manager.isSameOrigin(url: crossTenantUrl))

        // Null byte injection
        let nullByteUrl = URL(string: "goat://finance_app%00/assets/bypass")!
        XCTAssertEqual(manager.classifyOrigin(url: nullByteUrl), .block)
    }

    // MARK: - 5. Host Policy Override Tests

    func testHostPolicyOverrideViaHook() {
        let goatView = GoatView(frame: CGRect(x: 0, y: 0, width: 375, height: 667))
        goatView.initialize(appId: "finance_app")

        var hookCalled = false
        goatView.onPopupRequest = { request in
            hookCalled = true
            XCTAssertEqual(request.url.absoluteString, "https://example.com/login")
            return .sameFrame // Override from SYSTEM_BROWSER to SAME_FRAME
        }

        let pm = goatView.popupManager
        XCTAssertNotNil(pm)

        let req = GoatPopupRequest(
            url: URL(string: "https://example.com/login")!,
            target: "_blank",
            policy: .systemBrowser
        )
        let overridden = goatView.onPopupRequest?(req)
        XCTAssertTrue(hookCalled)
        XCTAssertEqual(overridden, .sameFrame)
    }

    func testHostPolicyCannotOverrideBlockedDangerousSchemes() {
        let goatView = GoatView(frame: CGRect(x: 0, y: 0, width: 375, height: 667))
        goatView.initialize(appId: "finance_app")

        goatView.onPopupRequest = { _ in
            return .modal // Attempt to force file:// into modal
        }

        let pm = goatView.popupManager!
        let fileUrl = URL(string: "file:///etc/passwd")!
        let policy = pm.classifyOrigin(url: fileUrl)
        XCTAssertEqual(policy, .block)
    }

    // MARK: - 6. External Link Warning Dialog & Opt-Out Tests

    func testExternalLinkWarningDialogOptOutWorkflow() {
        let appId = "store_app"
        let host = "checkout.stripe.com"

        XCTAssertFalse(GoatExternalLinkWarningDialog.isDomainOptedOut(appId: appId, host: host))

        GoatExternalLinkWarningDialog.optOutDomainForSession(appId: appId, host: host)
        XCTAssertTrue(GoatExternalLinkWarningDialog.isDomainOptedOut(appId: appId, host: host))

        // Different tenant is not opted out (tenant isolation)
        XCTAssertFalse(GoatExternalLinkWarningDialog.isDomainOptedOut(appId: "other_app", host: host))

        // Clear tenant opt-out
        GoatExternalLinkWarningDialog.clearSessionOptOuts(appId: appId)
        XCTAssertFalse(GoatExternalLinkWarningDialog.isDomainOptedOut(appId: appId, host: host))
    }

    // MARK: - 7. Modal Lifecycle & Teardown Tests

    func testSameOriginModalPresentationAndTeardownLifecycle() {
        let goatView = GoatView(frame: CGRect(x: 0, y: 0, width: 375, height: 667))
        goatView.initialize(appId: "tenant_alpha")

        guard let pm = goatView.popupManager else {
            XCTFail("popupManager is nil")
            return
        }

        var createdCallbackFired = false
        var closedCallbackFired = false

        pm.onPopupCreated = { childView in
            createdCallbackFired = true
            XCTAssertEqual(childView.appId, "tenant_alpha")
        }

        pm.onPopupClosed = { _ in
            closedCallbackFired = true
        }

        let targetUrl = URL(string: "goat://tenant_alpha/assets/details.html#sub")!
        let windowConfig = GoatWindowConfig(width: 400, height: 500, title: "Alpha Modal")

        let childGoatView = GoatView(frame: .zero)
        childGoatView.initialize(appId: "tenant_alpha", initialRoute: "sub")

        let container = GoatWindowedContainer(
            targetAppId: "tenant_alpha",
            parentAppId: "tenant_alpha",
            config: windowConfig
        )
        container.embeddedView = childGoatView

        container.show(in: goatView)
        XCTAssertEqual(childGoatView.appId, "tenant_alpha")

        // Trigger teardown
        pm.closeActivePopup(dismissedByUser: false)
        XCTAssertNil(pm.activeModalContainer)
        XCTAssertNil(pm.activeChildGoatView)
    }

    func testParentGoatViewDestroyCascadesPopupTeardown() {
        let goatView = GoatView(frame: CGRect(x: 0, y: 0, width: 375, height: 667))
        goatView.initialize(appId: "tenant_beta")

        let pm = goatView.popupManager
        XCTAssertNotNil(pm)

        goatView.destroy()
        XCTAssertNil(goatView.underlyingWKWebView)
        XCTAssertNil(goatView.popupManager)
    }

    func testEventCoalescerEmitsPopupTelemetry() {
        let url = URL(string: "https://external.com/pay")!
        let req = GoatPopupRequest(
            url: url,
            target: "_blank",
            policy: .systemBrowser,
            isUserGesture: true,
            isDialog: false
        )

        var receivedEvent = false
        GoatEventCoalescer.shared.emit(
            eventKey: "ON_POPUP_REQUEST",
            payload: req.toDictionary()
        ) { eventKey, payload in
            receivedEvent = true
            XCTAssertEqual(eventKey, "ON_POPUP_REQUEST")
            XCTAssertEqual(payload["url"] as? String, "https://external.com/pay")
            XCTAssertEqual(payload["policy"] as? String, "SYSTEM_BROWSER")
            XCTAssertEqual(payload["isUserGesture"] as? Bool, true)
        }

        XCTAssertTrue(receivedEvent)
    }
}
#endif // os(iOS)
