package com.goat.webview.feature.web3.solana

import com.goat.webview.feature.web3.spi.ChainFamily
import com.goat.webview.feature.web3.spi.DecodedTransactionPreview
import com.goat.webview.feature.web3.spi.GoatWalletAdapter
import com.goat.webview.feature.web3.spi.WalletAccountInfo
import com.goat.webview.feature.web3.spi.WalletContext
import com.goat.webview.feature.web3.spi.Web3ErrorCode
import com.goat.webview.feature.web3.spi.Web3Exception
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** The signing half of the Solana adapter, supplied by the host. goat holds no key material. */
interface GoatSolanaSigner {
    val walletName: String
    suspend fun account(chainId: String, ctx: WalletContext): WalletAccountInfo
    suspend fun signTransaction(txData: JsonObject, ctx: WalletContext): JsonObject
    suspend fun signMessage(message: String, messageType: String, ctx: WalletContext): JsonObject
    suspend fun disconnect(ctx: WalletContext) {}
}

/**
 * Solana adapter. Decodes both legacy and v0 wire transactions so the confirmation modal can name
 * the programs being called and the amounts moving, instead of showing an opaque blob.
 */
class GoatSolanaWalletAdapter(
    private val signer: GoatSolanaSigner,
    override val supportedChainIds: List<String> = listOf(MAINNET, DEVNET, TESTNET)
) : GoatWalletAdapter {

    companion object {
        const val MAINNET = "solana:mainnet"
        const val DEVNET = "solana:devnet"
        const val TESTNET = "solana:testnet"
    }

    override val chainFamily: ChainFamily = ChainFamily.SOLANA

    override suspend fun connect(
        chains: List<String>,
        manifestUrl: String?,
        ctx: WalletContext
    ): Result<WalletAccountInfo> = runCatching {
        val chainId = chains.firstOrNull { supportedChainIds.contains(it) } ?: MAINNET
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
        val wire = txData.str("transaction") ?: txData.str("message") ?: txData.str("data")
            ?: throw Web3Exception(
                Web3ErrorCode.INVALID_PARAMETERS,
                "Transaction payload is missing a serialised message"
            )

        val decoded = try {
            SolanaTxDecoder.decodeBase64(wire)
        } catch (e: SolanaMalformedTransactionException) {
            return@runCatching DecodedTransactionPreview(
                networkName = networkName(txData),
                recipient = txData.str("to") ?: "unknown",
                valueFormatted = "unknown",
                feeFormatted = "unknown",
                methodName = "malformed",
                methodDescription = "Transaction could not be parsed: ${e.message}",
                isUnverifiedContract = true,
                simulationSuccess = false,
                warnings = listOf("MALFORMED TRANSACTION: this payload could not be decoded and may be hostile.")
            )
        }

        val primary = decoded.instructions.firstOrNull { it.kind != "compute_budget" }
            ?: decoded.instructions.firstOrNull()

        DecodedTransactionPreview(
            networkName = networkName(txData),
            recipient = primary?.destination ?: decoded.feePayer,
            valueFormatted = primary?.let {
                if (it.amountRaw != null && it.decimals != null) {
                    SolanaTxDecoder.formatUnits(it.amountRaw, it.decimals)
                } else {
                    it.amountRaw?.toString() ?: "0"
                }
            } ?: "0",
            feeFormatted = "network fee applies",
            methodName = primary?.kind ?: "unknown",
            methodDescription = decoded.instructions.joinToString("; ") { it.summary },
            isUnverifiedContract = decoded.instructions.any { !it.isKnown },
            simulationSuccess = true,
            warnings = decoded.warnings
        )
    }

    override suspend fun signTransaction(
        txData: JsonObject,
        preview: DecodedTransactionPreview,
        ctx: WalletContext
    ): Result<JsonObject> = runCatching { signer.signTransaction(txData, ctx) }

    override suspend fun signMessage(
        message: String,
        messageType: String,
        ctx: WalletContext
    ): Result<JsonObject> = runCatching { signer.signMessage(message, messageType, ctx) }

    override suspend fun switchChain(
        targetChainId: String,
        addChainParams: JsonObject?,
        ctx: WalletContext
    ): Result<Boolean> = runCatching {
        if (!supportedChainIds.contains(targetChainId)) {
            throw Web3Exception(
                Web3ErrorCode.CHAIN_UNSUPPORTED,
                "Cluster $targetChainId is not known to this Solana adapter"
            )
        }
        true
    }

    private fun networkName(txData: JsonObject): String = when (txData.str("chainId")) {
        DEVNET -> "Solana Devnet"
        TESTNET -> "Solana Testnet"
        else -> "Solana"
    }

    private fun JsonObject.str(key: String): String? =
        this[key]?.let { runCatching { (it as JsonPrimitive).content }.getOrNull() }
            ?.takeIf { it.isNotBlank() && it != "null" }
}
