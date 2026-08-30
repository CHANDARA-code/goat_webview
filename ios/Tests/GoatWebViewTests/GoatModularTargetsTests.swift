import XCTest
import GoatWebViewBiometrics
import GoatWebViewBluetooth
import GoatWebViewLocation
import GoatWebViewMedia
import GoatWebViewNetwork
import GoatWebViewScanner

final class GoatModularTargetsTests: XCTestCase {

    func testEveryFeatureTargetLinksItsDeclaredFrameworks() {
        XCTAssertTrue(GoatWebViewMediaFeature.isFullyLinked)
        XCTAssertTrue(GoatWebViewScannerFeature.isFullyLinked)
        XCTAssertTrue(GoatWebViewLocationFeature.isFullyLinked)
        XCTAssertTrue(GoatWebViewBiometricsFeature.isFullyLinked)
        XCTAssertTrue(GoatWebViewBluetoothFeature.isFullyLinked)
        XCTAssertTrue(GoatWebViewNetworkFeature.isFullyLinked)
    }

    func testFeatureTargetsDeclareTheSameFrameworksAsThePodspecSubspecs() {
        XCTAssertEqual(GoatWebViewMediaFeature.requiredFrameworks, ["AVFoundation", "MediaPlayer"])
        XCTAssertEqual(GoatWebViewScannerFeature.requiredFrameworks, ["Vision", "AVFoundation"])
        XCTAssertEqual(GoatWebViewLocationFeature.requiredFrameworks, ["CoreLocation", "MapKit"])
        XCTAssertEqual(GoatWebViewBiometricsFeature.requiredFrameworks, ["LocalAuthentication", "Security"])
        XCTAssertEqual(GoatWebViewBluetoothFeature.requiredFrameworks, ["CoreBluetooth", "CoreNFC"])
        XCTAssertEqual(GoatWebViewNetworkFeature.requiredFrameworks, ["Network"])
    }

    func testFeatureTargetsReExportCoreSoHostsNeedASingleImport() {
        let handler = GoatScriptMessageHandler(appId: "modular_target_tenant")
        XCTAssertNotNil(handler)
    }
}
