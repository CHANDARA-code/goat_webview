import Foundation

public enum Web3ErrorCode: String, Sendable {
    case gestureRequired = "GESTURE_REQUIRED"
    case originNotAllowed = "ORIGIN_NOT_ALLOWED"
    case userCancelled = "USER_CANCELLED"
    case chainUnsupported = "CHAIN_UNSUPPORTED"
    case chainDisconnected = "CHAIN_DISCONNECTED"
    case disconnected = "DISCONNECTED"
    case notSupported = "NOT_SUPPORTED"
    case simulationFailed = "SIMULATION_FAILED"
    case invalidParameters = "INVALID_PARAMETERS"
    case internalError = "INTERNAL_ERROR"
    case noAdapterRegistered = "NO_ADAPTER_REGISTERED"
    case walletActionInProgress = "WALLET_ACTION_IN_PROGRESS"
    case walletNotConnected = "WALLET_NOT_CONNECTED"
}

public struct Web3Error: LocalizedError, Sendable {
    public let code: Web3ErrorCode
    public let detail: String

    public init(_ code: Web3ErrorCode, _ detail: String) {
        self.code = code
        self.detail = detail
    }

    public var errorDescription: String? { "\(code.rawValue): \(detail)" }
}

public struct Web3SignTxPayload: Codable, Sendable {
    public let chainFamily: ChainFamily
    public let chainId: String
    public let txDataRaw: String

    public init(chainFamily: ChainFamily, chainId: String, txDataRaw: String) {
        self.chainFamily = chainFamily
        self.chainId = chainId
        self.txDataRaw = txDataRaw
    }

    public func txField(_ key: String) -> String? {
        guard let data = txDataRaw.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        if let s = object[key] as? String, !s.isEmpty { return s }
        if let n = object[key] as? NSNumber { return n.stringValue }
        return nil
    }
}

public struct Web3SignTxResponse: Codable, Sendable {
    public let signature: String
    public let txHash: String?
    public let network: String
    public let from: String
    public let status: String
    public let simulated: Bool

    public init(
        signature: String,
        txHash: String?,
        network: String,
        from: String,
        status: String,
        simulated: Bool = false
    ) {
        self.signature = signature
        self.txHash = txHash
        self.network = network
        self.from = from
        self.status = status
        self.simulated = simulated
    }

    public func toDictionary() -> [String: Any] {
        var dict: [String: Any] = [
            "signature": signature,
            "network": network,
            "from": from,
            "status": status
        ]
        if let txHash { dict["txHash"] = txHash }
        if simulated { dict["simulated"] = true }
        return dict
    }
}

public struct Web3SignMessageResponse: Codable, Sendable {
    public let signature: String
    public let address: String
    public let messageType: String
    public let simulated: Bool

    public init(signature: String, address: String, messageType: String, simulated: Bool = false) {
        self.signature = signature
        self.address = address
        self.messageType = messageType
        self.simulated = simulated
    }

    public func toDictionary() -> [String: Any] {
        var dict: [String: Any] = [
            "signature": signature,
            "address": address,
            "messageType": messageType
        ]
        if simulated { dict["simulated"] = true }
        return dict
    }
}

/// Wire shape of `WEB3_CONNECT_WALLET` / `WEB3_GET_ACCOUNT`, matching Android's
/// `Web3WalletAccount` field for field so one mini-app payload works on both platforms.
public struct Web3WalletAccount: Codable, Sendable, Equatable {
    public let address: String
    public let publicKey: String
    public let wallet: String
    public let network: String
    public let chainId: String

    public init(address: String, publicKey: String, wallet: String, network: String, chainId: String) {
        self.address = address
        self.publicKey = publicKey
        self.wallet = wallet
        self.network = network
        self.chainId = chainId
    }

    public init(info: WalletAccountInfo, network: String) {
        self.address = info.address
        self.publicKey = info.publicKey
        self.wallet = info.walletName
        self.network = network
        self.chainId = info.chainId
    }

    public func toDictionary() -> [String: Any] {
        [
            "address": address,
            "publicKey": publicKey,
            "wallet": wallet,
            "network": network,
            "chainId": chainId
        ]
    }

    public func withChainId(_ newChainId: String) -> Web3WalletAccount {
        Web3WalletAccount(
            address: address, publicKey: publicKey, wallet: wallet,
            network: network, chainId: newChainId
        )
    }
}

public enum WalletLockKey {
    private static let unkeyed = "-"

    /// Serialises operations that must not interleave for one account. EVM keys on nonce, Solana on
    /// recent blockhash, TON on `valid_until`; requests carrying none of those still share a
    /// per-account key so a double-tap cannot open two signing ceremonies.
    public static func forTransaction(
        chainFamily: ChainFamily,
        chainId: String,
        accountAddress: String,
        txPayload: Web3SignTxPayload
    ) -> String {
        let discriminator: String?
        switch chainFamily {
        case .evm, .custom:
            discriminator = txPayload.txField("nonce")
        case .solana:
            discriminator = txPayload.txField("recentBlockhash") ?? txPayload.txField("blockhash")
        case .ton:
            discriminator = txPayload.txField("valid_until") ?? txPayload.txField("validUntil")
        }
        return "\(chainFamily.rawValue):\(chainId):\(accountAddress):\(discriminator ?? unkeyed)"
    }

    public static func forSession(chainFamily: ChainFamily, chainId: String, accountAddress: String) -> String {
        "\(chainFamily.rawValue):\(chainId):\(accountAddress):session"
    }
}
