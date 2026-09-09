package com.goat.webview.feature.web3.evm

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.math.BigInteger

data class DecodedTypedData(
    val primaryType: String,
    val domainName: String?,
    val verifyingContract: String?,
    val chainId: String?,
    val spender: String?,
    val amountRaw: BigInteger?,
    val expiry: Long?,
    val isPermit: Boolean,
    val isUnlimitedAllowance: Boolean,
    val isLongLivedApproval: Boolean,
    val isKnownPermitShape: Boolean,
    val summary: String,
    val warnings: List<String>
)

/**
 * Decodes `eth_signTypedData_v4` payloads before they reach the confirmation modal.
 *
 * This is the drainer path that on-chain calldata decoding misses entirely: a Permit2
 * `PermitSingle` is an *off-chain signature*, costs no gas, produces no transaction the user can
 * see, and hands a spender unlimited allowance until its expiry. Decoding it is the only thing
 * standing between a user and a one-tap drain.
 */
object Eip712Parser {

    /** Canonical Uniswap Permit2 deployment, identical on every chain it is deployed to. */
    const val PERMIT2_CONTRACT = "0x000000000022d473030f116ddee9f6b43ac78ba3"

    private const val THIRTY_DAYS_SECONDS = 30L * 24 * 60 * 60

    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    private val PERMIT_TYPES = setOf("Permit", "PermitSingle", "PermitBatch", "PermitTransferFrom")

    fun parse(raw: String?): DecodedTypedData? {
        if (raw.isNullOrBlank()) return null
        val root = runCatching { json.parseToJsonElement(raw).jsonObject }.getOrNull() ?: return null

        val primaryType = root.str("primaryType") ?: ""
        val domain = root["domain"]?.let { runCatching { it.jsonObject }.getOrNull() }
        val message = root["message"]?.let { runCatching { it.jsonObject }.getOrNull() }

        val verifyingContract = domain?.str("verifyingContract")?.lowercase()
        val domainName = domain?.str("name")
        val chainId = domain?.str("chainId")

        val isPermit2Contract = verifyingContract == PERMIT2_CONTRACT
        val isKnownPermitShape = primaryType in PERMIT_TYPES

        val details = message?.get("details")?.let { runCatching { it.jsonObject }.getOrNull() }
        val batch = message?.get("details")?.let { runCatching { it.jsonArray }.getOrNull() }

        val spender = message?.str("spender")
            ?: details?.str("spender")
            ?: message?.str("to")
        val amount = firstAmount(message, details, batch)
        val expiry = (details?.long("expiration")
            ?: message?.long("expiration")
            ?: message?.long("deadline")
            ?: firstBatchLong(batch, "expiration"))

        // Permit2 allowances are uint160; ERC-2612 permits are uint256. Compare against the right
        // ceiling or an unlimited Permit2 approval reads as merely "large".
        val unlimitedCeiling = if (isPermit2Contract || primaryType.startsWith("Permit")) {
            EvmAbiDecoder.UINT160_MAX
        } else {
            EvmAbiDecoder.UINT256_MAX
        }
        val isUnlimited = amount != null &&
            (amount >= unlimitedCeiling || amount >= EvmAbiDecoder.UINT256_MAX)

        val nowSeconds = System.currentTimeMillis() / 1000
        val isLongLived = expiry != null && expiry > nowSeconds + THIRTY_DAYS_SECONDS

        val warnings = buildList {
            if (isUnlimited) {
                add("Unlimited Allowance: this signature lets ${spender ?: "the spender"} withdraw all current and future tokens of this type without another prompt.")
            }
            if (isLongLived) {
                add("Long-Lived Approval: this permission lasts more than 30 days.")
            }
            if (isPermit2Contract) {
                add("Permit2: this is an off-chain signature, not a transaction. It takes effect immediately and costs no gas.")
            }
            if (!isKnownPermitShape && !isPermit2Contract) {
                add("Unverified typed data: this message shape is not a recognised permit. Read it carefully before signing.")
            }
        }

        val summary = when {
            isPermit2Contract && batch != null -> "Permit2 batch approval for ${batch.size} token(s)"
            isPermit2Contract -> "Permit2 approval for ${spender ?: "an unnamed spender"}"
            isKnownPermitShape -> "$primaryType approval for ${spender ?: "an unnamed spender"}"
            primaryType.isNotEmpty() -> "Sign $primaryType message"
            else -> "Sign typed data"
        }

        return DecodedTypedData(
            primaryType = primaryType,
            domainName = domainName,
            verifyingContract = verifyingContract,
            chainId = chainId,
            spender = spender,
            amountRaw = amount,
            expiry = expiry,
            isPermit = isKnownPermitShape || isPermit2Contract,
            isUnlimitedAllowance = isUnlimited,
            isLongLivedApproval = isLongLived,
            isKnownPermitShape = isKnownPermitShape,
            summary = summary,
            warnings = warnings
        )
    }

    private fun firstAmount(message: JsonObject?, details: JsonObject?, batch: JsonArray?): BigInteger? {
        details?.bigInt("amount")?.let { return it }
        message?.bigInt("amount")?.let { return it }
        message?.bigInt("value")?.let { return it }
        if (batch != null) {
            for (entry in batch) {
                runCatching { entry.jsonObject }.getOrNull()?.bigInt("amount")?.let { return it }
            }
        }
        return null
    }

    private fun firstBatchLong(batch: JsonArray?, key: String): Long? {
        if (batch == null) return null
        for (entry in batch) {
            runCatching { entry.jsonObject }.getOrNull()?.long(key)?.let { return it }
        }
        return null
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

    private fun JsonObject.long(key: String): Long? {
        val raw = str(key) ?: return null
        return runCatching {
            if (raw.startsWith("0x") || raw.startsWith("0X")) raw.substring(2).toLong(16) else raw.toLong()
        }.getOrNull()
    }
}
