package com.goat.webview

import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.io.File
import java.security.MessageDigest
import java.util.zip.GZIPOutputStream
import java.util.zip.ZipException

/**
 * Empirical Adversarial Stress Test Suite for GoatDeltaPatcher (BSDIFF40 OTA Engine).
 * Validates resilience against malicious payloads, header corruptions, DoS attacks,
 * stream overruns, zlib/gzip malformations, and atomic staging cleanup guarantees.
 */
class GoatDeltaPatcherAdversarialTest {

    private lateinit var tempDir: File

    @Before
    fun setUp() {
        tempDir = File(System.getProperty("java.io.tmpdir"), "goat_delta_adv_${System.currentTimeMillis()}").apply { mkdirs() }
    }

    @After
    fun tearDown() {
        tempDir.deleteRecursively()
    }

    private fun sha256Hex(bytes: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(bytes).joinToString("") { "%02x".format(it) }
    }

    private fun gzipCompress(bytes: ByteArray): ByteArray {
        val bos = ByteArrayOutputStream()
        GZIPOutputStream(bos).use { it.write(bytes) }
        return bos.toByteArray()
    }

    private fun createRawHeader(
        magic: String = "BSDIFF40",
        ctrlLen: Long,
        diffLen: Long,
        newSize: Long
    ): ByteArray {
        val bos = ByteArrayOutputStream()
        bos.write(magic.toByteArray(Charsets.US_ASCII))
        val dos = DataOutputStream(bos)
        dos.writeLong(ctrlLen)
        dos.writeLong(diffLen)
        dos.writeLong(newSize)
        dos.flush()
        return bos.toByteArray()
    }

    // =========================================================================
    // 1. Corrupted Magic Headers
    // =========================================================================

    @Test
    fun `adversarial test 1a - invalid magic headers are strictly rejected`() {
        val oldBytes = "baseline data".toByteArray()
        val badMagics = listOf("BADMAGIC", "BSDIFF30", "GZDIFF40", "12345678", "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000")

        for (badMagic in badMagics) {
            val patch = createRawHeader(magic = badMagic, ctrlLen = 10, diffLen = 10, newSize = 100) + ByteArray(30)
            try {
                GoatDeltaPatcher.applyPatchBytes(oldBytes, patch)
                fail("Expected IllegalArgumentException for bad magic: $badMagic")
            } catch (e: IllegalArgumentException) {
                assertTrue("Error should mention invalid magic header", e.message!!.contains("Invalid patch header magic"))
            }
        }
    }

    @Test
    fun `adversarial test 1b - empty and truncated headers under 32 bytes are rejected`() {
        val oldBytes = "baseline data".toByteArray()
        val truncatedSizes = listOf(0, 1, 7, 8, 15, 16, 24, 31)

        for (size in truncatedSizes) {
            val truncatedPatch = ByteArray(size) { 0x41 } // 'A'
            try {
                GoatDeltaPatcher.applyPatchBytes(oldBytes, truncatedPatch)
                fail("Expected IllegalArgumentException for truncated header size: $size")
            } catch (e: IllegalArgumentException) {
                assertTrue("Error should mention size is less than 32 bytes header", e.message!!.contains("less than 32 bytes header"))
            }
        }
    }

    // =========================================================================
    // 2. Out-of-bounds Stream Lengths
    // =========================================================================

    @Test
    fun `adversarial test 2a - ctrlBlockLen exceeding total file size is rejected`() {
        val oldBytes = "baseline".toByteArray()
        // Header says ctrlLen = 1000, diffLen = 10, newSize = 100, but file only has 32 + 20 bytes total
        val patch = createRawHeader(ctrlLen = 1000L, diffLen = 10L, newSize = 100L) + ByteArray(20)

        try {
            GoatDeltaPatcher.applyPatchBytes(oldBytes, patch)
            fail("Expected rejection for ctrlBlockLen exceeding file size")
        } catch (e: IllegalArgumentException) {
            assertTrue("Should report truncated patch file", e.message!!.contains("Truncated patch file"))
        }
    }

    @Test
    fun `adversarial test 2b - diffBlockLen exceeding total file size is rejected`() {
        val oldBytes = "baseline".toByteArray()
        val patch = createRawHeader(ctrlLen = 10L, diffLen = 5000L, newSize = 100L) + ByteArray(50)

        try {
            GoatDeltaPatcher.applyPatchBytes(oldBytes, patch)
            fail("Expected rejection for diffBlockLen exceeding file size")
        } catch (e: IllegalArgumentException) {
            assertTrue("Should report truncated patch file", e.message!!.contains("Truncated patch file"))
        }
    }

    @Test
    fun `adversarial test 2c - combined ctrl and diff offset exceeding patch size is rejected`() {
        val oldBytes = "baseline".toByteArray()
        val patch = createRawHeader(ctrlLen = 50L, diffLen = 50L, newSize = 100L) + ByteArray(40) // Needs 32 + 100 = 132

        try {
            GoatDeltaPatcher.applyPatchBytes(oldBytes, patch)
            fail("Expected rejection when required extraOffset exceeds patch size")
        } catch (e: IllegalArgumentException) {
            assertTrue("Should report truncated patch file", e.message!!.contains("Truncated patch file"))
        }
    }

    // =========================================================================
    // 3. Anti-DOS Memory Bounds
    // =========================================================================

    @Test
    fun `adversarial test 3a - newFileSize exceeding 50MB anti-DOS limit is rejected`() {
        val oldBytes = "baseline".toByteArray()

        val sizes = listOf(
            GoatDeltaPatcher.MAX_ALLOWED_BUNDLE_SIZE + 1L,
            100L * 1024 * 1024,
            1024L * 1024 * 1024
        )

        for (excessiveSize in sizes) {
            val patch = createRawHeader(ctrlLen = 10L, diffLen = 10L, newSize = excessiveSize) + ByteArray(30)
            try {
                GoatDeltaPatcher.applyPatchBytes(oldBytes, patch)
                fail("Expected rejection for newFileSize: $excessiveSize")
            } catch (e: IllegalArgumentException) {
                assertTrue("Should report exceeding max allowed bundle size", e.message!!.contains("exceeds maximum allowed bundle size"))
            }
        }
    }

    @Test
    fun `adversarial test 3b - negative header dimensions are strictly rejected`() {
        val oldBytes = "baseline".toByteArray()

        val testCases = listOf(
            Triple(-1L, 10L, 100L),
            Triple(10L, -1L, 100L),
            Triple(10L, 10L, -1L),
            Triple(-500L, -500L, -500L)
        )

        for ((ctrl, diff, newSize) in testCases) {
            val patch = createRawHeader(ctrlLen = ctrl, diffLen = diff, newSize = newSize) + ByteArray(30)
            try {
                GoatDeltaPatcher.applyPatchBytes(oldBytes, patch)
                fail("Expected rejection for negative dimension ($ctrl, $diff, $newSize)")
            } catch (e: IllegalArgumentException) {
                assertTrue("Should report corrupted header dimensions", e.message!!.contains("Corrupted patch header dimensions"))
            }
        }
    }

    @Test
    fun `adversarial test 3c - ctrlBlockLen or diffBlockLen exceeding MAX_ALLOWED_BUNDLE_SIZE is rejected`() {
        val oldBytes = "baseline".toByteArray()
        val excessiveLen = GoatDeltaPatcher.MAX_ALLOWED_BUNDLE_SIZE + 1L

        val patchCtrl = createRawHeader(ctrlLen = excessiveLen, diffLen = 10L, newSize = 100L) + ByteArray(20)
        try {
            GoatDeltaPatcher.applyPatchBytes(oldBytes, patchCtrl)
            fail("Expected rejection for ctrlBlockLen exceeding max limit")
        } catch (e: IllegalArgumentException) {
            assertTrue("Should report block length exceeding limit", e.message!!.contains("Block lengths exceed maximum allowed bundle size"))
        }

        val patchDiff = createRawHeader(ctrlLen = 10L, diffLen = excessiveLen, newSize = 100L) + ByteArray(20)
        try {
            GoatDeltaPatcher.applyPatchBytes(oldBytes, patchDiff)
            fail("Expected rejection for diffBlockLen exceeding max limit")
        } catch (e: IllegalArgumentException) {
            assertTrue("Should report block length exceeding limit", e.message!!.contains("Block lengths exceed maximum allowed bundle size"))
        }
    }

    // =========================================================================
    // 4. Corrupted GZIP Stream Payloads
    // =========================================================================

    @Test
    fun `adversarial test 4a - corrupted non-gzip ctrlBlock throws compression error`() {
        val oldBytes = "baseline".toByteArray()
        val garbageCtrl = ByteArray(30) { 0xFF.toByte() }
        val validGzipDiff = gzipCompress(ByteArray(10))
        val validGzipExtra = gzipCompress(ByteArray(10))

        val header = createRawHeader(
            ctrlLen = garbageCtrl.size.toLong(),
            diffLen = validGzipDiff.size.toLong(),
            newSize = 100L
        )
        val patch = header + garbageCtrl + validGzipDiff + validGzipExtra

        try {
            GoatDeltaPatcher.applyPatchBytes(oldBytes, patch)
            fail("Expected ZipException / IOException for corrupted ctrlBlock")
        } catch (e: Exception) {
            assertTrue("Expected ZipException or IOException for invalid GZIP magic header", e is ZipException || e is java.io.IOException)
        }
    }

    @Test
    fun `adversarial test 4b - corrupted non-gzip diffBlock throws compression error`() {
        val oldBytes = "baseline".toByteArray()
        val ctrlBos = ByteArrayOutputStream()
        val dos = DataOutputStream(ctrlBos)
        dos.writeInt(10)
        dos.writeInt(0)
        dos.writeInt(0)
        dos.flush()
        val validGzipCtrl = gzipCompress(ctrlBos.toByteArray())

        val garbageDiff = ByteArray(30) { 0xFE.toByte() }
        val validGzipExtra = gzipCompress(ByteArray(10))

        val header = createRawHeader(
            ctrlLen = validGzipCtrl.size.toLong(),
            diffLen = garbageDiff.size.toLong(),
            newSize = 10L
        )
        val patch = header + validGzipCtrl + garbageDiff + validGzipExtra

        try {
            GoatDeltaPatcher.applyPatchBytes(oldBytes, patch)
            fail("Expected ZipException for corrupted diffBlock")
        } catch (e: Exception) {
            assertTrue("Expected ZipException or IOException for invalid GZIP diff stream", e is ZipException || e is java.io.IOException)
        }
    }

    @Test
    fun `adversarial test 4c - corrupted non-gzip extraBlock throws compression error`() {
        val oldBytes = "baseline".toByteArray()
        val ctrlBos = ByteArrayOutputStream()
        val dos = DataOutputStream(ctrlBos)
        dos.writeInt(0)
        dos.writeInt(10)
        dos.writeInt(0)
        dos.flush()
        val validGzipCtrl = gzipCompress(ctrlBos.toByteArray())
        val validGzipDiff = gzipCompress(ByteArray(0))
        val garbageExtra = ByteArray(30) { 0xAA.toByte() }

        val header = createRawHeader(
            ctrlLen = validGzipCtrl.size.toLong(),
            diffLen = validGzipDiff.size.toLong(),
            newSize = 10L
        )
        val patch = header + validGzipCtrl + validGzipDiff + garbageExtra

        try {
            GoatDeltaPatcher.applyPatchBytes(oldBytes, patch)
            fail("Expected ZipException for corrupted extraBlock")
        } catch (e: Exception) {
            assertTrue("Expected ZipException or IOException for invalid GZIP extra stream", e is ZipException || e is java.io.IOException)
        }
    }

    // =========================================================================
    // 5. Incomplete / Overrun Control and Diff Streams
    // =========================================================================

    @Test
    fun `adversarial test 5a - ctrl tuple specifying diffBytesCount exceeding newFileSize is rejected`() {
        val oldBytes = "baseline".toByteArray()
        val ctrlBos = ByteArrayOutputStream()
        val dos = DataOutputStream(ctrlBos)
        dos.writeInt(500) // Exceeds newSize = 100
        dos.writeInt(0)
        dos.writeInt(0)
        dos.flush()
        val gzipCtrl = gzipCompress(ctrlBos.toByteArray())
        val gzipDiff = gzipCompress(ByteArray(10))
        val gzipExtra = gzipCompress(ByteArray(10))

        val header = createRawHeader(
            ctrlLen = gzipCtrl.size.toLong(),
            diffLen = gzipDiff.size.toLong(),
            newSize = 100L
        )
        val patch = header + gzipCtrl + gzipDiff + gzipExtra

        try {
            GoatDeltaPatcher.applyPatchBytes(oldBytes, patch)
            fail("Expected rejection when diff bytes exceed target file size")
        } catch (e: IllegalArgumentException) {
            assertTrue("Error must mention diff bytes exceed target file size", e.message!!.contains("diff bytes exceed target file size"))
        }
    }

    @Test
    fun `adversarial test 5b - ctrl tuple specifying extraBytesCount exceeding newFileSize is rejected`() {
        val oldBytes = "baseline".toByteArray()
        val ctrlBos = ByteArrayOutputStream()
        val dos = DataOutputStream(ctrlBos)
        dos.writeInt(50)
        dos.writeInt(200) // 50 + 200 = 250 > newSize = 100
        dos.writeInt(0)
        dos.flush()
        val gzipCtrl = gzipCompress(ctrlBos.toByteArray())
        val gzipDiff = gzipCompress(ByteArray(50))
        val gzipExtra = gzipCompress(ByteArray(200))

        val header = createRawHeader(
            ctrlLen = gzipCtrl.size.toLong(),
            diffLen = gzipDiff.size.toLong(),
            newSize = 100L
        )
        val patch = header + gzipCtrl + gzipDiff + gzipExtra

        try {
            GoatDeltaPatcher.applyPatchBytes(oldBytes, patch)
            fail("Expected rejection when extra bytes exceed target file size")
        } catch (e: IllegalArgumentException) {
            assertTrue("Error must mention extra bytes exceed target file size", e.message!!.contains("extra bytes exceed target file size"))
        }
    }

    @Test
    fun `adversarial test 5c - negative byte count in control block is rejected`() {
        val oldBytes = "baseline".toByteArray()
        val ctrlBos = ByteArrayOutputStream()
        val dos = DataOutputStream(ctrlBos)
        dos.writeInt(-10) // Negative diff count
        dos.writeInt(0)
        dos.writeInt(0)
        dos.flush()
        val gzipCtrl = gzipCompress(ctrlBos.toByteArray())
        val gzipDiff = gzipCompress(ByteArray(10))
        val gzipExtra = gzipCompress(ByteArray(10))

        val header = createRawHeader(
            ctrlLen = gzipCtrl.size.toLong(),
            diffLen = gzipDiff.size.toLong(),
            newSize = 100L
        )
        val patch = header + gzipCtrl + gzipDiff + gzipExtra

        try {
            GoatDeltaPatcher.applyPatchBytes(oldBytes, patch)
            fail("Expected rejection for negative byte count in control block")
        } catch (e: IllegalArgumentException) {
            assertTrue("Error must mention negative byte count", e.message!!.contains("negative byte count in control block"))
        }
    }

    // =========================================================================
    // 6. SHA-256 Verification & Atomic Staging Cleanup
    // =========================================================================

    @Test
    fun `adversarial test 6a - SHA-256 mismatch deletes temp staging file and leaves output clean`() = runTest {
        val oldBytes = "Base bundle contents 12345".toByteArray()
        val newBytes = "Upgraded bundle contents 67890".toByteArray()

        val oldFile = File(tempDir, "base.bin").apply { writeBytes(oldBytes) }
        val newFile = File(tempDir, "target.bin").apply { writeBytes(newBytes) }
        val patchFile = File(tempDir, "ota.patch")
        val outputFile = File(tempDir, "reconstructed.bin")

        GoatDeltaPatcher.createPatch(oldFile, newFile, patchFile)

        val wrongSha = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        val result = GoatDeltaPatcher.applyPatch(oldFile, patchFile, outputFile, wrongSha)

        assertFalse("applyPatch must return false on checksum mismatch", result)
        assertFalse("Destination output bundle must NOT exist on failure", outputFile.exists())

        val tempFiles = tempDir.listFiles { _, name -> name.contains(".tmp_") }
        assertEquals("Zero temporary staging files must remain after failure", 0, tempFiles?.size ?: 0)
    }

    @Test
    fun `adversarial test 6b - SHA-256 case insensitivity verification`() = runTest {
        val oldBytes = "Base file".toByteArray()
        val newBytes = "Updated file with higher security".toByteArray()

        val oldFile = File(tempDir, "old.bin").apply { writeBytes(oldBytes) }
        val newFile = File(tempDir, "new.bin").apply { writeBytes(newBytes) }
        val patchFile = File(tempDir, "patch.bin")
        val outputFile = File(tempDir, "out.bin")

        GoatDeltaPatcher.createPatch(oldFile, newFile, patchFile)

        val upperCaseSha = sha256Hex(newBytes).uppercase()
        val result = GoatDeltaPatcher.applyPatch(oldFile, patchFile, outputFile, upperCaseSha)

        assertTrue("applyPatch should succeed with uppercase SHA-256 hash", result)
        assertTrue("Destination output bundle must exist", outputFile.exists())
        assertEquals(upperCaseSha.lowercase(), sha256Hex(outputFile.readBytes()))

        val tempFiles = tempDir.listFiles { _, name -> name.contains(".tmp_") }
        assertEquals("Zero temporary staging files must remain after success", 0, tempFiles?.size ?: 0)
    }

    @Test
    fun `adversarial test 6c - corrupted patch file cleans up temp staging file atomically`() = runTest {
        val oldFile = File(tempDir, "base.bin").apply { writeBytes("base".toByteArray()) }
        val badPatchFile = File(tempDir, "corrupted.patch").apply { writeBytes("CORRUPTED_GARBAGE_HEADER_DATA_12345678".toByteArray()) }
        val outputFile = File(tempDir, "out.bin")

        val result = GoatDeltaPatcher.applyPatch(oldFile, badPatchFile, outputFile)

        assertFalse("applyPatch must return false on corrupted patch", result)
        assertFalse("Output file must not exist", outputFile.exists())

        val tempFiles = tempDir.listFiles { _, name -> name.contains(".tmp_") }
        assertEquals("All temporary files must be cleaned up on exception", 0, tempFiles?.size ?: 0)
    }
}
