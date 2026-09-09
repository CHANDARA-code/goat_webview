package com.goat.webview.feature.web3.ton

import com.goat.webview.feature.web3.spi.ChainFamily
import com.goat.webview.feature.web3.spi.DecodedTransactionPreview
import com.goat.webview.feature.web3.spi.GoatWalletAdapter
import com.goat.webview.feature.web3.spi.WalletAccountInfo
import com.goat.webview.feature.web3.spi.WalletContext
import com.goat.webview.feature.web3.spi.Web3ErrorCode
import com.goat.webview.feature.web3.spi.Web3Exception
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.math.BigInteger

/** The signing half of the TON adapter, supplied by the host. goat holds no key material. */
interface GoatTonSigner {
    val walletName: String
    suspend fun account(chainId: String, manifestUrl: String?, ctx: WalletContext): WalletAccountInfo
    suspend fun signTransaction(txData: JsonObject, ctx: WalletContext): JsonObject
    suspend fun signMessage(message: String, messageType: String, ctx: WalletContext): JsonObject
    suspend fun disconnect(ctx: WalletContext) {}
}

/**
 * TON adapter. Its job before signing is to turn the Base64 BOC payload the dApp supplies into a
 * sentence — without that, a TonConnect `sendTransaction` is pure blind signing.
 */
class GoatTonWalletAdapter(
    private val signer: GoatTonSigner,
    override val supportedChainIds: List<String> = listOf(MAINNET, TESTNET),
    private val parser: TonBocParser = TonBocParser()
) : GoatWalletAdapter {

    companion object {
        const val MAINNET = "-239"
        const val TESTNET = "-3"
        private val NANOTON = BigInteger.TEN.pow(9)
    }

    override val chainFamily: ChainFamily = ChainFamily.TON

    override suspend fun connect(
        chains: List<String>,
        manifestUrl: String?,
        ctx: WalletContext
    ): Result<WalletAccountInfo> = runCatching {
        val chainId = chains.firstOrNull { supportedChainIds.contains(it) }
            ?: supportedChainIds.first()
        signer.account(chainId, manifestUrl, ctx)
    }

    override suspend fun disconnect(ctx: WalletContext): Result<Boolean> = runCatching {
        signer.disconnect(ctx)
        true
    }

    override suspend fun decodeTransaction(
        txData: JsonObject,
        ctx: WalletContext
    ): Result<DecodedTransactionPreview> = runCatching {
        val to = txData.str("to") ?: txData.str("address")
            ?: throw Web3Exception(Web3ErrorCode.INVALID_PARAMETERS, "Transaction is missing a destination")
        val amount = txData.bigInt("value") ?: txData.bigInt("amount") ?: BigInteger.ZERO
        val payload = txData.str("data") ?: txData.str("payload")

        val decoded = payload?.let {
            runCatching { parser.decodePayload(it) }.getOrElse { error ->
                DecodedBocPayload(
                    opcode = "0x", kind = "malformed",
                    summary = "Payload could not be parsed: ${error.message}",
                    isKnown = false,
                    warnings = listOf("MALFORMED PAYLOAD: this message could not be decoded and may be hostile.")
                )
            }
        }

        val warnings = buildList {
            addAll(decoded?.warnings ?: emptyList())
            if (decoded != null && !decoded.isKnown) add("Unverified Contract — payload cannot be decoded.")
        }

        DecodedTransactionPreview(
            networkName = if (txData.str("chainId") == TESTNET) "TON Testnet" else "TON",
            recipient = decoded?.destination ?: to,
            valueFormatted = formatTon(amount),
            feeFormatted = "network fee applies",
            methodName = decoded?.kind ?: "transfer",
            methodDescription = decoded?.summary ?: "Send TON to $to",
            isUnverifiedContract = decoded != null && !decoded.isKnown,
            simulationSuccess = true,
            warnings = warnings
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
                "Chain $targetChainId is not a TON network known to this adapter"
            )
        }
        true
    }

    private fun formatTon(nanotons: BigInteger): String {
        val whole = nanotons.divide(NANOTON)
        val fraction = nanotons.mod(NANOTON).toString().padStart(9, '0').trimEnd('0')
        return if (fraction.isEmpty()) "$whole TON" else "$whole.$fraction TON"
    }

    private fun JsonObject.str(key: String): String? =
        this[key]?.let { runCatching { (it as JsonPrimitive).content }.getOrNull() }
            ?.takeIf { it.isNotBlank() && it != "null" }

    private fun JsonObject.bigInt(key: String): BigInteger? =
        str(key)?.let { runCatching { BigInteger(it) }.getOrNull() }
}
