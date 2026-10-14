#if os(iOS)
import XCTest
import Foundation
#if canImport(UIKit)
import UIKit
#endif
@testable import GoatWebView

final class GoatStorageManagerTests: XCTestCase {

    private var tempDirectory: URL!
    private var storageManager: GoatStorageManager!
    private var secureStorageManager: GoatSecureStorageManager!
    private var suiteName: String!
    private var testUserDefaults: UserDefaults!

    override func setUp() {
        super.setUp()
        let uniqueDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("GoatStorageTests_\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: uniqueDir, withIntermediateDirectories: true)
        tempDirectory = uniqueDir

        suiteName = "GoatStorageTests_\(UUID().uuidString)"
        testUserDefaults = UserDefaults(suiteName: suiteName) ?? .standard

        storageManager = GoatStorageManager(
            userDefaults: testUserDefaults,
            fileManager: .default,
            baseDocumentsURL: tempDirectory
        )
        secureStorageManager = GoatSecureStorageManager()
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

    // MARK: - 1. Identifier Sanitization & Traversal Rejection

    func testSanitizeIdentifierValidAndInvalid() {
        // Valid identifiers
        XCTAssertEqual(try? GoatStorageManager.sanitizeIdentifier("app_alpha"), "app_alpha")
        XCTAssertEqual(try? GoatStorageManager.sanitizeIdentifier("com.example.app-123"), "com.example.app-123")
        XCTAssertEqual(try? GoatStorageManager.sanitizeIdentifier("tenant.01_v2"), "tenant.01_v2")

        // Blank identifier throws invalidIdentifier
        XCTAssertThrowsError(try GoatStorageManager.sanitizeIdentifier("")) { error in
            guard case GoatStorageError.invalidIdentifier = error else {
                XCTFail("Expected invalidIdentifier error, got: \(error)")
                return
            }
        }

        XCTAssertThrowsError(try GoatStorageManager.sanitizeIdentifier("   ")) { error in
            guard case GoatStorageError.invalidIdentifier = error else {
                XCTFail("Expected invalidIdentifier error, got: \(error)")
                return
            }
        }

        // Path traversal sequences throw securityViolation
        XCTAssertThrowsError(try GoatStorageManager.sanitizeIdentifier("../../malicious")) { error in
            guard case GoatStorageError.securityViolation = error else {
                XCTFail("Expected securityViolation error, got: \(error)")
                return
            }
        }

        XCTAssertThrowsError(try GoatStorageManager.sanitizeIdentifier("app/subpath")) { error in
            guard case GoatStorageError.securityViolation = error else {
                XCTFail("Expected securityViolation error, got: \(error)")
                return
            }
        }

        XCTAssertThrowsError(try GoatStorageManager.sanitizeIdentifier("app\\subpath")) { error in
            guard case GoatStorageError.securityViolation = error else {
                XCTFail("Expected securityViolation error, got: \(error)")
                return
            }
        }
    }

    // MARK: - 2. Directory Resolution & Partitioning

    func testTenantDataDirectoryResolution() throws {
        let defaultDir = try GoatStorageManager.getTenantDataDirectory(baseDocumentsURL: tempDirectory, appId: "default")
        XCTAssertTrue(defaultDir.path.contains("miniapp_data"))

        let tenantDir = try GoatStorageManager.getTenantDataDirectory(baseDocumentsURL: tempDirectory, appId: "tenant_alpha")
        XCTAssertTrue(tenantDir.path.contains("miniapps/tenant_alpha/data"))

        let ensuredDir = try storageManager.ensureTenantDataDirectory(appId: "tenant_beta")
        XCTAssertTrue(FileManager.default.fileExists(atPath: ensuredDir.path))
        XCTAssertTrue(ensuredDir.path.contains("miniapps/tenant_beta/data"))
    }

    // MARK: - 3. Key-Value Storage Isolation

    func testKeyValueStorageIsolation() async throws {
        let tenantA = "app_tenant_a"
        let tenantB = "app_tenant_b"

        // Set value in Tenant A
        let savedA = try await storageManager.setValue(appId: tenantA, key: "session_token", value: "token_alpha_123")
        XCTAssertTrue(savedA)

        // Set value in Tenant B with same key
        let savedB = try await storageManager.setValue(appId: tenantB, key: "session_token", value: "token_beta_456")
        XCTAssertTrue(savedB)

        // Read values back and assert isolation
        let readA = try await storageManager.getValue(appId: tenantA, key: "session_token")
        let readB = try await storageManager.getValue(appId: tenantB, key: "session_token")
        XCTAssertEqual(readA, "token_alpha_123")
        XCTAssertEqual(readB, "token_beta_456")

        // Tenant C reading same key gets nil
        let readC = try await storageManager.getValue(appId: "app_tenant_c", key: "session_token")
        XCTAssertNil(readC)

        // Remove from Tenant A
        let removedA = try await storageManager.removeValue(appId: tenantA, key: "session_token")
        XCTAssertTrue(removedA)

        // Tenant A is nil, Tenant B is still intact
        let readAAfterRemove = try await storageManager.getValue(appId: tenantA, key: "session_token")
        let readBAfterRemove = try await storageManager.getValue(appId: tenantB, key: "session_token")
        XCTAssertNil(readAAfterRemove)
        XCTAssertEqual(readBAfterRemove, "token_beta_456")

        // Clean up Tenant B
        _ = try await storageManager.clearValues(appId: tenantB)
    }

    // MARK: - 4. Sandboxed File System CRUD Operations

    func testFileCrudOperations() async throws {
        let tenant = "app_fs_test"
        let testString = "Hello Goat WebView Sandboxed FileSystem!"
        guard let testData = testString.data(using: .utf8) else {
            XCTFail("Failed encoding test string")
            return
        }

        // 1. Write file
        let writeSuccess = try await storageManager.writeFile(appId: tenant, relativePath: "docs/readme.txt", data: testData)
        XCTAssertTrue(writeSuccess)

        // 2. File exists
        let exists = try await storageManager.fileExists(appId: tenant, relativePath: "docs/readme.txt")
        XCTAssertTrue(exists)

        let missingExists = try await storageManager.fileExists(appId: tenant, relativePath: "docs/missing.txt")
        XCTAssertFalse(missingExists)

        // 3. Read file
        let readData = try await storageManager.readFile(appId: tenant, relativePath: "docs/readme.txt")
        XCTAssertEqual(String(data: readData, encoding: .utf8), testString)

        // 4. File stats
        let stat = try await storageManager.getFileStat(appId: tenant, relativePath: "docs/readme.txt")
        XCTAssertEqual(stat["name"] as? String, "readme.txt")
        XCTAssertEqual(stat["isFile"] as? Bool, true)
        XCTAssertEqual(stat["isDirectory"] as? Bool, false)
        XCTAssertEqual((stat["size"] as? UInt64) ?? 0, UInt64(testData.count))

        // 5. Copy file
        let copySuccess = try await storageManager.copyFile(
            appId: tenant,
            srcRelativePath: "docs/readme.txt",
            destRelativePath: "backup/readme_backup.txt"
        )
        XCTAssertTrue(copySuccess)
        let copyExists = try await storageManager.fileExists(appId: tenant, relativePath: "backup/readme_backup.txt")
        XCTAssertTrue(copyExists)

        // 6. List directory
        let docsList = try await storageManager.listDirectory(appId: tenant, relativePath: "docs")
        XCTAssertTrue(docsList.contains("readme.txt"))

        // 7. Make directory
        let mkdirSuccess = try await storageManager.makeDirectory(appId: tenant, relativePath: "new_folder/sub")
        XCTAssertTrue(mkdirSuccess)

        // 8. Delete file
        let deleteSuccess = try await storageManager.deleteFile(appId: tenant, relativePath: "docs/readme.txt")
        XCTAssertTrue(deleteSuccess)
        let existsAfterDelete = try await storageManager.fileExists(appId: tenant, relativePath: "docs/readme.txt")
        XCTAssertFalse(existsAfterDelete)

        // 9. Remove directory
        let rmdirSuccess = try await storageManager.removeDirectory(appId: tenant, relativePath: "backup")
        XCTAssertTrue(rmdirSuccess)
        let backupExists = try await storageManager.fileExists(appId: tenant, relativePath: "backup")
        XCTAssertFalse(backupExists)
    }

    // MARK: - 5. Path Traversal Containment Rejection

    func testPathTraversalSecurityGuard() async {
        let tenant = "app_security_check"

        // Directory traversal attempt outside sandbox
        XCTAssertThrowsError(try storageManager.resolveTenantPath(appId: tenant, relativePath: "../../escape.txt")) { error in
            guard case GoatStorageError.securityViolation = error else {
                XCTFail("Expected securityViolation for path traversal, got: \(error)")
                return
            }
        }

        XCTAssertThrowsError(try storageManager.resolveTenantPath(appId: tenant, relativePath: "../sibling_tenant/file.txt")) { error in
            guard case GoatStorageError.securityViolation = error else {
                XCTFail("Expected securityViolation for sibling traversal, got: \(error)")
                return
            }
        }

        // Absolute / system path breakout attempt
        XCTAssertThrowsError(try storageManager.resolveTenantPath(appId: tenant, relativePath: "/private/var/root/secret.txt")) { error in
            // Note: leading slashes are stripped and resolved relative, or if escaping thrown as securityViolation
        }
    }

    // MARK: - 6. Tenant Purge

    func testPurgeTenantData() async throws {
        let tenantPurge = "app_to_purge"
        let tenantKeep = "app_to_keep"

        // Populate tenantPurge
        _ = try await storageManager.setValue(appId: tenantPurge, key: "p_key", value: "p_val")
        _ = try await storageManager.writeFile(
            appId: tenantPurge,
            relativePath: "doc.txt",
            data: Data("purge data".utf8)
        )

        // Populate tenantKeep
        _ = try await storageManager.setValue(appId: tenantKeep, key: "k_key", value: "k_val")
        _ = try await storageManager.writeFile(
            appId: tenantKeep,
            relativePath: "doc.txt",
            data: Data("keep data".utf8)
        )

        // Purge tenantPurge
        let purged = try await storageManager.purgeTenantData(appId: tenantPurge)
        XCTAssertTrue(purged)

        // Verify tenantPurge is wiped
        let pVal = try await storageManager.getValue(appId: tenantPurge, key: "p_key")
        XCTAssertNil(pVal)
        let pFileExists = try await storageManager.fileExists(appId: tenantPurge, relativePath: "doc.txt")
        XCTAssertFalse(pFileExists)

        // Verify tenantKeep is intact
        let kVal = try await storageManager.getValue(appId: tenantKeep, key: "k_key")
        XCTAssertEqual(kVal, "k_val")
        let kFileExists = try await storageManager.fileExists(appId: tenantKeep, relativePath: "doc.txt")
        XCTAssertTrue(kFileExists)

        // Clean up tenantKeep
        _ = try await storageManager.purgeTenantData(appId: tenantKeep)
    }

    // MARK: - 7. Keychain Secure Storage Manager

    func testSecureStorageManagerServiceName() throws {
        let serviceDefault = try GoatSecureStorageManager.getServiceName(appId: "default")
        XCTAssertEqual(serviceDefault, "goat_secure_default")

        let serviceCustom = try GoatSecureStorageManager.getServiceName(appId: "app_fintech")
        XCTAssertEqual(serviceCustom, "goat_secure_app_fintech")

        XCTAssertThrowsError(try GoatSecureStorageManager.getServiceName(appId: "../../hacker"))
    }
}
#endif // os(iOS)
