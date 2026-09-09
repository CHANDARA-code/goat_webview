package com.goat.webview.feature.web3.ton

import java.math.BigInteger

class BocMalformedException(message: String) : Exception(message)

data class TonCell(
    val data: ByteArray,
    val bitLength: Int,
    val refs: List<Int>,
    val isExotic: Boolean
) {
    override fun equals(other: Any?): Boolean =
        other is TonCell && bitLength == other.bitLength && refs == other.refs &&
            isExotic == other.isExotic && data.contentEquals(other.data)

    override fun hashCode(): Int =
        (data.contentHashCode() * 31 + bitLength) * 31 + refs.hashCode()
}

/**
 * Bit reader over a TON cell.
 *
 * Every read is bounds-checked before it happens rather than after. A slice is parsed from an
 * attacker-supplied payload, so an unchecked read is a crash — or worse, a silent read of adjacent
 * memory that decodes into a plausible-looking destination address.
 */
class TonCellSlice(private val cell: TonCell) {

    var bitOffset: Int = 0
        private set

    val remainingBits: Int get() = cell.bitLength - bitOffset

    private fun require(bits: Int) {
        if (bits < 0) throw BocMalformedException("Negative bit count requested")
        if (bitOffset + bits > cell.bitLength) {
            throw BocMalformedException(
                "Slice underflow: requested $bits bits at offset $bitOffset of ${cell.bitLength}"
            )
        }
    }

    fun readBit(): Int {
        require(1)
        val byteIndex = bitOffset ushr 3
        val shift = 7 - (bitOffset and 7)
        bitOffset++
        return (cell.data[byteIndex].toInt() ushr shift) and 1
    }

    /**
     * Reads up to 64 bits. A full 64-bit field (TON's `query_id`) comes back as a signed Long and
     * may read negative; that is fine for an opaque identifier, and callers that need the numeric
     * value of a large field use [readBigUInt] instead.
     */
    fun readUInt(bits: Int): Long {
        if (bits > 64) throw BocMalformedException("readUInt supports at most 64 bits, got $bits")
        require(bits)
        var value = 0L
        repeat(bits) { value = (value shl 1) or readBit().toLong() }
        return value
    }

    fun readBigUInt(bits: Int): BigInteger {
        require(bits)
        var value = BigInteger.ZERO
        repeat(bits) { value = value.shiftLeft(1).or(BigInteger.valueOf(readBit().toLong())) }
        return value
    }

    fun readBytes(count: Int): ByteArray {
        require(count * 8)
        val out = ByteArray(count)
        for (i in 0 until count) out[i] = readUInt(8).toByte()
        return out
    }

    fun skipBits(bits: Int) {
        require(bits)
        bitOffset += bits
    }

    /** TL-B `VarUInteger 16`, the encoding TON uses for coin amounts (nanotons). */
    fun readCoins(): BigInteger {
        val lengthBytes = readUInt(4).toInt()
        if (lengthBytes == 0) return BigInteger.ZERO
        if (lengthBytes > 15) throw BocMalformedException("Coins length prefix $lengthBytes exceeds VarUInteger 16")
        return readBigUInt(lengthBytes * 8)
    }

    /**
     * TL-B `MsgAddress`. Returns the raw `workchain:hex` form, or null for `addr_none`.
     * Rendering the raw form rather than a friendly base64 address is deliberate: a friendly form
     * carries flags that change what the address means, and getting them wrong in a confirmation
     * dialog would show the user the wrong destination.
     */
    fun readAddress(): String? {
        if (remainingBits < 2) throw BocMalformedException("Truncated MsgAddress")
        when (readUInt(2).toInt()) {
            0 -> return null
            2 -> {
                val hasAnycast = readBit() == 1
                if (hasAnycast) {
                    val depth = readUInt(5).toInt()
                    if (depth !in 1..30) throw BocMalformedException("Invalid anycast depth $depth")
                    skipBits(depth)
                }
                val workchain = readUInt(8).toInt().toByte().toInt()
                val hash = readBytes(32)
                return "$workchain:" + hash.joinToString("") { "%02x".format(it) }
            }
            else -> throw BocMalformedException("Unsupported MsgAddress variant")
        }
    }

    fun readTextTail(): String {
        val bytes = ByteArray(remainingBits / 8)
        for (i in bytes.indices) bytes[i] = readUInt(8).toByte()
        return String(bytes, Charsets.UTF_8)
    }

    fun refs(): List<Int> = cell.refs
}
