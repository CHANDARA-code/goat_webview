package com.goat.webview

import android.net.Uri
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * The test shim at src/test/java/android/net/Uri.java replaces the SDK stub at test runtime.
 * Production code compiles against the real SDK, so any member the shim omits becomes a
 * NoSuchMethodError at test time -- and the call sites wrap Uri access in catch(Throwable), which
 * swallows it. A missing member therefore does not fail loudly; it silently disables the code path
 * under test. These pin the members production actually uses.
 */
class GoatUriShimFidelityTest {

    private val full = Uri.parse("https://user@tenant1.example.com:8443/a/b?token=abc&x=1#goat_hash=xyz")

    @Test
    fun `scheme and host match real Uri`() {
        assertEquals("https", full.scheme)
        assertEquals("tenant1.example.com", full.host)
    }

    @Test
    fun `authority includes userinfo and port, not just the host`() {
        assertEquals("user@tenant1.example.com:8443", full.authority)
    }

    @Test
    fun `port is parsed, and is -1 when absent`() {
        assertEquals(8443, full.port)
        assertEquals(-1, Uri.parse("https://example.com/a").port)
    }

    @Test
    fun `fragment is the part after the hash, and null when absent`() {
        assertEquals("goat_hash=xyz", full.fragment)
        assertNull(Uri.parse("https://example.com/a").fragment)
    }

    @Test
    fun `query parameters resolve by name`() {
        assertEquals("abc", full.getQueryParameter("token"))
        assertEquals("1", full.getQueryParameter("x"))
        assertNull(full.getQueryParameter("absent"))
    }

    @Test
    fun `percent-encoded values are decoded`() {
        val u = Uri.parse("https://example.com/a?redirect=https%3A%2F%2Fevil.com%2Fx#a%20b")
        assertEquals("https://evil.com/x", u.getQueryParameter("redirect"))
        assertEquals("a b", u.fragment)
    }

    @Test
    fun `a scheme-relative or malformed string does not throw`() {
        for (raw in listOf("", "not a uri", "//host/path", "mailto:a@b.com")) {
            Uri.parse(raw).let { it.scheme; it.host; it.authority; it.port; it.fragment; it.getQueryParameter("k") }
        }
    }
    @Test
    fun `a host containing an underscore is returned, not dropped`() {
        // java.net.URI.getHost() returns null for these; android.net.Uri does not. Tenant domains
        // here are {appId}.appassets.androidplatform.net and appIds routinely contain underscores,
        // so delegating to java.net.URI made every such tenant look like an external origin.
        val u = Uri.parse("https://tenant_alpha.appassets.androidplatform.net/assets/page2.html")
        assertEquals("tenant_alpha.appassets.androidplatform.net", u.host)
        assertEquals("/assets/page2.html", u.path)
    }

    @Test
    fun `path and query are split correctly around the fragment`() {
        val u = Uri.parse("https://tenant_1.example.com/a/b?x=1#frag")
        assertEquals("/a/b", u.path)
        assertEquals("x=1", u.getQueryParameter("x")?.let { "x=$it" })
        assertEquals("frag", u.fragment)
    }

}
