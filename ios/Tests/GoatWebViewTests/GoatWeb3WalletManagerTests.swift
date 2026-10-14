#if os(iOS)
import XCTest
@testable import GoatWebView

private final class StubAdapter: GoatWalletAdapter, @unchecked Sendable {
    let chainFamily: ChainFamily
    let supportedChainIds: [String]

    private let lock = NSLock()
    private var _connectCalls = 0
    private var _lastMessageType: String?
    private var _lastPreview: DecodedTransactionPreview?
    private var _lastSwitchTarget: String?

    var connectCalls: Int { lock.lock(); defer { lock.unlock() }; return _connectCalls }
    var lastMessageType: String? { lock.lock(); defer { lock.unlock() }; return _lastMessageType }
    var lastPreview: DecodedTransactionPreview? { lock.lock(); defer { lock.unlock() }; return _lastPreview }
    var lastSwitchTarget: String? { lock.lock(); defer { lock.unlock() }; return _lastSwitchTarget }

    init(chainFamily: ChainFamily = .evm, supportedChainIds: [String] = ["1", "137"]) {
        self.chainFamily = chainFamily
        self.supportedChainIds = supportedChainIds
    }

    func connect(chains: [String], manifestUrl: String?, ctx: WalletContext) async throws -> WalletAccountInfo {
        lock.lock(); _connectCalls += 1; lock.unlock()
        return WalletAccountInfo(address: "0xhost", publicKey: "pubhost", chainId: "1", walletName: "HostWallet")
    }

    func disconnect(ctx: WalletContext) async throws -> Bool { true }

    func decodeTransaction(txPayload: Web3SignTxPayload, ctx: WalletContext) async throws -> DecodedTransactionPreview {
        DecodedTransactionPreview(
            networkName: "ethereum",
            recipient: txPayload.txField("to") ?? "",
            valueFormatted: "1",
            feeFormatted: "0.001",
            methodName: "approve",
            methodDescription: "Unlimited approval",
            isDangerousApproval: true,
            isPermit2Unlimited: true
        )
    }

    func signTransaction(
        txPayload: Web3SignTxPayload,
        preview: DecodedTransactionPreview,
        ctx: WalletContext
    ) async throws -> Web3SignTxResponse {
        lock.lock(); _lastPreview = preview; lock.unlock()
        return Web3SignTxResponse(
            signature: "0xhostsig", txHash: "0xhosthash",
            network: "ethereum", from: "0xhost", status: "SIGNED"
        )
    }

    func signMessage(message: String, messageType: String, ctx: WalletContext) async throws -> Web3SignMessageResponse {
        lock.lock(); _lastMessageType = messageType; lock.unlock()
        return Web3SignMessageResponse(signature: "0xhostmsgsig", address: "0xhost", messageType: messageType)
    }

    func switchChain(targetChainId: String, addChainParams: String?, ctx: WalletContext) async throws -> Bool {
        lock.lock(); _lastSwitchTarget = targetChainId; lock.unlock()
        return supportedChainIds.contains(targetChainId.replacingOccurrences(of: "eip155:", with: ""))
    }
}

final class GoatWeb3WalletManagerTests: XCTestCase {

    private func web3Error(_ error: Error) -> Web3Error? { error as? Web3Error }

    // MARK: - Registry

    func testAdapterRegistrationAndLookup() async {
        let manager = GoatWeb3WalletManager()
        let adapter = StubAdapter()

        var found = await manager.getAdapter(.evm)
        XCTAssertNil(found)

        await manager.registerAdapter(adapter)
        found = await manager.getAdapter(.evm)
        XCTAssertTrue(found === adapter)

        let families = await manager.registeredFamilies()
        XCTAssertEqual(families, Set([ChainFamily.evm]))

        let removed = await manager.unregisterAdapter(.evm)
        XCTAssertTrue(removed)
        found = await manager.getAdapter(.evm)
        XCTAssertNil(found)
    }

    func testRequireAdapterRejectsMissingFamily() async {
        let manager = GoatWeb3WalletManager()
        do {
            _ = try await manager.requireAdapter(.solana)
            XCTFail("Expected NO_ADAPTER_REGISTERED")
        } catch {
            XCTAssertEqual(web3Error(error)?.code, .noAdapterRegistered)
        }
    }

    func testRegisteringSameFamilyReplacesAdapter() async {
        let manager = GoatWeb3WalletManager()
        let first = StubAdapter()
        let second = StubAdapter()
        await manager.registerAdapter(first)
        await manager.registerAdapter(second)
        let found = await manager.getAdapter(.evm)
        XCTAssertTrue(found === second)
    }

    // MARK: - Exclusivity

    func testExclusiveKeyIsReleasedAfterUse() async throws {
        let manager = GoatWeb3WalletManager()
        let value = try await manager.withExclusiveKey("k") { "first" }
        XCTAssertEqual(value, "first")
        var count = await manager.inFlightKeyCount()
        XCTAssertEqual(count, 0)

        _ = try await manager.withExclusiveKey("k") { "second" }
        count = await manager.inFlightKeyCount()
        XCTAssertEqual(count, 0)
    }

    func testExclusiveKeyRejectsContendingCaller() async throws {
        let manager = GoatWeb3WalletManager()
        var innerCode: Web3ErrorCode?
        _ = try await manager.withExclusiveKey("same") { () -> Int in
            do {
                _ = try await manager.withExclusiveKey("same") { 1 }
            } catch {
                innerCode = self.web3Error(error)?.code
            }
            return 0
        }
        XCTAssertEqual(innerCode, .walletActionInProgress)
        let count = await manager.inFlightKeyCount()
        XCTAssertEqual(count, 0)
    }

    func testExclusiveKeyReleasedWhenBlockThrows() async {
        let manager = GoatWeb3WalletManager()
        struct Boom: Error {}
        do {
            _ = try await manager.withExclusiveKey("boom") { throw Boom() }
            XCTFail("Expected throw")
        } catch {}
        let count = await manager.inFlightKeyCount()
        XCTAssertEqual(count, 0, "in-flight key leaked after the block threw")
    }

    func testDistinctKeysDoNotContend() async throws {
        let manager = GoatWeb3WalletManager()
        let a = try await manager.withExclusiveKey("key-a") { 1 }
        let b = try await manager.withExclusiveKey("key-b") { 2 }
        XCTAssertEqual(a + b, 3)
        let count = await manager.inFlightKeyCount()
        XCTAssertEqual(count, 0)
    }

    // MARK: - Multi-tenancy

    func testSessionsAreIsolatedPerAppId() async {
        let manager = GoatWeb3WalletManager()
        let account = Web3WalletAccount(
            address: "0xabc", publicKey: "pub", wallet: "Stub", network: "ethereum", chainId: "1"
        )
        await manager.putSession(appId: "tenant-a", family: .evm, account: account)

        let a = await manager.getSession(appId: "tenant-a", family: .evm)
        XCTAssertEqual(a, account)

        let b = await manager.getSession(appId: "tenant-b", family: .evm)
        XCTAssertNil(b, "tenant-b must not observe tenant-a's wallet session")

        let otherFamily = await manager.getSession(appId: "tenant-a", family: .solana)
        XCTAssertNil(otherFamily)

        let cleared = await manager.clearSession(appId: "tenant-a", family: .evm)
        XCTAssertTrue(cleared)
        let again = await manager.clearSession(appId: "tenant-a", family: .evm)
        XCTAssertFalse(again)
    }

    // MARK: - Lock keys

    func testLockKeyDiscriminatesOnNonceAndBlockhash() {
        func payload(_ family: ChainFamily, _ json: String) -> Web3SignTxPayload {
            Web3SignTxPayload(chainFamily: family, chainId: "1", txDataRaw: json)
        }
        let evmA = WalletLockKey.forTransaction(
            chainFamily: .evm, chainId: "1", accountAddress: "0xabc",
            txPayload: payload(.evm, "{\"nonce\":\"7\"}")
        )
        let evmB = WalletLockKey.forTransaction(
            chainFamily: .evm, chainId: "1", accountAddress: "0xabc",
            txPayload: payload(.evm, "{\"nonce\":\"8\"}")
        )
        XCTAssertNotEqual(evmA, evmB)

        let solA = WalletLockKey.forTransaction(
            chainFamily: .solana, chainId: "solana:mainnet", accountAddress: "sol1",
            txPayload: payload(.solana, "{\"recentBlockhash\":\"hash1\"}")
        )
        let solB = WalletLockKey.forTransaction(
            chainFamily: .solana, chainId: "solana:mainnet", accountAddress: "sol1",
            txPayload: payload(.solana, "{\"recentBlockhash\":\"hash2\"}")
        )
        XCTAssertNotEqual(solA, solB)

        let bare1 = WalletLockKey.forTransaction(
            chainFamily: .evm, chainId: "1", accountAddress: "0xabc", txPayload: payload(.evm, "{}")
        )
        let bare2 = WalletLockKey.forTransaction(
            chainFamily: .evm, chainId: "1", accountAddress: "0xabc", txPayload: payload(.evm, "{}")
        )
        XCTAssertEqual(bare1, bare2, "nonce-less requests must share one key so a double-tap cannot double-sign")
    }

    // MARK: - Plugin routing

    func testPluginIdentityAndActionSurface() {
        let plugin = GoatWeb3Plugin()
        XCTAssertEqual(plugin.pluginId, "web3")
        XCTAssertEqual(plugin.supportedActions.count, 6)
        for action in ["WEB3_CONNECT_WALLET", "WEB3_SIGN_TRANSACTION", "WEB3_SIGN_MESSAGE",
                       "WEB3_SWITCH_CHAIN", "WEB3_DISCONNECT", "WEB3_GET_ACCOUNT"] {
            XCTAssertTrue(plugin.canHandle(action: action), "\(action) not handled")
        }
        XCTAssertFalse(plugin.canHandle(action: "REQUEST_PAYMENT"))
    }

    func testHostSuppliedAdapterReplacesTheReferenceOne() async throws {
        let adapter = StubAdapter()
        let plugin = GoatWeb3Plugin(adapters: [adapter])
        let res = try await plugin.execute(action: "WEB3_CONNECT_WALLET", payload: ["network": "ethereum"])
        XCTAssertEqual(adapter.connectCalls, 1)
        XCTAssertEqual(res["wallet"] as? String, "HostWallet")
        XCTAssertEqual(res["address"] as? String, "0xhost")
    }

    func testConnectSignDisconnectLifecycle() async throws {
        let plugin = GoatWeb3Plugin()
        let connect = try await plugin.execute(action: "WEB3_CONNECT_WALLET", payload: ["network": "ton-mainnet"])
        XCTAssertEqual(connect["network"] as? String, "ton-mainnet")

        let account = try await plugin.execute(action: "WEB3_GET_ACCOUNT", payload: [:])
        XCTAssertEqual(account["connected"] as? Bool, true)

        let signed = try await plugin.execute(action: "WEB3_SIGN_TRANSACTION", payload: [
            "network": "ton-mainnet",
            "to": "EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N",
            "amount": "100000000"
        ])
        XCTAssertTrue((signed["signature"] as? String)?.hasPrefix(GoatReferenceWalletAdapter.simulatedPrefix) == true)
        XCTAssertEqual(signed["simulated"] as? Bool, true)

        let disconnect = try await plugin.execute(action: "WEB3_DISCONNECT", payload: [:])
        XCTAssertEqual(disconnect["disconnected"] as? Bool, true)

        let after = try await plugin.execute(action: "WEB3_GET_ACCOUNT", payload: [:])
        XCTAssertEqual(after["connected"] as? Bool, false)
    }

    func testSignTransactionRequiresConnectedWallet() async {
        let plugin = GoatWeb3Plugin()
        do {
            _ = try await plugin.execute(action: "WEB3_SIGN_TRANSACTION", payload: [
                "network": "ethereum", "to": "0xdead", "amount": "1"
            ])
            XCTFail("Expected WALLET_NOT_CONNECTED")
        } catch {
            XCTAssertEqual(web3Error(error)?.code, .walletNotConnected)
        }
    }

    func testSignTransactionRequiresRecipient() async throws {
        let plugin = GoatWeb3Plugin()
        _ = try await plugin.execute(action: "WEB3_CONNECT_WALLET", payload: ["network": "ethereum"])
        do {
            _ = try await plugin.execute(action: "WEB3_SIGN_TRANSACTION", payload: ["network": "ethereum", "amount": "1"])
            XCTFail("Expected INVALID_PARAMETERS")
        } catch {
            XCTAssertEqual(web3Error(error)?.code, .invalidParameters)
        }
    }

    func testDecodedPreviewReachesTheSigner() async throws {
        let adapter = StubAdapter()
        let plugin = GoatWeb3Plugin(adapters: [adapter])
        _ = try await plugin.execute(action: "WEB3_CONNECT_WALLET", payload: ["network": "ethereum"])
        _ = try await plugin.execute(action: "WEB3_SIGN_TRANSACTION", payload: [
            "network": "ethereum", "to": "0xdead", "amount": "1"
        ])
        XCTAssertEqual(adapter.lastPreview?.recipient, "0xdead")
        XCTAssertEqual(adapter.lastPreview?.isPermit2Unlimited, true)
    }

    func testSignMessageRoutesMessageTypeThrough() async throws {
        let adapter = StubAdapter()
        let plugin = GoatWeb3Plugin(adapters: [adapter])
        _ = try await plugin.execute(action: "WEB3_CONNECT_WALLET", payload: ["network": "ethereum"])
        let res = try await plugin.execute(action: "WEB3_SIGN_MESSAGE", payload: [
            "network": "ethereum",
            "message": "{\"primaryType\":\"PermitSingle\"}",
            "messageType": "eth_signTypedData_v4"
        ])
        XCTAssertEqual(adapter.lastMessageType, "eth_signTypedData_v4")
        XCTAssertEqual(res["signature"] as? String, "0xhostmsgsig")
    }

    func testSwitchChainUpdatesSessionChainId() async throws {
        let adapter = StubAdapter()
        let plugin = GoatWeb3Plugin(adapters: [adapter])
        _ = try await plugin.execute(action: "WEB3_CONNECT_WALLET", payload: ["network": "ethereum"])
        let res = try await plugin.execute(action: "WEB3_SWITCH_CHAIN", payload: [
            "network": "ethereum", "chainId": "eip155:137"
        ])
        XCTAssertEqual(res["switched"] as? Bool, true)
        XCTAssertEqual(res["chainId"] as? String, "137")
        XCTAssertEqual(adapter.lastSwitchTarget, "eip155:137")

        let account = try await plugin.execute(action: "WEB3_GET_ACCOUNT", payload: [:])
        XCTAssertEqual(account["chainId"] as? String, "137")
    }

    func testSwitchChainRejectsUnsupportedChain() async throws {
        let plugin = GoatWeb3Plugin()
        _ = try await plugin.execute(action: "WEB3_CONNECT_WALLET", payload: ["network": "ethereum"])
        do {
            _ = try await plugin.execute(action: "WEB3_SWITCH_CHAIN", payload: ["network": "ethereum", "chainId": "99999"])
            XCTFail("Expected CHAIN_UNSUPPORTED")
        } catch {
            XCTAssertEqual(web3Error(error)?.code, .chainUnsupported)
        }
    }

    func testUnknownChainFamilyIsRejected() async {
        let plugin = GoatWeb3Plugin()
        do {
            _ = try await plugin.execute(action: "WEB3_CONNECT_WALLET", payload: ["chainFamily": "DOGECHAIN"])
            XCTFail("Expected CHAIN_UNSUPPORTED")
        } catch {
            XCTAssertEqual(web3Error(error)?.code, .chainUnsupported)
        }
    }

    func testMissingAdapterForFamilyIsRejected() async {
        let plugin = GoatWeb3Plugin(adapters: [StubAdapter(chainFamily: .evm)])
        do {
            _ = try await plugin.execute(action: "WEB3_CONNECT_WALLET", payload: ["chainFamily": "SOLANA"])
            XCTFail("Expected NO_ADAPTER_REGISTERED")
        } catch {
            XCTAssertEqual(web3Error(error)?.code, .noAdapterRegistered)
        }
    }

    func testSessionsDoNotLeakBetweenTenants() async throws {
        let shared = GoatWeb3WalletManager()
        let tenantA = GoatWeb3Plugin(manager: shared, appIdProvider: { "tenant-a" })
        let tenantB = GoatWeb3Plugin(manager: shared, appIdProvider: { "tenant-b" })

        _ = try await tenantA.execute(action: "WEB3_CONNECT_WALLET", payload: ["network": "ethereum"])

        let a = try await tenantA.execute(action: "WEB3_GET_ACCOUNT", payload: [:])
        let b = try await tenantB.execute(action: "WEB3_GET_ACCOUNT", payload: [:])
        XCTAssertEqual(a["connected"] as? Bool, true)
        XCTAssertEqual(b["connected"] as? Bool, false)
    }

    func testReferenceAdapterDerivesDistinctAddressesPerTenant() async throws {
        let shared = GoatWeb3WalletManager()
        let a = GoatWeb3Plugin(manager: shared, appIdProvider: { "tenant-a" })
        let b = GoatWeb3Plugin(manager: shared, appIdProvider: { "tenant-b" })

        let addrA = try await a.execute(action: "WEB3_CONNECT_WALLET", payload: ["network": "ethereum"])["address"] as? String
        let addrB = try await b.execute(action: "WEB3_CONNECT_WALLET", payload: ["network": "ethereum"])["address"] as? String

        XCTAssertNotNil(addrA)
        XCTAssertNotEqual(addrA, addrB, "tenants must not share a derived wallet address")
    }

    func testReferenceAdapterNeverClaimsARealSignature() async throws {
        let adapter = GoatReferenceWalletAdapter(chainFamily: .evm)
        let ctx = WalletContext(appId: "tenant", origin: "https://appassets.androidplatform.net")
        let tx = Web3SignTxPayload(chainFamily: .evm, chainId: "1", txDataRaw: "{\"to\":\"0xdead\",\"value\":\"1\"}")
        let preview = try await adapter.decodeTransaction(txPayload: tx, ctx: ctx)
        let signed = try await adapter.signTransaction(txPayload: tx, preview: preview, ctx: ctx)

        XCTAssertTrue(signed.simulated)
        XCTAssertTrue(signed.signature.contains(GoatReferenceWalletAdapter.simulatedPrefix))
    }

    func testUnsupportedActionIsRejected() async {
        let plugin = GoatWeb3Plugin()
        do {
            _ = try await plugin.execute(action: "NOT_A_WEB3_ACTION", payload: [:])
            XCTFail("Expected NOT_SUPPORTED")
        } catch {
            XCTAssertEqual(web3Error(error)?.code, .notSupported)
        }
    }

    // MARK: - Cross-platform parity

    func testConnectResponseMatchesTheDeclaredAndroidSchema() async throws {
        let plugin = GoatWeb3Plugin()
        let res = try await plugin.execute(action: "WEB3_CONNECT_WALLET", payload: ["network": "ethereum"])
        for key in ["address", "publicKey", "wallet", "network", "chainId"] {
            XCTAssertNotNil(res[key], "WEB3_CONNECT_WALLET must return '\(key)' on both platforms")
        }
    }

    func testSignTransactionResponseMatchesTheDeclaredAndroidSchema() async throws {
        let plugin = GoatWeb3Plugin()
        _ = try await plugin.execute(action: "WEB3_CONNECT_WALLET", payload: ["network": "ethereum"])
        let res = try await plugin.execute(action: "WEB3_SIGN_TRANSACTION", payload: [
            "network": "ethereum", "to": "0xdead", "amount": "1"
        ])
        for key in ["signature", "txHash", "network", "from"] {
            XCTAssertNotNil(res[key], "WEB3_SIGN_TRANSACTION must return '\(key)' on both platforms")
        }
    }
}
#endif // os(iOS)
