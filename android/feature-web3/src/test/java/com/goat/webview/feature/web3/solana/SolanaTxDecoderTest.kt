package com.goat.webview.feature.web3.solana

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigInteger

/**
 * Wire fixtures are serialised from their message structure by a generator, not transcribed.
 */
class SolanaTxDecoderTest {

    private companion object {
        const val SOL_TRANSFER =
            "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkBAgIAAQwCAAAAAC9oWQAAAAA="
        const val SPL_TRANSFER_CHECKED =
            "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEFAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUG3fbh12Whk9nL4UbO63msHLSF7V9bN5E6jPWFfv8AqQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJAQQEAQIDAAoMYBmFAQAAAAAG"
        const val SPL_APPROVE =
            "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEEAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBt324ddloZPZy+FGzut5rBy0he1fWzeROoz1hX7/AKkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQEDAwECAAkEP0IPAAAAAAA="
        const val V0_WITH_LOOKUP =
            "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAQABAwEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJAQICAAEMAgAAAABlzR0AAAAAAQcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHAQMBBA=="
        const val UNKNOWN_PROGRAM =
            "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJAQEBAAKquw=="
        const val BAD_PROGRAM_INDEX =
            "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkBCQIAAQEA"
    }

    @Test
    fun testDecodesALegacySystemTransfer() {
        val decoded = SolanaTxDecoder.decodeBase64(SOL_TRANSFER)
        assertEquals("legacy", decoded.version)
        assertEquals(1, decoded.instructions.size)

        val instruction = decoded.instructions.first()
        assertEquals("sol_transfer", instruction.kind)
        assertEquals("System Program", instruction.programName)
        assertEquals(BigInteger.valueOf(1_500_000_000L), instruction.amountRaw)
        assertTrue(instruction.summary.contains("1.5 SOL"))
        assertNotNull(instruction.destination)
        assertEquals(0, decoded.addressTableLookups)
        assertTrue(decoded.warnings.isEmpty())
    }

    @Test
    fun testDecodesSplTransferCheckedWithCorrectDecimalScaling() {
        val decoded = SolanaTxDecoder.decodeBase64(SPL_TRANSFER_CHECKED)
        val instruction = decoded.instructions.first()
        assertEquals("spl_transfer_checked", instruction.kind)
        assertEquals("SPL Token", instruction.programName)
        assertEquals(BigInteger.valueOf(25_500_000L), instruction.amountRaw)
        assertEquals(6, instruction.decimals)
        assertTrue(
            "25500000 base units at 6 decimals is 25.5, not 25500000",
            instruction.summary.contains("25.5")
        )
    }

    @Test
    fun testDecodesSplApproveAsADelegation() {
        val decoded = SolanaTxDecoder.decodeBase64(SPL_APPROVE)
        val instruction = decoded.instructions.first()
        assertEquals("spl_approve", instruction.kind)
        assertTrue(instruction.summary.contains("spend tokens"))
        assertEquals(BigInteger.valueOf(999_999L), instruction.amountRaw)
    }

    @Test
    fun testDecodesAVersionedV0TransactionAndFlagsLookupTables() {
        val decoded = SolanaTxDecoder.decodeBase64(V0_WITH_LOOKUP)
        assertEquals("v0", decoded.version)
        assertEquals(1, decoded.addressTableLookups)
        assertTrue(decoded.requiresAddressLookupResolution)
        assertTrue(
            "the user must be told some accounts are not visible",
            decoded.warnings.any { it.contains("lookup tables") }
        )
        assertEquals("sol_transfer", decoded.instructions.first().kind)
        assertEquals(BigInteger.valueOf(500_000_000L), decoded.instructions.first().amountRaw)
    }

    @Test
    fun testUnknownProgramIsReportedUnverifiedNotGuessedAt() {
        val decoded = SolanaTxDecoder.decodeBase64(UNKNOWN_PROGRAM)
        val instruction = decoded.instructions.first()
        assertFalse(instruction.isKnown)
        assertEquals("unknown", instruction.kind)
        assertTrue(decoded.warnings.any { it.contains("UNVERIFIED PROGRAM") })
    }

    @Test
    fun testInstructionNamingANonexistentAccountIsRejected() {
        val e = runCatching { SolanaTxDecoder.decodeBase64(BAD_PROGRAM_INDEX) }.exceptionOrNull()
        assertTrue("expected a malformed-transaction error, got $e", e is SolanaMalformedTransactionException)
    }

    @Test
    fun testGarbageInputIsRejectedCleanly() {
        for (bad in listOf(null, "", "@@@ not base64", "AAAA")) {
            val e = runCatching { SolanaTxDecoder.decodeBase64(bad) }.exceptionOrNull()
            assertTrue("input '$bad' should have been rejected", e is SolanaMalformedTransactionException)
        }
    }

    @Test
    fun testTruncatedTransactionUnderflowsCleanly() {
        val truncated = SOL_TRANSFER.substring(0, 60)
        val e = runCatching { SolanaTxDecoder.decodeBase64(truncated) }.exceptionOrNull()
        assertTrue(e is SolanaMalformedTransactionException)
    }

    @Test
    fun testFeePayerAndBlockhashAreExposedForTheMutexKey() {
        val decoded = SolanaTxDecoder.decodeBase64(SOL_TRANSFER)
        assertEquals(32, Base58Fixture.decodeLength(decoded.feePayer))
        assertTrue(decoded.recentBlockhash.isNotEmpty())
        assertEquals(3, decoded.accountKeys.size)
    }

    @Test
    fun testBase58EncodesTheAllZeroSystemProgramId() {
        assertEquals(SolanaTxDecoder.SYSTEM_PROGRAM, Base58.encode(ByteArray(32)))
    }

    @Test
    fun testFormatUnitsScalesCorrectly() {
        assertEquals("1.5", SolanaTxDecoder.formatUnits(BigInteger.valueOf(1_500_000_000L), 9))
        assertEquals("25.5", SolanaTxDecoder.formatUnits(BigInteger.valueOf(25_500_000L), 6))
        assertEquals("1", SolanaTxDecoder.formatUnits(BigInteger.valueOf(1_000_000L), 6))
        assertEquals("0", SolanaTxDecoder.formatUnits(null, 9))
    }

    private object Base58Fixture {
        private const val ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
        fun decodeLength(value: String): Int {
            var n = BigInteger.ZERO
            for (c in value) n = n.multiply(BigInteger.valueOf(58)).add(BigInteger.valueOf(ALPHABET.indexOf(c).toLong()))
            val leading = value.takeWhile { it == ALPHABET[0] }.length
            val body = if (n.signum() == 0) emptyList() else n.toByteArray().toList().dropWhile { it.toInt() == 0 }
            return leading + body.size
        }
    }
}
