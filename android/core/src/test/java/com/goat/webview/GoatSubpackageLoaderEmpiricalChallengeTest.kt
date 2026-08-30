package com.goat.webview

import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/**
 * Empirical Adversarial Challenge Test Suite for GoatSubpackageLoader (Android).
 *
 * Adversarial Stress Scenarios Tested:
 * 1. Zip Slip payloads with complex relative paths:
 *    - ../../../../etc/passwd
 *    - foo/bar/../../../escaped.js
 *    - Windows backslashes ..\..\evil.js
 *    - deep traversal a/b/c/../../../../evil.js
 * 2. Null byte injections in subpackage name and zip entries:
 *    - subpackage name: pkg\u0000.zip, sub\u0000pkg
 *    - zip entry name: entry\u0000name.js, sub/\u0000/evil.js
 * 3. URL/Hex encoded traversals:
 *    - %2e%2e%2f, %252e%252e%252f, %2e%2e/, ..%2f, %2e%2e%5c, %2E%2E%2F
 * 4. Multi-tenant boundary violation:
 *    - Cross-tenant data overwrite / access between tenant_alpha and tenant_beta
 *    - Directory traversal via appId (e.g. tenant_alpha/../tenant_beta)
 *    - Selective cache eviction: clearing tenant_alpha preserves tenant_beta intact
 *    - Metadata and subpackage listing isolation
 * 5. Empty / whitespace-only inputs, missing files, corrupted ZIP archives:
 *    - Blank / whitespace subpackage names and appIds
 *    - Missing subpackage (not on disk, null stream)
 *    - Corrupted ZIP headers: truncated data, invalid magic numbers, truncated entries
 *    - Decompression bomb exceeding MAX_ALLOWED_SUBPACKAGE_SIZE (50MB)
 */
class GoatSubpackageLoaderEmpiricalChallengeTest {

    private lateinit var subpackageLoader: GoatSubpackageLoader
    private lateinit var tempDir: File

    @Before
    fun setUp() {
        tempDir = File(System.getProperty("java.io.tmpdir"), "goat_subpkg_chal_${System.currentTimeMillis()}_${(1000..9999).random()}")
        tempDir.mkdirs()
        subpackageLoader = GoatSubpackageLoader(customBaseDir = tempDir)
    }

    @After
    fun tearDown() {
        tempDir.deleteRecursively()
    }

    private fun createZipStream(entries: Map<String, ByteArray>): ByteArrayInputStream {
        val baos = ByteArrayOutputStream()
        ZipOutputStream(baos).use { zos ->
            for ((name, content) in entries) {
                val entry = ZipEntry(name)
                zos.putNextEntry(entry)
                zos.write(content)
                zos.closeEntry()
            }
        }
        return ByteArrayInputStream(baos.toByteArray())
    }

    private fun createTextZipStream(entries: Map<String, String>): ByteArrayInputStream {
        return createZipStream(entries.mapValues { it.value.toByteArray(Charsets.UTF_8) })
    }

    // =========================================================================
    // SCENARIO 1: ZIP SLIP PAYLOADS WITH COMPLEX RELATIVE PATHS
    // =========================================================================

    @Test
    fun `test zip slip classic etc passwd payload rejected safely`() = runTest {
        val zip = createTextZipStream(mapOf("../../../../etc/passwd" to "root:x:0:0:root:/root:/bin/bash"))
        val result = subpackageLoader.loadSubpackage("tenant_sec", "mod_slip1", zip)

        assertFalse("Zip Slip ../../../../etc/passwd must fail", result.isSuccess)
        assertNotNull(result.errorMessage)
        assertTrue(result.errorMessage?.contains("Zip Slip") == true || result.errorMessage?.contains("containment") == true)
        assertFalse(File(tempDir, "etc/passwd").exists())
    }

    @Test
    fun `test zip slip normalized mid-path traversal foo bar dotdot dotdot escaped js rejected`() = runTest {
        val zip = createTextZipStream(mapOf("foo/bar/../../../escaped.js" to "console.log('escaped');"))
        val result = subpackageLoader.loadSubpackage("tenant_sec", "mod_slip2", zip)

        assertFalse("Zip Slip foo/bar/../../../escaped.js must fail", result.isSuccess)
        assertNotNull(result.errorMessage)
        assertFalse(File(tempDir, "miniapps/tenant_sec/escaped.js").exists())
    }

    @Test
    fun `test zip slip deep traversal a b c dotdot dotdot dotdot dotdot evil js rejected`() = runTest {
        val zip = createTextZipStream(mapOf("a/b/c/../../../../evil.js" to "window.pwned = true;"))
        val result = subpackageLoader.loadSubpackage("tenant_sec", "mod_slip3", zip)

        assertFalse("Zip Slip a/b/c/../../../../evil.js must fail", result.isSuccess)
        assertNotNull(result.errorMessage)
        assertFalse(File(tempDir, "miniapps/tenant_sec/evil.js").exists())
    }

    @Test
    fun `test zip slip with backslashes on subpackage name rejected`() = runTest {
        val badNames = listOf(
            "..\\..\\evil.js",
            "sub\\..\\evil",
            "foo\\bar",
            "..\\evil"
        )
        for (badName in badNames) {
            val result = subpackageLoader.loadSubpackage("tenant_sec", badName)
            assertFalse("Subpackage name '$badName' with backslashes must be rejected", result.isSuccess)
        }
    }

    // =========================================================================
    // SCENARIO 2: NULL BYTE INJECTIONS IN SUBPACKAGE NAME AND ZIP ENTRIES
    // =========================================================================

    @Test
    fun `test null byte in subpackage name rejected with SecurityException`() = runTest {
        val nullByteNames = listOf(
            "pkg\u0000.zip",
            "sub\u0000pkg",
            "\u0000malicious",
            "module\u0000/../../escaped"
        )
        for (badName in nullByteNames) {
            val result = subpackageLoader.loadSubpackage("tenant_null", badName)
            assertFalse("Null byte subpackage name '$badName' must be rejected", result.isSuccess)
            assertNotNull(result.errorMessage)
            assertTrue(
                "Error should mention SecurityException or invalid name",
                result.errorMessage?.contains("Invalid subpackage name") == true ||
                result.errorMessage?.contains("traversal") == true
            )
        }
    }

    @Test
    fun `test null byte in zip entry name rejected safely`() = runTest {
        val zip = createTextZipStream(mapOf("entry\u0000name.js" to "alert(1);"))
        val result = subpackageLoader.loadSubpackage("tenant_null", "mod_null_entry", zip)

        assertFalse("Zip entry with null byte must be rejected", result.isSuccess)
        assertNotNull(result.errorMessage)
        assertTrue(result.errorMessage?.contains("Zip Slip") == true || result.errorMessage?.contains("entry\u0000name.js") == true)
    }

    // =========================================================================
    // SCENARIO 3: URL / HEX ENCODED TRAVERSALS
    // =========================================================================

    @Test
    fun `test url encoded traversals in subpackage name rejected`() = runTest {
        val encodedNames = listOf(
            "%2e%2e%2f",
            "%252e%252e%252f",
            "%2e%2e/",
            "..%2f",
            "%2e%2e%5c",
            "%2E%2E%2F",
            "%252E%252E%252F",
            "module%2fsub",
            "module%5csub",
            "..%252f..%252fetc"
        )

        for (encoded in encodedNames) {
            val result = subpackageLoader.loadSubpackage("tenant_enc", encoded)
            assertFalse("Encoded traversal '$encoded' must be rejected", result.isSuccess)
            assertNotNull(result.errorMessage)
        }
    }

    @Test
    fun `test url encoded traversal in zip entry name rejected`() = runTest {
        val zip1 = createTextZipStream(mapOf("%2e%2e%2fevil.js" to "console.log('pwn');"))
        val res1 = subpackageLoader.loadSubpackage("tenant_enc", "mod_enc1", zip1)
        assertFalse(res1.isSuccess)
        assertTrue(res1.errorMessage?.contains("Zip Slip") == true)

        val zip2 = createTextZipStream(mapOf("%2E%2E%2Fescaped.js" to "console.log('pwn');"))
        val res2 = subpackageLoader.loadSubpackage("tenant_enc", "mod_enc2", zip2)
        assertFalse(res2.isSuccess)
        assertTrue(res2.errorMessage?.contains("Zip Slip") == true)
    }

    // =========================================================================
    // SCENARIO 4: MULTI-TENANT BOUNDARY VIOLATION & ISOLATION
    // =========================================================================

    @Test
    fun `test strict multi-tenant filesystem partitioning and no bleed`() = runTest {
        val zipAlpha = createTextZipStream(mapOf("config.json" to "{\"tenant\":\"alpha\",\"secret\":\"ALPHA_KEY\"}"))
        val zipBeta = createTextZipStream(mapOf("config.json" to "{\"tenant\":\"beta\",\"secret\":\"BETA_KEY\"}"))

        val resAlpha = subpackageLoader.loadSubpackage("tenant_alpha", "core_module", zipAlpha)
        val resBeta = subpackageLoader.loadSubpackage("tenant_beta", "core_module", zipBeta)

        assertTrue(resAlpha.isSuccess)
        assertTrue(resBeta.isSuccess)

        val dirAlpha = File(resAlpha.extractedPath)
        val dirBeta = File(resBeta.extractedPath)

        assertTrue(dirAlpha.exists())
        assertTrue(dirBeta.exists())
        assertFalse("Paths must be distinct for different tenants", dirAlpha.canonicalPath == dirBeta.canonicalPath)

        val contentAlpha = File(dirAlpha, "config.json").readText()
        val contentBeta = File(dirBeta, "config.json").readText()
        assertTrue(contentAlpha.contains("ALPHA_KEY"))
        assertTrue(contentBeta.contains("BETA_KEY"))

        // Verify registry isolation
        val alphaSubs = subpackageLoader.getSubpackages("tenant_alpha")
        val betaSubs = subpackageLoader.getSubpackages("tenant_beta")
        assertEquals(listOf("core_module"), alphaSubs)
        assertEquals(listOf("core_module"), betaSubs)

        val metaAlpha = subpackageLoader.getSubpackageMetadata("tenant_alpha", "core_module")
        val metaBeta = subpackageLoader.getSubpackageMetadata("tenant_beta", "core_module")
        assertEquals("tenant_alpha", metaAlpha?.appId)
        assertEquals("tenant_beta", metaBeta?.appId)

        // Selective eviction of tenant_alpha must NOT affect tenant_beta
        subpackageLoader.clearSubpackageCache("tenant_alpha", "core_module")
        assertFalse(subpackageLoader.isSubpackageCached("tenant_alpha", "core_module"))
        assertTrue(subpackageLoader.isSubpackageCached("tenant_beta", "core_module"))
        assertFalse(dirAlpha.exists())
        assertTrue(dirBeta.exists())
        assertTrue(File(dirBeta, "config.json").exists())
    }

    @Test
    fun `test tenant cross-boundary breakout via appId path traversal rejected`() = runTest {
        val maliciousAppIds = listOf(
            "tenant_alpha/../tenant_beta",
            "../tenant_beta",
            "tenant/beta",
            "tenant\\beta",
            "tenant\u0000beta",
            "tenant%2fbeta"
        )
        for (badAppId in maliciousAppIds) {
            val result = subpackageLoader.loadSubpackage(badAppId, "module_x")
            assertFalse("Malicious appId '$badAppId' must be rejected", result.isSuccess)
            assertNotNull(result.errorMessage)
        }
    }

    // =========================================================================
    // SCENARIO 5: EMPTY / WHITESPACE INPUTS, CORRUPTED ARCHIVES & ANTI-DOS
    // =========================================================================

    @Test
    fun `test empty and whitespace only inputs fail gracefully`() = runTest {
        val emptySubpkg = subpackageLoader.loadSubpackage("tenant_a", "")
        assertFalse(emptySubpkg.isSuccess)
        assertNotNull(emptySubpkg.errorMessage)

        val wsSubpkg = subpackageLoader.loadSubpackage("tenant_a", "   \t\n  ")
        assertFalse(wsSubpkg.isSuccess)
        assertNotNull(wsSubpkg.errorMessage)

        val emptyAppId = subpackageLoader.loadSubpackage("", "valid_module")
        assertFalse(emptyAppId.isSuccess)
        assertNotNull(emptyAppId.errorMessage)

        val wsAppId = subpackageLoader.loadSubpackage("   \t  ", "valid_module")
        assertFalse(wsAppId.isSuccess)
        assertNotNull(wsAppId.errorMessage)
    }

    @Test
    fun `test missing subpackage without zip stream returns SUBPACKAGE_NOT_FOUND`() = runTest {
        val result = subpackageLoader.loadSubpackage("tenant_test", "non_existent_pkg", null)
        assertFalse(result.isSuccess)
        assertFalse(result.isCached)
        assertNotNull(result.errorMessage)
        assertTrue(result.errorMessage?.contains("SUBPACKAGE_NOT_FOUND") == true)
    }

    @Test
    fun `test corrupted zip archives fail gracefully`() = runTest {
        // 1. Truncated random garbage bytes
        val garbageBytes = ByteArrayInputStream(byteArrayOf(0x50, 0x4B, 0x03, 0x04, 0x12, 0x34))
        val resGarbage = subpackageLoader.loadSubpackage("tenant_corrupt", "garbage_pkg", garbageBytes)
        // With 0 extracted files, subpackage is not cached
        assertFalse(subpackageLoader.isSubpackageCached("tenant_corrupt", "garbage_pkg"))

        // 2. Invalid magic signature bytes
        val invalidMagic = ByteArrayInputStream("NOT_A_ZIP_STREAM_AT_ALL".toByteArray(Charsets.UTF_8))
        val resMagic = subpackageLoader.loadSubpackage("tenant_corrupt", "invalid_magic_pkg", invalidMagic)
        assertFalse(subpackageLoader.isSubpackageCached("tenant_corrupt", "invalid_magic_pkg"))

        // 3. Truncated ZIP entry stream (cut off in the middle of local header)
        val validZipBytes = ByteArrayOutputStream().apply {
            ZipOutputStream(this).use { zos ->
                zos.putNextEntry(ZipEntry("test.js"))
                zos.write("hello".toByteArray(Charsets.UTF_8))
                zos.closeEntry()
            }
        }.toByteArray()
        val truncatedBytes = ByteArrayInputStream(validZipBytes.copyOf(15))
        val resTruncated = subpackageLoader.loadSubpackage("tenant_corrupt", "truncated_pkg", truncatedBytes)
        assertFalse(subpackageLoader.isSubpackageCached("tenant_corrupt", "truncated_pkg"))
    }

    @Test
    fun `test decompression bomb exceeding size limit is rejected with SecurityException`() = runTest {
        // Mock large archive by creating entries exceeding MAX_ALLOWED_SUBPACKAGE_SIZE (50MB)
        // We write 51MB of zeroes into a compressed stream
        val largeBaos = ByteArrayOutputStream()
        ZipOutputStream(largeBaos).use { zos ->
            zos.putNextEntry(ZipEntry("huge_payload.bin"))
            val chunk = ByteArray(1024 * 1024) // 1MB chunk
            for (i in 0 until 51) {
                zos.write(chunk)
            }
            zos.closeEntry()
        }
        val bombStream = ByteArrayInputStream(largeBaos.toByteArray())
        val result = subpackageLoader.loadSubpackage("tenant_bomb", "bomb_pkg", bombStream)

        assertFalse("51MB subpackage archive must exceed size limit", result.isSuccess)
        assertNotNull(result.errorMessage)
        assertTrue(
            "Error must mention size limit: ${result.errorMessage}",
            result.errorMessage?.contains("limit") == true || result.errorMessage?.contains("size") == true
        )
    }
}
