package com.goat.webview.feature.web3.evm

import java.math.BigInteger

data class DecodedCall(
    val selector: String,
    val methodName: String,
    val signature: String,
    val description: String,
    val recipient: String? = null,
    val amountRaw: BigInteger? = null,
    val isApproval: Boolean = false,
    val isUnlimitedApproval: Boolean = false,
    val isSetApprovalForAll: Boolean = false,
    val isKnown: Boolean = true,
    val warnings: List<String> = emptyList()
)

/**
 * Decodes EVM calldata so the native confirmation modal can show what a transaction actually does
 * rather than an opaque hex blob.
 *
 * Only the shapes a drainer needs are decoded in full — the token approvals. Anything unrecognised
 * is reported as unknown so the modal can say so, which is the honest answer and the one the
 * threat model (A2) requires; guessing at an unindexed contract would be worse than admitting it.
 */
object EvmAbiDecoder {

    val UINT256_MAX: BigInteger = BigInteger.TWO.pow(256).subtract(BigInteger.ONE)
    val UINT160_MAX: BigInteger = BigInteger.TWO.pow(160).subtract(BigInteger.ONE)

    /** Anything at or above this is treated as effectively unlimited for display purposes. */
    private val UNLIMITED_THRESHOLD: BigInteger = BigInteger.TWO.pow(255)

    private const val SIG_TRANSFER = "transfer(address,uint256)"
    private const val SIG_APPROVE = "approve(address,uint256)"
    private const val SIG_TRANSFER_FROM = "transferFrom(address,address,uint256)"
    private const val SIG_INCREASE_ALLOWANCE = "increaseAllowance(address,uint256)"
    private const val SIG_SET_APPROVAL_FOR_ALL = "setApprovalForAll(address,bool)"
    private const val SIG_SAFE_TRANSFER_FROM = "safeTransferFrom(address,address,uint256)"
    private const val SIG_PERMIT_2612 = "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)"
    private const val SIG_PERMIT2_APPROVE = "approve(address,address,uint160,uint48)"

    /** Selectors are derived from signatures at load time, never transcribed. */
    private val SELECTORS: Map<String, String> = listOf(
        SIG_TRANSFER, SIG_APPROVE, SIG_TRANSFER_FROM, SIG_INCREASE_ALLOWANCE,
        SIG_SET_APPROVAL_FOR_ALL, SIG_SAFE_TRANSFER_FROM, SIG_PERMIT_2612, SIG_PERMIT2_APPROVE
    ).associateBy({ Keccak256.functionSelector(it) }, { it })

    fun selectorOf(signature: String): String = Keccak256.functionSelector(signature)

    fun decode(calldata: String?): DecodedCall? {
        val hex = normalize(calldata) ?: return null
        if (hex.length < 8) return null
        val selector = "0x" + hex.substring(0, 8).lowercase()
        val args = hex.substring(8)

        return when (val signature = SELECTORS[selector]) {
            SIG_TRANSFER -> {
                val to = readAddress(args, 0)
                val amount = readUint(args, 1)
                DecodedCall(
                    selector = selector, methodName = "transfer", signature = signature,
                    description = "Send tokens to $to",
                    recipient = to, amountRaw = amount
                )
            }

            SIG_APPROVE -> {
                val spender = readAddress(args, 0)
                val amount = readUint(args, 1)
                val unlimited = amount != null && amount >= UNLIMITED_THRESHOLD
                DecodedCall(
                    selector = selector, methodName = "approve", signature = signature,
                    description = "Allow $spender to spend your tokens",
                    recipient = spender, amountRaw = amount,
                    isApproval = true, isUnlimitedApproval = unlimited,
                    warnings = if (unlimited) {
                        listOf("Unlimited Approval: $spender can withdraw all current and future tokens of this type.")
                    } else emptyList()
                )
            }

            SIG_INCREASE_ALLOWANCE -> {
                val spender = readAddress(args, 0)
                val amount = readUint(args, 1)
                val unlimited = amount != null && amount >= UNLIMITED_THRESHOLD
                DecodedCall(
                    selector = selector, methodName = "increaseAllowance", signature = signature,
                    description = "Increase $spender's spending allowance",
                    recipient = spender, amountRaw = amount,
                    isApproval = true, isUnlimitedApproval = unlimited,
                    warnings = if (unlimited) {
                        listOf("Unlimited Approval: $spender can withdraw all current and future tokens of this type.")
                    } else emptyList()
                )
            }

            SIG_PERMIT2_APPROVE -> {
                val spender = readAddress(args, 1)
                val amount = readUint(args, 2)
                val unlimited = amount != null && amount >= UINT160_MAX
                DecodedCall(
                    selector = selector, methodName = "permit2Approve", signature = signature,
                    description = "Permit2: allow $spender to spend your tokens",
                    recipient = spender, amountRaw = amount,
                    isApproval = true, isUnlimitedApproval = unlimited,
                    warnings = if (unlimited) {
                        listOf("Unlimited Permit2 Approval: $spender can withdraw all current and future tokens of this type.")
                    } else emptyList()
                )
            }

            SIG_TRANSFER_FROM, SIG_SAFE_TRANSFER_FROM -> {
                val from = readAddress(args, 0)
                val to = readAddress(args, 1)
                val amount = readUint(args, 2)
                DecodedCall(
                    selector = selector,
                    methodName = if (signature == SIG_TRANSFER_FROM) "transferFrom" else "safeTransferFrom",
                    signature = signature,
                    description = "Move tokens from $from to $to",
                    recipient = to, amountRaw = amount
                )
            }

            SIG_SET_APPROVAL_FOR_ALL -> {
                val operator = readAddress(args, 0)
                val approved = readUint(args, 1)?.signum() != 0
                DecodedCall(
                    selector = selector, methodName = "setApprovalForAll", signature = signature,
                    description = if (approved) {
                        "Grant $operator control of EVERY token in this collection"
                    } else {
                        "Revoke $operator's control of this collection"
                    },
                    recipient = operator,
                    isApproval = approved, isUnlimitedApproval = approved, isSetApprovalForAll = true,
                    warnings = if (approved) {
                        listOf("Collection-Wide Approval: $operator can transfer every NFT you own in this collection, now and in future.")
                    } else emptyList()
                )
            }

            SIG_PERMIT_2612 -> {
                val owner = readAddress(args, 0)
                val spender = readAddress(args, 1)
                val amount = readUint(args, 2)
                val unlimited = amount != null && amount >= UNLIMITED_THRESHOLD
                DecodedCall(
                    selector = selector, methodName = "permit", signature = signature,
                    description = "EIP-2612 permit: $owner allows $spender to spend tokens",
                    recipient = spender, amountRaw = amount,
                    isApproval = true, isUnlimitedApproval = unlimited,
                    warnings = if (unlimited) {
                        listOf("Unlimited Approval: $spender can withdraw all current and future tokens of this type.")
                    } else emptyList()
                )
            }

            else -> DecodedCall(
                selector = selector,
                methodName = "unknown",
                signature = "",
                description = "The contract interaction could not be verified. You are approving an unindexed bytecode operation. Proceed with extreme caution.",
                isKnown = false,
                warnings = listOf("UNVERIFIED CONTRACT: calldata could not be decoded against any known interface.")
            )
        }
    }

    fun formatUnits(amount: BigInteger?, decimals: Int): String {
        if (amount == null) return "0"
        if (amount >= UNLIMITED_THRESHOLD) return "Unlimited"
        if (decimals <= 0) return amount.toString()
        val divisor = BigInteger.TEN.pow(decimals)
        val whole = amount.divide(divisor)
        val remainder = amount.mod(divisor)
        if (remainder.signum() == 0) return whole.toString()
        val fraction = remainder.toString().padStart(decimals, '0').trimEnd('0')
        return "$whole.$fraction"
    }

    private fun normalize(calldata: String?): String? {
        val trimmed = calldata?.trim()?.removePrefix("0x")?.removePrefix("0X") ?: return null
        if (trimmed.isEmpty()) return null
        if (!trimmed.all { it.isDigit() || it in 'a'..'f' || it in 'A'..'F' }) return null
        return trimmed
    }

    private fun word(args: String, index: Int): String? {
        val start = index * 64
        val end = start + 64
        if (args.length < end) return null
        return args.substring(start, end)
    }

    private fun readAddress(args: String, index: Int): String? {
        val w = word(args, index) ?: return null
        return "0x" + w.substring(24).lowercase()
    }

    private fun readUint(args: String, index: Int): BigInteger? {
        val w = word(args, index) ?: return null
        return BigInteger(w, 16)
    }
}
