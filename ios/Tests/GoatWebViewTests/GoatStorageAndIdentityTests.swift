import XCTest
import Foundation
import UIKit
@testable import GoatWebView

final class GoatStorageAndIdentityTests: XCTestCase {

    private var tempDirectory: URL!
    private var suiteName: String!
    private var testUserDefaults: UserDefaults!
    private var storageManager: GoatStorageManager!
    private var secureStorageManager: GoatSecureStorageManager!
    private var sandbox: GoatAccountScopedSandbox!

    override func setUp() {
        super.setUp()
        GoatConfig.shared.reset()

        let uniqueDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("GoatStorageAndIdentityTests_\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: uniqueDir, withIntermediateDirectories: true)
        tempDirectory = uniqueDir

        suiteName = "GoatIdentityTests_\(UUID().uuidString)"
        testUserDefaults = UserDefaults(suiteName: suiteName) ?? .standard

        sandbox = GoatAccountScopedSandbox(userDefaults: testUserDefaults)
        storageManager = GoatStorageManager(
            userDefaults: testUserDefaults,
            fileManager: .default,
            baseDocumentsURL: tempDirectory
        )
        secureStorageManager = GoatSecureStorageManager()
    }

    override func tearDown() {
        GoatConfig.shared.reset()
        if let temp = tempDirectory {
            try? FileManager.default.removeItem(at: temp)
        }
        if let suite = suiteName {
            testUserDefaults?.removePersistentDomain(forName: suite)
        }
        super.tearDown()
    }

    // MARK: - 1. Prefix and Path Resolution

    func testScopedPreferencesPrefixResolution() throws {
        // Without active account -> goat_storage_{appId}_
        let unScopedPrefix = try sandbox.getScopedPreferencesPrefix(appId: "app_shop")
        XCTAssertEqual(unScopedPrefix, "goat_storage_app_shop_")

        // With explicit accountId
        let scopedPrefix = try sandbox.getScopedPreferencesPrefix(appId: "app_shop", accountId: "user_alice")
        XCTAssertEqual(scopedPrefix, "goat_storage_app_shop_user_alice_")

        // Via active accountProvider in GoatConfig
        GoatConfig.shared.accountProvider = { "user_bob" }
        let dynamicPrefix = try GoatStorageManager.getPreferencesPrefix(appId: "app_shop")
        XCTAssertEqual(dynamicPrefix, "goat_storage_app_shop_user_bob_")

        // Reset accountProvider -> fallback to un-scoped
        GoatConfig.shared.reset()
        let resetPrefix = try GoatStorageManager.getPreferencesPrefix(appId: "app_shop")
        XCTAssertEqual(resetPrefix, "goat_storage_app_shop_")
    }

    func testScopedDataDirectoryResolution() throws {
        // Without active account -> base/miniapps/{appId}/data/
        let unScopedDir = try sandbox.getScopedDataDirectory(baseDocumentsURL: tempDirectory, appId: "app_crm")
        XCTAssertEqual(unScopedDir.path, tempDirectory.appendingPathComponent("miniapps/app_crm/data").path)

        // Default app without account -> base/miniapp_data
        let defaultUnScopedDir = try sandbox.getScopedDataDirectory(baseDocumentsURL: tempDirectory, appId: "default")
        XCTAssertEqual(defaultUnScopedDir.path, tempDirectory.appendingPathComponent("miniapp_data").path)

        // With active account in GoatConfig -> base/miniapps/{appId}/{accountId}/data/
        GoatConfig.shared.accountProvider = { "acc_finance_1" }
        let scopedDir = try GoatStorageManager.getTenantDataDirectory(baseDocumentsURL: tempDirectory, appId: "app_crm")
        XCTAssertEqual(scopedDir.path, tempDirectory.appendingPathComponent("miniapps/app_crm/acc_finance_1/data").path)

        // Default app with active account -> base/miniapp_data/{accountId}/data/
        let defaultScopedDir = try GoatStorageManager.getTenantDataDirectory(baseDocumentsURL: tempDirectory, appId: "default")
        XCTAssertEqual(defaultScopedDir.path, tempDirectory.appendingPathComponent("miniapp_data/acc_finance_1/data").path)
    }

    func testScopedServiceNameResolution() throws {
        // Without active account -> goat_secure_{appId}
        let unScopedService = try sandbox.getScopedServiceName(appId: "app_wallet")
        XCTAssertEqual(unScopedService, "goat_secure_app_wallet")

        // With active account in GoatConfig -> goat_secure_{appId}_{accountId}
        GoatConfig.shared.accountProvider = { "acc_vault_7" }
        let scopedService = try GoatSecureStorageManager.getServiceName(appId: "app_wallet")
        XCTAssertEqual(scopedService, "goat_secure_app_wallet_acc_vault_7")

        // Explicit account override
        let explicitService = try GoatSecureStorageManager.getServiceName(appId: "app_wallet", accountId: "acc_vault_8")
        XCTAssertEqual(explicitService, "goat_secure_app_wallet_acc_vault_8")
    }

    // MARK: - 2. Key-Value Storage Account Isolation & Switching

    func testKeyValueAccountIsolationAndSwitching() async throws {
        let appId = "mini_banking"
        let key = "auth_token"

        // Step 1: Active User Alice
        GoatConfig.shared.accountProvider = { "user_alice" }
        let savedAlice = try await storageManager.setValue(appId: appId, key: key, value: "jwt_token_alice_secret")
        XCTAssertTrue(savedAlice)
        let readAlice = try await storageManager.getValue(appId: appId, key: key)
        XCTAssertEqual(readAlice, "jwt_token_alice_secret")

        // Step 2: Switch to User Bob
        GoatConfig.shared.accountProvider = { "user_bob" }
        let readBobInitial = try await storageManager.getValue(appId: appId, key: key)
        XCTAssertNil(readBobInitial, "User Bob must not access User Alice's key-value data")

        let savedBob = try await storageManager.setValue(appId: appId, key: key, value: "jwt_token_bob_secret")
        XCTAssertTrue(savedBob)
        let readBob = try await storageManager.getValue(appId: appId, key: key)
        XCTAssertEqual(readBob, "jwt_token_bob_secret")

        // Step 3: Switch back to User Alice
        GoatConfig.shared.accountProvider = { "user_alice" }
        let readAliceRestored = try await storageManager.getValue(appId: appId, key: key)
        XCTAssertEqual(readAliceRestored, "jwt_token_alice_secret", "User Alice's data must remain intact after account switch")

        // Step 4: Switch to un-scoped (no account)
        GoatConfig.shared.reset()
        let readUnScoped = try await storageManager.getValue(appId: appId, key: key)
        XCTAssertNil(readUnScoped, "Un-scoped sandbox must not access account-partitioned data")

        // Write un-scoped
        _ = try await storageManager.setValue(appId: appId, key: key, value: "unscoped_guest_token")
        let readUnScopedWritten = try await storageManager.getValue(appId: appId, key: key)
        XCTAssertEqual(readUnScopedWritten, "unscoped_guest_token")

        // Verify Alice and Bob remain unaffected
        GoatConfig.shared.accountProvider = { "user_alice" }
        let readAliceAfterReset = try await storageManager.getValue(appId: appId, key: key)
        XCTAssertEqual(readAliceAfterReset, "jwt_token_alice_secret")

        GoatConfig.shared.accountProvider = { "user_bob" }
        let readBobAfterReset = try await storageManager.getValue(appId: appId, key: key)
        XCTAssertEqual(readBobAfterReset, "jwt_token_bob_secret")
    }

    // MARK: - 3. Filesystem Sandbox Account Isolation

    func testFilesystemAccountIsolation() async throws {
        let appId = "mini_docs"
        let relativePath = "statement.pdf"
        let aliceData = Data("Alice Financial Statement".utf8)
        let bobData = Data("Bob Financial Statement".utf8)

        // Write as Alice
        GoatConfig.shared.accountProvider = { "user_alice" }
        let writtenAlice = try await storageManager.writeFile(appId: appId, relativePath: relativePath, data: aliceData)
        XCTAssertTrue(writtenAlice)
        let readAlice = try await storageManager.readFile(appId: appId, relativePath: relativePath)
        XCTAssertEqual(readAlice, aliceData)

        // Switch to Bob
        GoatConfig.shared.accountProvider = { "user_bob" }
        let existsForBob = try await storageManager.fileExists(appId: appId, relativePath: relativePath)
        XCTAssertFalse(existsForBob, "Bob must not see Alice's files")

        // Write Bob's file
        let writtenBob = try await storageManager.writeFile(appId: appId, relativePath: relativePath, data: bobData)
        XCTAssertTrue(writtenBob)
        let readBob = try await storageManager.readFile(appId: appId, relativePath: relativePath)
        XCTAssertEqual(readBob, bobData)

        // Switch back to Alice
        GoatConfig.shared.accountProvider = { "user_alice" }
        let readAliceRestored = try await storageManager.readFile(appId: appId, relativePath: relativePath)
        XCTAssertEqual(readAliceRestored, aliceData)
    }

    // MARK: - 4. Secure Storage Account Isolation

    func testSecureStorageAccountIsolation() async throws {
        let appId = "mini_vault"
        let key = "private_key"

        // Set under user 1
        GoatConfig.shared.accountProvider = { "user_one" }
        let savedOne = try await secureStorageManager.setSecureValue(appId: appId, key: key, value: "key_for_user_one")
        XCTAssertTrue(savedOne)
        let readOne = try await secureStorageManager.getSecureValue(appId: appId, key: key)
        XCTAssertEqual(readOne, "key_for_user_one")

        // Switch to user 2
        GoatConfig.shared.accountProvider = { "user_two" }
        let readTwo = try await secureStorageManager.getSecureValue(appId: appId, key: key)
        XCTAssertNil(readTwo, "User Two must not see User One's Keychain credentials")

        let savedTwo = try await secureStorageManager.setSecureValue(appId: appId, key: key, value: "key_for_user_two")
        XCTAssertTrue(savedTwo)
        let readTwoValue = try await secureStorageManager.getSecureValue(appId: appId, key: key)
        XCTAssertEqual(readTwoValue, "key_for_user_two")

        // Clean up Keychain items
        _ = try await secureStorageManager.clearSecureValues(appId: appId)
        GoatConfig.shared.accountProvider = { "user_one" }
        _ = try await secureStorageManager.clearSecureValues(appId: appId)
    }

    // MARK: - 5. Path Traversal & Security Validation

    func testPathTraversalInAccountIdRejection() {
        GoatConfig.shared.accountProvider = { "../../malicious_account" }
        XCTAssertThrowsError(try GoatStorageManager.getPreferencesPrefix(appId: "app_test")) { error in
            guard case GoatStorageError.securityViolation = error else {
                XCTFail("Expected securityViolation error, got: \(error)")
                return
            }
        }

        GoatConfig.shared.accountProvider = { "account/sub/escape" }
        XCTAssertThrowsError(try GoatStorageManager.getTenantDataDirectory(baseDocumentsURL: tempDirectory, appId: "app_test")) { error in
            guard case GoatStorageError.securityViolation = error else {
                XCTFail("Expected securityViolation error, got: \(error)")
                return
            }
        }

        GoatConfig.shared.accountProvider = { "account\\sub\\escape" }
        XCTAssertThrowsError(try GoatSecureStorageManager.getServiceName(appId: "app_test")) { error in
            guard case GoatStorageError.securityViolation = error else {
                XCTFail("Expected securityViolation error, got: \(error)")
                return
            }
        }
    }

    // MARK: - 6. Install-Scoped Anonymous GUID

    func testInstallGuidFormatAndPersistence() {
        let guid1 = sandbox.getInstallGuid()
        XCTAssertFalse(guid1.isEmpty)

        // Verify UUID v4 regex format (8-4-4-4-12 hex)
        let uuidRegex = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
        let predicate = NSPredicate(format: "SELF MATCHES %@", uuidRegex)
        XCTAssertTrue(predicate.evaluate(with: guid1), "installGuid must be a valid UUID format: \(guid1)")

        // Repeated calls return identical GUID
        let guid2 = sandbox.getInstallGuid()
        XCTAssertEqual(guid1, guid2)

        // Independent sandbox instance with same UserDefaults suite returns identical GUID
        let sandbox2 = GoatAccountScopedSandbox(userDefaults: testUserDefaults)
        XCTAssertEqual(sandbox2.getInstallGuid(), guid1)

        // Reset for test generates a new distinct valid GUID
        let resetGuid = sandbox.resetInstallGuidForTest()
        XCTAssertNotEqual(resetGuid, guid1)
        XCTAssertTrue(predicate.evaluate(with: resetGuid))

        // Subsequent reads return the reset GUID
        XCTAssertEqual(sandbox.getInstallGuid(), resetGuid)
    }

    // MARK: - 7. Bridge GET_DEVICE_INFO Integration

    @MainActor
    func testDeviceInfoBridgeReturnsInstallGuid() async throws {
        let handler = GoatScriptMessageHandler(appId: "test_device_info_app", storageManager: storageManager)
        let result = try await handler.dispatchDirect(action: "GET_DEVICE_INFO", payload: [:])

        guard let returnedGuid = result["installGuid"] as? String else {
            XCTFail("GET_DEVICE_INFO must include 'installGuid'")
            return
        }

        let expectedGuid = GoatAccountScopedSandbox.shared.getInstallGuid()
        XCTAssertEqual(returnedGuid, expectedGuid)
        XCTAssertEqual(result["platform"] as? String, "iOS")
        XCTAssertEqual(result["appId"] as? String, "test_device_info_app")
    }
}
