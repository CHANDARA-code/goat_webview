#if os(iOS)
import XCTest
import Foundation
#if canImport(UIKit)
import UIKit
#endif
import WebKit
@testable import GoatWebView

@MainActor
final class GoatAdversarialSecurityTests: XCTestCase {

    private var tempDirectory: URL!
    private var storageManager: GoatStorageManager!
    private var suiteName: String!
    private var testUserDefaults: UserDefaults!

    override func setUp() {
        super.setUp()
        let uniqueDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("GoatAdversarialTests_\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: uniqueDir, withIntermediateDirectories: true)
        tempDirectory = uniqueDir

        suiteName = "GoatAdversarialTests_\(UUID().uuidString)"
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

    // MARK: - Dimension 1: Zip Slip & Path Traversal Attacks

    func testAdversarialAppIdTraversalAttacks() {
        let adversarialAppIds = [
            "../../malicious",
            "../sibling",
            "foo/../../bar",
            "foo\\..\\..\\bar",
            "/absolute/root",
            "\\windows\\style",
            "..",
            "...",
            "....",
            "app/sub",
            "app\\sub",
            "app/../app",
            "app%2e%2e%2f",
            "app\u{0000}nullbyte",
            "   ",
            ""
        ]

        for maliciousId in adversarialAppIds {
            do {
                let result = try GoatStorageManager.sanitizeIdentifier(maliciousId)
                // If it didn't throw, it must NOT contain traversal characters or slash
                XCTAssertFalse(result.contains(".."), "Sanitized appId must not contain ..: \(maliciousId) -> \(result)")
                XCTAssertFalse(result.contains("/"), "Sanitized appId must not contain /: \(maliciousId) -> \(result)")
                XCTAssertFalse(result.contains("\\"), "Sanitized appId must not contain \\: \(maliciousId) -> \(result)")
                XCTAssertFalse(result.isEmpty, "Sanitized appId must not be empty: \(maliciousId)")
            } catch {
                // Throwing a security violation or invalid identifier is the expected secure behavior
                XCTAssertTrue(error is GoatStorageError, "Error must be GoatStorageError: \(error)")
            }
        }
    }

    func testAdversarialRelativePathTraversalAttacks() async {
        let tenant = "tenant_victim"
        let attackPaths = [
            "../../secret.txt",
            "../../../etc/passwd",
            "docs/../../escape.txt",
            "docs/sub/../../../escape.txt",
            "/private/var/root/secret.txt",
            "//network/path/file.txt",
            "./../../evil.txt",
            "sub/./../../evil.txt"
        ]

        for attackPath in attackPaths {
            do {
                _ = try storageManager.resolveTenantPath(appId: tenant, relativePath: attackPath)
                XCTFail("Path traversal attack must throw security violation: \(attackPath)")
            } catch let error as GoatStorageError {
                switch error {
                case .securityViolation:
                    // Expected
                    break
                default:
                    XCTFail("Expected .securityViolation, got: \(error) for path: \(attackPath)")
                }
            } catch {
                XCTFail("Unexpected error type for path: \(attackPath): \(error)")
            }
        }
    }

    // MARK: - Dimension 2: Multi-Tenant Boundary Isolation

    func testMultiTenantKeyspaceAndFilesystemIsolation() async throws {
        let tenantA = "miniapp_ecommerce"
        let tenantB = "miniapp_banking"

        // 1. Tenant A writes sensitive data
        _ = try await storageManager.setValue(appId: tenantA, key: "session_token", value: "token_alpha_secret_999")
        _ = try await storageManager.writeFile(
            appId: tenantA,
            relativePath: "vault/credentials.json",
            data: Data("{\"pin\": 1234}".utf8)
        )

        // 2. Tenant B attempts to read Tenant A's keyspace directly using Tenant B's context
        let tokenFromB = try await storageManager.getValue(appId: tenantB, key: "session_token")
        XCTAssertNil(tokenFromB, "Tenant B must NOT access Tenant A's keyspace")

        // 3. Tenant B attempts to read Tenant A's file
        do {
            _ = try await storageManager.readFile(appId: tenantB, relativePath: "vault/credentials.json")
            XCTFail("Tenant B must NOT read Tenant A's files")
        } catch GoatStorageError.fileNotFound {
            // Expected: Tenant B does not have this file in its sandbox
        }

        // 4. Tenant B attempts path traversal into Tenant A's directory
        do {
            _ = try storageManager.resolveTenantPath(
                appId: tenantB,
                relativePath: "../../\(tenantA)/data/vault/credentials.json"
            )
            XCTFail("Tenant B must NOT break out into Tenant A via relative path traversal")
        } catch GoatStorageError.securityViolation {
            // Expected security violation
        }

        // 5. Tenant B writes to its own keyspace and file with identical key/name
        _ = try await storageManager.setValue(appId: tenantB, key: "session_token", value: "token_beta_clean_111")
        _ = try await storageManager.writeFile(
            appId: tenantB,
            relativePath: "vault/credentials.json",
            data: Data("{\"pin\": 9999}".utf8)
        )

        // 6. Verify Tenant A's data remains unmodified
        let tokenA = try await storageManager.getValue(appId: tenantA, key: "session_token")
        XCTAssertEqual(tokenA, "token_alpha_secret_999")
        let fileDataA = try await storageManager.readFile(appId: tenantA, relativePath: "vault/credentials.json")
        XCTAssertEqual(String(data: fileDataA, encoding: .utf8), "{\"pin\": 1234}")

        // 7. Verify Tenant B's data is distinct
        let tokenB = try await storageManager.getValue(appId: tenantB, key: "session_token")
        XCTAssertEqual(tokenB, "token_beta_clean_111")
        let fileDataB = try await storageManager.readFile(appId: tenantB, relativePath: "vault/credentials.json")
        XCTAssertEqual(String(data: fileDataB, encoding: .utf8), "{\"pin\": 9999}")

        // Cleanup
        _ = try await storageManager.purgeTenantData(appId: tenantA)
        _ = try await storageManager.purgeTenantData(appId: tenantB)
    }

    // MARK: - Dimension 3: Renderer Crash & Process Termination Recovery

    func testWebProcessTerminationHandlerRetryBudget() {
        var terminationNotified = 0
        let handler = GoatWebProcessTerminationHandler { _ in
            terminationNotified += 1
        }

        // Dummy mock WKWebView
        let config = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: config)

        // Simulate 3 crashes within budget
        handler.webViewWebContentProcessDidTerminate(webView)
        handler.webViewWebContentProcessDidTerminate(webView)
        handler.webViewWebContentProcessDidTerminate(webView)

        XCTAssertEqual(terminationNotified, 3)

        // 4th crash exceeds budget of 3
        handler.webViewWebContentProcessDidTerminate(webView)
        XCTAssertEqual(terminationNotified, 4)

        // Reset budget
        handler.resetRetryBudget()
        handler.webViewWebContentProcessDidTerminate(webView)
        XCTAssertEqual(terminationNotified, 5)
    }
}
#endif // os(iOS)
