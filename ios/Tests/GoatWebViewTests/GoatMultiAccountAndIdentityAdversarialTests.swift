#if os(iOS)
import XCTest
import Foundation
@testable import GoatWebView

/**
 * Empirical Adversarial Challenge Suite for Task 10203 (iOS):
 * Multi-Account Storage Partitioning & Install-Scoped Anonymous GUID.
 */
final class GoatMultiAccountAndIdentityAdversarialTests: XCTestCase {

    private var tempDirectory: URL!
    private var suiteName: String!
    private var testUserDefaults: UserDefaults!
    private var storageManager: GoatStorageManager!
    private var secureStorageManager: GoatSecureStorageManager!
    private var sandbox: GoatAccountScopedSandbox!

    // Strict RFC 4122 UUID v4 regex:
    private let uuidV4StrictRegex = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"

    override func setUp() {
        super.setUp()
        GoatConfig.shared.reset()

        let uniqueDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("GoatAdversarialTests_\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: uniqueDir, withIntermediateDirectories: true)
        tempDirectory = uniqueDir

        suiteName = "GoatIdentityAdvTests_\(UUID().uuidString)"
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

    // =========================================================================
    // 1. RAPID CONCURRENT ACCOUNT SWITCHING & DATA LEAKAGE PREVENTION
    // =========================================================================

    func testRapidAlternatingAccountSwitchingPreventsDataLeakage() async throws {
        let appId = "fintech_wallet_ios"
        let accounts = ["user_alpha_101", "user_beta_202", "user_gamma_303", "user_delta_404"]

        // 1. Write unique KV and secure values for each account
        for (idx, account) in accounts.enumerated() {
            GoatConfig.shared.accountProvider = { account }

            // Standard storage
            let setKv = try await storageManager.setValue(
                appId: appId,
                key: "secret_balance",
                value: "balance_\(idx) for \(account)"
            )
            XCTAssertTrue(setKv)

            // Secure storage
            let setSec = try await secureStorageManager.setSecureValue(
                appId: appId,
                key: "auth_token",
                value: "token_xyz_\(idx)#\(account)"
            )
            XCTAssertTrue(setSec)
        }

        // 2. Perform 200 rapid alternating switch-and-verify cycles
        for i in 0..<200 {
            let accountIndex = i % accounts.count
            let targetAccount = accounts[accountIndex]
            let expectedValue = "balance_\(accountIndex) for \(targetAccount)"
            let expectedToken = "token_xyz_\(accountIndex)#\(targetAccount)"

            GoatConfig.shared.accountProvider = { targetAccount }

            // Read Standard storage
            let readKv = try await storageManager.getValue(appId: appId, key: "secret_balance")
            XCTAssertEqual(readKv, expectedValue, "Account \(targetAccount) must read its own balance on iteration \(i)")

            // Read Secure storage
            let readSec = try await secureStorageManager.getSecureValue(appId: appId, key: "auth_token")
            XCTAssertEqual(readSec, expectedToken, "Account \(targetAccount) must read its own token on iteration \(i)")
        }

        // Cleanup secure values
        for account in accounts {
            GoatConfig.shared.accountProvider = { account }
            _ = try await secureStorageManager.clearSecureValues(appId: appId)
        }
    }

    func testConcurrentMultiThreadedAccountProviderSwitchingSafety() {
        let iterations = 500
        let group = DispatchGroup()
        let accounts = ["acc_001", "acc_002", "acc_003", "acc_004", "acc_005"]

        for i in 0..<iterations {
            group.enter()
            DispatchQueue.global(qos: .userInitiated).async {
                let chosenAccount = accounts[i % accounts.count]
                GoatConfig.shared.accountProvider = { chosenAccount }
                
                let resolved = GoatConfig.shared.currentAccountId()
                XCTAssertNotNil(resolved)
                XCTAssertTrue(accounts.contains(resolved!))
                
                let prefix = try? GoatStorageManager.getPreferencesPrefix(appId: "app_concur")
                XCTAssertNotNil(prefix)
                XCTAssertTrue(prefix!.hasPrefix("goat_storage_app_concur_acc_"))
                
                group.leave()
            }
        }

        let waitResult = group.wait(timeout: .now() + 5.0)
        XCTAssertEqual(waitResult, .success, "Concurrent account provider switching completed without crash or race")
    }

    // =========================================================================
    // 2. ACCOUNT ID SANITIZATION, PATH TRAVERSAL & SPECIAL CHARACTERS
    // =========================================================================

    func testPathTraversalSequencesInAccountIdStrictlyRejected() {
        let maliciousAccountIds = [
            "../escaped_user",
            "..\\windows_escaped",
            "../../../../etc/passwd",
            "account/with/forward/slashes",
            "account\\with\\backslashes",
            "..",
            "/",
            "\\"
        ]

        for malicious in maliciousAccountIds {
            GoatConfig.shared.accountProvider = { malicious }

            XCTAssertThrowsError(try GoatStorageManager.getPreferencesPrefix(appId: "shop")) { error in
                guard case GoatStorageError.securityViolation = error else {
                    XCTFail("Expected securityViolation for '\(malicious)', got \(error)")
                    return
                }
            }

            XCTAssertThrowsError(try GoatStorageManager.getTenantDataDirectory(baseDocumentsURL: self.tempDirectory, appId: "shop")) { error in
                guard case GoatStorageError.securityViolation = error else {
                    XCTFail("Expected securityViolation for '\(malicious)', got \(error)")
                    return
                }
            }

            XCTAssertThrowsError(try GoatSecureStorageManager.getServiceName(appId: "shop")) { error in
                guard case GoatStorageError.securityViolation = error else {
                    XCTFail("Expected securityViolation for '\(malicious)', got \(error)")
                    return
                }
            }
        }
    }

    func testSpecialCharactersAndUnicodeSanitizedCleanly() throws {
        let specialAccounts: [String: String] = [
            "user@company.com": "user_company.com",
            "user#123$456": "user_123_456",
            "user:alpha;beta": "user_alpha_beta",
            "user[1]+2": "user_1__2",
            "user!test?yes": "user_test_yes",
            "user_valid-account.123": "user_valid-account.123"
        ]

        for (raw, sanitized) in specialAccounts {
            GoatConfig.shared.accountProvider = { raw }

            let prefix = try GoatStorageManager.getPreferencesPrefix(appId: "app_portal")
            XCTAssertEqual(prefix, "goat_storage_app_portal_\(sanitized)_")

            let service = try GoatSecureStorageManager.getServiceName(appId: "app_portal")
            XCTAssertEqual(service, "goat_secure_app_portal_\(sanitized)")

            let dir = try GoatStorageManager.getTenantDataDirectory(baseDocumentsURL: tempDirectory, appId: "app_portal")
            XCTAssertTrue(dir.path.contains(sanitized))
        }
    }

    // =========================================================================
    // 3. INSTALL GUID UUID V4 COMPLIANCE & PERSISTENCE STABILITY
    // =========================================================================

    func testInstallGuidStrictUuidV4FormatCompliance() {
        let predicate = NSPredicate(format: "SELF MATCHES %@", uuidV4StrictRegex)

        for _ in 0..<50 {
            let uniqueSuite = "GoatTestGuid_\(UUID().uuidString)"
            let localDefaults = UserDefaults(suiteName: uniqueSuite)!
            let localSandbox = GoatAccountScopedSandbox(userDefaults: localDefaults)

            let guid = localSandbox.getInstallGuid()
            XCTAssertEqual(guid.count, 36)
            XCTAssertTrue(predicate.evaluate(with: guid), "installGuid must be strict UUID v4: \(guid)")

            // Check version nibble at index 14
            let versionChar = guid[guid.index(guid.startIndex, offsetBy: 14)]
            XCTAssertEqual(versionChar, "4", "Version nibble must be 4")

            // Check variant nibble at index 19
            let variantChar = guid[guid.index(guid.startIndex, offsetBy: 19)].lowercased()
            XCTAssertTrue(["8", "9", "a", "b"].contains(variantChar), "Variant nibble must be 8, 9, a, or b")

            localDefaults.removePersistentDomain(forName: uniqueSuite)
        }
    }

    func testInstallGuidPersistenceAcross1000Invocations() {
        let initialGuid = sandbox.getInstallGuid()

        for _ in 0..<1000 {
            let g = sandbox.getInstallGuid()
            XCTAssertEqual(g, initialGuid)
        }

        // Test with separate sandbox instances pointing to same defaults
        for _ in 0..<50 {
            let parallelSandbox = GoatAccountScopedSandbox(userDefaults: testUserDefaults)
            XCTAssertEqual(parallelSandbox.getInstallGuid(), initialGuid)
        }
    }

    func testInstallGuidRemainsInvariantAcrossAccountSwitches() {
        let originalGuid = sandbox.getInstallGuid()

        GoatConfig.shared.accountProvider = { "user_first" }
        XCTAssertEqual(sandbox.getInstallGuid(), originalGuid)

        GoatConfig.shared.accountProvider = { "user_second" }
        XCTAssertEqual(sandbox.getInstallGuid(), originalGuid)

        GoatConfig.shared.reset()
        XCTAssertEqual(sandbox.getInstallGuid(), originalGuid)
    }

    // =========================================================================
    // 4. BACKWARD COMPATIBILITY & NULL / EMPTY / EXCEPTION HANDLING
    // =========================================================================

    func testBackwardCompatibilityFallbackOnNilEmptyWhitespace() throws {
        let testCases: [(() -> String?)?] = [
            nil,
            { nil },
            { "" },
            { "   " },
            { "\t\r\n  " }
        ]

        for provider in testCases {
            GoatConfig.shared.accountProvider = provider

            XCTAssertNil(GoatAccountScopedSandbox.shared.getCurrentAccountId())

            let prefix = try GoatStorageManager.getPreferencesPrefix(appId: "legacy_app")
            XCTAssertEqual(prefix, "goat_storage_legacy_app_")

            let service = try GoatSecureStorageManager.getServiceName(appId: "legacy_app")
            XCTAssertEqual(service, "goat_secure_legacy_app")

            let dataDir = try GoatStorageManager.getTenantDataDirectory(baseDocumentsURL: tempDirectory, appId: "legacy_app")
            XCTAssertEqual(dataDir.path, tempDirectory.appendingPathComponent("miniapps/legacy_app/data").path)
        }
    }

    func testSwitchingFromUnscopedToScopedAndBackPreservesData() async throws {
        let appId = "transition_app"

        // 1. Write in un-scoped legacy mode
        GoatConfig.shared.reset()
        let savedUnscoped = try await storageManager.setValue(appId: appId, key: "config_mode", value: "UNSCOPED_DEFAULT")
        XCTAssertTrue(savedUnscoped)
        let readUnscoped = try await storageManager.getValue(appId: appId, key: "config_mode")
        XCTAssertEqual(readUnscoped, "UNSCOPED_DEFAULT")

        // 2. Enable account scoping
        GoatConfig.shared.accountProvider = { "user_migrated_1" }
        let readScopedInitial = try await storageManager.getValue(appId: appId, key: "config_mode")
        XCTAssertNil(readScopedInitial, "Scoped user should not see legacy un-scoped data")

        let savedScoped = try await storageManager.setValue(appId: appId, key: "config_mode", value: "SCOPED_USER_1")
        XCTAssertTrue(savedScoped)
        let readScoped = try await storageManager.getValue(appId: appId, key: "config_mode")
        XCTAssertEqual(readScoped, "SCOPED_USER_1")

        // 3. Switch back to un-scoped legacy mode
        GoatConfig.shared.reset()
        let readUnscopedRestored = try await storageManager.getValue(appId: appId, key: "config_mode")
        XCTAssertEqual(readUnscopedRestored, "UNSCOPED_DEFAULT")

        // 4. Switch back to scoped user
        GoatConfig.shared.accountProvider = { "user_migrated_1" }
        let readScopedRestored = try await storageManager.getValue(appId: appId, key: "config_mode")
        XCTAssertEqual(readScopedRestored, "SCOPED_USER_1")
    }
}
#endif // os(iOS)
