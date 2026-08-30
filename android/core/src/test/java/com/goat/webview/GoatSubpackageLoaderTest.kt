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
 * Unit test suite for GoatSubpackageLoader (Task 10092 & 10190).
 */
class GoatSubpackageLoaderTest {

    private lateinit var subpackageLoader: GoatSubpackageLoader
    private lateinit var tempDir: File

    @Before
    fun setUp() {
        tempDir = File(System.getProperty("java.io.tmpdir"), "goat_subpkg_test_${System.currentTimeMillis()}_${(1000..9999).random()}")
        tempDir.mkdirs()
        subpackageLoader = GoatSubpackageLoader(customBaseDir = tempDir)
    }

    @After
    fun tearDown() {
        tempDir.deleteRecursively()
    }

    private fun createZipStream(entries: Map<String, String>): ByteArrayInputStream {
        val baos = ByteArrayOutputStream()
        ZipOutputStream(baos).use { zos ->
            for ((name, content) in entries) {
                val entry = ZipEntry(name)
                zos.putNextEntry(entry)
                zos.write(content.toByteArray(Charsets.UTF_8))
                zos.closeEntry()
            }
        }
        return ByteArrayInputStream(baos.toByteArray())
    }

    @Test
    fun `test loadSubpackage fails when subpackage does not exist and no zip stream provided`() = runTest {
        val result = subpackageLoader.loadSubpackage("app_ecommerce", "missing_module")
        assertFalse("Must not return success for non-existent subpackage without stream", result.isSuccess)
        assertFalse(result.isCached)
        assertNotNull(result.errorMessage)
        assertTrue(result.errorMessage?.contains("SUBPACKAGE_NOT_FOUND") == true)
        assertFalse(subpackageLoader.isSubpackageCached("app_ecommerce", "missing_module"))
    }

    @Test
    fun `test loadSubpackage with valid zip stream extracts files and metadata`() = runTest {
        val zipStream = createZipStream(
            mapOf(
                "index.js" to "console.log('checkout loaded');",
                "styles.css" to "body { background: #fafafa; }"
            )
        )

        val result = subpackageLoader.loadSubpackage("app_ecommerce", "checkout", zipStream)
        assertTrue(result.isSuccess)
        assertEquals("checkout", result.subpackageName)
        assertEquals("app_ecommerce", result.appId)
        assertFalse(result.isCached) // First load extracts from stream
        assertTrue(result.byteSize > 0)

        val targetDir = File(result.extractedPath)
        assertTrue(targetDir.exists())
        assertTrue(File(targetDir, "index.js").exists())
        assertTrue(File(targetDir, "styles.css").exists())

        assertTrue(subpackageLoader.isSubpackageCached("app_ecommerce", "checkout"))

        val meta = subpackageLoader.getSubpackageMetadata("app_ecommerce", "checkout")
        assertNotNull(meta)
        assertEquals("checkout", meta?.subpackageName)
        assertEquals(2, meta?.fileCount)
        assertTrue((meta?.byteSize ?: 0L) > 0)

        // Subsequent load of existing module succeeds with isCached = true
        val secondResult = subpackageLoader.loadSubpackage("app_ecommerce", "checkout")
        assertTrue(secondResult.isSuccess)
        assertTrue(secondResult.isCached)
        assertEquals(result.byteSize, secondResult.byteSize)
    }

    @Test
    fun `test strict path traversal and zip slip prevention on subpackage names`() = runTest {
        val badNames = listOf(
            "   ",
            "../escape",
            "foo/../../bar",
            "/absolute_path",
            "sub\\backslash",
            "%2e%2e/encoded",
            "null\u0000byte",
            "pipe|char",
            "colon:test"
        )

        for (badName in badNames) {
            val result = subpackageLoader.loadSubpackage("app_security", badName)
            assertFalse("Expected '$badName' to be rejected", result.isSuccess)
            assertNotNull(result.errorMessage)
            assertFalse(subpackageLoader.isSubpackageCached("app_security", badName))
        }
    }

    @Test
    fun `test loadSubpackage with Zip Slip exploit stream is rejected safely`() = runTest {
        val maliciousZipStream = createZipStream(
            mapOf(
                "../../evil.js" to "alert('hacked');"
            )
        )

        val result = subpackageLoader.loadSubpackage("app_target", "exploitsub", maliciousZipStream)
        assertFalse(result.isSuccess)
        assertTrue(result.errorMessage?.contains("Zip Slip") == true || result.errorMessage?.contains("Path containment") == true)
    }

    @Test
    fun `test clearSubpackageCache evicts entries from memory and deletes from disk`() = runTest {
        val zip1 = createZipStream(mapOf("level1.json" to "{ \"level\": 1 }"))
        val zip2 = createZipStream(mapOf("level2.json" to "{ \"level\": 2 }"))

        val res1 = subpackageLoader.loadSubpackage("app_game", "level1", zip1)
        val res2 = subpackageLoader.loadSubpackage("app_game", "level2", zip2)

        assertTrue(res1.isSuccess)
        assertTrue(res2.isSuccess)

        val dir1 = File(res1.extractedPath)
        val dir2 = File(res2.extractedPath)
        assertTrue(dir1.exists())
        assertTrue(dir2.exists())
        assertEquals(2, subpackageLoader.getSubpackages("app_game").size)

        // Clear level1
        subpackageLoader.clearSubpackageCache("app_game", "level1")
        assertFalse(subpackageLoader.isSubpackageCached("app_game", "level1"))
        assertTrue(subpackageLoader.isSubpackageCached("app_game", "level2"))
        assertFalse(dir1.exists())
        assertTrue(dir2.exists())
        assertNull(subpackageLoader.getSubpackageMetadata("app_game", "level1"))

        // Clear all for app_game
        subpackageLoader.clearSubpackageCache("app_game")
        assertEquals(0, subpackageLoader.getSubpackages("app_game").size)
        assertFalse(dir2.exists())
    }

    @Test
    fun `test multi-tenant subpackage isolation`() = runTest {
        val zipA = createZipStream(mapOf("settings.json" to "{\"theme\":\"dark\"}"))
        val zipB = createZipStream(mapOf("settings.json" to "{\"theme\":\"light\"}"))

        val resA = subpackageLoader.loadSubpackage("tenant_a", "settings", zipA)
        val resB = subpackageLoader.loadSubpackage("tenant_b", "settings", zipB)

        assertTrue(resA.isSuccess)
        assertTrue(resB.isSuccess)
        assertFalse(resA.extractedPath == resB.extractedPath)
        assertTrue(resA.extractedPath.contains("tenant_a"))
        assertTrue(resB.extractedPath.contains("tenant_b"))
    }

    @Test
    fun `test subpackage with nested directories extracts all files correctly`() = runTest {
        val nestedZip = createZipStream(
            mapOf(
                "index.js" to "console.log('main');",
                "assets/textures/bg.png" to "PNG_IMAGE_BINARY_DATA",
                "components/Button.js" to "export const Button = {};"
            )
        )

        val result = subpackageLoader.loadSubpackage("app_nested", "dashboard", nestedZip)
        assertTrue(result.isSuccess)
        assertEquals(3, subpackageLoader.getSubpackageMetadata("app_nested", "dashboard")?.fileCount)

        val targetDir = File(result.extractedPath)
        assertTrue(File(targetDir, "index.js").exists())
        assertTrue(File(targetDir, "assets/textures/bg.png").exists())
        assertTrue(File(targetDir, "components/Button.js").exists())
    }

    @Test
    fun `test subpackage load with blank or whitespace-only inputs fails`() = runTest {
        val resBlankSubpkg = subpackageLoader.loadSubpackage("app_valid", "   ")
        assertFalse(resBlankSubpkg.isSuccess)
        assertNotNull(resBlankSubpkg.errorMessage)

        val resBlankAppId = subpackageLoader.loadSubpackage("   ", "sub_valid")
        assertFalse(resBlankAppId.isSuccess)
        assertNotNull(resBlankAppId.errorMessage)
    }
}
