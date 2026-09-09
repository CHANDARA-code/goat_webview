package com.goat.webview

import com.goat.webview.view.GoatView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GoatBridgeSenderOriginTest {

    private fun listener(
        origins: Set<String>,
        allowSubframes: Boolean = false
    ): GoatWebMessageListener =
        GoatWebMessageListener(CoroutineScope(Dispatchers.Unconfined), origins, allowSubframes) { _, _ ->
            Result.success(JsonObject(emptyMap()))
        }

    private val packaged = setOf(
        "https://tenant1.appassets.androidplatform.net",
        "https://appassets.androidplatform.net"
    )

    @Test
    fun `a packaged tenant main frame is permitted`() {
        val l = listener(packaged)
        assertTrue(l.isSenderPermitted("https://tenant1.appassets.androidplatform.net", true))
    }

    @Test
    fun `a foreign origin is rejected even in the main frame`() {
        val l = listener(packaged)
        assertFalse(l.isSenderPermitted("https://evil.example.com", true))
    }

    @Test
    fun `a cross-origin subframe is rejected`() {
        val l = listener(packaged)
        assertFalse(l.isSenderPermitted("https://evil.example.com", false))
    }

    @Test
    fun `even an allowed origin is rejected from a subframe by default`() {
        val l = listener(packaged)
        assertFalse(l.isSenderPermitted("https://tenant1.appassets.androidplatform.net", false))
    }

    @Test
    fun `subframes from an allowed origin pass only when explicitly opted in`() {
        val l = listener(packaged, allowSubframes = true)
        assertTrue(l.isSenderPermitted("https://tenant1.appassets.androidplatform.net", false))
        assertFalse(l.isSenderPermitted("https://evil.example.com", false))
    }

    @Test
    fun `an empty policy falls back to main-frame-only rather than allow-all`() {
        val l = listener(emptySet())
        assertTrue(l.isSenderPermitted("https://anything.example.com", true))
        assertFalse(l.isSenderPermitted("https://anything.example.com", false))
    }

    @Test
    fun `url mode does not hand the wildcard on to the listener`() {
        assertEquals(emptySet<String>(), GoatView.bridgeSenderOrigins(setOf("*")))
        assertEquals(packaged, GoatView.bridgeSenderOrigins(packaged))
    }

    @Test
    fun `origin comparison ignores scheme and host case and keeps the port`() {
        val l = listener(setOf("HTTPS://Tenant1.AppAssets.AndroidPlatform.NET"))
        assertTrue(l.isSenderPermitted("https://tenant1.appassets.androidplatform.net", true))
        assertFalse(l.isSenderPermitted("https://tenant1.appassets.androidplatform.net:8443", true))
    }

    @Test
    fun `a null source origin is rejected when a policy is set`() {
        val l = listener(packaged)
        assertFalse(l.isSenderPermitted(null, true))
    }

    @Test
    fun `a path or query on the origin does not widen the match`() {
        val l = listener(packaged)
        assertTrue(l.isSenderPermitted("https://tenant1.appassets.androidplatform.net/a/b?c=d", true))
        assertFalse(l.isSenderPermitted("https://evil.com/https://tenant1.appassets.androidplatform.net", true))
    }
}
