import Foundation
#if canImport(CryptoKit)
import CryptoKit
#endif

/**
 * REFERENCE SIMULATION — NOT A WALLET. Holds no key material and produces no cryptographic
 * signature: every value it returns is a deterministic SHA-256 placeholder prefixed `SIMULATED_`,
 * and every signing response carries `simulated: true`.
 *
 * It exists so the `WEB3_*` bridge surface, the injected EIP-6963/Solana/TonConnect providers and
 * the example mini-apps are exercisable without a wallet backend. A production host registers its
 * own `GoatWalletAdapter`, which replaces this one for that `ChainFamily`.
 */
public final class GoatReferenceWalletAdapter: GoatWalletAdapter, @unchecked Sendable {

    public static let simulatedPrefix = "SIMULATED_"

    public let chainFamily: ChainFamily
    public let supportedChainIds: [String]

    private let walletName = "Goat Reference Wallet (simulated)"

    public init(chainFamily: ChainFamily, supportedChainIds: [String]? = nil) {
        self.chainFamily = chainFamily
        self.supportedChainIds = supportedChainIds ?? Self.defaultChainIds(chainFamily)
    }

    public static func defaultChainIds(_ family: ChainFamily) -> [String] {
        switch family {
        case .evm: return ["1", "137", "42161", "56", "8453", "10"]
        case .solana: return ["solana:mainnet", "solana:devnet"]
        case .ton: return ["-239", "-3"]
        case .custom: return []
        }
    }

    public static func defaultSet() -> [GoatReferenceWalletAdapter] {
        [
            GoatReferenceWalletAdapter(chainFamily: .evm),
            GoatReferenceWalletAdapter(chainFamily: .solana),
            GoatReferenceWalletAdapter(chainFamily: .ton)
        ]
    }

    private func deriveAddress(appId: String) -> String {
        let seed = Self.sha256("\(chainFamily.rawValue):\(appId)")
        switch chainFamily {
        case .evm, .custom: return "0x" + String(seed.prefix(40))
        case .solana: return Self.simulatedPrefix + "SoL" + String(seed.prefix(40))
        case .ton: return Self.simulatedPrefix + "EQ" + String(seed.prefix(46))
        }
    }

    private func resolveChainId(_ requested: [String]) throws -> String {
        let fallback = supportedChainIds.first ?? "0"
        guard !requested.isEmpty else { return fallback }
        let normalized = requested.map { $0.replacingOccurrences(of: "eip155:", with: "") }
        guard let match = normalized.first(where: { supportedChainIds.contains($0) }) else {
            throw Web3Error(
                .chainUnsupported,
                "Chain(s) \(requested.joined(separator: ", ")) not supported by \(chainFamily.rawValue) reference adapter"
            )
        }
        return match
    }

    private var networkLabel: String {
        switch chainFamily {
        case .evm: return "evm"
        case .solana: return "solana"
        case .ton: return "ton"
        case .custom: return "custom"
        }
    }

    public func connect(chains: [String], manifestUrl: String?, ctx: WalletContext) async throws -> WalletAccountInfo {
        let chainId = try resolveChainId(chains)
        let address = deriveAddress(appId: ctx.appId)
        return WalletAccountInfo(
            address: address,
            publicKey: Self.simulatedPrefix + "PUBKEY_" + String(Self.sha256(address).prefix(32)),
            chainId: chainId,
            walletName: walletName
        )
    }

    public func disconnect(ctx: WalletContext) async throws -> Bool { true }

    public func decodeTransaction(
        txPayload: Web3SignTxPayload,
        ctx: WalletContext
    ) async throws -> DecodedTransactionPreview {
        guard let to = txPayload.txField("to") ?? txPayload.txField("address") else {
            throw Web3Error(.invalidParameters, "Transaction is missing a recipient")
        }
        let value = txPayload.txField("value") ?? txPayload.txField("amount") ?? "0"
        let data = txPayload.txField("data") ?? txPayload.txField("payload")
        let hasCalldata = (data?.isEmpty == false) && data != "0x"

        return DecodedTransactionPreview(
            networkName: networkLabel,
            recipient: to,
            valueFormatted: value,
            feeFormatted: "unknown",
            methodName: hasCalldata ? "contractCall" : "transfer",
            methodDescription: hasCalldata
                ? "Calldata present. The reference adapter does not decode calldata — register a production adapter for human-readable decoding."
                : "Native value transfer",
            isUnverifiedContract: hasCalldata,
            simulationSuccess: true,
            warnings: ["Reference adapter: this preview is not derived from a real chain simulation."]
        )
    }

    public func signTransaction(
        txPayload: Web3SignTxPayload,
        preview: DecodedTransactionPreview,
        ctx: WalletContext
    ) async throws -> Web3SignTxResponse {
        let address = deriveAddress(appId: ctx.appId)
        let digest = Self.sha256(
            "\(ctx.appId)|\(chainFamily.rawValue)|\(preview.recipient)|\(preview.valueFormatted)|\(txPayload.txDataRaw)"
        )
        return Web3SignTxResponse(
            signature: Self.simulatedPrefix + "SIG_" + String(digest.prefix(64)),
            txHash: "0x" + digest,
            network: networkLabel,
            from: address,
            status: "SIMULATED",
            simulated: true
        )
    }

    public func signMessage(
        message: String,
        messageType: String,
        ctx: WalletContext
    ) async throws -> Web3SignMessageResponse {
        let address = deriveAddress(appId: ctx.appId)
        return Web3SignMessageResponse(
            signature: Self.simulatedPrefix + "MSGSIG_"
                + String(Self.sha256("\(messageType)|\(message)|\(address)").prefix(64)),
            address: address,
            messageType: messageType,
            simulated: true
        )
    }

    public func switchChain(targetChainId: String, addChainParams: String?, ctx: WalletContext) async throws -> Bool {
        let normalized = targetChainId.replacingOccurrences(of: "eip155:", with: "")
        guard supportedChainIds.contains(normalized) else {
            throw Web3Error(
                .chainUnsupported,
                "Chain \(targetChainId) is not configured on the \(chainFamily.rawValue) reference adapter"
            )
        }
        return true
    }

    static func sha256(_ input: String) -> String {
        let data = Data(input.utf8)
        #if canImport(CryptoKit)
        return SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        #else
        return String(format: "%016lx", UInt(bitPattern: input.hashValue))
        #endif
    }
}
