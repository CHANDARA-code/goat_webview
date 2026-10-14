#if os(iOS)
import XCTest
@testable import GoatWebView

final class GoatManifestPolicyWiringTests: XCTestCase {

    private var tempDirs: [URL] = []

    override func tearDown() {
        tempDirs.forEach { try? FileManager.default.removeItem(at: $0) }
        tempDirs = []
        super.tearDown()
    }

    private func bundle(_ manifest: String?) -> URL {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("goat_manifest_\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        tempDirs.append(dir)
        if let manifest {
            try? manifest.write(to: dir.appendingPathComponent("manifest.json"),
                                atomically: true, encoding: .utf8)
        }
        return dir
    }

    func testAllowedDomainsAreReadFromTheBundleManifest() {
        let dir = bundle("""
        {"appId":"com.goat.x","version":"1.0.0",
         "security":{"allowedDomains":["api.example.com","*.cdn.example.com"]}}
        """)
        XCTAssertEqual(Set(GoatView.manifestAllowedDomains(assetDir: dir)),
                       ["api.example.com", "*.cdn.example.com"])
    }

    func testAManifestWithoutASecurityBlockYieldsEmpty() {
        let dir = bundle(#"{"appId":"com.goat.x","version":"1.0.0"}"#)
        XCTAssertTrue(GoatView.manifestAllowedDomains(assetDir: dir).isEmpty)
    }

    func testAbsentOrMalformedManifestYieldsEmptyRatherThanThrowing() {
        XCTAssertTrue(GoatView.manifestAllowedDomains(assetDir: bundle(nil)).isEmpty)
        XCTAssertTrue(GoatView.manifestAllowedDomains(assetDir: bundle("{ not json ")).isEmpty)
        XCTAssertTrue(GoatView.manifestAllowedDomains(assetDir: nil).isEmpty)
    }

    func testAPackagedBundleIsPinnedToItsOwnGoatOrigin() {
        XCTAssertEqual(
            GoatView.bridgeOrigins(appId: "tenant1", assetDir: bundle(nil), initialUrl: nil),
            ["goat://tenant1"]
        )
    }

    func testUrlModeIsPinnedToTheEntryUrlOrigin() {
        XCTAssertEqual(
            GoatView.bridgeOrigins(appId: "t", assetDir: nil,
                                   initialUrl: "https://merchant.example.com/shop?ref=1"),
            ["https://merchant.example.com"]
        )
    }

    func testAnUnusableEntryUrlFallsBackToMainFrameOnlyNotAllowAll() {
        for bad in [nil, "", "about:blank", "not a url"] {
            XCTAssertTrue(
                GoatView.bridgeOrigins(appId: "t", assetDir: nil, initialUrl: bad).isEmpty,
                "expected empty (main-frame-only) for \(String(describing: bad))"
            )
        }
    }

    func testTheWiredPolicyReachesTheHandler() {
        let dir = bundle("""
        {"appId":"com.goat.x","version":"1.0.0","security":{"allowedDomains":["api.example.com"]}}
        """)
        let view = GoatView()
        view.applyManifestSecurityPolicy(appId: "tenant1", assetDir: dir, initialUrl: nil)
        XCTAssertEqual(view.coreScriptMessageHandler.manifestDomainAllowlist, ["api.example.com"])
        XCTAssertEqual(view.coreScriptMessageHandler.allowedBridgeOrigins, ["goat://tenant1"])
    }

    func testHostOverrideWinsOverTheManifest() {
        let dir = bundle("""
        {"appId":"com.goat.x","version":"1.0.0","security":{"allowedDomains":["api.example.com"]}}
        """)
        let view = GoatView()
        view.hostDomainAllowlist = ["override.example.com"]
        view.applyManifestSecurityPolicy(appId: "tenant1", assetDir: dir, initialUrl: nil)
        XCTAssertEqual(view.coreScriptMessageHandler.manifestDomainAllowlist, ["override.example.com"])
    }
    /**
     * The one test that proves initialize() actually applies the policy. The others call
     * applyManifestSecurityPolicy directly, so they pass even if nothing calls it -- which is the
     * exact defect being fixed here (properties shipped with no assignment), and was verified by
     * deleting the call and watching them all still pass.
     */
    @MainActor
    func testInitializeAppliesTheManifestPolicy() {
        let dir = bundle("""
        {"appId":"com.goat.x","version":"1.0.0","security":{"allowedDomains":["api.example.com"]}}
        """)
        let view = GoatView()
        view.initialize(appId: "tenant1", assetDir: dir)

        XCTAssertEqual(view.coreScriptMessageHandler.manifestDomainAllowlist, ["api.example.com"],
                       "initialize() must read the bundle manifest into the bridge policy")
        XCTAssertEqual(view.coreScriptMessageHandler.allowedBridgeOrigins, ["goat://tenant1"],
                       "initialize() must pin the bridge to the packaged origin")
        XCTAssertFalse(view.coreScriptMessageHandler.allowsSubframeBridgeMessages,
                       "subframe bridge access must stay off by default")
    }

}
#endif // os(iOS)
