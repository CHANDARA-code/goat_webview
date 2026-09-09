package com.goat.webview.feature.web3.ton

import java.math.BigInteger

data class DecodedBocPayload(
    val opcode: String,
    val kind: String,
    val summary: String,
    val destination: String? = null,
    val amountRaw: BigInteger? = null,
    val comment: String? = null,
    val queryId: Long? = null,
    val isKnown: Boolean = true,
    val warnings: List<String> = emptyList()
)

/**
 * Bag of Cells deserialiser and payload opcode decoder.
 *
 * Traversal is an explicit heap stack, not recursion: a BOC arrives from the page, and a deeply
 * nested one would otherwise take the process down with a StackOverflowError that no `catch` in
 * Kotlin reliably contains. Depth, cell count and every bit read are bounded, and back-references
 * are rejected outright — a canonical BOC only ever refers forward, so a back-reference is either
 * malformed or a deliberate cycle.
 */
class TonBocParser(
    private val maxCellDepth: Int = MAX_CELL_DEPTH,
    private val maxCellCount: Int = MAX_CELL_COUNT
) {

    companion object {
        const val MAX_CELL_DEPTH = 128
        const val MAX_CELL_COUNT = 1024
        private const val BOC_MAGIC = -0x4a11638e // 0xb5ee9c72

        const val OP_TEXT_COMMENT = 0x00000000
        const val OP_JETTON_TRANSFER = 0x0f8a7ea5
        const val OP_NFT_TRANSFER = 0x5fcc3d14

        fun decodeBase64(value: String): ByteArray {
            val table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
            val clean = value.trim().replace("-", "+").replace("_", "/").trimEnd('=')
            val out = java.io.ByteArrayOutputStream()
            var buffer = 0
            var bits = 0
            for (ch in clean) {
                val index = table.indexOf(ch)
                if (index < 0) throw BocMalformedException("Payload is not valid Base64")
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

    fun parseBase64(payload: String?): List<TonCell> {
        if (payload.isNullOrBlank()) throw BocMalformedException("Empty BOC payload")
        return parse(decodeBase64(payload))
    }

    fun parse(raw: ByteArray): List<TonCell> {
        if (raw.size < 5) throw BocMalformedException("BOC data too small (${raw.size} bytes)")

        var offset = 0
        fun u8(): Int {
            if (offset >= raw.size) throw BocMalformedException("BOC header truncated")
            return raw[offset++].toInt() and 0xff
        }
        fun uint(byteCount: Int): Int {
            if (byteCount <= 0 || byteCount > 4) throw BocMalformedException("Unsupported size width $byteCount")
            var value = 0
            repeat(byteCount) { value = (value shl 8) or u8() }
            if (value < 0) throw BocMalformedException("BOC declares an out-of-range size")
            return value
        }

        // Read the magic without the range check below: 0xb5ee9c72 is a negative signed Int.
        var magic = 0
        repeat(4) { magic = (magic shl 8) or u8() }
        if (magic != BOC_MAGIC) throw BocMalformedException("Unrecognised BOC magic")

        val flags = u8()
        val hasIndex = (flags and 0x80) != 0
        val hasCrc = (flags and 0x40) != 0
        val hasCacheBits = (flags and 0x20) != 0
        val refSize = flags and 0x07
        if (refSize !in 1..4) throw BocMalformedException("Invalid BOC ref size $refSize")

        val offsetSize = u8()
        if (offsetSize !in 1..8) throw BocMalformedException("Invalid BOC offset size $offsetSize")

        val cellCount = uint(refSize)
        val rootCount = uint(refSize)
        val absentCount = uint(refSize)
        if (rootCount < 1) throw BocMalformedException("BOC declares no roots")
        if (cellCount > maxCellCount) {
            throw BocMalformedException("MAX_CELL_COUNT ($maxCellCount) exceeded: BOC declares $cellCount cells")
        }
        if (rootCount + absentCount > cellCount) {
            throw BocMalformedException("BOC declares more roots than cells")
        }
        if (offsetSize > 4) throw BocMalformedException("Unsupported total-size width $offsetSize")
        uint(offsetSize) // total cell data size, re-derived while reading

        val roots = ArrayList<Int>(rootCount)
        repeat(rootCount) { roots.add(uint(refSize)) }
        if (hasIndex) repeat(cellCount) { uint(offsetSize) }
        if (hasCacheBits) { /* cache-bits flag affects the index only, which is skipped above */ }

        val cells = ArrayList<TonCell>(cellCount)
        repeat(cellCount) {
            val d1 = u8()
            val d2 = u8()
            val refCount = d1 and 0x07
            val isExotic = (d1 and 0x08) != 0
            val hasHashes = (d1 and 0x10) != 0
            if (refCount > 4) throw BocMalformedException("Cell declares $refCount refs (max 4)")

            if (hasHashes) {
                val level = (d1 shr 5) and 0x03
                val hashCount = level + 1
                repeat(hashCount * 32 + hashCount * 2) { u8() }
            }

            val dataBytes = (d2 shr 1) + (d2 and 1)
            if (offset + dataBytes > raw.size) throw BocMalformedException("Cell data truncated")
            val data = raw.copyOfRange(offset, offset + dataBytes)
            offset += dataBytes

            // An odd d2 means the final byte is augmented: a 1 bit followed by zero padding.
            val bitLength = if ((d2 and 1) == 0) {
                d2 * 4
            } else {
                val last = data.lastOrNull()?.toInt()?.and(0xff) ?: 0
                var trailing = 0
                var mask = 1
                while (trailing < 8 && (last and mask) == 0) { trailing++; mask = mask shl 1 }
                (dataBytes * 8) - trailing - 1
            }
            if (bitLength < 0 || bitLength > dataBytes * 8) {
                throw BocMalformedException("Cell declares an impossible bit length")
            }

            val refs = ArrayList<Int>(refCount)
            repeat(refCount) {
                val index = uint(refSize)
                if (index >= cellCount) throw BocMalformedException("Cell reference $index is out of range")
                refs.add(index)
            }
            cells.add(TonCell(data, bitLength, refs, isExotic))
        }

        if (hasCrc && offset + 4 <= raw.size) offset += 4

        validateAcyclicAndBounded(cells, roots)
        return cells
    }

    /**
     * Iterative depth-first walk. Bounds depth, and rejects any reference that does not point
     * strictly forward — which makes a cycle unrepresentable rather than merely detected late.
     */
    private fun validateAcyclicAndBounded(cells: List<TonCell>, roots: List<Int>) {
        val visited = HashSet<Int>()
        for (root in roots) {
            if (root >= cells.size) throw BocMalformedException("Root index $root is out of range")
            val stack = ArrayDeque<Pair<Int, Int>>()
            stack.addLast(root to 1)
            while (stack.isNotEmpty()) {
                val (index, depth) = stack.removeLast()
                if (depth > maxCellDepth) {
                    throw BocMalformedException("MAX_CELL_DEPTH ($maxCellDepth) exceeded")
                }
                if (!visited.add(index) && depth > 1) continue
                for (ref in cells[index].refs) {
                    if (ref <= index) {
                        throw BocMalformedException(
                            "Cyclic or backward cell reference detected ($index -> $ref)"
                        )
                    }
                    stack.addLast(ref to depth + 1)
                }
            }
        }
    }

    /** Decodes the root cell's 32-bit opcode into something a confirmation dialog can show. */
    fun decodePayload(payload: String?): DecodedBocPayload {
        val cells = parseBase64(payload)
        val slice = TonCellSlice(cells.first())
        if (slice.remainingBits < 32) {
            return DecodedBocPayload(
                opcode = "0x", kind = "empty",
                summary = "Empty payload", isKnown = true
            )
        }

        val opcode = slice.readUInt(32).toInt()
        val opcodeHex = "0x%08x".format(opcode)

        return when (opcode) {
            OP_TEXT_COMMENT -> {
                val text = slice.readTextTail()
                DecodedBocPayload(
                    opcode = opcodeHex, kind = "comment",
                    summary = if (text.isBlank()) "Text comment (empty)" else "Comment: $text",
                    comment = text
                )
            }

            OP_JETTON_TRANSFER -> {
                val queryId = slice.readUInt(64)
                val amount = slice.readCoins()
                val destination = slice.readAddress()
                DecodedBocPayload(
                    opcode = opcodeHex, kind = "jetton_transfer",
                    summary = "Jetton transfer of $amount to ${destination ?: "an unspecified address"}",
                    destination = destination, amountRaw = amount, queryId = queryId
                )
            }

            OP_NFT_TRANSFER -> {
                val queryId = slice.readUInt(64)
                val newOwner = slice.readAddress()
                DecodedBocPayload(
                    opcode = opcodeHex, kind = "nft_transfer",
                    summary = "NFT ownership transfer to ${newOwner ?: "an unspecified address"}",
                    destination = newOwner, queryId = queryId,
                    warnings = listOf("This transfers ownership of an NFT out of your wallet.")
                )
            }

            else -> DecodedBocPayload(
                opcode = opcodeHex, kind = "unknown",
                summary = "Unrecognised contract call ($opcodeHex). The payload could not be verified.",
                isKnown = false,
                warnings = listOf("UNVERIFIED PAYLOAD: this message's opcode is not a known standard operation.")
            )
        }
    }
}
