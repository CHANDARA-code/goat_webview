package com.goat.webview.feature.web3.spi

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive

object Web3ErrorCode {
    const val GESTURE_REQUIRED = "GESTURE_REQUIRED"
    const val ORIGIN_NOT_ALLOWED = "ORIGIN_NOT_ALLOWED"
    const val USER_CANCELLED = "USER_CANCELLED"
    const val CHAIN_UNSUPPORTED = "CHAIN_UNSUPPORTED"
    const val CHAIN_DISCONNECTED = "CHAIN_DISCONNECTED"
    const val DISCONNECTED = "DISCONNECTED"
    const val NOT_SUPPORTED = "NOT_SUPPORTED"
    const val SIMULATION_FAILED = "SIMULATION_FAILED"
    const val INVALID_PARAMETERS = "INVALID_PARAMETERS"
    const val INTERNAL_ERROR = "INTERNAL_ERROR"
    const val NO_ADAPTER_REGISTERED = "NO_ADAPTER_REGISTERED"
    const val WALLET_ACTION_IN_PROGRESS = "WALLET_ACTION_IN_PROGRESS"
    const val WALLET_NOT_CONNECTED = "WALLET_NOT_CONNECTED"
}

class Web3Exception(
    val code: String,
    message: String,
    cause: Throwable? = null
) : Exception("$code: $message", cause)

fun web3Failure(code: String, message: String): Result<Nothing> =
    Result.failure(Web3Exception(code, message))

object WalletLockKey {
    private const val UNKEYED = "-"

    /**
     * Serialises operations that must not interleave for one account. EVM keys on nonce, Solana on
     * recent blockhash, TON on the message `valid_until`/`query_id`; requests that carry none of
     * those still share a per-account key so a double-tap cannot open two signing ceremonies.
     */
    fun forTransaction(
        chainFamily: ChainFamily,
        chainId: String,
        accountAddress: String,
        txData: JsonObject
    ): String {
        val discriminator = when (chainFamily) {
            ChainFamily.EVM -> txData.stringOf("nonce")
            ChainFamily.SOLANA -> txData.stringOf("recentBlockhash") ?: txData.stringOf("blockhash")
            ChainFamily.TON -> txData.stringOf("valid_until") ?: txData.stringOf("validUntil")
            ChainFamily.CUSTOM -> txData.stringOf("nonce")
        } ?: UNKEYED
        return "$chainFamily:$chainId:$accountAddress:$discriminator"
    }

    fun forSession(chainFamily: ChainFamily, chainId: String, accountAddress: String): String =
        "$chainFamily:$chainId:$accountAddress:session"

    private fun JsonObject.stringOf(key: String): String? =
        this[key]?.jsonPrimitive?.contentOrNullSafe()

    private fun kotlinx.serialization.json.JsonPrimitive.contentOrNullSafe(): String? =
        runCatching { content }.getOrNull()?.takeIf { it.isNotBlank() && it != "null" }
}
