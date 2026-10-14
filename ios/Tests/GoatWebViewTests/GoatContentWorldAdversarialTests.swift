#if os(iOS)
import XCTest
import WebKit
@testable import GoatWebView

@MainActor
final class GoatContentWorldAdversarialTests: XCTestCase {

    private func makeHermeticGoatView(
        html: String = "<html><body><div id='app'>test</div></body></html>",
        setup: ((GoatView) -> Void)? = nil
    ) async -> (GoatView, GoatWKWebView) {
        let view = GoatView(frame: CGRect(x: 0, y: 0, width: 375, height: 667))
        setup?(view)
        view.initialize(appId: "adversarial_tenant", initialUrl: "about:blank")

        let loaded = expectation(description: "HTML loaded")
        let nav = TestNavDelegate { loaded.fulfill() }
        view.webView?.navigationDelegate = nav
        view.webView?.loadHTMLString(html, baseURL: URL(string: "goat://adversarial_tenant/index.html")!)
        await fulfillment(of: [loaded], timeout: 10.0)

        return (view, view.webView!)
    }

    private func evaluateJS(_ js: String, on webView: WKWebView) async throws -> Any? {
        try await webView.evaluateJavaScript(js)
    }

    private func callAsyncJS(_ jsBody: String, on webView: WKWebView) async throws -> Any? {
        try await webView.callAsyncJavaScript(jsBody, arguments: [:], in: nil, contentWorld: .page)
    }

    // =========================================================================
    // 1. Script Message Handler Concealment (.page Isolation)
    // =========================================================================

    func testNativeBridgeHandlerNotDirectlyAccessibleInPageWorld() async throws {
        let (_, webView) = await makeHermeticGoatView()

        let script = """
        (function () {
          return {
            hasWebkit: typeof window.webkit !== 'undefined',
            hasHandlers: !!(window.webkit && window.webkit.messageHandlers),
            hasNativeBridge: !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeBridge),
            hasGoatBridge: !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.goatBridge),
            hasGoatConsole: !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.goatConsole)
          };
        })()
        """
        guard let dict = try await evaluateJS(script, on: webView) as? [String: Any] else {
            XCTFail("Script evaluation returned unexpected format")
            return
        }

        XCTAssertFalse(dict["hasNativeBridge"] as? Bool ?? true, "nativeBridge MUST NOT be accessible in .page")
        XCTAssertFalse(dict["hasGoatBridge"] as? Bool ?? true, "goatBridge MUST NOT be accessible in .page")
        XCTAssertFalse(dict["hasGoatConsole"] as? Bool ?? true, "goatConsole MUST NOT be accessible in .page")
    }

    func testAttemptToHookMessageHandlersThrowsOrFailsInPage() async throws {
        let (_, webView) = await makeHermeticGoatView()

        let script = """
        (function () {
          try {
            window.webkit.messageHandlers.nativeBridge.postMessage = function () { return 'hacked'; };
            return 'hooked_unexpectedly';
          } catch (e) {
            return 'blocked_' + e.name;
          }
        })()
        """
        let result = try await evaluateJS(script, on: webView) as? String
        XCTAssertTrue(result?.starts(with: "blocked_") == true, "Attempting to hook handler must fail or throw: \(result ?? "")")
    }

    // =========================================================================
    // 2. Immutable, Frozen Proxy Verification
    // =========================================================================

    func testWindowGoatBridgeProxyIsFrozenAndImmutable() async throws {
        let (_, webView) = await makeHermeticGoatView()

        let script = """
        (function () {
          var results = {};
          results.exists = typeof window.GoatBridge !== 'undefined';
          results.isFrozen = Object.isFrozen(window.GoatBridge);
          results.postMessageFrozen = Object.isFrozen(window.GoatBridge.postMessage);
          results.addEventListenerFrozen = Object.isFrozen(window.GoatBridge.addEventListener);
          results.removeEventListenerFrozen = Object.isFrozen(window.GoatBridge.removeEventListener);
          results.callFrozen = Object.isFrozen(window.GoatBridge.call);

          // Test assignment mutation attempt
          try {
            window.GoatBridge.postMessage = function () { return 'mutated'; };
          } catch (e) {
            results.assignmentThrew = true;
          }
          results.postMessageUnchanged = typeof window.GoatBridge.postMessage === 'function';

          // Test property addition attempt
          try {
            window.GoatBridge.maliciousProperty = 'injected';
          } catch (e) {}
          results.noInjectedProperty = typeof window.GoatBridge.maliciousProperty === 'undefined';

          // Test deletion attempt
          try {
            delete window.GoatBridge;
          } catch (e) {}
          results.stillExists = typeof window.GoatBridge !== 'undefined';

          return results;
        })()
        """
        guard let dict = try await evaluateJS(script, on: webView) as? [String: Any] else {
            XCTFail("Proxy inspection script returned invalid format")
            return
        }

        XCTAssertTrue(dict["exists"] as? Bool ?? false, "window.GoatBridge must exist")
        XCTAssertTrue(dict["isFrozen"] as? Bool ?? false, "window.GoatBridge must be frozen")
        XCTAssertTrue(dict["postMessageFrozen"] as? Bool ?? false, "postMessage must be frozen")
        XCTAssertTrue(dict["addEventListenerFrozen"] as? Bool ?? false, "addEventListener must be frozen")
        XCTAssertTrue(dict["removeEventListenerFrozen"] as? Bool ?? false, "removeEventListener must be frozen")
        XCTAssertTrue(dict["callFrozen"] as? Bool ?? false, "call must be frozen")
        XCTAssertTrue(dict["noInjectedProperty"] as? Bool ?? false, "Cannot add properties to frozen proxy")
        XCTAssertTrue(dict["stillExists"] as? Bool ?? false, "Cannot delete window.GoatBridge")
    }

    func testWindowNativeBridgeProxyAliasIsAlsoFrozenAndImmutable() async throws {
        let (_, webView) = await makeHermeticGoatView()

        let script = """
        (function () {
          return {
            exists: typeof window.nativeBridge !== 'undefined',
            isFrozen: Object.isFrozen(window.nativeBridge),
            postMessageFrozen: Object.isFrozen(window.nativeBridge.postMessage),
            isSameAsGoatBridge: window.nativeBridge === window.GoatBridge
          };
        })()
        """
        guard let dict = try await evaluateJS(script, on: webView) as? [String: Any] else {
            XCTFail("nativeBridge check failed")
            return
        }

        XCTAssertTrue(dict["exists"] as? Bool ?? false)
        XCTAssertTrue(dict["isFrozen"] as? Bool ?? false)
        XCTAssertTrue(dict["postMessageFrozen"] as? Bool ?? false)
        XCTAssertTrue(dict["isSameAsGoatBridge"] as? Bool ?? false)
    }

    // =========================================================================
    // 3. Prototype Pollution Resilience
    // =========================================================================

    func testObjectPrototypePollutionDoesNotAlterBridgeExecution() async throws {
        var receivedAction: String?
        var receivedPayload: [String: Any]?

        let (view, webView) = await makeHermeticGoatView { view in
            view.onBridgeAction = { action, payload in
                receivedAction = action
                receivedPayload = payload
                return ["status": "ok", "echo_polluted": payload["polluted"] ?? "absent"]
            }
        }

        let jsBody = """
        Object.prototype.polluted = 'MALICIOUS_PROTOTYPE_INJECTION';
        Object.prototype.action = 'POISONED_ACTION';
        Object.prototype.id = 'POISONED_ID';

        return new Promise(function (resolve) {
          window.nativeBridge.addEventListener('message', function (e) {
            resolve(typeof e.data === 'string' ? JSON.parse(e.data) : e.data);
          });
          window.nativeBridge.postMessage(JSON.stringify({
            id: 'legit_req_101',
            action: 'LEGIT_ACTION',
            payload: { legitimateField: 'hello' }
          }));
        });
        """
        let reply = try await callAsyncJS(jsBody, on: webView) as? [String: Any]

        XCTAssertEqual(receivedAction, "LEGIT_ACTION", "Native received action must not be altered by Object.prototype.action")
        XCTAssertEqual(receivedPayload?["legitimateField"] as? String, "hello")
        XCTAssertEqual(reply?["id"] as? String, "legit_req_101", "Response id must match original request id")
        XCTAssertEqual(reply?["success"] as? Bool, true)
        _ = view
    }

    func testArrayPrototypeTamperingDoesNotBreakBridgeCalls() async throws {
        let (view, webView) = await makeHermeticGoatView { view in
            view.onBridgeAction = { action, payload in
                return ["count": 42]
            }
        }

        let jsBody = """
        Array.prototype.push = function () { throw new Error('Array.prototype.push is poisoned!'); };
        Array.prototype.slice = function () { return []; };
        Array.prototype.forEach = function () { throw new Error('forEach poisoned'); };

        return new Promise(function (resolve) {
          window.nativeBridge.addEventListener('message', function (e) {
            resolve(typeof e.data === 'string' ? JSON.parse(e.data) : e.data);
          });
          window.nativeBridge.postMessage(JSON.stringify({
            id: 'req_array_test',
            action: 'GET_COUNT',
            payload: {}
          }));
        });
        """
        let reply = try await callAsyncJS(jsBody, on: webView) as? [String: Any]
        XCTAssertEqual(reply?["id"] as? String, "req_array_test")
        XCTAssertEqual(reply?["success"] as? Bool, true)
        let data = reply?["data"] as? [String: Any]
        XCTAssertEqual(data?["count"] as? Int, 42)
        _ = view
    }

    func testJSONStringifyTamperingDoesNotAlterBridgePayload() async throws {
        var receivedAction: String?

        let (view, webView) = await makeHermeticGoatView { view in
            view.onBridgeAction = { action, payload in
                receivedAction = action
                return ["received": true]
            }
        }

        let jsBody = """
        window.JSON.stringify = function (val) {
          return '{"id":"tampered","action":"MALICIOUS_REDIRECT","payload":{}}';
        };

        return new Promise(function (resolve) {
          window.GoatBridge.call('GENUINE_ACTION', { safe: true })
            .then(function (data) { resolve({ success: true, data: data }); })
            .catch(function (err) { resolve({ success: false, error: err.message }); });
        });
        """
        let reply = try await callAsyncJS(jsBody, on: webView) as? [String: Any]
        XCTAssertEqual(receivedAction, "GENUINE_ACTION", "Bridge call must use pristine stringify captured at document start")
        XCTAssertEqual(reply?["success"] as? Bool, true)
        let data = reply?["data"] as? [String: Any]
        XCTAssertEqual(data?["received"] as? Bool, true)
        _ = view
    }

    // =========================================================================
    // 4. Console Override Relay in Isolated World
    // =========================================================================

    func testConsoleRelayWorksInIsolatedWorldWithoutPageExposure() async throws {
        var receivedConsoleLog: (text: String, level: String)?
        let logExpectation = expectation(description: "Console log captured")

        let (view, webView) = await makeHermeticGoatView { view in
            view.onConsoleMessageCompat = { text, level in
                receivedConsoleLog = (text, level)
                logExpectation.fulfill()
            }
        }

        let script = """
        console.warn('Simulated sensitive message', 12345);
        """
        _ = try await evaluateJS(script, on: webView)
        await fulfillment(of: [logExpectation], timeout: 5.0)

        XCTAssertNotNil(receivedConsoleLog)
        XCTAssertTrue(receivedConsoleLog?.text.contains("Simulated sensitive message 12345") == true)
        XCTAssertEqual(receivedConsoleLog?.level, "warn")

        // Verify goatConsole handler is not in .page
        let concealmentScript = """
        (function () {
          return !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.goatConsole);
        })()
        """
        let hasGoatConsole = try await evaluateJS(concealmentScript, on: webView) as? Bool
        XCTAssertFalse(hasGoatConsole ?? true, "goatConsole message handler MUST NOT be exposed in .page")
        _ = view
    }
}

private final class TestNavDelegate: NSObject, WKNavigationDelegate {
    private let onFinish: () -> Void
    init(onFinish: @escaping () -> Void) { self.onFinish = onFinish }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { onFinish() }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { onFinish() }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { onFinish() }
}
#endif // os(iOS)
