#if os(iOS)
import XCTest
@testable import GoatWebView

final class GoatLifecycleManagerTests: XCTestCase {

    func testCompleteLifecycleTransitions() {
        let manager = GoatLifecycleManager()
        XCTAssertEqual(manager.state, .uninitialized)
        XCTAssertEqual(manager.state.description, "UNINITIALIZED")

        let launchOpts = GoatLaunchOptions(
            entryRoute: "/pages/home",
            queryParams: ["tab": "feed"],
            referrerInfo: ["appId": "host.superapp"],
            scene: 1001
        )

        XCTAssertTrue(manager.startLaunch(options: launchOpts))
        XCTAssertEqual(manager.state, .launching)
        XCTAssertEqual(manager.lastLaunchOptions?.entryRoute, "/pages/home")

        XCTAssertTrue(manager.enterForeground())
        XCTAssertEqual(manager.state, .foregroundActive)

        XCTAssertTrue(manager.enterBackground())
        XCTAssertEqual(manager.state, .backgroundPaused)

        XCTAssertTrue(manager.enterForeground())
        XCTAssertEqual(manager.state, .foregroundActive)

        XCTAssertTrue(manager.terminate())
        XCTAssertEqual(manager.state, .terminated)
    }

    func testInvalidTransitionsAreRejected() {
        let manager = GoatLifecycleManager()

        XCTAssertFalse(manager.enterForeground())
        XCTAssertEqual(manager.state, .uninitialized)

        XCTAssertFalse(manager.enterBackground())
        XCTAssertEqual(manager.state, .uninitialized)

        XCTAssertTrue(manager.startLaunch())
        XCTAssertFalse(manager.startLaunch())
        XCTAssertFalse(manager.enterBackground())

        XCTAssertTrue(manager.terminate())
        XCTAssertEqual(manager.state, .terminated)

        XCTAssertFalse(manager.startLaunch())
        XCTAssertFalse(manager.enterForeground())
        XCTAssertFalse(manager.enterBackground())
        XCTAssertFalse(manager.terminate())
    }

    func testMovingToBackgroundUnder10ms() {
        let manager = GoatLifecycleManager()
        _ = manager.startLaunch()
        _ = manager.enterForeground()

        let start = DispatchTime.now().uptimeNanoseconds
        let success = manager.enterBackground()
        let elapsedMs = Double(DispatchTime.now().uptimeNanoseconds - start) / 1_000_000.0

        XCTAssertTrue(success)
        XCTAssertEqual(manager.state, .backgroundPaused)
        XCTAssertLessThan(elapsedMs, 10.0)
    }

    func testLaunchOptionsDeliveredOnAppShow() {
        let manager = GoatLifecycleManager()
        var receivedPayload: [String: Any]?

        manager.addEventObserver(for: "ON_APP_SHOW") { payload in
            receivedPayload = payload
        }

        let launchOpts = GoatLaunchOptions(
            entryRoute: "/pages/checkout",
            queryParams: ["orderId": "9876"],
            referrerInfo: ["source": "campaign"],
            scene: 1089
        )

        _ = manager.startLaunch(options: launchOpts)
        _ = manager.enterForeground()

        XCTAssertNotNil(receivedPayload)
        XCTAssertEqual(receivedPayload?["entryRoute"] as? String, "/pages/checkout")
        XCTAssertEqual(receivedPayload?["queryParams"] as? [String: String], ["orderId": "9876"])
        XCTAssertEqual(receivedPayload?["referrerInfo"] as? [String: String], ["source": "campaign"])
        XCTAssertEqual(receivedPayload?["scene"] as? Int, 1089)
    }

    func testLifecycleObserverTracking() {
        final class TestObserver: GoatLifecycleObserver {
            var transitions: [(GoatLifecycleState, GoatLifecycleState)] = []
            func onStateChanged(from: GoatLifecycleState, to: GoatLifecycleState) {
                transitions.append((from, to))
            }
        }

        let manager = GoatLifecycleManager()
        let observer = TestObserver()
        manager.addObserver(observer)

        _ = manager.startLaunch()
        _ = manager.enterForeground()
        _ = manager.enterBackground()
        manager.removeObserver(observer)
        _ = manager.terminate()

        XCTAssertEqual(observer.transitions.count, 3)
        XCTAssertEqual(observer.transitions[0].0, .uninitialized)
        XCTAssertEqual(observer.transitions[0].1, .launching)
        XCTAssertEqual(observer.transitions[1].0, .launching)
        XCTAssertEqual(observer.transitions[1].1, .foregroundActive)
        XCTAssertEqual(observer.transitions[2].0, .foregroundActive)
        XCTAssertEqual(observer.transitions[2].1, .backgroundPaused)
    }

    func testEventHubDispatchesAllStandardEvents() {
        let manager = GoatLifecycleManager()
        var receivedEvents: [String: [String: Any]] = [:]

        let eventNames = [
            "ON_APP_SHOW", "onAppShow",
            "ON_APP_HIDE", "onAppHide",
            "ON_PAGE_SCROLL", "onPageScroll",
            "ON_MEMORY_WARNING", "onMemoryWarning",
            "ON_WINDOW_RESIZE", "onWindowResize"
        ]

        for name in eventNames {
            manager.addEventObserver(for: name) { payload in
                receivedEvents[name] = payload
            }
        }

        manager.dispatchAppShow(options: GoatLaunchOptions(entryRoute: "/home"))
        manager.dispatchAppHide()
        manager.dispatchPageScroll(scrollTop: 100, scrollLeft: 0, scrollHeight: 1000, scrollWidth: 400)
        manager.dispatchMemoryWarning(level: 80, memoryPressure: "critical")
        manager.dispatchWindowResize(width: 390, height: 844, windowWidth: 390, windowHeight: 844, orientation: "portrait")

        XCTAssertEqual(receivedEvents["ON_APP_SHOW"]?["entryRoute"] as? String, "/home")
        XCTAssertEqual(receivedEvents["onAppShow"]?["entryRoute"] as? String, "/home")
        XCTAssertNotNil(receivedEvents["ON_APP_HIDE"]?["timestamp"])
        XCTAssertNotNil(receivedEvents["onAppHide"]?["timestamp"])
        XCTAssertEqual(receivedEvents["ON_PAGE_SCROLL"]?["scrollTop"] as? Int, 100)
        XCTAssertEqual(receivedEvents["onPageScroll"]?["scrollTop"] as? Int, 100)
        XCTAssertEqual(receivedEvents["ON_MEMORY_WARNING"]?["level"] as? Int, 80)
        XCTAssertEqual(receivedEvents["onMemoryWarning"]?["memoryPressure"] as? String, "critical")
        XCTAssertEqual(receivedEvents["ON_WINDOW_RESIZE"]?["width"] as? Int, 390)
        XCTAssertEqual(receivedEvents["onWindowResize"]?["orientation"] as? String, "portrait")
    }

    func testScriptEvaluatorExecution() {
        let manager = GoatLifecycleManager()
        var evaluatedScripts: [String] = []

        manager.scriptEvaluator = { script in
            evaluatedScripts.append(script)
        }

        manager.dispatchAppHide()

        XCTAssertEqual(evaluatedScripts.count, 2)
        XCTAssertTrue(evaluatedScripts[0].contains("native_call"))
        XCTAssertTrue(evaluatedScripts[0].contains("ON_APP_HIDE"))
        XCTAssertTrue(evaluatedScripts[1].contains("onAppHide"))
    }
}
#endif // os(iOS)
