package com.goat.webview

import android.app.Application
import android.content.ComponentCallbacks2
import android.content.Context
import android.content.ContextWrapper
import android.content.MutableContextWrapper
import android.graphics.Color
import android.webkit.WebView
import android.webkit.WebViewClient
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Automated test suite for GoatFastPool 2-instance warm WebView recycler pool (Pillar 2).
 * Verifies MutableContextWrapper base context swapping, the complete 8-step sanitization sequence,
 * and memory trimming / eviction behaviors under OS memory pressure.
 */
class GoatFastPoolTest {

    private lateinit var fakeAppContext: Context
    private lateinit var fakeActivityContext1: Context
    private lateinit var fakeActivityContext2: Context
    private lateinit var fakeActivityContext3: Context

    @Before
    fun setUp() {
        GoatFastPool.trimMemory()
        fakeAppContext = object : ContextWrapper(null) {
            override fun getApplicationContext(): Context = this
        }
        fakeActivityContext1 = object : ContextWrapper(fakeAppContext) {
            override fun getApplicationContext(): Context = fakeAppContext
        }
        fakeActivityContext2 = object : ContextWrapper(fakeAppContext) {
            override fun getApplicationContext(): Context = fakeAppContext
        }
        fakeActivityContext3 = object : ContextWrapper(fakeAppContext) {
            override fun getApplicationContext(): Context = fakeAppContext
        }
    }

    @Test
    fun `test pool constant configurations`() {
        assertEquals("Max pool size must be 2 to cap RAM below 45MB", 2, GoatFastPool.MAX_POOL_SIZE)
        assertEquals("Pool must start empty after trimMemory", 0, GoatFastPool.poolSize)
    }

    @Test
    fun `test acquire from empty pool creates new instance`() {
        assertEquals(0, GoatFastPool.poolSize)
        val webView = GoatFastPool.acquire(fakeAppContext)
        assertNotNull(webView)
        assertEquals(0, GoatFastPool.poolSize)
    }

    @Test
    fun `test recycle adds instance to pool and decrements on acquire`() {
        val instance1 = GoatFastPool.createWarmWebView(fakeAppContext)
        val recycled1 = GoatFastPool.recycle(instance1)
        assertTrue(recycled1)
        assertEquals(1, GoatFastPool.poolSize)

        val instance2 = GoatFastPool.createWarmWebView(fakeAppContext)
        val recycled2 = GoatFastPool.recycle(instance2)
        assertTrue(recycled2)
        assertEquals(2, GoatFastPool.poolSize)

        // Acquiring an instance should pop from pool
        val acquired = GoatFastPool.acquire(fakeAppContext)
        assertNotNull(acquired)
        assertEquals(1, GoatFastPool.poolSize)
    }

    @Test
    fun `test MutableContextWrapper swapping on acquire and recycle prevents memory leak`() {
        // 1. Acquire binds Activity 1 context
        val webView = GoatFastPool.acquire(fakeActivityContext1)
        assertNotNull(webView)
        val wrapper = webView.context as? MutableContextWrapper
        assertNotNull("WebView context must be wrapped in MutableContextWrapper", wrapper)
        assertSame("Base context on acquire must match active activity context 1", fakeActivityContext1, wrapper?.baseContext)

        // 2. Recycle resets base context to Application context immediately
        val recycled = GoatFastPool.recycle(webView)
        assertTrue("Recycling should succeed", recycled)
        assertSame("Base context on recycle must be restored to application context", fakeAppContext, wrapper?.baseContext)

        // 3. Re-acquire binds Activity 2 context
        val reacquired = GoatFastPool.acquire(fakeActivityContext2)
        assertSame("Re-acquired instance must be the pooled instance", webView, reacquired)
        assertSame("Base context must now be rebound to activity context 2", fakeActivityContext2, wrapper?.baseContext)

        // 4. Recycle again and re-acquire with Activity 3 context
        GoatFastPool.recycle(reacquired)
        assertSame("Base context on second recycle must be application context", fakeAppContext, wrapper?.baseContext)

        val reacquired3 = GoatFastPool.acquire(fakeActivityContext3)
        assertSame("Base context must now be bound to activity context 3", fakeActivityContext3, wrapper?.baseContext)
    }

    @Test
    fun `test complete 8-step sanitization sequence executes on recycle`() {
        val webView = GoatFastPool.createWarmWebView(fakeAppContext)
        assertNotNull(webView)

        // Run complete 8-step sanitization sequence
        GoatFastPool.sanitizeWebView(webView)

        // Verify Step 8: client delegates detachment and reset styling
        assertNotNull("webViewClient must be reset to clean default instance", webView.webViewClient)
        assertTrue("webViewClient must be default WebViewClient", webView.webViewClient is WebViewClient)
        // WebChromeClient is cleared / reset
        assertNull("webChromeClient should be cleared to null", webView.webChromeClient)
        // Views container cleared
        assertEquals("Child views should be cleared", 0, webView.childCount)
    }

    @Test
    fun `test pool saturation does not exceed max capacity and returns false`() {
        val instance1 = GoatFastPool.createWarmWebView(fakeAppContext)
        val instance2 = GoatFastPool.createWarmWebView(fakeAppContext)
        val instance3 = GoatFastPool.createWarmWebView(fakeAppContext)

        assertTrue(GoatFastPool.recycle(instance1))
        assertTrue(GoatFastPool.recycle(instance2))
        assertEquals(2, GoatFastPool.poolSize)

        // Third instance should not be added (max pool size is 2) and return false
        val recycled3 = GoatFastPool.recycle(instance3)
        assertFalse("Third recycled instance exceeds max capacity and must be destroyed", recycled3)
        assertEquals(2, GoatFastPool.poolSize)
    }

    @Test
    fun `test trimMemory clears all standby instances`() {
        val instance1 = GoatFastPool.createWarmWebView(fakeAppContext)
        val instance2 = GoatFastPool.createWarmWebView(fakeAppContext)

        GoatFastPool.recycle(instance1)
        GoatFastPool.recycle(instance2)
        assertEquals(2, GoatFastPool.poolSize)

        GoatFastPool.trimMemory()
        assertEquals(0, GoatFastPool.poolSize)
    }

    @Test
    fun `test clearPool alias clears all standby instances`() {
        val instance = GoatFastPool.createWarmWebView(fakeAppContext)
        GoatFastPool.recycle(instance)
        assertEquals(1, GoatFastPool.poolSize)

        GoatFastPool.clearPool()
        assertEquals(0, GoatFastPool.poolSize)
    }

    @Test
    fun `test handleTrimMemory purges pool on critical memory warnings`() {
        val instance1 = GoatFastPool.createWarmWebView(fakeAppContext)
        val instance2 = GoatFastPool.createWarmWebView(fakeAppContext)
        GoatFastPool.recycle(instance1)
        GoatFastPool.recycle(instance2)
        assertEquals(2, GoatFastPool.poolSize)

        // Non-critical level should preserve pool
        GoatFastPool.handleTrimMemory(ComponentCallbacks2.TRIM_MEMORY_RUNNING_MODERATE)
        assertEquals(2, GoatFastPool.poolSize)

        // Critical level RUNNING_CRITICAL should purge pool
        GoatFastPool.handleTrimMemory(ComponentCallbacks2.TRIM_MEMORY_RUNNING_CRITICAL)
        assertEquals(0, GoatFastPool.poolSize)
    }

    @Test
    fun `test handleTrimMemory purges pool on all critical OS memory levels`() {
        val criticalLevels = listOf(
            ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW,
            ComponentCallbacks2.TRIM_MEMORY_RUNNING_CRITICAL,
            ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN,
            ComponentCallbacks2.TRIM_MEMORY_BACKGROUND,
            ComponentCallbacks2.TRIM_MEMORY_MODERATE,
            ComponentCallbacks2.TRIM_MEMORY_COMPLETE
        )

        for (level in criticalLevels) {
            GoatFastPool.prewarmPool(fakeAppContext)
            assertEquals("Pool should be prewarmed before test level $level", 2, GoatFastPool.poolSize)

            GoatFastPool.handleTrimMemory(level)
            assertEquals("Pool must be purged on level $level", 0, GoatFastPool.poolSize)
        }
    }

    @Test
    fun `test prewarmPool populates up to max capacity`() {
        assertEquals(0, GoatFastPool.poolSize)
        GoatFastPool.prewarmPool(fakeAppContext)
        assertEquals(2, GoatFastPool.poolSize)

        // Second prewarm should not exceed max capacity
        GoatFastPool.prewarmPool(fakeAppContext)
        assertEquals(2, GoatFastPool.poolSize)
    }

    @Test
    fun `test registerMemoryCallbacks attaches without error`() {
        var callbackRegistered = false
        var registeredCallback: android.content.ComponentCallbacks? = null

        val fakeApp = object : Application() {
            override fun registerComponentCallbacks(callback: android.content.ComponentCallbacks?) {
                callbackRegistered = true
                registeredCallback = callback
            }
        }

        GoatFastPool.registerMemoryCallbacks(fakeApp)
        assertTrue("Component callbacks must be registered", callbackRegistered)
        assertNotNull(registeredCallback)

        // Test onLowMemory trigger
        GoatFastPool.prewarmPool(fakeAppContext)
        assertEquals(2, GoatFastPool.poolSize)
        registeredCallback?.onLowMemory()
        assertEquals(0, GoatFastPool.poolSize)
    }
}
