import XCTest
#if canImport(UIKit) && !os(watchOS)
import UIKit
#endif
@testable import GoatWebView

/// Task 10175, iOS side. Deliberately mirrors the Android test cases so the two platforms cannot
/// drift apart in behaviour without a test noticing.
final class GoatOrientationControllerTests: XCTestCase {

    override func setUp() {
        super.setUp()
        GoatOrientationController.shared.resetForTesting()
    }

    override func tearDown() {
        GoatOrientationController.shared.resetForTesting()
        super.tearDown()
    }

    func testParsesTheThreeDocumentedOrientations() {
        XCTAssertEqual(GoatOrientationController.normalize("portrait"), "portrait")
        XCTAssertEqual(GoatOrientationController.normalize("LANDSCAPE"), "landscape")
        XCTAssertEqual(GoatOrientationController.normalize("  Auto  "), "auto")
    }

    func testRejectsUnknownOrientations() {
        XCTAssertNil(GoatOrientationController.normalize("sideways"))
        XCTAssertNil(GoatOrientationController.normalize(""))
        XCTAssertNil(GoatOrientationController.normalize(nil))
    }

    func testNoLockIsActiveInitially() {
        XCTAssertNil(GoatOrientationController.shared.currentLock)
    }

    func testAutoClearsTheLockRatherThanRecordingOne() {
        GoatOrientationController.shared.setLock("landscape")
        XCTAssertEqual(GoatOrientationController.shared.currentLock, "landscape")

        GoatOrientationController.shared.setLock("auto")
        XCTAssertNil(GoatOrientationController.shared.currentLock)
    }

    func testAnInvalidOrientationLeavesTheExistingLockUntouched() {
        GoatOrientationController.shared.setLock("portrait")
        XCTAssertFalse(GoatOrientationController.shared.setLock("diagonal"))
        XCTAssertEqual(GoatOrientationController.shared.currentLock, "portrait")
    }

    func testReleaseToManifestDefaultDropsTheRuntimeLock() {
        GoatOrientationController.shared.rememberManifestDefault("portrait")
        GoatOrientationController.shared.setLock("landscape")
        XCTAssertEqual(GoatOrientationController.shared.currentLock, "landscape")

        GoatOrientationController.shared.releaseToManifestDefault()
        XCTAssertNil(GoatOrientationController.shared.currentLock)
        // The manifest default survives a route unmount -- only the runtime lock is dropped.
        XCTAssertEqual(GoatOrientationController.shared.effectiveOrientation, "portrait")
    }

    func testTeardownDropsTheLockSoItCannotLeakToTheNextMiniApp() {
        GoatOrientationController.shared.rememberManifestDefault("portrait")
        GoatOrientationController.shared.setLock("landscape")

        GoatOrientationController.shared.releaseToHost()

        XCTAssertNil(GoatOrientationController.shared.currentLock)
        // Teardown must also forget the manifest default, or the next mini-app would inherit the
        // previous one's orientation.
        XCTAssertEqual(GoatOrientationController.shared.effectiveOrientation, "auto")
    }

    #if canImport(UIKit) && !os(watchOS)
    func testSupportedOrientationsMaskFollowsTheEffectiveOrientation() {
        XCTAssertEqual(GoatOrientationController.shared.supportedInterfaceOrientations, .all)

        GoatOrientationController.shared.setLock("portrait")
        XCTAssertEqual(GoatOrientationController.shared.supportedInterfaceOrientations, .portrait)

        GoatOrientationController.shared.setLock("landscape")
        XCTAssertEqual(GoatOrientationController.shared.supportedInterfaceOrientations, .landscape)

        GoatOrientationController.shared.setLock("auto")
        XCTAssertEqual(GoatOrientationController.shared.supportedInterfaceOrientations, .all)
    }

    func testManifestDefaultDrivesTheMaskWhenNoRuntimeLockIsHeld() {
        GoatOrientationController.shared.rememberManifestDefault("landscape")
        XCTAssertNil(GoatOrientationController.shared.currentLock)
        XCTAssertEqual(GoatOrientationController.shared.supportedInterfaceOrientations, .landscape)
    }
    #endif
}
