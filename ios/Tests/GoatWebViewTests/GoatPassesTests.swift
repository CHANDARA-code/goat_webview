#if os(iOS)
import XCTest
@testable import GoatWebView

/// Mirrors the Android `GoatPassesPluginTest` so the two implementations cannot drift on what a
/// pass state means or on who can see whose passes.
final class GoatPassesTests: XCTestCase {

    private final class InMemoryVault: EncryptedPassVault, @unchecked Sendable {
        private let lock = NSLock()
        private var store: [String: String] = [:]
        private func key(_ appId: String, _ passId: String) -> String { "\(appId)::\(passId)" }

        func put(appId: String, passId: String, plaintext: String) {
            lock.lock(); defer { lock.unlock() }
            store[key(appId, passId)] = plaintext
        }
        func get(appId: String, passId: String) -> String? {
            lock.lock(); defer { lock.unlock() }
            return store[key(appId, passId)]
        }
        func remove(appId: String, passId: String) -> Bool {
            lock.lock(); defer { lock.unlock() }
            return store.removeValue(forKey: key(appId, passId)) != nil
        }
        func listIds(appId: String) -> [String] {
            lock.lock(); defer { lock.unlock() }
            return store.keys.filter { $0.hasPrefix("\(appId)::") }
                .map { String($0.dropFirst(appId.count + 2)) }.sorted()
        }
    }

    private final class FakePassLibrary: ApplePassLibrary, @unchecked Sendable {
        var available = true
        var held: Set<String> = []
        var outcome: AppleWalletSaveOutcome = .saved
        var addCalls = 0

        func isPassLibraryAvailable() -> Bool { available }
        func containsPass(passTypeIdentifier: String, serialNumber: String) -> Bool {
            held.contains("\(passTypeIdentifier):\(serialNumber)")
        }
        func addPass(pkpassData: Data) async throws -> AppleWalletSaveOutcome {
            addCalls += 1
            return outcome
        }
        func openPass(passTypeIdentifier: String, serialNumber: String) async -> Bool { available }
    }

    /// A minimal but genuinely ZIP-headered payload — PK\u{03}\u{04} then filler.
    private var validPkPass: String {
        var bytes: [UInt8] = [0x50, 0x4B, 0x03, 0x04]
        bytes.append(contentsOf: [UInt8](repeating: 0x00, count: 28))
        return Data(bytes).base64EncodedString()
    }

    private func metadata() -> [String: Any] {
        ["passTypeIdentifier": "pass.com.example.loyalty", "serialNumber": "SN-1", "description": "Coffee card"]
    }

    private func plugin(
        library: FakePassLibrary = FakePassLibrary(),
        vault: InMemoryVault? = InMemoryVault(),
        appId: String = "tenant-a"
    ) -> GoatPassesPlugin {
        GoatPassesPlugin(
            adapters: [AppleWalletPassAdapter(library: library)],
            genericStore: vault.map { GenericPassStore(vault: $0) },
            appIdProvider: { appId }
        )
    }

    private func code(_ error: Error) -> PassErrorCode? { (error as? PassError)?.code }

    // MARK: - Surface

    func testPluginIdentityAndActionSurface() {
        let p = plugin()
        XCTAssertEqual(p.pluginId, "wallet_passes")
        XCTAssertEqual(p.supportedActions.count, 5)
        for action in ["WALLET_SAVE_PASS", "WALLET_GET_PASS_STATE", "WALLET_OPEN_PASS",
                       "WALLET_LIST_PASSES", "WALLET_DELETE_PASS"] {
            XCTAssertTrue(p.canHandle(action: action), "\(action) not handled")
        }
        XCTAssertFalse(p.canHandle(action: "REQUEST_PAYMENT"))
    }

    // MARK: - pkpass validation

    func testMalformedPkPassIsRejectedBeforeReachingPassKit() async {
        let library = FakePassLibrary()
        let p = plugin(library: library)

        let bad: [(String, String)] = [
            ("", "empty"),
            ("not base64 @@@", "not base64"),
            (Data("hello".utf8).base64EncodedString(), "valid base64 but not a ZIP"),
            (Data([0x50, 0x4B]).base64EncodedString(), "too short"),
        ]
        for (payload, why) in bad {
            do {
                _ = try await p.execute(action: "WALLET_SAVE_PASS", payload: [
                    "provider": "APPLE_WALLET", "payload": payload
                ])
                XCTFail("\(why) should have been rejected")
            } catch {
                XCTAssertTrue([.passInvalid, .invalidParameters].contains(code(error)!), "\(why)")
            }
        }
        XCTAssertEqual(library.addCalls, 0, "no malformed pkpass may reach PassKit")
    }

    func testAValidZipHeaderedPkPassIsAccepted() async throws {
        let res = try await plugin().execute(action: "WALLET_SAVE_PASS", payload: [
            "provider": "APPLE_WALLET", "payload": validPkPass, "metadata": metadata()
        ])
        XCTAssertEqual(res["state"] as? String, "ADDED")
        XCTAssertEqual(res["passId"] as? String, "pass.com.example.loyalty:SN-1")
    }

    // MARK: - Apple Wallet behaviour

    func testAPassAlreadyHeldSkipsTheSheetAndReportsAlreadyAdded() async throws {
        let library = FakePassLibrary()
        library.held = ["pass.com.example.loyalty:SN-1"]

        let res = try await plugin(library: library).execute(action: "WALLET_SAVE_PASS", payload: [
            "provider": "APPLE_WALLET", "payload": validPkPass, "metadata": metadata()
        ])
        XCTAssertEqual(res["alreadyAdded"] as? Bool, true)
        XCTAssertEqual(library.addCalls, 0, "the user must not see a sheet for a pass they already hold")
    }

    func testUserCancellationMapsToUserCancelled() async {
        let library = FakePassLibrary()
        library.outcome = .cancelled
        do {
            _ = try await plugin(library: library).execute(action: "WALLET_SAVE_PASS", payload: [
                "provider": "APPLE_WALLET", "payload": validPkPass
            ])
            XCTFail("Expected USER_CANCELLED")
        } catch {
            XCTAssertEqual(code(error), .userCancelled)
        }
    }

    func testAnUnavailableWalletIsRefusedBeforeSaving() async {
        let library = FakePassLibrary()
        library.available = false
        do {
            _ = try await plugin(library: library).execute(action: "WALLET_SAVE_PASS", payload: [
                "provider": "APPLE_WALLET", "payload": validPkPass
            ])
            XCTFail("Expected PASS_PROVIDER_UNAVAILABLE")
        } catch {
            XCTAssertEqual(code(error), .passProviderUnavailable)
        }
        XCTAssertEqual(library.addCalls, 0)
    }

    func testAnUnlinkedHostFailsClosed() async {
        let p = GoatPassesPlugin()
        do {
            _ = try await p.execute(action: "WALLET_SAVE_PASS", payload: [
                "provider": "APPLE_WALLET", "payload": validPkPass
            ])
            XCTFail("Expected PASS_PROVIDER_UNAVAILABLE")
        } catch {
            XCTAssertEqual(code(error), .passProviderUnavailable)
        }
    }

    // MARK: - Pass state

    func testPassKitCanAnswerStateUnlikeGoogleWallet() async throws {
        let library = FakePassLibrary()
        library.held = ["pass.com.example.loyalty:SN-1"]
        let p = plugin(library: library)

        let present = try await p.execute(action: "WALLET_GET_PASS_STATE", payload: [
            "provider": "APPLE_WALLET", "passId": "pass.com.example.loyalty:SN-1"
        ])
        XCTAssertEqual(present["state"] as? String, "ADDED")

        let absent = try await p.execute(action: "WALLET_GET_PASS_STATE", payload: [
            "provider": "APPLE_WALLET", "passId": "pass.com.example.loyalty:SN-2"
        ])
        XCTAssertEqual(absent["state"] as? String, "NOT_ADDED", "PassKit CAN be queried, so this is a real answer")
    }

    func testStateIsUnsupportedWithoutAWallet() async throws {
        let library = FakePassLibrary()
        library.available = false
        let res = try await plugin(library: library).execute(action: "WALLET_GET_PASS_STATE", payload: [
            "provider": "APPLE_WALLET", "passId": "a:b"
        ])
        XCTAssertEqual(res["state"] as? String, "UNSUPPORTED")
    }

    func testAMalformedPassIdIsUnknownNotNotAdded() async {
        let adapter = AppleWalletPassAdapter(library: FakePassLibrary())
        let state = await adapter.getPassState(passId: "no-colon-here")
        XCTAssertEqual(state, .unknown)
    }

    // MARK: - Generic passes and tenancy

    func testGenericPassRoundTrips() async throws {
        let p = plugin()
        let saved = try await p.execute(action: "WALLET_SAVE_PASS", payload: [
            "provider": "GENERIC", "payload": "raw-pass-bytes", "metadata": metadata()
        ])
        XCTAssertEqual(saved["state"] as? String, "ADDED")

        let listed = try await p.execute(action: "WALLET_LIST_PASSES", payload: [:])
        XCTAssertEqual(listed["count"] as? Int, 1)

        let deleted = try await p.execute(action: "WALLET_DELETE_PASS", payload: [
            "passId": "pass.com.example.loyalty:SN-1"
        ])
        XCTAssertEqual(deleted["deleted"] as? Bool, true)
    }

    func testOneTenantCannotSeeOrDeleteAnothersPasses() async throws {
        let vault = InMemoryVault()
        let store = GenericPassStore(vault: vault)
        let a = GoatPassesPlugin(genericStore: store, appIdProvider: { "tenant-a" })
        let b = GoatPassesPlugin(genericStore: store, appIdProvider: { "tenant-b" })

        _ = try await a.execute(action: "WALLET_SAVE_PASS", payload: [
            "provider": "GENERIC", "payload": "secret-barcode", "metadata": metadata()
        ])

        let aList = try await a.execute(action: "WALLET_LIST_PASSES", payload: [:])
        let bList = try await b.execute(action: "WALLET_LIST_PASSES", payload: [:])
        XCTAssertEqual(aList["count"] as? Int, 1)
        XCTAssertEqual(bList["count"] as? Int, 0, "a pass is a bearer token; another tenant must not see it")

        let bDelete = try await b.execute(action: "WALLET_DELETE_PASS", payload: [
            "passId": "pass.com.example.loyalty:SN-1"
        ])
        XCTAssertEqual(bDelete["deleted"] as? Bool, false)
    }

    func testGenericPassRequiresIdentifiers() async {
        do {
            _ = try await plugin().execute(action: "WALLET_SAVE_PASS", payload: [
                "provider": "GENERIC", "payload": "bytes"
            ])
            XCTFail("Expected INVALID_PARAMETERS")
        } catch {
            XCTAssertEqual(code(error), .invalidParameters)
        }
    }

    func testUnsupportedBarcodeFormatIsRejected() {
        let store = GenericPassStore(vault: InMemoryVault())
        XCTAssertThrowsError(
            try store.storePass(
                appId: "tenant-a",
                metadata: PassMetadata(
                    passTypeIdentifier: "t", serialNumber: "s", provider: .generic,
                    barcode: PassBarcode(format: "MORSE", message: "hi")
                ),
                payload: "payload"
            )
        ) { XCTAssertEqual(code($0), .passInvalid) }
    }

    func testRefreshDoesNotResurrectADeletedPass() throws {
        let store = GenericPassStore(vault: InMemoryVault())
        let meta = PassMetadata(passTypeIdentifier: "t", serialNumber: "s", provider: .generic)
        try store.storePass(appId: "tenant-a", metadata: meta, payload: "v1")
        XCTAssertTrue(store.refreshPass(appId: "tenant-a", passId: meta.passId, payload: "v2"))
        XCTAssertEqual(try store.exportPass(appId: "tenant-a", passId: meta.passId), "v2")

        _ = store.deletePass(appId: "tenant-a", passId: meta.passId)
        XCTAssertFalse(
            store.refreshPass(appId: "tenant-a", passId: meta.passId, payload: "v3"),
            "a webhook refresh must not recreate a pass the user deleted"
        )
    }

    func testUnknownProviderIsRejected() async {
        do {
            _ = try await plugin().execute(action: "WALLET_SAVE_PASS", payload: [
                "provider": "MY_WALLET", "payload": validPkPass
            ])
            XCTFail("Expected INVALID_PARAMETERS")
        } catch {
            XCTAssertEqual(code(error), .invalidParameters)
        }
    }

    func testUnsupportedActionIsRejected() async {
        do {
            _ = try await plugin().execute(action: "NOT_A_PASS_ACTION", payload: [:])
            XCTFail("Expected INVALID_PARAMETERS")
        } catch {
            XCTAssertEqual(code(error), .invalidParameters)
        }
    }
}
#endif // os(iOS)
