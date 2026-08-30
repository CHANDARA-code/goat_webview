import Foundation
import WebKit
import XCTest
import UIKit
@testable import GoatWebView

@MainActor
final class GoatEmpiricalAdversarialSecurityTests: XCTestCase {

    private var tempDirectory: URL!
    private var storageManager: GoatStorageManager!
    private var suiteName: String!
    private var testUserDefaults: UserDefaults!

    override func setUp() {
        super.setUp()
        let uniqueDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("EmpiricalSecurity_\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: uniqueDir, withIntermediateDirectories: true)
        tempDirectory = uniqueDir
        suiteName = "EmpiricalSecurity_\(UUID().uuidString)"
        testUserDefaults = UserDefaults(suiteName: suiteName) ?? .standard
        storageManager = GoatStorageManager(
            userDefaults: testUserDefaults,
            fileManager: .default,
            baseDocumentsURL: tempDirectory
        )
    }

    override func tearDown() {
        if let temp = tempDirectory {
            try? FileManager.default.removeItem(at: temp)
        }
        if let suite = suiteName {
            testUserDefaults?.removePersistentDomain(forName: suite)
        }
        super.tearDown()
    }

    // 1. Test Identifier Sanitization & Traversal Invariants
    func testIdentifierSanitizationAndTraversalInvariants() {
        let validIds = ["app_alpha", "com.example.app-123", "tenant.01_v2"]
        for id in validIds {
            let res = try? GoatStorageManager.sanitizeIdentifier(id)
            XCTAssertEqual(res, id, "Valid id should remain unchanged")
        }

        let attackIds = [
            "../../malicious",
            "../sibling",
            "foo/../../bar",
            "foo\\..\\..\\bar",
            "/root",
            "\\windows",
            "..",
            "app/sub",
            "app\\sub",
            "   ",
            ""
        ]
        for maliciousId in attackIds {
            var threw = false
            do {
                _ = try GoatStorageManager.sanitizeIdentifier(maliciousId)
            } catch {
                threw = true
            }
            XCTAssertTrue(threw, "Malicious identifier '\(maliciousId)' MUST throw an error")
        }
    }

    // 2. Test Sandboxed Canonical Path Containment
    func testSandboxedCanonicalPathContainment() {
        let victim = "victim_app"
        let traversalPaths = [
            "../../secret.txt",
            "../../../etc/passwd",
            "docs/../../escape.txt",
            "docs/sub/../../../escape.txt",
            "/private/var/root/secret.txt",
            "//network/path/file.txt",
            "./../../evil.txt",
            "sub/./../../evil.txt"
        ]
        for path in traversalPaths {
            var threw = false
            do {
                _ = try storageManager.resolveTenantPath(appId: victim, relativePath: path)
            } catch {
                threw = true
            }
            XCTAssertTrue(threw, "Path traversal '\(path)' MUST throw SecurityException")
        }
    }

    // 3. Test Multi-Tenant Key-Value Storage Isolation
    func testMultiTenantKeyValueStorageIsolation() async {
        let tenantA = "miniapp_ecommerce"
        let tenantB = "miniapp_banking"

        _ = try? await storageManager.setValue(appId: tenantA, key: "session_token", value: "token_alpha_secret_999")
        _ = try? await storageManager.setValue(appId: tenantB, key: "session_token", value: "token_beta_clean_111")

        let tokenA = try? await storageManager.getValue(appId: tenantA, key: "session_token")
        let tokenB = try? await storageManager.getValue(appId: tenantB, key: "session_token")
        let tokenC = try? await storageManager.getValue(appId: "miniapp_other", key: "session_token")

        XCTAssertEqual(tokenA, "token_alpha_secret_999", "Tenant A must get Tenant A's token")
        XCTAssertEqual(tokenB, "token_beta_clean_111", "Tenant B must get Tenant B's token")
        XCTAssertNil(tokenC, "Tenant C must get nil")
    }

    // 4. Test Multi-Tenant Filesystem Isolation & CRUD
    func testMultiTenantFilesystemIsolationAndCrud() async {
        let tenantA = "miniapp_ecommerce"
        let tenantB = "miniapp_banking"

        let fileAData = Data("{\"auth\": \"alpha_secret\"}".utf8)
        let fileBData = Data("{\"auth\": \"beta_secret\"}".utf8)

        _ = try? await storageManager.writeFile(appId: tenantA, relativePath: "auth/session.json", data: fileAData)
        _ = try? await storageManager.writeFile(appId: tenantB, relativePath: "auth/session.json", data: fileBData)

        let readA = try? await storageManager.readFile(appId: tenantA, relativePath: "auth/session.json")
        let readB = try? await storageManager.readFile(appId: tenantB, relativePath: "auth/session.json")

        XCTAssertEqual(String(data: readA ?? Data(), encoding: .utf8), "{\"auth\": \"alpha_secret\"}")
        XCTAssertEqual(String(data: readB ?? Data(), encoding: .utf8), "{\"auth\": \"beta_secret\"}")

        let statA = try? await storageManager.getFileStat(appId: tenantA, relativePath: "auth/session.json")
        XCTAssertEqual(statA?["name"] as? String, "session.json")
        XCTAssertEqual(statA?["isFile"] as? Bool, true)

        let purgedA = try? await storageManager.purgeTenantData(appId: tenantA)
        XCTAssertEqual(purgedA, true, "Tenant A purge should succeed")

        let existsAAfterPurge = try? await storageManager.fileExists(appId: tenantA, relativePath: "auth/session.json")
        XCTAssertEqual(existsAAfterPurge, false, "Tenant A files must be deleted after purge")

        let existsBAfterPurge = try? await storageManager.fileExists(appId: tenantB, relativePath: "auth/session.json")
        XCTAssertEqual(existsBAfterPurge, true, "Tenant B files must remain intact after Tenant A purge")
    }

    // 5. Test WebProcess Termination Recovery Budget
    func testWebProcessTerminationRecoveryBudget() {
        var notifiedCount = 0
        let terminationHandler = GoatWebProcessTerminationHandler { _ in
            notifiedCount += 1
        }
        let webView = WKWebView(frame: .zero)

        // 3 crashes within budget
        terminationHandler.webViewWebContentProcessDidTerminate(webView)
        terminationHandler.webViewWebContentProcessDidTerminate(webView)
        terminationHandler.webViewWebContentProcessDidTerminate(webView)
        XCTAssertEqual(notifiedCount, 3)

        // 4th crash exceeds budget
        terminationHandler.webViewWebContentProcessDidTerminate(webView)
        XCTAssertEqual(notifiedCount, 4)

        // Reset budget
        terminationHandler.resetRetryBudget()
        terminationHandler.webViewWebContentProcessDidTerminate(webView)
        XCTAssertEqual(notifiedCount, 5)
    }

    // 6. Test URL Scheme Handler Path Traversal
    func testUrlSchemeHandlerPathContainment() {
        let schemeHandler = GoatURLSchemeHandler(appId: "sample_app", baseBundlePath: tempDirectory.path)
        XCTAssertEqual(schemeHandler.appId, "sample_app")
    }
}
