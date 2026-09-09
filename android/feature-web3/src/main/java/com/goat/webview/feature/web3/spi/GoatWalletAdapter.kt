package com.goat.webview.feature.web3.spi

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

enum class ChainFamily {
    EVM,
    SOLANA,
    TON,
    CUSTOM;

    companion object {
        fun fromWireName(raw: String?): ChainFamily? = when (raw?.trim()?.uppercase()) {
            "EVM", "ETHEREUM", "EIP155" -> EVM
            "SOLANA", "SVM" -> SOLANA
            "TON" -> TON
            "CUSTOM" -> CUSTOM
            else -> null
        }

        /**
         * Maps the legacy `network` parameter of `WEB3_CONNECT_WALLET` (e.g. "ton-mainnet",
         * "ethereum", "polygon", "solana") onto a chain family. Kept so mini-apps written against
         * the shipped wire contract keep working after the SPI migration.
         */
        fun fromNetworkName(network: String?): ChainFamily {
            val n = network?.trim()?.lowercase().orEmpty()
            return when {
                n.startsWith("ton") -> TON
                n.startsWith("solana") || n.startsWith("svm") -> SOLANA
                n.isEmpty() -> EVM
                else -> EVM
            }
        }
    }
}

data class WalletContext(
    val appId: String,
    val origin: String,
    val context: Context
)

@Serializable
data class WalletAccountInfo(
    val address: String,
    val publicKey: String,
    val chainId: String,
    val walletName: String
)

@Serializable
data class DecodedTransactionPreview(
    val networkName: String,
    val recipient: String,
    val recipientDomain: String? = null,
    val valueFormatted: String,
    val feeFormatted: String,
    val methodName: String,
    val methodDescription: String,
    val isDangerousApproval: Boolean = false,
    val isPermit2Unlimited: Boolean = false,
    val isUnverifiedContract: Boolean = false,
    val simulationSuccess: Boolean = true,
    val warnings: List<String> = emptyList()
)

interface GoatWalletAdapter {
    val chainFamily: ChainFamily
    val supportedChainIds: List<String>

    suspend fun connect(
        chains: List<String>,
        manifestUrl: String?,
        ctx: WalletContext
    ): Result<WalletAccountInfo>

    suspend fun disconnect(ctx: WalletContext): Result<Boolean>

    suspend fun decodeTransaction(
        txData: JsonObject,
        ctx: WalletContext
    ): Result<DecodedTransactionPreview>

    suspend fun signTransaction(
        txData: JsonObject,
        preview: DecodedTransactionPreview,
        ctx: WalletContext
    ): Result<JsonObject>

    suspend fun signMessage(
        message: String,
        messageType: String,
        ctx: WalletContext
    ): Result<JsonObject>

    suspend fun switchChain(
        targetChainId: String,
        addChainParams: JsonObject?,
        ctx: WalletContext
    ): Result<Boolean>
}
