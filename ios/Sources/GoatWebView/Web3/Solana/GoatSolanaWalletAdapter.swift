import Foundation

/// The signing half of the Solana adapter, supplied by the host. goat holds no key material.
public protocol GoatSolanaSigner: Sendable {
    var walletName: String { get }
    func account(chainId: String, ctx: WalletContext) async throws -> WalletAccountInfo
    func signTransaction(txPayload: Web3SignTxPayload, ctx: WalletContext) async throws -> Web3SignTxResponse
    func signMessage(message: String, messageType: String, ctx: WalletContext) async throws -> Web3SignMessageResponse
    func disconnect(ctx: WalletContext) async throws
}

public extension GoatSolanaSigner {
    func disconnect(ctx: WalletContext) async throws {}
}

/// Solana adapter. Decodes legacy and v0 wire transactions so the modal can name the programs
/// being called and the amounts moving. Mirrors the Android `GoatSolanaWalletAdapter`.
public final class GoatSolanaWalletAdapter: GoatWalletAdapter, @unchecked Sendable {

    public static let mainnet = "solana:mainnet"
    public static let devnet = "solana:devnet"
    public static let testnet = "solana:testnet"

    public let chainFamily: ChainFamily = .solana
    public let supportedChainIds: [String]

    private let signer: GoatSolanaSigner

    public init(
        signer: GoatSolanaSigner,
        supportedChainIds: [String] = [
            GoatSolanaWalletAdapter.mainnet, GoatSolanaWalletAdapter.devnet, GoatSolanaWalletAdapter.testnet
        ]
    ) {
        self.signer = signer
        self.supportedChainIds = supportedChainIds
    }

    public func connect(chains: [String], manifestUrl: String?, ctx: WalletContext) async throws -> WalletAccountInfo {
        let chainId = chains.first(where: { supportedChainIds.contains($0) }) ?? Self.mainnet
        return try await signer.account(chainId: chainId, ctx: ctx)
    }

    public func disconnect(ctx: WalletContext) async throws -> Bool {
        try await signer.disconnect(ctx: ctx)
        return true
    }

    public func decodeTransaction(
        txPayload: Web3SignTxPayload, ctx: WalletContext
    ) async throws -> DecodedTransactionPreview {
        guard let wire = txPayload.txField("transaction")
            ?? txPayload.txField("message")
            ?? txPayload.txField("data") else {
            throw Web3Error(.invalidParameters, "Transaction payload is missing a serialised message")
        }

        let decoded: DecodedSolanaTransaction
        do {
            decoded = try SolanaTxDecoder.decodeBase64(wire)
        } catch {
            let detail = (error as? SolanaMalformedTransactionError)?.detail ?? error.localizedDescription
            return DecodedTransactionPreview(
                networkName: networkName(txPayload),
                recipient: txPayload.txField("to") ?? "unknown",
                valueFormatted: "unknown",
                feeFormatted: "unknown",
                methodName: "malformed",
                methodDescription: "Transaction could not be parsed: \(detail)",
                isUnverifiedContract: true,
                simulationSuccess: false,
                warnings: ["MALFORMED TRANSACTION: this payload could not be decoded and may be hostile."]
            )
        }

        let primary = decoded.instructions.first(where: { $0.kind != "compute_budget" })
            ?? decoded.instructions.first

        var valueFormatted = "0"
        if let primary, let amount = primary.amountRaw {
            valueFormatted = primary.decimals.map {
                SolanaTxDecoder.formatUnits(amount, decimals: $0)
            } ?? String(amount)
        }

        return DecodedTransactionPreview(
            networkName: networkName(txPayload),
            recipient: primary?.destination ?? decoded.feePayer,
            valueFormatted: valueFormatted,
            feeFormatted: "network fee applies",
            methodName: primary?.kind ?? "unknown",
            methodDescription: decoded.instructions.map(\.summary).joined(separator: "; "),
            isUnverifiedContract: decoded.instructions.contains { !$0.isKnown },
            simulationSuccess: true,
            warnings: decoded.warnings
        )
    }

    public func signTransaction(
        txPayload: Web3SignTxPayload, preview: DecodedTransactionPreview, ctx: WalletContext
    ) async throws -> Web3SignTxResponse {
        try await signer.signTransaction(txPayload: txPayload, ctx: ctx)
    }

    public func signMessage(
        message: String, messageType: String, ctx: WalletContext
    ) async throws -> Web3SignMessageResponse {
        try await signer.signMessage(message: message, messageType: messageType, ctx: ctx)
    }

    public func switchChain(targetChainId: String, addChainParams: String?, ctx: WalletContext) async throws -> Bool {
        guard supportedChainIds.contains(targetChainId) else {
            throw Web3Error(.chainUnsupported, "Cluster \(targetChainId) is not known to this Solana adapter")
        }
        return true
    }

    private func networkName(_ txPayload: Web3SignTxPayload) -> String {
        switch txPayload.chainId {
        case Self.devnet: return "Solana Devnet"
        case Self.testnet: return "Solana Testnet"
        default: return "Solana"
        }
    }
}
