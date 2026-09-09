package com.goat.webview

import com.goat.webview.view.GoatView
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class GoatManifestAllowlistWiringTest {

    private fun bundle(manifestJson: String?): File {
        val dir = File(System.getProperty("java.io.tmpdir"), "goat_manifest_${System.nanoTime()}")
        dir.mkdirs()
        if (manifestJson != null) File(dir, "manifest.json").writeText(manifestJson)
        return dir
    }

    @Test
    fun `security allowedDomains is read from the bundle manifest`() {
        val dir = bundle(
            """
            {"appId":"com.goat.x","version":"1.0.0",
             "security":{"allowedDomains":["https://cdn.example.com","https://api.example.com"]}}
            """.trimIndent()
        )
        assertEquals(
            setOf("https://cdn.example.com", "https://api.example.com"),
            GoatView.manifestAllowedDomains(dir)
        )
    }

    @Test
    fun `a manifest without a security block yields an empty set, leaving the blocker off`() {
        val dir = bundle("""{"appId":"com.goat.x","version":"1.0.0"}""")
        assertTrue(GoatView.manifestAllowedDomains(dir).isEmpty())
    }

    @Test
    fun `a malformed manifest does not throw and does not enable blocking`() {
        val dir = bundle("{ not json at all ")
        assertTrue(GoatView.manifestAllowedDomains(dir).isEmpty())
    }

    @Test
    fun `an absent manifest file yields an empty set`() {
        assertTrue(GoatView.manifestAllowedDomains(bundle(null)).isEmpty())
    }

    @Test
    fun `url mode has no bundle and therefore no manifest allowlist`() {
        assertTrue(GoatView.manifestAllowedDomains(null).isEmpty())
    }

    @Test
    fun `url mode pins the bridge to the entry url origin, not merely the main frame`() {
        assertEquals(
            setOf("https://merchant.example.com"),
            GoatView.urlModeSenderOrigins("https://merchant.example.com/shop?ref=1")
        )
        assertEquals(
            setOf("https://merchant.example.com:8443"),
            GoatView.urlModeSenderOrigins("https://merchant.example.com:8443/shop")
        )
    }

    @Test
    fun `an unusable entry url falls back to main-frame-only rather than to allow-all`() {
        for (bad in listOf(null, "", "about:blank", "not a url")) {
            assertTrue(
                "expected empty (main-frame-only) for $bad",
                GoatView.urlModeSenderOrigins(bad).isEmpty()
            )
        }
    }

    @Test
    fun `packaged mode still uses the exact transport origins`() {
        val packaged = setOf("https://t1.appassets.androidplatform.net", "https://appassets.androidplatform.net")
        assertEquals(packaged, GoatView.bridgeSenderOrigins(packaged))
    }
    @Test
    fun `a declared entrypoint is used instead of the hardcoded index html`() {
        val dir = bundle("""{"appId":"com.goat.x","version":"1.0.0","entrypoint":"app/main.html"}""")
        assertEquals("app/main.html", GoatView.manifestEntrypoint(dir))
    }

    @Test
    fun `a bundle declaring no entrypoint still gets index html`() {
        val dir = bundle("""{"appId":"com.goat.x","version":"1.0.0"}""")
        assertEquals("index.html", GoatView.manifestEntrypoint(dir))
    }

    @Test
    fun `an absent or malformed manifest falls back to index html rather than failing the load`() {
        assertEquals("index.html", GoatView.manifestEntrypoint(bundle(null)))
        assertEquals("index.html", GoatView.manifestEntrypoint(bundle("{ not json ")))
        assertEquals("index.html", GoatView.manifestEntrypoint(null))
    }

    @Test
    fun `an entrypoint escaping the bundle root is refused and falls back`() {
        val dir = bundle("""{"appId":"com.goat.x","version":"1.0.0","entrypoint":"../../etc/passwd"}""")
        assertEquals("index.html", GoatView.manifestEntrypoint(dir))
    }

}
