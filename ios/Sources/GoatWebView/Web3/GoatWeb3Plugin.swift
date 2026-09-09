import Foundation

/**
 * Domain 13b (Web3 & Wallet Signing) as a `GoatBridgePlugin`.
 *
 * Routes every `WEB3_*` action to the `GoatWalletAdapter` registered for the requested
 * `ChainFamily`. This module never holds key material; a host supplies signing by registering its
 * own adapter. When none is registered the simulated `GoatReferenceWalletAdapter` set is used so
 * the bridge surface stays exercisable — every response it produces is tagged `simulated: true`.
 *
 * The L1 user-gesture gate is enforced centrally by `GoatScriptMessageHandler` via
 * `GoatAbuseGuard.privilegedActions`, which this module's signing actions are listed in.
 */
public final class GoatWeb3Plugin: GoatBridgePlugin, @unchecked Sendable {

    public static let actionConnect = "WEB3_CONNECT_WALLET"
    public static let actionSignTransaction = "WEB3_SIGN_TRANSACTION"
    public static let actionSignMessage = "WEB3_SIGN_MESSAGE"
    public static let actionSwitchChain = "WEB3_SWITCH_CHAIN"
    public static let actionDisconnect = "WEB3_DISCONNECT"
    public static let actionGetAccount = "WEB3_GET_ACCOUNT"

    public let pluginId = "web3"

    public let supportedActions = [
        GoatWeb3Plugin.actionConnect,
        GoatWeb3Plugin.actionSignTransaction,
        GoatWeb3Plugin.actionSignMessage,
        GoatWeb3Plugin.actionSwitchChain,
        GoatWeb3Plugin.actionDisconnect,
        GoatWeb3Plugin.actionGetAccount
    ]

    public let manager: GoatWeb3WalletManager
    private let appIdProvider: @Sendable () -> String
    private var bootstrapped = false
    private let bootstrapLock = NSLock()
    private let seedAdapters: [GoatWalletAdapter]

    public init(
        manager: GoatWeb3WalletManager = GoatWeb3WalletManager(),
        adapters: [GoatWalletAdapter] = [],
        appIdProvider: @escaping @Sendable () -> String = { "default" }
    ) {
        self.manager = manager
        self.seedAdapters = adapters.isEmpty ? GoatReferenceWalletAdapter.defaultSet() : adapters
        self.appIdProvider = appIdProvider
    }

    private func ensureAdaptersRegistered() async {
        bootstrapLock.lock()
        let needsBootstrap = !bootstrapped
        bootstrapped = true
        bootstrapLock.unlock()
        guard needsBootstrap else { return }
        await manager.registerAdapters(seedAdapters)
    }

    private func walletContext() -> WalletContext {
        let appId = appIdProvider()
        return WalletContext(appId: appId, origin: "https://" + GoatWeb3Plugin.resolveOrigin(appId))
    }

    static func resolveOrigin(_ appId: String) -> String {
        let base = "appassets.androidplatform.net"
        let sanitized = appId.lowercased().filter { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }
        if sanitized.isEmpty || sanitized == "default" { return base }
        return "\(sanitized).\(base)"
    }

    public func execute(action: String, payload: [String: Any]) async throws -> [String: Any] {
        await ensureAdaptersRegistered()
        switch action {
        case Self.actionConnect: return try await connect(payload)
        case Self.actionSignTransaction: return try await signTransaction(payload)
        case Self.actionSignMessage: return try await signMessage(payload)
        case Self.actionSwitchChain: return try await switchChain(payload)
        case Self.actionDisconnect: return try await disconnect(payload)
        case Self.actionGetAccount: return try await getAccount(payload)
        default:
            throw Web3Error(.notSupported, "Unsupported web3 action: \(action)")
        }
    }

    private func resolveFamily(_ payload: [String: Any]) throws -> ChainFamily {
        if let raw = payload["chainFamily"] as? String, !raw.isEmpty {
            guard let family = ChainFamily.fromWireName(raw) else {
                throw Web3Error(.chainUnsupported, "Unknown chainFamily '\(raw)'")
            }
            return family
        }
        return ChainFamily.fromNetworkName(payload["network"] as? String)
    }

    private func requestedChains(_ payload: [String: Any]) -> [String] {
        if let chains = payload["chains"] as? [String] { return chains }
        if let chainId = payload["chainId"] as? String, !chainId.isEmpty { return [chainId] }
        return []
    }

    private func networkLabel(_ payload: [String: Any], _ family: ChainFamily) -> String {
        if let network = payload["network"] as? String, !network.isEmpty { return network }
        switch family {
        case .evm: return "ethereum"
        case .solana: return "solana"
        case .ton: return "ton"
        case .custom: return "custom"
        }
    }

    private func txPayload(_ payload: [String: Any], family: ChainFamily, chainId: String) -> Web3SignTxPayload {
        let raw: [String: Any]
        if let nested = payload["txData"] as? [String: Any] {
            raw = nested
        } else {
            var legacy: [String: Any] = [:]
            for key in ["to", "value", "amount", "data", "payload", "nonce", "address",
                        "recentBlockhash", "blockhash", "valid_until", "validUntil"] {
                if let v = payload[key] { legacy[key] = v }
            }
            if legacy["value"] == nil, let amount = legacy["amount"] { legacy["value"] = amount }
            if legacy["data"] == nil, let p = legacy["payload"] { legacy["data"] = p }
            raw = legacy
        }
        let encoded = (try? JSONSerialization.data(withJSONObject: raw, options: [.sortedKeys]))
            .flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        return Web3SignTxPayload(chainFamily: family, chainId: chainId, txDataRaw: encoded)
    }

    private func connect(_ payload: [String: Any]) async throws -> [String: Any] {
        let family = try resolveFamily(payload)
        let adapter = try await manager.requireAdapter(family)
        let ctx = walletContext()
        let network = networkLabel(payload, family)
        let chains = requestedChains(payload)
        let manifestUrl = payload["manifestUrl"] as? String

        let info = try await manager.withExclusiveKey(
            WalletLockKey.forSession(
                chainFamily: family,
                chainId: (payload["chainId"] as? String) ?? "-",
                accountAddress: ctx.appId
            )
        ) {
            try await adapter.connect(chains: chains, manifestUrl: manifestUrl, ctx: ctx)
        }

        let account = Web3WalletAccount(info: info, network: network)
        await manager.putSession(appId: ctx.appId, family: family, account: account)
        return account.toDictionary()
    }

    private func signTransaction(_ payload: [String: Any]) async throws -> [String: Any] {
        let family = try resolveFamily(payload)
        let adapter = try await manager.requireAdapter(family)
        let ctx = walletContext()
        guard let account = await manager.getSession(appId: ctx.appId, family: family) else {
            throw Web3Error(.walletNotConnected, "Wallet not connected. Call WEB3_CONNECT_WALLET first.")
        }

        let tx = txPayload(payload, family: family, chainId: account.chainId)
        guard tx.txField("to") != nil || tx.txField("address") != nil else {
            throw Web3Error(.invalidParameters, "Missing 'to'")
        }

        let lockKey = WalletLockKey.forTransaction(
            chainFamily: family, chainId: account.chainId,
            accountAddress: account.address, txPayload: tx
        )
        let signed = try await manager.withExclusiveKey(lockKey) { () -> Web3SignTxResponse in
            let preview = try await adapter.decodeTransaction(txPayload: tx, ctx: ctx)
            return try await adapter.signTransaction(txPayload: tx, preview: preview, ctx: ctx)
        }

        var result = signed.toDictionary()
        if (result["network"] as? String)?.isEmpty != false { result["network"] = account.network }
        if (result["from"] as? String)?.isEmpty != false { result["from"] = account.address }
        return result
    }

    private func signMessage(_ payload: [String: Any]) async throws -> [String: Any] {
        let family = try resolveFamily(payload)
        let adapter = try await manager.requireAdapter(family)
        let ctx = walletContext()
        guard let account = await manager.getSession(appId: ctx.appId, family: family) else {
            throw Web3Error(.walletNotConnected, "Wallet not connected. Call WEB3_CONNECT_WALLET first.")
        }
        guard let message = payload["message"] as? String, !message.isEmpty else {
            throw Web3Error(.invalidParameters, "Missing 'message'")
        }
        let messageType = (payload["messageType"] as? String) ?? "personal_sign"

        let signed = try await manager.withExclusiveKey(
            WalletLockKey.forSession(
                chainFamily: family, chainId: account.chainId, accountAddress: account.address
            )
        ) {
            try await adapter.signMessage(message: message, messageType: messageType, ctx: ctx)
        }
        return signed.toDictionary()
    }

    private func switchChain(_ payload: [String: Any]) async throws -> [String: Any] {
        let family = try resolveFamily(payload)
        let adapter = try await manager.requireAdapter(family)
        let ctx = walletContext()
        guard let target = (payload["chainId"] as? String) ?? (payload["targetChainId"] as? String),
              !target.isEmpty else {
            throw Web3Error(.invalidParameters, "Missing 'chainId'")
        }
        var addChainParams: String?
        if let params = payload["addChainParams"] as? [String: Any],
           let data = try? JSONSerialization.data(withJSONObject: params, options: [.sortedKeys]) {
            addChainParams = String(data: data, encoding: .utf8)
        }

        let switched = try await adapter.switchChain(
            targetChainId: target, addChainParams: addChainParams, ctx: ctx
        )
        let normalized = target.replacingOccurrences(of: "eip155:", with: "")
        if switched, let current = await manager.getSession(appId: ctx.appId, family: family) {
            await manager.putSession(
                appId: ctx.appId, family: family, account: current.withChainId(normalized)
            )
        }
        return ["switched": switched, "chainId": normalized]
    }

    private func disconnect(_ payload: [String: Any]) async throws -> [String: Any] {
        let ctx = walletContext()
        let family = ChainFamily.fromWireName(payload["chainFamily"] as? String)
        var disconnected = false
        if let family {
            if let adapter = await manager.getAdapter(family) {
                _ = try? await adapter.disconnect(ctx: ctx)
            }
            disconnected = await manager.clearSession(appId: ctx.appId, family: family)
        } else {
            for registered in await manager.registeredFamilies() {
                if let adapter = await manager.getAdapter(registered) {
                    _ = try? await adapter.disconnect(ctx: ctx)
                }
            }
            disconnected = await manager.clearAllSessions(appId: ctx.appId)
        }
        return ["disconnected": disconnected]
    }

    private func getAccount(_ payload: [String: Any]) async throws -> [String: Any] {
        let ctx = walletContext()
        let family = ChainFamily.fromWireName(payload["chainFamily"] as? String)
        let account = family != nil
            ? await manager.getSession(appId: ctx.appId, family: family!)
            : await manager.getAnySession(appId: ctx.appId)

        guard let account else { return ["connected": false] }
        var result = account.toDictionary()
        result["connected"] = true
        return result
    }
}
