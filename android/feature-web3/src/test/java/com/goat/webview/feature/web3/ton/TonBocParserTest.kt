package com.goat.webview.feature.web3.ton

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigInteger

/**
 * BOC fixtures are serialised from their cell structure by a generator, not transcribed, so a
 * fixture cannot drift from what it claims to encode. The adversarial ones are the point: a BOC
 * arrives from the page, so the parser has to survive whatever the page sends.
 */
class TonBocParserTest {

    private companion object {
        const val TEXT_COMMENT = "te6ccgEBAQEAFgAAKAAAAABUaGFua3MgZm9yIGx1bmNo"
        const val JETTON_TRANSFER =
            "te6ccgEBAQEANAAAYw+KfqUAAAAAAAAwOUWWgvAIAAACBAYICgwOEBIUFhgaHB4gIiQmKCosLjAyNDY4Ojw/"
        const val NFT_TRANSFER =
            "te6ccgEBAQEAMAAAW1/MPRQAAAAAAAAAB4AAACBAYICgwOEBIUFhgaHB4gIiQmKCosLjAyNDY4Ojw/A="
        const val UNKNOWN_OPCODE = "te6ccgEBAQEABgAACN6tvu8="
        const val CYCLIC = "te6ccgEBAgEABgABAAEBAAA="
        const val HUGE_COUNT = "te6ccgICE4gAAQAAAAIAAAAA"
        const val JETTON_TRUNCATED = "te6ccgECAQEAAAYAAAgPin6l"
        const val DEEP_CHAIN =
            "te6ccgICAMgAAQAAAx4AAAEAAAEBAAACAQAAAwEAAAQBAAAFAQAABgEAAAcBAAAIAQAACQEAAAoBAAALAQAADAEAAA0BAAAOAQAADwEAABABAAARAQAAEgEAABMBAAAUAQAAFQEAABYBAAAXAQAAGAEAABkBAAAaAQAAGwEAABwBAAAdAQAAHgEAAB8BAAAgAQAAIQEAACIBAAAjAQAAJAEAACUBAAAmAQAAJwEAACgBAAApAQAAKgEAACsBAAAsAQAALQEAAC4BAAAvAQAAMAEAADEBAAAyAQAAMwEAADQBAAA1AQAANgEAADcBAAA4AQAAOQEAADoBAAA7AQAAPAEAAD0BAAA+AQAAPwEAAEABAABBAQAAQgEAAEMBAABEAQAARQEAAEYBAABHAQAASAEAAEkBAABKAQAASwEAAEwBAABNAQAATgEAAE8BAABQAQAAUQEAAFIBAABTAQAAVAEAAFUBAABWAQAAVwEAAFgBAABZAQAAWgEAAFsBAABcAQAAXQEAAF4BAABfAQAAYAEAAGEBAABiAQAAYwEAAGQBAABlAQAAZgEAAGcBAABoAQAAaQEAAGoBAABrAQAAbAEAAG0BAABuAQAAbwEAAHABAABxAQAAcgEAAHMBAAB0AQAAdQEAAHYBAAB3AQAAeAEAAHkBAAB6AQAAewEAAHwBAAB9AQAAfgEAAH8BAACAAQAAgQEAAIIBAACDAQAAhAEAAIUBAACGAQAAhwEAAIgBAACJAQAAigEAAIsBAACMAQAAjQEAAI4BAACPAQAAkAEAAJEBAACSAQAAkwEAAJQBAACVAQAAlgEAAJcBAACYAQAAmQEAAJoBAACbAQAAnAEAAJ0BAACeAQAAnwEAAKABAAChAQAAogEAAKMBAACkAQAApQEAAKYBAACnAQAAqAEAAKkBAACqAQAAqwEAAKwBAACtAQAArgEAAK8BAACwAQAAsQEAALIBAACzAQAAtAEAALUBAAC2AQAAtwEAALgBAAC5AQAAugEAALsBAAC8AQAAvQEAAL4BAAC/AQAAwAEAAMEBAADCAQAAwwEAAMQBAADFAQAAxgEAAMcAAA=="
    }

    private val parser = TonBocParser()

    @Test
    fun testDecodesATextComment() {
        val decoded = parser.decodePayload(TEXT_COMMENT)
        assertEquals("0x00000000", decoded.opcode)
        assertEquals("comment", decoded.kind)
        assertEquals("Thanks for lunch", decoded.comment)
        assertTrue(decoded.isKnown)
    }

    @Test
    fun testDecodesATep74JettonTransfer() {
        val decoded = parser.decodePayload(JETTON_TRANSFER)
        assertEquals("0x0f8a7ea5", decoded.opcode)
        assertEquals("jetton_transfer", decoded.kind)
        assertEquals(BigInteger.valueOf(1_500_000_000L), decoded.amountRaw)
        assertEquals(12345L, decoded.queryId)
        assertNotNull(decoded.destination)
        assertTrue("destination must be the raw workchain:hash form", decoded.destination!!.startsWith("0:"))
        assertEquals(64 + 2, decoded.destination!!.length)
    }

    @Test
    fun testDecodesATep62NftTransfer() {
        val decoded = parser.decodePayload(NFT_TRANSFER)
        assertEquals("0x5fcc3d14", decoded.opcode)
        assertEquals("nft_transfer", decoded.kind)
        assertEquals(7L, decoded.queryId)
        assertNotNull(decoded.destination)
        assertTrue(decoded.warnings.any { it.contains("ownership") })
    }

    @Test
    fun testUnknownOpcodeIsReportedUnverifiedNotGuessedAt() {
        val decoded = parser.decodePayload(UNKNOWN_OPCODE)
        assertEquals("0xdeadbeef", decoded.opcode)
        assertFalse(decoded.isKnown)
        assertTrue(decoded.warnings.any { it.contains("UNVERIFIED PAYLOAD") })
    }

    // ---- Adversarial ----

    @Test
    fun testCyclicReferenceIsRejectedCleanly() {
        val e = runCatching { parser.parseBase64(CYCLIC) }.exceptionOrNull()
        assertTrue("expected BocMalformedException, got $e", e is BocMalformedException)
        assertTrue(e!!.message!!.contains("Cyclic"))
    }

    @Test
    fun testDepthBeyondTheLimitIsRejectedWithoutStackOverflow() {
        val deepParser = TonBocParser(maxCellDepth = 8, maxCellCount = 1024)
        val e = runCatching { deepParser.parseBase64(DEEP_CHAIN) }.exceptionOrNull()
        assertTrue("expected BocMalformedException, got $e", e is BocMalformedException)
        assertTrue(e!!.message!!.contains("MAX_CELL_DEPTH"))
    }

    @Test
    fun testDeclaredCellCountBeyondTheLimitIsRejectedBeforeAllocating() {
        val e = runCatching { parser.parseBase64(HUGE_COUNT) }.exceptionOrNull()
        assertTrue("expected BocMalformedException, got $e", e is BocMalformedException)
        assertTrue(e!!.message!!.contains("MAX_CELL_COUNT"))
    }

    @Test
    fun testTruncatedSliceUnderflowsCleanlyRatherThanReadingPastTheEnd() {
        val e = runCatching { parser.decodePayload(JETTON_TRUNCATED) }.exceptionOrNull()
        assertTrue("expected BocMalformedException, got $e", e is BocMalformedException)
        assertTrue(e!!.message!!.contains("underflow"))
    }

    @Test
    fun testGarbageInputIsRejected() {
        for (bad in listOf(null, "", "not base64 @@@", "aGVsbG8=", "te6ccg")) {
            val e = runCatching { parser.decodePayload(bad) }.exceptionOrNull()
            assertTrue("input '$bad' should have been rejected", e is BocMalformedException)
        }
    }

    @Test
    fun testSliceBoundsAreCheckedOnEveryRead() {
        val slice = TonCellSlice(TonCell(byteArrayOf(0xFF.toByte()), 8, emptyList(), false))
        assertEquals(255L, slice.readUInt(8))
        assertEquals(0, slice.remainingBits)
        assertTrue(runCatching { slice.readBit() }.exceptionOrNull() is BocMalformedException)
        assertTrue(runCatching { slice.readUInt(64) }.exceptionOrNull() is BocMalformedException)
        assertTrue(runCatching { slice.skipBits(-1) }.exceptionOrNull() is BocMalformedException)
    }

    @Test
    fun testCoinsRejectsAnOversizedLengthPrefix() {
        // A 4-bit length prefix of 15 with no following body must underflow, not over-read.
        val slice = TonCellSlice(TonCell(byteArrayOf(0xF0.toByte()), 4, emptyList(), false))
        assertTrue(runCatching { slice.readCoins() }.exceptionOrNull() is BocMalformedException)
    }

    @Test
    fun testAddressVariantsAreHandled() {
        // addr_none$00 padded to 2 bits.
        val none = TonCellSlice(TonCell(byteArrayOf(0x00), 2, emptyList(), false))
        assertEquals(null, none.readAddress())

        // A truncated addr_std must be rejected rather than returning a partial address.
        val truncated = TonCellSlice(TonCell(byteArrayOf(0x80.toByte()), 2, emptyList(), false))
        assertTrue(runCatching { truncated.readAddress() }.exceptionOrNull() is BocMalformedException)
    }

    @Test
    fun testParsingIsBoundedInTimeForTheLargestLegalPayload() {
        val start = System.nanoTime()
        repeat(200) { parser.decodePayload(JETTON_TRANSFER) }
        val perParseMs = (System.nanoTime() - start) / 200 / 1_000_000.0
        assertTrue("BOC parse took ${perParseMs}ms, over the 3ms budget", perParseMs < 3.0)
    }
}
