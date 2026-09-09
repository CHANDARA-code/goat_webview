package com.goat.webview

import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.net.Uri
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
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

    /** WebResourceRequest is a plain interface -- trivially fakeable, no Robolectric needed. */
    private class FakeWebResourceRequest(
        private val requestUrl: Uri,
        private val mainFrame: Boolean = true
    ) : WebResourceRequest {
        override fun getUrl(): Uri = requestUrl
        override fun isForMainFrame(): Boolean = mainFrame
        override fun isRedirect(): Boolean = false
        override fun hasGesture(): Boolean = false
        override fun getMethod(): String = "GET"
        override fun getRequestHeaders(): Map<String, String> = emptyMap()
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
    fun `test compat deep-link schemes are blocked by default when resolver is off`() {
        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = extractedDir,
            appId = "tenant_alpha"
        )
        val initialIntentCount = fakeContext.startedIntents.size

        for (scheme in GoatWebViewClient.COMPAT_DEEP_LINK_SCHEMES) {
            assertTrue(
                "compatExternalSchemeResolver=false must still block $scheme (unchanged default behavior)",
                client.shouldOverrideUrl(null, scheme)
            )
        }
        assertEquals(
            "No intents should launch for tg/fb/whatsapp/comgooglemaps when the resolver is off",
            initialIntentCount, fakeContext.startedIntents.size
        )
    }

    @Test
    fun `test compat resolver off leaves t-me host on the existing dialog-or-block path`() {
        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = extractedDir,
            appId = "tenant_alpha"
        )
        var externalNavFired = false
        val client2 = GoatWebViewClient(
            context = fakeContext,
            extractedDir = extractedDir,
            appId = "tenant_alpha",
            onExternalNavigation = { externalNavFired = true }
        )
        assertTrue(client.shouldOverrideUrl("t.me", "https"))
        assertTrue(client2.shouldOverrideUrl("t.me", "https"))
        assertFalse(
            "onExternalNavigation must not fire when compatExternalSchemeResolver is off",
            externalNavFired
        )
    }

    @Test
    fun `test compat resolver routes new deep-link schemes and fires onExternalNavigation`() {
        var lastExternalUrl: String? = null
        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = extractedDir,
            appId = "tenant_alpha",
            compatExternalSchemeResolver = true,
            onExternalNavigation = { url -> lastExternalUrl = url }
        )

        for (scheme in GoatWebViewClient.COMPAT_DEEP_LINK_SCHEMES) {
            lastExternalUrl = null
            assertTrue(
                "compat resolver must handle $scheme (return true)",
                client.shouldOverrideUrl(null, scheme)
            )
            assertNotNull(
                "onExternalNavigation must fire for $scheme when the resolver is on",
                lastExternalUrl
            )
        }
    }

    @Test
    fun `test compat resolver routes configured universal-link hosts`() {
        var externalNavFired = false
        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = extractedDir,
            appId = "tenant_alpha",
            compatExternalSchemeResolver = true,
            compatExternalLinkHosts = setOf("t.me", "wa.me"),
            onExternalNavigation = { externalNavFired = true }
        )

        assertTrue(client.shouldOverrideUrl("t.me", "https"))
        assertTrue("onExternalNavigation must fire for a configured universal-link host", externalNavFired)

        externalNavFired = false
        assertTrue(client.shouldOverrideUrl("wa.me", "https"))
        assertTrue("wa.me must also route when explicitly configured", externalNavFired)

        externalNavFired = false
        assertTrue(client.shouldOverrideUrl("some-other-host.com", "https"))
        assertFalse("An unconfigured host must not trigger onExternalNavigation", externalNavFired)
    }

    @Test
    fun `test compat universal-link hosts match case-insensitively`() {
        // The host set arrives straight from the embedder (Flutter forwards
        // compatExternalLinkHosts untouched), while matching is done against a lowercased
        // uri.host. DNS is case-insensitive, so an entry like "T.me" must still match.
        var externalNavFired = false
        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = extractedDir,
            appId = "tenant_alpha",
            compatExternalSchemeResolver = true,
            compatExternalLinkHosts = setOf("T.me", "  WA.me  "),
            onExternalNavigation = { externalNavFired = true }
        )

        assertTrue("A capitalised configured host must still route", client.shouldOverrideUrl("t.me", "https"))
        assertTrue("onExternalNavigation must fire for a capitalised configured host", externalNavFired)

        externalNavFired = false
        assertTrue("A padded configured host must still route", client.shouldOverrideUrl("wa.me", "https"))
        assertTrue("onExternalNavigation must fire for a whitespace-padded configured host", externalNavFired)

        externalNavFired = false
        assertTrue(client.shouldOverrideUrl("unconfigured-host.com", "https"))
        assertFalse("An unconfigured host must still not route externally", externalNavFired)
    }

    @Test
    fun `test compat resolver on the intent scheme with a null uri returns true without crashing`() {
        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = extractedDir,
            appId = "tenant_alpha",
            compatExternalSchemeResolver = true
        )
        val initialIntentCount = fakeContext.startedIntents.size
        assertTrue(client.shouldOverrideUrl(null, "intent"))
        assertEquals(initialIntentCount, fakeContext.startedIntents.size)
    }

    @Test
    fun `test compat resolver on a real intent uri does not crash and fires onExternalNavigation`() {
        // Uri.parse() genuinely works under this module's isReturnDefaultValues unit-test config
        // (confirmed empirically -- it is backed by a real parser, unlike most android.jar stubs),
        // but Intent.parseUri() is not (it returns null instead of parsing) -- exercised here to
        // confirm the null-guard added in GoatWebViewClient.resolveIntentScheme handles that
        // gracefully. Real intent:// resolution (an actual Intent launching) is verified live on
        // an emulator instead (bench/goat_vs_fiw's T7ProbeScreen).
        var lastExternalUrl: String? = null
        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = extractedDir,
            appId = "tenant_alpha",
            compatExternalSchemeResolver = true,
            onExternalNavigation = { url -> lastExternalUrl = url }
        )
        val realUri = Uri.parse("intent://scan/#Intent;scheme=zxing;package=com.example;end")
        val initialIntentCount = fakeContext.startedIntents.size

        assertTrue(client.shouldOverrideUrl(null, "intent", realUri))
        assertEquals(
            "Intent.parseUri returning null (this test env's stub behavior) must not launch a spurious intent",
            initialIntentCount, fakeContext.startedIntents.size
        )
        assertEquals(realUri.toString(), lastExternalUrl)
    }

    @Test
    fun `test tel mailto sms geo still fire onExternalNavigation only when resolver is on`() {
        var fired = false
        val clientOff = GoatWebViewClient(
            context = fakeContext,
            extractedDir = extractedDir,
            onExternalNavigation = { fired = true }
        )
        clientOff.shouldOverrideUrl(null, "tel")
        assertFalse("onExternalNavigation must stay silent for tel: when the flag is off", fired)

        val clientOn = GoatWebViewClient(
            context = fakeContext,
            extractedDir = extractedDir,
            compatExternalSchemeResolver = true,
            onExternalNavigation = { fired = true }
        )
        clientOn.shouldOverrideUrl(null, "tel")
        assertTrue("onExternalNavigation must fire for tel: when the flag is on", fired)
    }

    // --- T8: opt-in lifecycle/error forwarding ---

    @Test
    fun `test onReceivedError fires only when callback is set and only for the main frame`() {
        // WebResourceError's constructor is package-private (can't subclass/fake it here); the
        // error param is passed null, exercising this override's own null-safe fallback (-1, "")
        // rather than a real error's fields. Callback wiring + main-frame gating -- the part this
        // test actually verifies -- doesn't depend on the error object's real content.
        var received: Triple<String, Int, String>? = null
        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = extractedDir,
            onReceivedErrorCompat = { url, code, desc -> received = Triple(url, code, desc) }
        )
        val mainFrameRequest = FakeWebResourceRequest(Uri.parse("https://example.com/broken"))

        client.onReceivedError(null, mainFrameRequest, null)
        assertEquals(Triple("https://example.com/broken", -1, ""), received)

        received = null
        val subFrameRequest = FakeWebResourceRequest(Uri.parse("https://example.com/iframe"), mainFrame = false)
        client.onReceivedError(null, subFrameRequest, null)
        assertNull("Sub-frame errors must not fire the main-frame-only compat callback", received)
    }

    @Test
    fun `test onReceivedError does nothing when no callback is set (G7)`() {
        val client = GoatWebViewClient(context = fakeContext, extractedDir = extractedDir)
        // Must not throw even with no callback wired.
        client.onReceivedError(null, FakeWebResourceRequest(Uri.parse("https://example.com")), null)
    }

    @Test
    fun `test onReceivedHttpError fires only when callback is set and only for the main frame`() {
        // WebResourceResponse.setStatusCodeAndReasonPhrase is also a no-op stub in this JVM test
        // env (getStatusCode() reads back 0 regardless of what was set) -- errorResponse passed
        // null here for the same reason as the onReceivedError test above: this verifies callback
        // wiring + main-frame gating, not real status-code passthrough (verified live instead).
        var received: Pair<String, Int>? = null
        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = extractedDir,
            onReceivedHttpErrorCompat = { url, status -> received = url to status }
        )

        client.onReceivedHttpError(null, FakeWebResourceRequest(Uri.parse("https://example.com/missing")), null)
        assertEquals("https://example.com/missing" to -1, received)

        received = null
        client.onReceivedHttpError(
            null,
            FakeWebResourceRequest(Uri.parse("https://example.com/sub.js"), mainFrame = false),
            null
        )
        assertNull("Sub-resource HTTP errors must not fire the main-frame-only compat callback", received)
    }

    @Test
    fun `test onPageCommitVisible fires only when callback is set`() {
        var committedUrl: String? = null
        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = extractedDir,
            onPageCommitVisibleCompat = { url -> committedUrl = url }
        )
        client.onPageCommitVisible(null, "https://example.com/visible")
        assertEquals("https://example.com/visible", committedUrl)

        val silentClient = GoatWebViewClient(context = fakeContext, extractedDir = extractedDir)
        silentClient.onPageCommitVisible(null, "https://example.com/visible") // must not throw
    }

    @Test
    fun `test onLoadResource fires per resource only when callback is set`() {
        val loaded = mutableListOf<String>()
        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = extractedDir,
            onLoadResourceCompat = { url -> loaded.add(url) }
        )
        client.onLoadResource(null, "https://example.com/a.js")
        client.onLoadResource(null, "https://example.com/b.css")
        assertEquals(listOf("https://example.com/a.js", "https://example.com/b.css"), loaded)
    }

    @Test
    fun `test doUpdateVisitedHistory fires with reload flag only when callback is set`() {
        val events = mutableListOf<Pair<String, Boolean>>()
        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = extractedDir,
            onUpdateVisitedHistoryCompat = { url, isReload -> events.add(url to isReload) }
        )
        client.doUpdateVisitedHistory(null, "https://example.com/page1", false)
        client.doUpdateVisitedHistory(null, "https://example.com/page1", true)
        assertEquals(listOf("https://example.com/page1" to false, "https://example.com/page1" to true), events)
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
    /**
     * Integration coverage for the launch-hash gate, which was previously unreachable in tests.
     * shouldOverrideUrlLoading reads `uri.fragment`; the Uri test shim did not implement
     * getFragment(), so the call threw NoSuchMethodError, the surrounding catch(Throwable) turned
     * it into null, and `if (fragment != null)` skipped the HMAC check entirely. Every assertion
     * below would have passed vacuously before the shim gained getFragment().
     */
    @Test
    fun `shouldOverrideUrlLoading blocks a navigation whose launch hash fails HMAC`() {
        var rejectedUrl: String? = null
        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = extractedDir,
            appId = "tenant_alpha",
            launchHashSecretKey = "correct-horse-battery-staple".toByteArray(),
            onLaunchHashRejected = { url -> rejectedUrl = url }
        )

        val tampered = "https://tenant_alpha.appassets.androidplatform.net/assets/index.html" +
            "#${GoatSecurityManager.LAUNCH_HASH_PARAM}=deadbeef&goatWebAppData=user%3Dattacker"
        val blocked = client.shouldOverrideUrlLoading(null, FakeWebResourceRequest(Uri.parse(tampered)))

        assertTrue("A tampered launch hash must be blocked", blocked)
        assertEquals("The rejection callback must receive the offending URL", tampered, rejectedUrl)
    }

    @Test
    fun `shouldOverrideUrlLoading leaves a fragment-free in-origin navigation alone`() {
        var rejected = false
        val client = GoatWebViewClient(
            context = fakeContext,
            extractedDir = extractedDir,
            appId = "tenant_alpha",
            launchHashSecretKey = "correct-horse-battery-staple".toByteArray(),
            onLaunchHashRejected = { rejected = true }
        )

        val clean = "https://tenant_alpha.appassets.androidplatform.net/assets/page2.html"
        assertFalse(
            "In-origin navigation carrying no launch hash must not be blocked",
            client.shouldOverrideUrlLoading(null, FakeWebResourceRequest(Uri.parse(clean)))
        )
        assertFalse("No rejection callback should fire", rejected)
    }

    @Test
    fun `test onReceivedSslError unconditionally cancels handler (Task 10197)`() {
        val fakeHandler = android.webkit.FakeSslErrorHandler()
        val client = GoatWebViewClient(context = fakeContext, extractedDir = extractedDir, appId = "tenant_alpha")
        client.onReceivedSslError(null, fakeHandler, null)
        assertTrue("SSL handler must be cancelled unconditionally", fakeHandler.cancelCalled)
        assertFalse("SSL proceed must never be called", fakeHandler.proceedCalled)
    }
}
