import Foundation

/**
 * Registry and concurrency arbiter for `GoatWalletAdapter` implementations.
 *
 * Holds no keys and performs no signing: a host registers an adapter per `ChainFamily` and this
 * actor routes to it. Actor isolation gives the exclusivity that Android's `GoatWeb3WalletManager`
 * builds from a reference-counted mutex — the check-and-insert of an in-flight lock key cannot
 * interleave here, so there is no split-mutex window to close.
 *
 * Wallet sessions are keyed by `appId` so one mini-app can never observe or reuse another's
 * connected account.
 */
public actor GoatWeb3WalletManager {

    public static let shared = GoatWeb3WalletManager()

    private var adapters: [ChainFamily: GoatWalletAdapter] = [:]
    private var inFlightKeys: Set<String> = []
    private var sessions: [String: Web3WalletAccount] = [:]

    public init() {}

    public func registerAdapter(_ adapter: GoatWalletAdapter) {
        adapters[adapter.chainFamily] = adapter
    }

    public func registerAdapters(_ list: [GoatWalletAdapter]) {
        for adapter in list { adapters[adapter.chainFamily] = adapter }
    }

    @discardableResult
    public func unregisterAdapter(_ family: ChainFamily) -> Bool {
        adapters.removeValue(forKey: family) != nil
    }

    public func getAdapter(_ family: ChainFamily) -> GoatWalletAdapter? {
        adapters[family]
    }

    public func registeredFamilies() -> Set<ChainFamily> {
        Set(adapters.keys)
    }

    public func requireAdapter(_ family: ChainFamily) throws -> GoatWalletAdapter {
        guard let adapter = adapters[family] else {
            throw Web3Error(
                .noAdapterRegistered,
                "No GoatWalletAdapter registered for chain family \(family.rawValue). "
                    + "Register one via GoatWeb3WalletManager.registerAdapter(_:)."
            )
        }
        return adapter
    }

    /// Claims `key` for the caller, or throws `WALLET_ACTION_IN_PROGRESS` when another operation
    /// already holds it. Fails fast rather than queueing so a double-tap or a replayed payload
    /// cannot open two signing ceremonies for one account/nonce.
    private func beginExclusive(_ key: String) throws {
        guard !inFlightKeys.contains(key) else {
            throw Web3Error(.walletActionInProgress, "Another wallet operation is already in progress for \(key)")
        }
        inFlightKeys.insert(key)
    }

    private func endExclusive(_ key: String) {
        inFlightKeys.remove(key)
    }

    public func withExclusiveKey<T: Sendable>(_ key: String, _ block: () async throws -> T) async throws -> T {
        try beginExclusive(key)
        defer { endExclusive(key) }
        return try await block()
    }

    public func inFlightKeyCount() -> Int { inFlightKeys.count }

    public func putSession(appId: String, family: ChainFamily, account: Web3WalletAccount) {
        sessions[Self.sessionKey(appId, family)] = account
    }

    public func getSession(appId: String, family: ChainFamily) -> Web3WalletAccount? {
        sessions[Self.sessionKey(appId, family)]
    }

    public func getAnySession(appId: String) -> Web3WalletAccount? {
        for family in ChainFamily.allCases {
            if let found = sessions[Self.sessionKey(appId, family)] { return found }
        }
        return nil
    }

    @discardableResult
    public func clearSession(appId: String, family: ChainFamily) -> Bool {
        sessions.removeValue(forKey: Self.sessionKey(appId, family)) != nil
    }

    @discardableResult
    public func clearAllSessions(appId: String) -> Bool {
        var cleared = false
        for family in ChainFamily.allCases {
            if clearSession(appId: appId, family: family) { cleared = true }
        }
        return cleared
    }

    private static func sessionKey(_ appId: String, _ family: ChainFamily) -> String {
        "\(appId):\(family.rawValue)"
    }
}
