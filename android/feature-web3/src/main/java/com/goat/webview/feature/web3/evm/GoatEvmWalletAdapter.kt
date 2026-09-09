package com.goat.webview.feature.web3.evm

import com.goat.webview.feature.web3.spi.ChainFamily
import com.goat.webview.feature.web3.spi.DecodedTransactionPreview
import com.goat.webview.feature.web3.spi.GoatWalletAdapter
import com.goat.webview.feature.web3.spi.WalletAccountInfo
import com.goat.webview.feature.web3.spi.WalletContext
import com.goat.webview.feature.web3.spi.Web3ErrorCode
import com.goat.webview.feature.web3.spi.Web3Exception
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.math.BigInteger

/**
 * The signing half of the EVM adapter, supplied by the host.
 *
 * goat performs the decoding and renders the confirmation; it holds no key material. A host backs
 * this with its own keystore, a hardware wallet, or an external signer.
 */
interface GoatEvmSigner {
    val walletName: String
    suspend fun account(chainId: String, ctx: WalletContext): WalletAccountInfo
    suspend fun signTransaction(txData: JsonObject, chainId: String, ctx: WalletContext): JsonObject
    suspend fun signMessage(message: String, messageType: String, ctx: WalletContext): JsonObject
    suspend fun disconnect(ctx: WalletContext) {}
}

/**
 * EVM adapter: EIP-1193 method routing plus the calldata and EIP-712 decoding that lets the native
 * modal show what is actually being authorised (threat A2).
 */
class GoatEvmWalletAdapter(
    private val signer: GoatEvmSigner,
    override val supportedChainIds: List<String> = DEFAULT_CHAIN_IDS,
    private val tokenMetadata: (String) -> TokenMetadata? = { null }
) : GoatWalletAdapter {

    data class TokenMetadata(val symbol: String, val decimals: Int)

    companion object {
        val DEFAULT_CHAIN_IDS = listOf("1", "10", "56", "137", "8453", "42161", "43114")

        private val CHAIN_NAMES = mapOf(
            "1" to "Ethereum", "10" to "Optimism", "56" to "BNB Chain", "137" to "Polygon",
            "8453" to "Base", "42161" to "Arbitrum One", "43114" to "Avalanche"
        )

        fun chainName(chainId: String): String =
            CHAIN_NAMES[chainId.removePrefix("eip155:")] ?: "Chain $chainId"
    }

    override val chainFamily: ChainFamily = ChainFamily.EVM

    override suspend fun connect(
        chains: List<String>,
        manifestUrl: String?,
        ctx: WalletContext
    ): Result<WalletAccountInfo> = runCatching {
        val chainId = resolveChainId(chains)
        signer.account(chainId, ctx)
    }

    override suspend fun disconnect(ctx: WalletContext): Result<Boolean> = runCatching {
        signer.disconnect(ctx)
        true
    }

    override suspend fun decodeTransaction(
        txData: JsonObject,
        ctx: WalletContext
    ): Result<DecodedTransactionPreview> = runCatching {
        val to = txData.str("to")
            ?: throw Web3Exception(Web3ErrorCode.INVALID_PARAMETERS, "Transaction is missing 'to'")
        val chainId = txData.str("chainId")?.removePrefix("eip155:") ?: supportedChainIds.first()
        val decoded = EvmAbiDecoder.decode(txData.str("data"))
        val nativeValue = txData.bigInt("value") ?: BigInteger.ZERO

        val token = tokenMetadata(to)
        val decimals = token?.decimals ?: 18
        val symbol = token?.symbol

        val valueFormatted = when {
            decoded?.amountRaw != null -> {
                val amount = EvmAbiDecoder.formatUnits(decoded.amountRaw, decimals)
                if (symbol != null) "$amount $symbol" else amount
            }
            nativeValue.signum() > 0 -> EvmAbiDecoder.formatUnits(nativeValue, 18) + " ETH"
            else -> "0"
        }

        val warnings = buildList {
            addAll(decoded?.warnings ?: emptyList())
            if (decoded != null && !decoded.isKnown) {
                add("Unverified Contract — calldata cannot be decoded.")
            }
        }

        DecodedTransactionPreview(
            networkName = chainName(chainId),
            recipient = decoded?.recipient ?: to,
            valueFormatted = valueFormatted,
            feeFormatted = formatFee(txData),
            methodName = decoded?.methodName ?: "transfer",
            methodDescription = decoded?.description ?: "Send native currency to $to",
            isDangerousApproval = decoded?.isApproval == true,
            isPermit2Unlimited = decoded?.isUnlimitedApproval == true,
            isUnverifiedContract = decoded != null && !decoded.isKnown,
            simulationSuccess = true,
            warnings = warnings
        )
    }

    override suspend fun signTransaction(
        txData: JsonObject,
        preview: DecodedTransactionPreview,
        ctx: WalletContext
    ): Result<JsonObject> = runCatching {
        val chainId = txData.str("chainId")?.removePrefix("eip155:") ?: supportedChainIds.first()
        signer.signTransaction(txData, chainId, ctx)
    }

    /**
     * `eth_signTypedData_v4` runs through [Eip712Parser] before signing, so an off-chain Permit2
     * allowance is described to the user instead of being signed blind.
     */
    override suspend fun signMessage(
        message: String,
        messageType: String,
        ctx: WalletContext
    ): Result<JsonObject> = runCatching {
        val signed = signer.signMessage(message, messageType, ctx)
        if (messageType != "eth_signTypedData_v4") return@runCatching signed

        val decoded = Eip712Parser.parse(message)
        buildJsonObject {
            signed.forEach { (k, v) -> put(k, v) }
            if (decoded != null) {
                put("decodedSummary", decoded.summary)
                put("isPermit", decoded.isPermit)
                put("isUnlimitedAllowance", decoded.isUnlimitedAllowance)
                put("isLongLivedApproval", decoded.isLongLivedApproval)
            }
        }
    }

    /** Decodes typed data for the confirmation modal without signing anything. */
    fun previewTypedData(message: String): DecodedTypedData? = Eip712Parser.parse(message)

    override suspend fun switchChain(
        targetChainId: String,
        addChainParams: JsonObject?,
        ctx: WalletContext
    ): Result<Boolean> = runCatching {
        val normalized = targetChainId.removePrefix("eip155:")
        if (!supportedChainIds.contains(normalized)) {
            throw Web3Exception(
                Web3ErrorCode.CHAIN_UNSUPPORTED,
                "Chain $targetChainId is not configured on this EVM adapter"
            )
        }
        true
    }

    private fun resolveChainId(chains: List<String>): String {
        if (chains.isEmpty()) return supportedChainIds.first()
        val normalized = chains.map { it.removePrefix("eip155:") }
        return normalized.firstOrNull { supportedChainIds.contains(it) }
            ?: throw Web3Exception(
                Web3ErrorCode.CHAIN_UNSUPPORTED,
                "Chain(s) ${chains.joinToString()} not supported by this EVM adapter"
            )
    }

    private fun formatFee(txData: JsonObject): String {
        val gasLimit = txData.bigInt("gasLimit") ?: txData.bigInt("gas") ?: return "unknown"
        val maxFee = txData.bigInt("maxFeePerGas") ?: txData.bigInt("gasPrice") ?: return "unknown"
        return EvmAbiDecoder.formatUnits(gasLimit.multiply(maxFee), 18) + " ETH"
    }

    private fun JsonObject.str(key: String): String? =
        this[key]?.let { runCatching { (it as JsonPrimitive).content }.getOrNull() }
            ?.takeIf { it.isNotBlank() && it != "null" }

    private fun JsonObject.bigInt(key: String): BigInteger? {
        val raw = str(key) ?: return null
        return runCatching {
            if (raw.startsWith("0x") || raw.startsWith("0X")) BigInteger(raw.substring(2), 16)
            else BigInteger(raw)
        }.getOrNull()
    }
}
