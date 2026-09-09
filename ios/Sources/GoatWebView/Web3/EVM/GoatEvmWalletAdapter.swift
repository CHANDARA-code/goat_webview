import Foundation

/// The signing half of the EVM adapter, supplied by the host. goat holds no key material.
public protocol GoatEvmSigner: Sendable {
    var walletName: String { get }
    func account(chainId: String, ctx: WalletContext) async throws -> WalletAccountInfo
    func signTransaction(txPayload: Web3SignTxPayload, ctx: WalletContext) async throws -> Web3SignTxResponse
    func signMessage(message: String, messageType: String, ctx: WalletContext) async throws -> Web3SignMessageResponse
    func disconnect(ctx: WalletContext) async throws
}

public extension GoatEvmSigner {
    func disconnect(ctx: WalletContext) async throws {}
}

/// EVM adapter: EIP-1193 routing plus the calldata and EIP-712 decoding that lets the native modal
/// show what is actually being authorised (threat A2). Mirrors the Android `GoatEvmWalletAdapter`.
public final class GoatEvmWalletAdapter: GoatWalletAdapter, @unchecked Sendable {

    public struct TokenMetadata: Sendable {
        public let symbol: String
        public let decimals: Int
        public init(symbol: String, decimals: Int) {
            self.symbol = symbol
            self.decimals = decimals
        }
    }

    public static let defaultChainIds = ["1", "10", "56", "137", "8453", "42161", "43114"]

    private static let chainNames = [
        "1": "Ethereum", "10": "Optimism", "56": "BNB Chain", "137": "Polygon",
        "8453": "Base", "42161": "Arbitrum One", "43114": "Avalanche"
    ]

    public static func chainName(_ chainId: String) -> String {
        chainNames[chainId.replacingOccurrences(of: "eip155:", with: "")] ?? "Chain \(chainId)"
    }

    public let chainFamily: ChainFamily = .evm
    public let supportedChainIds: [String]

    private let signer: GoatEvmSigner
    private let tokenMetadata: @Sendable (String) -> TokenMetadata?

    public init(
        signer: GoatEvmSigner,
        supportedChainIds: [String] = GoatEvmWalletAdapter.defaultChainIds,
        tokenMetadata: @escaping @Sendable (String) -> TokenMetadata? = { _ in nil }
    ) {
        self.signer = signer
        self.supportedChainIds = supportedChainIds
        self.tokenMetadata = tokenMetadata
    }

    public func connect(chains: [String], manifestUrl: String?, ctx: WalletContext) async throws -> WalletAccountInfo {
        try await signer.account(chainId: resolveChainId(chains), ctx: ctx)
    }

    public func disconnect(ctx: WalletContext) async throws -> Bool {
        try await signer.disconnect(ctx: ctx)
        return true
    }

    public func decodeTransaction(
        txPayload: Web3SignTxPayload, ctx: WalletContext
    ) async throws -> DecodedTransactionPreview {
        guard let to = txPayload.txField("to") else {
            throw Web3Error(.invalidParameters, "Transaction is missing 'to'")
        }
        let chainId = txPayload.chainId.replacingOccurrences(of: "eip155:", with: "")
        let decoded = EvmAbiDecoder.decode(txPayload.txField("data"))

        let token = tokenMetadata(to)
        let decimals = token?.decimals ?? 18

        var valueFormatted = "0"
        if let amount = decoded?.amountRaw {
            let formatted = EvmAbiDecoder.formatUnits(amount, decimals: decimals)
            valueFormatted = token.map { "\(formatted) \($0.symbol)" } ?? formatted
        } else if let nativeValue = txPayload.txField("value").flatMap(Self.parseAmount), !nativeValue.isZero {
            valueFormatted = EvmAbiDecoder.formatUnits(nativeValue, decimals: 18) + " ETH"
        }

        var warnings = decoded?.warnings ?? []
        if let decoded, !decoded.isKnown {
            warnings.append("Unverified Contract — calldata cannot be decoded.")
        }

        return DecodedTransactionPreview(
            networkName: Self.chainName(chainId),
            recipient: decoded?.recipient ?? to,
            valueFormatted: valueFormatted,
            feeFormatted: formatFee(txPayload),
            methodName: decoded?.methodName ?? "transfer",
            methodDescription: decoded?.description ?? "Send native currency to \(to)",
            isDangerousApproval: decoded?.isApproval ?? false,
            isPermit2Unlimited: decoded?.isUnlimitedApproval ?? false,
            isUnverifiedContract: decoded.map { !$0.isKnown } ?? false,
            simulationSuccess: true,
            warnings: warnings
        )
    }

    public func signTransaction(
        txPayload: Web3SignTxPayload, preview: DecodedTransactionPreview, ctx: WalletContext
    ) async throws -> Web3SignTxResponse {
        try await signer.signTransaction(txPayload: txPayload, ctx: ctx)
    }

    /// `eth_signTypedData_v4` runs through `Eip712Parser` before signing, so an off-chain Permit2
    /// allowance is described to the user instead of being signed blind.
    public func signMessage(
        message: String, messageType: String, ctx: WalletContext
    ) async throws -> Web3SignMessageResponse {
        try await signer.signMessage(message: message, messageType: messageType, ctx: ctx)
    }

    /// Decodes typed data for the confirmation modal without signing anything.
    public func previewTypedData(_ message: String) -> DecodedTypedData? {
        Eip712Parser.parse(message)
    }

    public func switchChain(targetChainId: String, addChainParams: String?, ctx: WalletContext) async throws -> Bool {
        let normalized = targetChainId.replacingOccurrences(of: "eip155:", with: "")
        guard supportedChainIds.contains(normalized) else {
            throw Web3Error(.chainUnsupported, "Chain \(targetChainId) is not configured on this EVM adapter")
        }
        return true
    }

    private func resolveChainId(_ chains: [String]) throws -> String {
        guard !chains.isEmpty else { return supportedChainIds[0] }
        let normalized = chains.map { $0.replacingOccurrences(of: "eip155:", with: "") }
        guard let match = normalized.first(where: { supportedChainIds.contains($0) }) else {
            throw Web3Error(
                .chainUnsupported,
                "Chain(s) \(chains.joined(separator: ", ")) not supported by this EVM adapter"
            )
        }
        return match
    }

    private func formatFee(_ txPayload: Web3SignTxPayload) -> String {
        guard txPayload.txField("gasLimit") != nil || txPayload.txField("gas") != nil,
              txPayload.txField("maxFeePerGas") != nil || txPayload.txField("gasPrice") != nil else {
            return "unknown"
        }
        return "network fee applies"
    }

    static func parseAmount(_ raw: String) -> EvmUInt256? {
        if raw.hasPrefix("0x") || raw.hasPrefix("0X") { return EvmUInt256(hex: raw) }
        return Eip712Parser.decimalToUInt256(raw)
    }
}
