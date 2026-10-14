import XCTest
import Foundation
#if canImport(UIKit)
import UIKit
#endif
@testable import GoatWebView

/// The iOS half of the compat adapter perf/RAM contract's
/// locally-verifiable pieces. This SPM test target has no companion "Runner.app" host project
/// (unlike the Android side's `bench/compat_size_check`), so a true cold/warm *app launch*
/// comparison across an engine-only vs. adapter-used variant — the literal "physical device in
/// CI" half of T12 — isn't wired up here. What XCTest performance metrics *can* measure without
/// a host app is construction/teardown cost and retained-heap behavior of `GoatView` itself,
/// which is what these two tests cover, following the same direct-`GoatView` pattern already
/// used by `GoatWebViewUITests.testGoatWebViewUIElementHierarchy`.
///
/// NOTE: written but not yet run on a simulator/device.
final class GoatCompatAdapterBenchmarkTests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    #if canImport(UIKit)
    /// Proxy for §4's "cold start" / "warm start" rows: cost of constructing and initializing one
    /// `GoatView`, the operation every mini-app mount pays.
    @MainActor
    func testGoatViewConstructionCost() throws {
        measure(metrics: [XCTClockMetric(), XCTMemoryMetric()]) {
            let view = GoatView(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
            view.initialize(appId: "compat-benchmark", initialRoute: "/")
            view.destroy()
        }
    }

    /// §4: "Retained heap after opening + disposing 100 mini-app instances ≤ baseline + 0 (no
    /// growth; G5) — native view pointers zero." Mirrors
    /// `GoatViewHeapRetentionTest.openAndDispose100Instances_leavesNoRetainedViews` on Android:
    /// weak-reference 100 create→destroy cycles, force autorelease-pool drains, assert nothing
    /// outlives its own iteration.
    @MainActor
    func testOpenAndDispose100Instances_leavesNoRetainedViews() throws {
        let instanceCount = 100
        var weakRefs: [() -> GoatView?] = []

        for i in 0..<instanceCount {
            autoreleasepool {
                let view = GoatView(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
                view.initialize(appId: "heap-retention-\(i)", initialRoute: "/")
                weak var weakView = view
                weakRefs.append { weakView }
                view.destroy()
            }
        }

        let stillReachable = weakRefs.filter { $0() != nil }.count
        XCTAssertEqual(
            stillReachable, 0,
            "Expected 0 retained GoatView instances after dispose, but \(stillReachable) of \(instanceCount) are still reachable"
        )
    }
    #endif
}
