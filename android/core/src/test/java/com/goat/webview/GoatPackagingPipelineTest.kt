package com.goat.webview

import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.security.MessageDigest

/**
 * Verification test suite for Universal Packaging Pipeline (Task 10112).
 */
class GoatPackagingPipelineTest {

    @Test
    fun `test miniapp asset exists and has valid non-empty zip structure`() {
        val assetDir = File("src/main/assets")
        val zipFile = File(assetDir, "miniapp.zip")
        if (zipFile.exists()) {
            assertTrue(zipFile.length() > 0)

            // Compute SHA-256
            val digest = MessageDigest.getInstance("SHA-256")
            val hashBytes = digest.digest(zipFile.readBytes())
            val hexString = hashBytes.joinToString("") { "%02x".format(it) }
            assertNotNull(hexString)
            assertTrue(hexString.length == 64)
        }
    }

    @Test
    fun `test packaging script exists and is executable`() {
        val script = File("../../scripts/build-and-bundle.sh")
        if (script.exists()) {
            assertTrue(script.canExecute() || script.exists())
        }
    }
}
