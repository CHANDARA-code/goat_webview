package com.goat.webview.feature.web3.solana

import java.math.BigInteger

class SolanaMalformedTransactionException(message: String) : Exception(message)

data class SolanaInstructionSummary(
    val programId: String,
    val programName: String,
    val kind: String,
    val summary: String,
    val destination: String? = null,
    val amountRaw: BigInteger? = null,
    val decimals: Int? = null,
    val isKnown: Boolean = true
)

data class DecodedSolanaTransaction(
    val version: String,
    val feePayer: String,
    val recentBlockhash: String,
    val accountKeys: List<String>,
    val instructions: List<SolanaInstructionSummary>,
    val addressTableLookups: Int,
    val requiresAddressLookupResolution: Boolean,
    val warnings: List<String>
)

/**
 * Deserialises a Solana wire transaction so its instructions can be described before signing.
 *
 * Handles both layouts: legacy, and v0 with address-table lookups. v0 matters because the accounts
 * an instruction touches may live in a lookup table rather than the message — a decoder that
 * ignores that would confidently describe a transfer using the wrong account list.
 */
object SolanaTxDecoder {

    const val SYSTEM_PROGRAM = "11111111111111111111111111111111"
    const val TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
    const val TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
    const val ASSOCIATED_TOKEN_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
    const val COMPUTE_BUDGET_PROGRAM = "ComputeBudget111111111111111111111111111111"

    private const val MAX_ACCOUNTS = 256
    private const val MAX_INSTRUCTIONS = 64

    private val PROGRAM_NAMES = mapOf(
        SYSTEM_PROGRAM to "System Program",
        TOKEN_PROGRAM to "SPL Token",
        TOKEN_2022_PROGRAM to "SPL Token-2022",
        ASSOCIATED_TOKEN_PROGRAM to "Associated Token Account",
        COMPUTE_BUDGET_PROGRAM to "Compute Budget"
    )

    fun decodeBase64(raw: String?): DecodedSolanaTransaction {
        if (raw.isNullOrBlank()) throw SolanaMalformedTransactionException("Empty transaction payload")
        return decode(Base58.decodeBase64(raw))
    }

    fun decode(bytes: ByteArray): DecodedSolanaTransaction {
        val reader = ByteReader(bytes)

        val signatureCount = reader.readCompactU16()
        if (signatureCount > 32) {
            throw SolanaMalformedTransactionException("Transaction declares $signatureCount signatures")
        }
        reader.skip(signatureCount * 64)

        val versionByte = reader.peek()
        val isVersioned = (versionByte.toInt() and 0x80) != 0
        val version = if (isVersioned) {
            val v = reader.readByte().toInt() and 0x7f
            if (v != 0) throw SolanaMalformedTransactionException("Unsupported message version $v")
            "v0"
        } else {
            "legacy"
        }

        val numRequiredSignatures = reader.readByte().toInt() and 0xff
        val numReadonlySigned = reader.readByte().toInt() and 0xff
        val numReadonlyUnsigned = reader.readByte().toInt() and 0xff

        val accountCount = reader.readCompactU16()
        if (accountCount == 0 || accountCount > MAX_ACCOUNTS) {
            throw SolanaMalformedTransactionException("Transaction declares $accountCount account keys")
        }
        val accountKeys = ArrayList<String>(accountCount)
        repeat(accountCount) { accountKeys.add(Base58.encode(reader.readBytes(32))) }

        val recentBlockhash = Base58.encode(reader.readBytes(32))

        val instructionCount = reader.readCompactU16()
        if (instructionCount > MAX_INSTRUCTIONS) {
            throw SolanaMalformedTransactionException("Transaction declares $instructionCount instructions")
        }

        val instructions = ArrayList<SolanaInstructionSummary>(instructionCount)
        repeat(instructionCount) {
            val programIndex = reader.readByte().toInt() and 0xff
            val accountIndexCount = reader.readCompactU16()
            val accountIndexes = IntArray(accountIndexCount) { reader.readByte().toInt() and 0xff }
            val dataLength = reader.readCompactU16()
            val data = reader.readBytes(dataLength)

            val programId = accountKeys.getOrNull(programIndex)
                ?: throw SolanaMalformedTransactionException("Instruction names account $programIndex, which does not exist")
            instructions.add(summarise(programId, accountIndexes, data, accountKeys))
        }

        var lookups = 0
        if (version == "v0" && reader.hasRemaining()) {
            lookups = reader.readCompactU16()
            repeat(lookups) {
                reader.readBytes(32)
                val writable = reader.readCompactU16(); reader.skip(writable)
                val readonly = reader.readCompactU16(); reader.skip(readonly)
            }
        }

        val warnings = buildList {
            if (lookups > 0) {
                add("This transaction uses address lookup tables; some accounts it touches are not listed in the message and cannot be shown here.")
            }
            if (instructions.any { !it.isKnown }) {
                add("UNVERIFIED PROGRAM: one or more instructions call a program this device cannot decode.")
            }
        }

        return DecodedSolanaTransaction(
            version = version,
            feePayer = accountKeys.first(),
            recentBlockhash = recentBlockhash,
            accountKeys = accountKeys,
            instructions = instructions,
            addressTableLookups = lookups,
            requiresAddressLookupResolution = lookups > 0,
            warnings = warnings
        )
    }

    private fun summarise(
        programId: String,
        accountIndexes: IntArray,
        data: ByteArray,
        accountKeys: List<String>
    ): SolanaInstructionSummary {
        val programName = PROGRAM_NAMES[programId] ?: "Unknown program"

        if (programId == SYSTEM_PROGRAM && data.size >= 12) {
            val instructionType = readUInt32LE(data, 0)
            if (instructionType == 2L) {
                val lamports = readUInt64LE(data, 4)
                val destination = accountKeys.getOrNull(accountIndexes.getOrNull(1) ?: -1)
                return SolanaInstructionSummary(
                    programId = programId, programName = programName, kind = "sol_transfer",
                    summary = "Send ${formatUnits(lamports, 9)} SOL to ${destination ?: "an unlisted account"}",
                    destination = destination, amountRaw = lamports, decimals = 9
                )
            }
        }

        if ((programId == TOKEN_PROGRAM || programId == TOKEN_2022_PROGRAM) && data.isNotEmpty()) {
            when (data[0].toInt() and 0xff) {
                3 -> if (data.size >= 9) {
                    val amount = readUInt64LE(data, 1)
                    val destination = accountKeys.getOrNull(accountIndexes.getOrNull(1) ?: -1)
                    return SolanaInstructionSummary(
                        programId, programName, "spl_transfer",
                        "Send $amount token base units to ${destination ?: "an unlisted account"}",
                        destination, amount, null
                    )
                }
                12 -> if (data.size >= 10) {
                    val amount = readUInt64LE(data, 1)
                    val decimals = data[9].toInt() and 0xff
                    val destination = accountKeys.getOrNull(accountIndexes.getOrNull(2) ?: -1)
                    return SolanaInstructionSummary(
                        programId, programName, "spl_transfer_checked",
                        "Send ${formatUnits(amount, decimals)} tokens to ${destination ?: "an unlisted account"}",
                        destination, amount, decimals
                    )
                }
                4 -> {
                    val delegate = accountKeys.getOrNull(accountIndexes.getOrNull(1) ?: -1)
                    return SolanaInstructionSummary(
                        programId, programName, "spl_approve",
                        "Allow ${delegate ?: "a delegate"} to spend tokens from this account",
                        delegate, if (data.size >= 9) readUInt64LE(data, 1) else null, null
                    )
                }
            }
        }

        if (programId == COMPUTE_BUDGET_PROGRAM) {
            return SolanaInstructionSummary(
                programId, programName, "compute_budget", "Set the compute budget", isKnown = true
            )
        }

        return SolanaInstructionSummary(
            programId = programId,
            programName = programName,
            kind = "unknown",
            summary = "Call to $programId could not be decoded. Proceed with extreme caution.",
            isKnown = false
        )
    }

    fun formatUnits(amount: BigInteger?, decimals: Int): String {
        if (amount == null) return "0"
        if (decimals <= 0) return amount.toString()
        val divisor = BigInteger.TEN.pow(decimals)
        val whole = amount.divide(divisor)
        val remainder = amount.mod(divisor)
        if (remainder.signum() == 0) return whole.toString()
        return "$whole." + remainder.toString().padStart(decimals, '0').trimEnd('0')
    }

    private fun readUInt32LE(data: ByteArray, offset: Int): Long {
        var value = 0L
        for (i in 3 downTo 0) value = (value shl 8) or (data[offset + i].toLong() and 0xff)
        return value
    }

    private fun readUInt64LE(data: ByteArray, offset: Int): BigInteger {
        var value = BigInteger.ZERO
        for (i in 7 downTo 0) {
            value = value.shiftLeft(8).or(BigInteger.valueOf(data[offset + i].toLong() and 0xff))
        }
        return value
    }

    /** Bounds-checked cursor. Every field a hostile payload controls is read through this. */
    private class ByteReader(private val data: ByteArray) {
        private var offset = 0

        fun hasRemaining(): Boolean = offset < data.size

        fun peek(): Byte {
            if (offset >= data.size) throw SolanaMalformedTransactionException("Transaction truncated")
            return data[offset]
        }

        fun readByte(): Byte {
            if (offset >= data.size) throw SolanaMalformedTransactionException("Transaction truncated")
            return data[offset++]
        }

        fun readBytes(count: Int): ByteArray {
            if (count < 0 || offset + count > data.size) {
                throw SolanaMalformedTransactionException("Transaction truncated reading $count bytes")
            }
            val out = data.copyOfRange(offset, offset + count)
            offset += count
            return out
        }

        fun skip(count: Int) {
            if (count < 0 || offset + count > data.size) {
                throw SolanaMalformedTransactionException("Transaction truncated skipping $count bytes")
            }
            offset += count
        }

        /** Solana's compact-u16 (ShortVec): 7 bits per byte, at most 3 bytes. */
        fun readCompactU16(): Int {
            var value = 0
            var shift = 0
            while (true) {
                val byte = readByte().toInt() and 0xff
                value = value or ((byte and 0x7f) shl shift)
                if ((byte and 0x80) == 0) break
                shift += 7
                if (shift > 14) throw SolanaMalformedTransactionException("Malformed compact-u16 length")
            }
            if (value < 0 || value > 0xffff) throw SolanaMalformedTransactionException("compact-u16 out of range")
            return value
        }
    }
}

/** Base58 (Bitcoin alphabet) and Base64, as Solana wire formats need them. */
object Base58 {
    private const val ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

    fun encode(bytes: ByteArray): String {
        if (bytes.isEmpty()) return ""
        var leadingZeros = 0
        while (leadingZeros < bytes.size && bytes[leadingZeros].toInt() == 0) leadingZeros++

        var value = BigInteger(1, bytes)
        val sb = StringBuilder()
        val base = BigInteger.valueOf(58)
        while (value.signum() > 0) {
            val divRem = value.divideAndRemainder(base)
            sb.append(ALPHABET[divRem[1].toInt()])
            value = divRem[0]
        }
        repeat(leadingZeros) { sb.append(ALPHABET[0]) }
        return sb.reverse().toString()
    }

    fun decodeBase64(value: String): ByteArray {
        val table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
        val clean = value.trim().replace("-", "+").replace("_", "/").trimEnd('=')
        val out = java.io.ByteArrayOutputStream()
        var buffer = 0
        var bits = 0
        for (ch in clean) {
            val index = table.indexOf(ch)
            if (index < 0) throw SolanaMalformedTransactionException("Transaction payload is not valid Base64")
            buffer = (buffer shl 6) or index
            bits += 6
            if (bits >= 8) {
                bits -= 8
                out.write((buffer shr bits) and 0xff)
            }
        }
        return out.toByteArray()
    }
}
