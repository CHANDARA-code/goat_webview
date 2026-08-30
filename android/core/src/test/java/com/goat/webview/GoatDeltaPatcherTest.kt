package com.goat.webview

import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.io.File
import java.security.MessageDigest
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class GoatDeltaPatcherTest {

    private lateinit var tempDir: File

    @Before
    fun setUp() {
        tempDir = File(System.getProperty("java.io.tmpdir"), "goat_patch_test_${System.currentTimeMillis()}").apply { mkdirs() }
    }

    @After
    fun tearDown() {
        tempDir.deleteRecursively()
    }

    private fun createZipWithContent(entries: Map<String, String>): ByteArray {
        val bos = ByteArrayOutputStream()
        ZipOutputStream(bos).use { zos ->
            entries.forEach { (name, content) ->
                zos.putNextEntry(ZipEntry(name))
                zos.write(content.toByteArray(Charsets.UTF_8))
                zos.closeEntry()
            }
        }
        return bos.toByteArray()
    }

    private fun sha256Hex(bytes: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(bytes).joinToString("") { "%02x".format(it) }
    }

    @Test
    fun `test binary delta patch creation and reconstruction on byte arrays`() {
        val oldBytes = "Hello World! This is the baseline v1.0.0 mini-app bundle.".toByteArray(Charsets.UTF_8)
        val newBytes = "Hello World! This is the upgraded v2.0.0 mini-app bundle with extra features.".toByteArray(Charsets.UTF_8)

        val patchBytes = GoatDeltaPatcher.createPatchBytes(oldBytes, newBytes)
        assertTrue(patchBytes.size > 32)
        assertEquals("BSDIFF40", String(patchBytes, 0, 8, Charsets.US_ASCII))

        val reconstructed = GoatDeltaPatcher.applyPatchBytes(oldBytes, patchBytes)
        assertArrayEquals(newBytes, reconstructed)
        assertEquals(String(newBytes, Charsets.UTF_8), String(reconstructed, Charsets.UTF_8))
    }

    @Test
    fun `test delta patching on real ZIP archives with full SHA-256 match`() = runTest {
        val oldZip = createZipWithContent(mapOf(
            "index.html" to "<html><head><title>App v1</title></head><body><h1>Welcome</h1></body></html>",
            "app.js" to "console.log('v1');"
        ))

        val newZip = createZipWithContent(mapOf(
            "index.html" to "<html><head><title>App v2</title></head><body><h1>Welcome to SuperApp</h1></body></html>",
            "app.js" to "console.log('v2 with optimizations');",
            "new_feature.js" to "export const feature = 'crypto_wallet';"
        ))

        val expectedSha256 = sha256Hex(newZip)

        val oldFile = File(tempDir, "base_miniapp.zip").apply { writeBytes(oldZip) }
        val newFile = File(tempDir, "target_miniapp.zip").apply { writeBytes(newZip) }
        val patchFile = File(tempDir, "update.patch")
        val outputFile = File(tempDir, "patched_miniapp.zip")

        // 1. Generate patch
        val patchSize = GoatDeltaPatcher.createPatch(oldFile, newFile, patchFile)
        assertTrue(patchFile.exists())
        assertEquals(patchFile.length(), patchSize)

        // 2. Apply patch
        val success = GoatDeltaPatcher.applyPatch(oldFile, patchFile, outputFile, expectedSha256)
        assertTrue(success)
        assertTrue(outputFile.exists())

        val patchedBytes = outputFile.readBytes()
        val actualSha256 = sha256Hex(patchedBytes)
        assertEquals(expectedSha256, actualSha256)
        assertArrayEquals(newZip, patchedBytes)
    }

    @Test
    fun `test applyPatch fails on corrupted patch header`() {
        val oldBytes = "Sample baseline".toByteArray()
        val badPatch = "CORRUPTED_HEADER_DATA_1234567890".toByteArray()

        var caught = false
        try {
            GoatDeltaPatcher.applyPatchBytes(oldBytes, badPatch)
        } catch (e: IllegalArgumentException) {
            caught = true
            assertTrue(e.message!!.contains("Invalid patch header magic"))
        }
        assertTrue(caught)
    }

    @Test
    fun `test applyPatch fails on SHA-256 checksum mismatch`() = runTest {
        val oldBytes = "Version 1.0".toByteArray()
        val newBytes = "Version 2.0".toByteArray()

        val oldFile = File(tempDir, "old.bin").apply { writeBytes(oldBytes) }
        val newFile = File(tempDir, "new.bin").apply { writeBytes(newBytes) }
        val patchFile = File(tempDir, "diff.patch")
        val outputFile = File(tempDir, "out.bin")

        GoatDeltaPatcher.createPatch(oldFile, newFile, patchFile)

        val mismatchSha256 = "0000000000000000000000000000000000000000000000000000000000000000"
        val result = GoatDeltaPatcher.applyPatch(oldFile, patchFile, outputFile, mismatchSha256)

        assertFalse(result)
        assertFalse(outputFile.exists())
    }

    @Test
    fun `test applyPatchBytes fails on anti-DOS limit breach`() {
        val oldBytes = "baseline".toByteArray()

        // Create malicious header with newFileSize = 100MB (> 50MB)
        val bos = ByteArrayOutputStream()
        val dos = java.io.DataOutputStream(bos)
        bos.write("BSDIFF40".toByteArray(Charsets.US_ASCII))
        dos.writeLong(10L) // ctrlBlockLen
        dos.writeLong(10L) // diffBlockLen
        dos.writeLong(100L * 1024 * 1024) // newFileSize = 100MB
        dos.flush()
        bos.write(ByteArray(20)) // payload

        var caught = false
        try {
            GoatDeltaPatcher.applyPatchBytes(oldBytes, bos.toByteArray())
        } catch (e: IllegalArgumentException) {
            caught = true
            assertTrue(e.message!!.contains("exceeds maximum allowed bundle size"))
        }
        assertTrue("Must reject patches exceeding MAX_ALLOWED_BUNDLE_SIZE", caught)
    }

    @Test
    fun `test applyPatch fails when source files are missing`() = runTest {
        val missingOld = File(tempDir, "missing_old.bin")
        val missingPatch = File(tempDir, "missing_patch.bin")
        val output = File(tempDir, "out.bin")

        val result = GoatDeltaPatcher.applyPatch(missingOld, missingPatch, output)
        assertFalse(result)
        assertFalse(output.exists())
    }

    @Test
    fun `test applyPatchBytes fails on short patch header`() {
        val oldBytes = "baseline".toByteArray()
        val shortPatch = "SHORT_HDR".toByteArray()

        var caught = false
        try {
            GoatDeltaPatcher.applyPatchBytes(oldBytes, shortPatch)
        } catch (e: IllegalArgumentException) {
            caught = true
            assertTrue(e.message!!.contains("size is less than 32 bytes header"))
        }
        assertTrue(caught)
    }
}
