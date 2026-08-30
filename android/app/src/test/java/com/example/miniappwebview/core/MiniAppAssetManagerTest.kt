package com.example.miniappwebview.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class MiniAppAssetManagerTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    private lateinit var destDir: File

    @Before
    fun setUp() {
        destDir = tempFolder.newFolder("extracted_bundle")
    }

    @Test
    fun `test valid zip archive extracts properly`() {
        val zipBytes = createZipArchive(
            "index.html" to "<!DOCTYPE html><html><body><h1>MiniApp</h1></body></html>",
            "static/app.js" to "console.log('loaded');",
            "static/style.css" to "body { background: #000; }"
        )

        MiniAppAssetManager.extractZipStream(ByteArrayInputStream(zipBytes), destDir)

        val indexFile = File(destDir, "index.html")
        val jsFile = File(destDir, "static/app.js")
        val cssFile = File(destDir, "static/style.css")

        assertTrue("index.html should exist", indexFile.exists())
        assertTrue("static/app.js should exist", jsFile.exists())
        assertTrue("static/style.css should exist", cssFile.exists())

        assertEquals("<!DOCTYPE html><html><body><h1>MiniApp</h1></body></html>", indexFile.readText())
        assertEquals("console.log('loaded');", jsFile.readText())
    }

    @Test
    fun `test zip slip vulnerability attempt throws SecurityException`() {
        // Craft a malicious entry attempting directory traversal
        val maliciousZipBytes = createZipArchive(
            "valid.txt" to "safe content",
            "../../malicious_file.txt" to "malicious exploit payload"
        )

        try {
            MiniAppAssetManager.extractZipStream(ByteArrayInputStream(maliciousZipBytes), destDir)
            fail("Expected SecurityException due to Zip Slip vulnerability guard")
        } catch (e: SecurityException) {
            assertTrue("Exception message should indicate Zip Slip", e.message?.contains("Zip Slip") == true)
        }

        // Verify that malicious file was not written outside target
        val parentDir = destDir.parentFile
        val maliciousFile = File(parentDir?.parentFile, "malicious_file.txt")
        assertFalse("Malicious file should not have been written", maliciousFile.exists())
    }

    @Test
    fun `test stream hash computation`() {
        val content = "Hello MiniApp WebView!"
        val stream = ByteArrayInputStream(content.toByteArray())
        val hash = MiniAppAssetManager.computeStreamHash(stream)
        assertTrue("Hash should be non-empty 64 hex characters", hash.length == 64)
    }

    private fun createZipArchive(vararg entries: Pair<String, String>): ByteArray {
        val byteOut = ByteArrayOutputStream()
        ZipOutputStream(byteOut).use { zipOut ->
            for ((name, content) in entries) {
                val entry = ZipEntry(name)
                zipOut.putNextEntry(entry)
                zipOut.write(content.toByteArray())
                zipOut.closeEntry()
            }
        }
        return byteOut.toByteArray()
    }
}
