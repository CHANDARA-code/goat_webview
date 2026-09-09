import Foundation

/// The signing half of the TON adapter, supplied by the host. goat holds no key material.
public protocol GoatTonSigner: Sendable {
    var walletName: String { get }
    func account(chainId: String, manifestUrl: String?, ctx: WalletContext) async throws -> WalletAccountInfo
    func signTransaction(txPayload: Web3SignTxPayload, ctx: WalletContext) async throws -> Web3SignTxResponse
    func signMessage(message: String, messageType: String, ctx: WalletContext) async throws -> Web3SignMessageResponse
    func disconnect(ctx: WalletContext) async throws
}

public extension GoatTonSigner {
    func disconnect(ctx: WalletContext) async throws {}
}

/// TON adapter. Turns the Base64 BOC payload a dApp supplies into a sentence before signing —
/// without that, a TonConnect `sendTransaction` is pure blind signing.
public final class GoatTonWalletAdapter: GoatWalletAdapter, @unchecked Sendable {

    public static let mainnet = "-239"
    public static let testnet = "-3"

    public let chainFamily: ChainFamily = .ton
    public let supportedChainIds: [String]

    private let signer: GoatTonSigner
    private let parser: TonBocParser

    public init(
        signer: GoatTonSigner,
        supportedChainIds: [String] = [GoatTonWalletAdapter.mainnet, GoatTonWalletAdapter.testnet],
        parser: TonBocParser = TonBocParser()
    ) {
        self.signer = signer
        self.supportedChainIds = supportedChainIds
        self.parser = parser
    }

    public func connect(chains: [String], manifestUrl: String?, ctx: WalletContext) async throws -> WalletAccountInfo {
        let chainId = chains.first(where: { supportedChainIds.contains($0) }) ?? supportedChainIds[0]
        return try await signer.account(chainId: chainId, manifestUrl: manifestUrl, ctx: ctx)
    }

    public func disconnect(ctx: WalletContext) async throws -> Bool {
        try await signer.disconnect(ctx: ctx)
        return true
    }

    public func decodeTransaction(
        txPayload: Web3SignTxPayload, ctx: WalletContext
    ) async throws -> DecodedTransactionPreview {
        guard let to = txPayload.txField("to") ?? txPayload.txField("address") else {
            throw Web3Error(.invalidParameters, "Transaction is missing a destination")
        }
        let amountRaw = txPayload.txField("value") ?? txPayload.txField("amount") ?? "0"
        let payload = txPayload.txField("data") ?? txPayload.txField("payload")

        var decoded: DecodedBocPayload?
        var warnings: [String] = []
        if let payload {
            do {
                decoded = try parser.decodePayload(payload)
                warnings = decoded?.warnings ?? []
                if let decoded, !decoded.isKnown {
                    warnings.append("Unverified Contract — payload cannot be decoded.")
                }
            } catch {
                let detail = (error as? BocMalformedError)?.detail ?? error.localizedDescription
                return DecodedTransactionPreview(
                    networkName: networkName(txPayload),
                    recipient: to,
                    valueFormatted: formatTon(amountRaw),
                    feeFormatted: "network fee applies",
                    methodName: "malformed",
                    methodDescription: "Payload could not be parsed: \(detail)",
                    isUnverifiedContract: true,
                    simulationSuccess: false,
                    warnings: ["MALFORMED PAYLOAD: this message could not be decoded and may be hostile."]
                )
            }
        }

        return DecodedTransactionPreview(
            networkName: networkName(txPayload),
            recipient: decoded?.destination ?? to,
            valueFormatted: formatTon(amountRaw),
            feeFormatted: "network fee applies",
            methodName: decoded?.kind ?? "transfer",
            methodDescription: decoded?.summary ?? "Send TON to \(to)",
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

    public func signMessage(
        message: String, messageType: String, ctx: WalletContext
    ) async throws -> Web3SignMessageResponse {
        try await signer.signMessage(message: message, messageType: messageType, ctx: ctx)
    }

    public func switchChain(targetChainId: String, addChainParams: String?, ctx: WalletContext) async throws -> Bool {
        guard supportedChainIds.contains(targetChainId) else {
            throw Web3Error(.chainUnsupported, "Chain \(targetChainId) is not a TON network known to this adapter")
        }
        return true
    }

    private func networkName(_ txPayload: Web3SignTxPayload) -> String {
        txPayload.chainId == Self.testnet ? "TON Testnet" : "TON"
    }

    /// Nanotons to TON, by string arithmetic so large values do not lose precision.
    func formatTon(_ nanotons: String) -> String {
        let digits = nanotons.allSatisfy { $0.isNumber } ? nanotons : "0"
        if digits.count <= 9 {
            let fraction = String(repeating: "0", count: 9 - digits.count) + digits
            let trimmed = trimZeros(fraction)
            return trimmed.isEmpty ? "0 TON" : "0.\(trimmed) TON"
        }
        let whole = String(digits.prefix(digits.count - 9))
        let fraction = trimZeros(String(digits.suffix(9)))
        return fraction.isEmpty ? "\(whole) TON" : "\(whole).\(fraction) TON"
    }

    private func trimZeros(_ value: String) -> String {
        var s = value
        while s.hasSuffix("0") { s.removeLast() }
        return s
    }
}
