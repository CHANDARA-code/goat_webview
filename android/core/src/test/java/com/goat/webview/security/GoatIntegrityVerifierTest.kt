package com.goat.webview.security

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.File

class GoatIntegrityVerifierTest {

    @Test
    fun testGenerateCspNonceProducesValidBase64AndUniqueValues() {
        val nonces = mutableSetOf<String>()
        repeat(100) {
            val nonce = GoatIntegrityVerifier.generateCspNonce(16)
            assertTrue(nonce.isNotBlank())
            assertTrue(nonce.length >= 20)
            assertTrue(nonce.matches(Regex("^[A-Za-z0-9+/=_-]+$")))
            assertFalse(nonces.contains(nonce))
            nonces.add(nonce)
        }
        assertEquals(100, nonces.size)
    }

    @Test
    fun testInjectDynamicCspNonceInjectsDefaultMetaWhenNoneExists() {
        val nonce = "abc123xyz789"
        val html = "<html><head><title>App</title></head><body><script src=\"app.js\"></script></body></html>"
        val injected = GoatIntegrityVerifier.injectDynamicCspNonce(html, nonce)

        assertTrue(injected.contains("<meta http-equiv=\"Content-Security-Policy\""))
        assertTrue(injected.contains("'nonce-$nonce'"))
        assertTrue(injected.contains("'strict-dynamic'"))
        assertTrue(injected.contains("<script nonce=\"$nonce\" src=\"app.js\"></script>"))
    }

    @Test
    fun testInjectDynamicCspNonceUpdatesExistingCspMetaTag() {
        val nonce = "testNonce12345"
        val html = """
            <!DOCTYPE html>
            <html>
            <head>
                <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self';">
                <title>Test</title>
            </head>
            <body>
                <script type="module" src="/assets/index.js"></script>
            </body>
            </html>
        """.trimIndent()

        val injected = GoatIntegrityVerifier.injectDynamicCspNonce(html, nonce)
        assertTrue(injected.contains("script-src 'nonce-$nonce' 'strict-dynamic'"))
        assertTrue(injected.contains("<script nonce=\"$nonce\" type=\"module\" src=\"/assets/index.js\"></script>"))
    }

    @Test
    fun testInjectDynamicCspNonceReplacesExistingScriptNonce() {
        val oldNonce = "oldNonceValue"
        val newNonce = "newFreshNonceValue"
        val html = """
            <html>
            <head></head>
            <body>
                <script nonce="$oldNonce" src="bundle.js"></script>
                <script>console.log('inline');</script>
            </body>
            </html>
        """.trimIndent()

        val injected = GoatIntegrityVerifier.injectDynamicCspNonce(html, newNonce)
        assertFalse(injected.contains(oldNonce))
        assertTrue(injected.contains("<script nonce=\"$newNonce\" src=\"bundle.js\"></script>"))
        assertTrue(injected.contains("<script nonce=\"$newNonce\">console.log('inline');</script>"))
    }

    @Test
    fun testInjectDynamicCspNonceWhenNoHeadTag() {
        val nonce = "headlessNonce"
        val html = "<div id=\"root\"></div><script src=\"vendor.js\"></script>"
        val injected = GoatIntegrityVerifier.injectDynamicCspNonce(html, nonce)

        assertTrue(injected.startsWith("<meta http-equiv=\"Content-Security-Policy\""))
        assertTrue(injected.contains("<script nonce=\"$nonce\" src=\"vendor.js\"></script>"))
    }

    @Test
    fun testComputeSriHashProducesStandardPrefixedOutputs() {
        val payload = "console.log('Hello, world!');\n".toByteArray(Charsets.UTF_8)

        val sha256 = GoatIntegrityVerifier.computeSriHash(payload, "SHA-256")
        assertTrue(sha256.startsWith("sha256-"))

        val sha384 = GoatIntegrityVerifier.computeSriHash(payload, "SHA-384")
        assertTrue(sha384.startsWith("sha384-"))

        val sha512 = GoatIntegrityVerifier.computeSriHash(payload, "SHA-512")
        assertTrue(sha512.startsWith("sha512-"))

        assertNotEquals(sha256, sha384)
        assertNotEquals(sha384, sha512)
    }

    @Test
    fun testVerifySriHashPassesOnExactMatchAndFailsOnTampering() {
        val payload = "const secret = 42; export default secret;".toByteArray(Charsets.UTF_8)
        val expectedSri = GoatIntegrityVerifier.computeSriHash(payload, "SHA-384")

        assertTrue(GoatIntegrityVerifier.verifySriHash(payload, expectedSri))

        val tampered = "const secret = 43; export default secret;".toByteArray(Charsets.UTF_8)
        assertFalse(GoatIntegrityVerifier.verifySriHash(tampered, expectedSri))
    }

    @Test
    fun testVerifySriHashHandlesSha256AndSha512() {
        val payload = "{\"version\": \"1.0.0\"}".toByteArray(Charsets.UTF_8)
        val sri256 = GoatIntegrityVerifier.computeSriHash(payload, "SHA-256")
        val sri512 = GoatIntegrityVerifier.computeSriHash(payload, "SHA-512")

        assertTrue(GoatIntegrityVerifier.verifySriHash(payload, sri256))
        assertTrue(GoatIntegrityVerifier.verifySriHash(payload, sri512))

        assertFalse(GoatIntegrityVerifier.verifySriHash("wrong".toByteArray(Charsets.UTF_8), sri256))
    }

    @Test
    fun testVerifySriHashRejectsMalformedOrInvalidHashes() {
        val payload = "test data".toByteArray(Charsets.UTF_8)
        assertFalse(GoatIntegrityVerifier.verifySriHash(payload, ""))
        assertFalse(GoatIntegrityVerifier.verifySriHash(payload, "notahash"))
        assertFalse(GoatIntegrityVerifier.verifySriHash(payload, "md5-12345"))
        assertFalse(GoatIntegrityVerifier.verifySriHash(payload, "sha384-invalidBase64!!@@"))
    }

    @Test
    fun testVerifySriHashWithFileAndStream() {
        val tempFile = File.createTempFile("goat-sri-test", ".js")
        try {
            val content = "function add(a, b) { return a + b; }\n"
            tempFile.writeText(content, Charsets.UTF_8)

            val sri = GoatIntegrityVerifier.computeSriHash(tempFile, "SHA-384")
            assertTrue(sri.startsWith("sha384-"))
            assertTrue(GoatIntegrityVerifier.verifySriHash(tempFile, sri))

            val stream = ByteArrayInputStream(content.toByteArray(Charsets.UTF_8))
            assertTrue(GoatIntegrityVerifier.verifySriHash(stream, sri))

            tempFile.writeText("function add(a, b) { return a - b; }\n", Charsets.UTF_8)
            assertFalse(GoatIntegrityVerifier.verifySriHash(tempFile, sri))
        } finally {
            tempFile.delete()
        }
    }

    @Test
    fun testVerifySriManifest() {
        val bundleBytes = "console.log('bundle');".toByteArray(Charsets.UTF_8)
        val styleBytes = "body { margin: 0; }".toByteArray(Charsets.UTF_8)

        val bundleSri = GoatIntegrityVerifier.computeSriHash(bundleBytes, "SHA-384")
        val styleSri = GoatIntegrityVerifier.computeSriHash(styleBytes, "SHA-384")

        val manifest = mapOf(
            "bundle.js" to bundleSri,
            "style.css" to styleSri,
            "missing.js" to "sha384-missingHash123="
        )

        val results = GoatIntegrityVerifier.verifySriManifest(manifest) { path ->
            when (path) {
                "bundle.js" -> bundleBytes
                "style.css" -> styleBytes
                else -> null
            }
        }

        assertEquals(true, results["bundle.js"])
        assertEquals(true, results["style.css"])
        assertEquals(false, results["missing.js"])
    }
}
