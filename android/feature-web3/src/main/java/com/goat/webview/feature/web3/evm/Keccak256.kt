package com.goat.webview.feature.web3.evm

/**
 * Keccak-256 as Ethereum uses it.
 *
 * Not interchangeable with the JDK's `SHA3-256`: NIST SHA-3 appends the domain separator `0x06`
 * before padding, original Keccak appends `0x01`. Using the JDK digest here would produce hashes
 * that look right and match nothing on chain.
 *
 * Present so ABI function selectors are derived from their signatures rather than transcribed as
 * magic constants — a wrong hardcoded selector silently decodes the wrong parameters.
 */
object Keccak256 {

    private const val RATE_BYTES = 136

    private val ROUND_CONSTANTS = longArrayOf(
        0x0000000000000001L, 0x0000000000008082L, -0x7fffffffffff7f76L, -0x7fffffff7fff8000L,
        0x000000000000808BL, 0x0000000080000001L, -0x7fffffff7fff7f7fL, -0x7fffffffffff7ff7L,
        0x000000000000008AL, 0x0000000000000088L, 0x0000000080008009L, 0x000000008000000AL,
        0x000000008000808BL, -0x7fffffffffffff75L, -0x7fffffffffff7f77L, -0x7fffffffffff7ffdL,
        -0x7fffffffffff7ffeL, -0x7fffffffffffff80L, 0x000000000000800AL, -0x7fffffff7ffffff6L,
        -0x7fffffff7fff7f7fL, -0x7fffffffffff7f80L, 0x0000000080000001L, -0x7fffffff7fff7ff8L
    )

    /** Rotation offsets indexed as `x + 5 * y`. */
    private val ROTATION = intArrayOf(
        0, 1, 62, 28, 27,
        36, 44, 6, 55, 20,
        3, 10, 43, 25, 39,
        41, 45, 15, 21, 8,
        18, 2, 61, 56, 14
    )

    fun digest(input: ByteArray): ByteArray {
        val state = LongArray(25)
        val padded = pad(input)

        var offset = 0
        while (offset < padded.size) {
            for (i in 0 until RATE_BYTES / 8) {
                state[i] = state[i] xor readLittleEndianLong(padded, offset + i * 8)
            }
            keccakF(state)
            offset += RATE_BYTES
        }

        val out = ByteArray(32)
        for (i in 0 until 4) writeLittleEndianLong(out, i * 8, state[i])
        return out
    }

    fun digest(input: String): ByteArray = digest(input.toByteArray(Charsets.UTF_8))

    fun hex(input: String): String = digest(input).joinToString("") { "%02x".format(it) }

    /** First 4 bytes of keccak256(signature), lowercase hex with a `0x` prefix. */
    fun functionSelector(signature: String): String =
        "0x" + digest(signature).copyOfRange(0, 4).joinToString("") { "%02x".format(it) }

    private fun pad(input: ByteArray): ByteArray {
        val padLength = RATE_BYTES - (input.size % RATE_BYTES)
        val padded = ByteArray(input.size + padLength)
        input.copyInto(padded)
        // Original Keccak padding, not NIST SHA-3's 0x06.
        padded[input.size] = 0x01
        padded[padded.size - 1] = (padded[padded.size - 1].toInt() or 0x80).toByte()
        return padded
    }

    private fun keccakF(state: LongArray) {
        val c = LongArray(5)
        val d = LongArray(5)
        val b = LongArray(25)

        for (round in 0 until 24) {
            for (x in 0 until 5) {
                c[x] = state[x] xor state[x + 5] xor state[x + 10] xor state[x + 15] xor state[x + 20]
            }
            for (x in 0 until 5) {
                d[x] = c[(x + 4) % 5] xor java.lang.Long.rotateLeft(c[(x + 1) % 5], 1)
            }
            for (y in 0 until 5) {
                for (x in 0 until 5) {
                    state[x + 5 * y] = state[x + 5 * y] xor d[x]
                }
            }

            for (y in 0 until 5) {
                for (x in 0 until 5) {
                    val target = y + 5 * ((2 * x + 3 * y) % 5)
                    b[target] = java.lang.Long.rotateLeft(state[x + 5 * y], ROTATION[x + 5 * y])
                }
            }

            for (y in 0 until 5) {
                for (x in 0 until 5) {
                    state[x + 5 * y] =
                        b[x + 5 * y] xor (b[(x + 1) % 5 + 5 * y].inv() and b[(x + 2) % 5 + 5 * y])
                }
            }

            state[0] = state[0] xor ROUND_CONSTANTS[round]
        }
    }

    private fun readLittleEndianLong(data: ByteArray, offset: Int): Long {
        var value = 0L
        for (i in 7 downTo 0) value = (value shl 8) or (data[offset + i].toLong() and 0xff)
        return value
    }

    private fun writeLittleEndianLong(data: ByteArray, offset: Int, value: Long) {
        for (i in 0 until 8) data[offset + i] = ((value ushr (8 * i)) and 0xff).toByte()
    }
}
