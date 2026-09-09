import Foundation

public enum ChainFamily: String, Codable, Sendable, CaseIterable {
    case evm = "EVM"
    case solana = "SOLANA"
    case ton = "TON"
    case custom = "CUSTOM"

    public static func fromWireName(_ raw: String?) -> ChainFamily? {
        switch raw?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() {
        case "EVM", "ETHEREUM", "EIP155": return .evm
        case "SOLANA", "SVM": return .solana
        case "TON": return .ton
        case "CUSTOM": return .custom
        default: return nil
        }
    }

    /// Maps the legacy `network` parameter of `WEB3_CONNECT_WALLET` onto a chain family, so
    /// mini-apps written against the shipped wire contract keep working after the SPI migration.
    public static func fromNetworkName(_ network: String?) -> ChainFamily {
        let n = (network ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if n.hasPrefix("ton") { return .ton }
        if n.hasPrefix("solana") || n.hasPrefix("svm") { return .solana }
        return .evm
    }
}

public struct WalletContext: Sendable {
    public let appId: String
    public let origin: String

    public init(appId: String, origin: String) {
        self.appId = appId
        self.origin = origin
    }
}

public struct WalletAccountInfo: Codable, Sendable {
    public let address: String
    public let publicKey: String
    public let chainId: String
    public let walletName: String

    public init(address: String, publicKey: String, chainId: String, walletName: String) {
        self.address = address
        self.publicKey = publicKey
        self.chainId = chainId
        self.walletName = walletName
    }
}

public struct DecodedTransactionPreview: Codable, Sendable {
    public let networkName: String
    public let recipient: String
    public let recipientDomain: String?
    public let valueFormatted: String
    public let feeFormatted: String
    public let methodName: String
    public let methodDescription: String
    public let isDangerousApproval: Bool
    public let isPermit2Unlimited: Bool
    public let isUnverifiedContract: Bool
    public let simulationSuccess: Bool
    public let warnings: [String]

    public init(
        networkName: String,
        recipient: String,
        recipientDomain: String? = nil,
        valueFormatted: String,
        feeFormatted: String,
        methodName: String,
        methodDescription: String,
        isDangerousApproval: Bool = false,
        isPermit2Unlimited: Bool = false,
        isUnverifiedContract: Bool = false,
        simulationSuccess: Bool = true,
        warnings: [String] = []
    ) {
        self.networkName = networkName
        self.recipient = recipient
        self.recipientDomain = recipientDomain
        self.valueFormatted = valueFormatted
        self.feeFormatted = feeFormatted
        self.methodName = methodName
        self.methodDescription = methodDescription
        self.isDangerousApproval = isDangerousApproval
        self.isPermit2Unlimited = isPermit2Unlimited
        self.isUnverifiedContract = isUnverifiedContract
        self.simulationSuccess = simulationSuccess
        self.warnings = warnings
    }
}

public protocol GoatWalletAdapter: AnyObject, Sendable {
    var chainFamily: ChainFamily { get }
    var supportedChainIds: [String] { get }

    func connect(chains: [String], manifestUrl: String?, ctx: WalletContext) async throws -> WalletAccountInfo
    func disconnect(ctx: WalletContext) async throws -> Bool
    func decodeTransaction(txPayload: Web3SignTxPayload, ctx: WalletContext) async throws -> DecodedTransactionPreview
    func signTransaction(
        txPayload: Web3SignTxPayload,
        preview: DecodedTransactionPreview,
        ctx: WalletContext
    ) async throws -> Web3SignTxResponse
    func signMessage(message: String, messageType: String, ctx: WalletContext) async throws -> Web3SignMessageResponse
    func switchChain(targetChainId: String, addChainParams: String?, ctx: WalletContext) async throws -> Bool
}
