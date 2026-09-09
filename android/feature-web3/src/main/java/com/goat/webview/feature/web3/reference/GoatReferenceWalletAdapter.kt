package com.goat.webview.feature.web3.reference

import android.util.Log
import com.goat.webview.feature.web3.spi.ChainFamily
import com.goat.webview.feature.web3.spi.DecodedTransactionPreview
import com.goat.webview.feature.web3.spi.GoatWalletAdapter
import com.goat.webview.feature.web3.spi.WalletAccountInfo
import com.goat.webview.feature.web3.spi.WalletContext
import com.goat.webview.feature.web3.spi.Web3ErrorCode
import com.goat.webview.feature.web3.spi.Web3Exception
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.security.MessageDigest

/**
 * REFERENCE SIMULATION — NOT A WALLET. Holds no key material and produces no cryptographic
 * signature: every value it returns is a deterministic SHA-256 placeholder prefixed `SIMULATED_`,
 * and every signing response carries `"simulated": true`.
 *
 * It exists so the `WEB3_*` bridge surface, the injected EIP-6963/Solana/TonConnect providers and
 * the example mini-apps are exercisable without a wallet backend. A production host registers its
 * own [GoatWalletAdapter] — see `GoatWeb3Plugin(context, adapters = listOf(...))` — which replaces
 * this one for that [ChainFamily].
 */
class GoatReferenceWalletAdapter(
    override val chainFamily: ChainFamily,
    override val supportedChainIds: List<String> = defaultChainIds(chainFamily)
) : GoatWalletAdapter {

    companion object {
        private const val TAG = "GoatReferenceWallet"
        const val SIMULATED_PREFIX = "SIMULATED_"

        fun defaultChainIds(family: ChainFamily): List<String> = when (family) {
            ChainFamily.EVM -> listOf("1", "137", "42161", "56", "8453", "10")
            ChainFamily.SOLANA -> listOf("solana:mainnet", "solana:devnet")
            ChainFamily.TON -> listOf("-239", "-3")
            ChainFamily.CUSTOM -> emptyList()
        }

        fun defaultSet(): List<GoatReferenceWalletAdapter> = listOf(
            GoatReferenceWalletAdapter(ChainFamily.EVM),
            GoatReferenceWalletAdapter(ChainFamily.SOLANA),
            GoatReferenceWalletAdapter(ChainFamily.TON)
        )
    }

    private val walletName: String = "Goat Reference Wallet (simulated)"

    private fun deriveAddress(appId: String): String {
        val seed = sha256("$chainFamily:$appId")
        return when (chainFamily) {
            ChainFamily.EVM, ChainFamily.CUSTOM -> "0x" + seed.take(40)
            ChainFamily.SOLANA -> SIMULATED_PREFIX + "SoL" + seed.take(40)
            ChainFamily.TON -> SIMULATED_PREFIX + "EQ" + seed.take(46)
        }
    }

    private fun resolveChainId(requested: List<String>): String {
        val fallback = supportedChainIds.firstOrNull() ?: "0"
        if (requested.isEmpty()) return fallback
        val normalized = requested.map { it.removePrefix("eip155:") }
        return normalized.firstOrNull { supportedChainIds.contains(it) }
            ?: throw Web3Exception(
                Web3ErrorCode.CHAIN_UNSUPPORTED,
                "Chain(s) ${requested.joinToString()} not supported by $chainFamily reference adapter"
            )
    }

    override suspend fun connect(
        chains: List<String>,
        manifestUrl: String?,
        ctx: WalletContext
    ): Result<WalletAccountInfo> = runCatching {
        Log.w(TAG, "Reference wallet adapter connected for $chainFamily — signatures are simulated, not cryptographic.")
        val chainId = resolveChainId(chains)
        val address = deriveAddress(ctx.appId)
        WalletAccountInfo(
            address = address,
            publicKey = SIMULATED_PREFIX + "PUBKEY_" + sha256(address).take(32),
            chainId = chainId,
            walletName = walletName
        )
    }

    override suspend fun disconnect(ctx: WalletContext): Result<Boolean> = Result.success(true)

    override suspend fun decodeTransaction(
        txData: JsonObject,
        ctx: WalletContext
    ): Result<DecodedTransactionPreview> = runCatching {
        val to = txData.str("to") ?: txData.str("address")
            ?: throw Web3Exception(Web3ErrorCode.INVALID_PARAMETERS, "Transaction is missing a recipient")
        val value = txData.str("value") ?: txData.str("amount") ?: "0"
        val data = txData.str("data") ?: txData.str("payload")
        val hasCalldata = !data.isNullOrBlank() && data != "0x"

        DecodedTransactionPreview(
            networkName = networkLabel(),
            recipient = to,
            valueFormatted = value,
            feeFormatted = "unknown",
            methodName = if (hasCalldata) "contractCall" else "transfer",
            methodDescription = if (hasCalldata) {
                "Calldata present. The reference adapter does not decode calldata — register a production adapter for human-readable decoding."
            } else {
                "Native value transfer"
            },
            isUnverifiedContract = hasCalldata,
            simulationSuccess = true,
            warnings = listOf("Reference adapter: this preview is not derived from a real chain simulation.")
        )
    }

    override suspend fun signTransaction(
        txData: JsonObject,
        preview: DecodedTransactionPreview,
        ctx: WalletContext
    ): Result<JsonObject> = runCatching {
        val address = deriveAddress(ctx.appId)
        val digest = sha256("${ctx.appId}|$chainFamily|${preview.recipient}|${preview.valueFormatted}|${txData}")
        buildJsonObject {
            put("signature", SIMULATED_PREFIX + "SIG_" + digest.take(64))
            put("txHash", "0x" + digest)
            put("from", address)
            put("network", networkLabel())
            put("status", "SIMULATED")
            put("simulated", true)
        }
    }

    override suspend fun signMessage(
        message: String,
        messageType: String,
        ctx: WalletContext
    ): Result<JsonObject> = runCatching {
        val address = deriveAddress(ctx.appId)
        buildJsonObject {
            put("signature", SIMULATED_PREFIX + "MSGSIG_" + sha256("$messageType|$message|$address").take(64))
            put("address", address)
            put("messageType", messageType)
            put("simulated", true)
        }
    }

    override suspend fun switchChain(
        targetChainId: String,
        addChainParams: JsonObject?,
        ctx: WalletContext
    ): Result<Boolean> = runCatching {
        val normalized = targetChainId.removePrefix("eip155:")
        if (!supportedChainIds.contains(normalized)) {
            throw Web3Exception(
                Web3ErrorCode.CHAIN_UNSUPPORTED,
                "Chain $targetChainId is not configured on the $chainFamily reference adapter"
            )
        }
        true
    }

    private fun networkLabel(): String = when (chainFamily) {
        ChainFamily.EVM -> "evm"
        ChainFamily.SOLANA -> "solana"
        ChainFamily.TON -> "ton"
        ChainFamily.CUSTOM -> "custom"
    }

    private fun JsonObject.str(key: String): String? =
        this[key]?.let { runCatching { it.jsonPrimitive.content }.getOrNull() }?.takeIf { it.isNotBlank() && it != "null" }

    private fun sha256(input: String): String =
        MessageDigest.getInstance("SHA-256")
            .digest(input.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
}
