package com.goat.webview

import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceRequest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

/**
 * Automated test suite for GoatWebViewClient:
 * - Dynamic domain scoping per mini-app tenant (Same-Origin Policy isolation)
 * - Chromium renderer crash recovery & process isolation (onRenderProcessGone) (Task 10078)
 * - Navigation intent routing (tel:, mailto:, sms:, geo:) & external URL blocking (shouldOverrideUrlLoading)
 * - Page navigation lifecycle hooks (onPageStarted, onPageFinished)
 */
class GoatWebViewClientTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    private lateinit var extractedDir: File
    private lateinit var fakeContext: FakeTestContext

    private class FakeTestContext : ContextWrapper(null) {
        val startedIntents = mutableListOf<Intent>()

        override fun getApplicationContext(): Context = this

        override fun startActivity(intent: Intent?) {
            if (intent != null) {
                startedIntents.add(intent)
            }
        }
    }

    @Before
    fun setUp() {
        fakeContext = FakeTestContext()
        extractedDir = tempFolder.newFolder("extracted_bundle")
    }

    @Test
    fun `test virtual domain constants`() {
        assertEquals("appassets.androidplatform.net", GoatWebViewClient.DEFAULT_DOMAIN)
        assertEquals("appassets.androidplatform.net", GoatWebViewClient.VIRTUAL_DOMAIN)
        assertEquals("/assets/", GoatWebViewClient.ASSETS_PATH)
    }

    @Test
    @Suppress("DEPRECATION")
    fun `test onRenderProcessGone returns true on renderer crash and notifies listener`() {
        var crashDetected = false
        var crashedState = false

        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = extractedDir,
            onRenderCrashed = { didCrash ->
                crashDetected = true
                crashedState = didCrash
            }
        )

        val crashDetail = object : RenderProcessGoneDetail() {
            override fun didCrash(): Boolean = true
            override fun rendererPriorityAtExit(): Int = 2
        }

        val result = client.onRenderProcessGone(null, crashDetail)

        // Must ALWAYS return true to isolate crash and protect host application
        assertTrue("onRenderProcessGone must return true to prevent host crash", result)
        assertTrue("Crash callback must be invoked", crashDetected)
        assertTrue("didCrash must be true", crashedState)
    }

    @Test
    @Suppress("DEPRECATION")
    fun `test onRenderProcessGone returns true on OS low-memory kill and notifies listener`() {
        var crashDetected = false
        var crashedState = true

        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = extractedDir,
            onRenderCrashed = { didCrash ->
                crashDetected = true
                crashedState = didCrash
            }
        )

        val memoryKillDetail = object : RenderProcessGoneDetail() {
            override fun didCrash(): Boolean = false
            override fun rendererPriorityAtExit(): Int = 0
        }

        val result = client.onRenderProcessGone(null, memoryKillDetail)

        assertTrue("onRenderProcessGone must return true for memory kills", result)
        assertTrue("Crash callback must be invoked", crashDetected)
        assertFalse("didCrash must be false for OS memory kills", crashedState)
    }

    @Test
    fun `test onRenderProcessGone handles null view and null detail safely`() {
        var crashDetected = false
        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = extractedDir,
            onRenderCrashed = {
                crashDetected = true
            }
        )

        val result = client.onRenderProcessGone(null, null)
        assertTrue("Must return true even with null parameters", result)
        assertTrue("Callback should still be called safely", crashDetected)
    }

    @Test
    fun `test resolveDomain dynamically scopes per appId`() {
        assertEquals("appassets.androidplatform.net", GoatWebViewClient.resolveDomain("default"))
        assertEquals("appassets.androidplatform.net", GoatWebViewClient.resolveDomain(""))
        assertEquals("appassets.androidplatform.net", GoatWebViewClient.resolveDomain("   "))
        assertEquals("tenant_alpha.appassets.androidplatform.net", GoatWebViewClient.resolveDomain("tenant_alpha"))
        assertEquals("tenant_beta.appassets.androidplatform.net", GoatWebViewClient.resolveDomain("tenant_beta"))
        assertEquals("app_123___.appassets.androidplatform.net", GoatWebViewClient.resolveDomain("app_123!@#"))
        assertEquals("my_app_v2.appassets.androidplatform.net", GoatWebViewClient.resolveDomain("my_app_v2"))

        val tenantClient = GoatWebViewClient(
            context = fakeContext,
            extractedDir = extractedDir,
            appId = "tenant_alpha"
        )
        assertEquals("tenant_alpha.appassets.androidplatform.net", tenantClient.domain)
        assertEquals("https://tenant_alpha.appassets.androidplatform.net", tenantClient.origin)
        assertEquals("https://tenant_alpha.appassets.androidplatform.net/assets/index.html", tenantClient.entryUrl)
    }

    @Test
    fun `test shouldOverrideUrlLoading allows internal navigation to tenant domain and default domain`() {
        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = extractedDir,
            appId = "tenant_alpha"
        )

        assertFalse("Internal tenant navigation must be permitted (return false)", client.shouldOverrideUrl("tenant_alpha.appassets.androidplatform.net", "https"))
        assertFalse("Default domain navigation must be permitted (return false)", client.shouldOverrideUrl("appassets.androidplatform.net", "https"))
    }

    @Test
    fun `test shouldOverrideUrlLoading handles safe intent schemes and launches intents`() {
        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = extractedDir,
            appId = "tenant_alpha"
        )

        // Safe intents (tel:, mailto:, sms:, geo:) return true (handled externally via Android Intent)
        assertTrue("tel: intent must be intercepted and handled", client.shouldOverrideUrl(null, "tel"))
        assertEquals(1, fakeContext.startedIntents.size)

        assertTrue("mailto: intent must be intercepted and handled", client.shouldOverrideUrl(null, "mailto"))
        assertEquals(2, fakeContext.startedIntents.size)

        assertTrue("sms: intent must be intercepted and handled", client.shouldOverrideUrl(null, "sms"))
        assertEquals(3, fakeContext.startedIntents.size)

        assertTrue("geo: intent must be intercepted and handled", client.shouldOverrideUrl(null, "geo"))
        assertEquals(4, fakeContext.startedIntents.size)
    }

    @Test
    fun `test shouldOverrideUrlLoading blocks unauthorized external websites and cleartext links`() {
        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = extractedDir,
            appId = "tenant_alpha"
        )

        val initialIntentCount = fakeContext.startedIntents.size

        // External untrusted websites must be blocked (return true without launching intent)
        assertTrue("External untrusted navigation must be blocked", client.shouldOverrideUrl("evil.com", "https"))
        assertTrue("Cleartext external navigation must be blocked", client.shouldOverrideUrl("untrusted.org", "http"))
        assertTrue("Subdomain suffix attack navigation must be blocked", client.shouldOverrideUrl("tenant_alpha.appassets.androidplatform.net.evil.com", "https"))

        // No new intents should have been launched for blocked URLs
        assertEquals(initialIntentCount, fakeContext.startedIntents.size)
    }

    @Test
    fun `test shouldOverrideUrlLoading handles null parameters safely`() {
        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = extractedDir,
            appId = "tenant_alpha"
        )

        assertFalse(client.shouldOverrideUrlLoading(null, null as WebResourceRequest?))
    }

    @Test
    fun `test onPageStarted and onPageFinished invoke lifecycle hooks`() {
        var pageStartedCalled = false
        var pageLoadedCalled = false

        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = extractedDir,
            onPageStarted = { pageStartedCalled = true },
            onPageLoaded = { pageLoadedCalled = true }
        )

        assertFalse(pageStartedCalled)
        assertFalse(pageLoadedCalled)

        client.onPageStarted(null, "https://appassets.androidplatform.net/assets/index.html", null)
        assertTrue("onPageStarted hook should be invoked", pageStartedCalled)

        client.onPageFinished(null, "https://appassets.androidplatform.net/assets/index.html")
        assertTrue("onPageLoaded hook should be invoked", pageLoadedCalled)
    }
}
