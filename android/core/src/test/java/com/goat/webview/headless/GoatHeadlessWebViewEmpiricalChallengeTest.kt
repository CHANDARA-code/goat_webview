package com.goat.webview.headless

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.MutableContextWrapper
import android.content.SharedPreferences
import android.view.View
import android.view.ViewGroup
import android.webkit.ValueCallback
import android.webkit.WebView
import com.goat.webview.GoatAssetManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * Adversarial Empirical Challenge test suite for GoatHeadlessWebView (Milestone 1).
 *
 * Tests:
 * 1. Concurrent script execution stress testing (100 parallel coroutines with dynamic JS responses).
 * 2. Strict post-disposal invariant verification (all APIs reject after dispose).
 * 3. Complete Activity context detachment and memory leak prevention.
 * 4. Error propagation (JS engine crashes, bridge action failures, coroutine cancellation).
 */
@OptIn(ExperimentalCoroutinesApi::class)
class GoatHeadlessWebViewEmpiricalChallengeTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    private val testDispatcher = UnconfinedTestDispatcher()
    private lateinit var fakeAppContext: Context
    private lateinit var rootFilesDir: File

    private class FakeSharedPreferences : SharedPreferences {
        val data = ConcurrentHashMap<String, Any>()

        override fun getAll(): MutableMap<String, *> = HashMap(data)
        override fun getString(key: String?, defValue: String?): String? = (data[key] as? String) ?: defValue
        override fun getStringSet(key: String?, defValues: MutableSet<String>?): MutableSet<String>? = null
        override fun getInt(key: String?, defValue: Int): Int = (data[key] as? Int) ?: defValue
        override fun getLong(key: String?, defValue: Long): Long = (data[key] as? Long) ?: defValue
        override fun getFloat(key: String?, defValue: Float): Float = (data[key] as? Float) ?: defValue
        override fun getBoolean(key: String?, defValue: Boolean): Boolean = (data[key] as? Boolean) ?: defValue
        override fun contains(key: String?): Boolean = data.containsKey(key)
        override fun edit(): SharedPreferences.Editor = FakeEditor(this)
        override fun registerOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {}
        override fun unregisterOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {}

        class FakeEditor(private val prefs: FakeSharedPreferences) : SharedPreferences.Editor {
            private val temp = HashMap<String, Any?>()
            private var clearAll = false

            override fun putString(key: String?, value: String?): SharedPreferences.Editor {
                if (key != null) {
                    if (value != null) temp[key] = value else temp[key] = null
                }
                return this
            }
            override fun putStringSet(key: String?, values: MutableSet<String>?): SharedPreferences.Editor = this
            override fun putInt(key: String?, value: Int): SharedPreferences.Editor {
                if (key != null) temp[key] = value
                return this
            }
            override fun putLong(key: String?, value: Long): SharedPreferences.Editor {
                if (key != null) temp[key] = value
                return this
            }
            override fun putFloat(key: String?, value: Float): SharedPreferences.Editor {
                if (key != null) temp[key] = value
                return this
            }
            override fun putBoolean(key: String?, value: Boolean): SharedPreferences.Editor {
                if (key != null) temp[key] = value
                return this
            }
            override fun remove(key: String?): SharedPreferences.Editor {
                if (key != null) temp[key] = null
                return this
            }
            override fun clear(): SharedPreferences.Editor {
                clearAll = true
                return this
            }
            override fun commit(): Boolean {
                apply()
                return true
            }
            override fun apply() {
                if (clearAll) {
                    prefs.data.clear()
                }
                for ((k, v) in temp) {
                    if (v == null) {
                        prefs.data.remove(k)
                    } else {
                        prefs.data[k] = v
                    }
                }
            }
        }
    }

    private class FakeTestContext(private val baseFilesDir: File) : ContextWrapper(null) {
        private val prefsMap = ConcurrentHashMap<String, FakeSharedPreferences>()

        override fun getFilesDir(): File = baseFilesDir

        override fun getSharedPreferences(name: String?, mode: Int): SharedPreferences {
            val safeName = name ?: "default"
            return prefsMap.computeIfAbsent(safeName) { FakeSharedPreferences() }
        }

        override fun getApplicationContext(): Context = this
    }

    private class FakeActivity(private val appCtx: Context) : Activity(appCtx) {
        override fun getApplicationContext(): Context = appCtx
    }

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        rootFilesDir = tempFolder.newFolder("challengeFilesDir")
        fakeAppContext = FakeTestContext(rootFilesDir)
        WebView.customEvaluateJavascript = null
    }

    @After
    fun tearDown() {
        WebView.customEvaluateJavascript = null
        Dispatchers.resetMain()
    }

    // ==========================================
    // CHALLENGE 1: CONCURRENT SCRIPT EXECUTION
    // ==========================================

    @Test
    fun `challenge concurrent script executions under high parallel load`() = runTest {
        val headless = GoatHeadlessWebView(fakeAppContext, appId = "stress_test_app")
        val concurrencyCount = 100
        val executionCounter = AtomicInteger(0)

        WebView.customEvaluateJavascript = { script, callback ->
            executionCounter.incrementAndGet()
            callback?.onReceiveValue(""""echo:$script"""")
        }

        val deferredResults = (1..concurrencyCount).map { i ->
            async {
                val script = "const x = $i; x * 2;"
                val result = headless.runScript(script)
                assertEquals(""""echo:$script"""", result)
                result
            }
        }

        val allResults = deferredResults.awaitAll()
        assertEquals(concurrencyCount, allResults.size)
        assertEquals(concurrencyCount, executionCounter.get())

        headless.dispose()
    }

    @Test
    fun `challenge concurrent runScriptAsync handles parallel deferred execution`() = runTest {
        val headless = GoatHeadlessWebView(fakeAppContext, appId = "async_stress_app")
        val concurrencyCount = 50

        WebView.customEvaluateJavascript = { script, callback ->
            callback?.onReceiveValue(""""async_response:$script"""")
        }

        val deferredList = (1..concurrencyCount).map { i ->
            headless.runScriptAsync("async_query_$i")
        }

        val results = deferredList.awaitAll()
        assertEquals(concurrencyCount, results.size)
        for (i in 1..concurrencyCount) {
            assertEquals(""""async_response:async_query_$i"""", results[i - 1])
        }

        headless.dispose()
    }

    // ==========================================
    // CHALLENGE 2: POST-DISPOSAL INVARIANTS
    // ==========================================

    @Test
    fun `challenge post-disposal calls fail immediately with IllegalStateException`() = runTest {
        val headless = GoatHeadlessWebView(fakeAppContext, appId = "post_disposal_app")
        headless.dispose()

        // 1. runScript post-disposal
        try {
            headless.runScript("2 + 2")
            fail("runScript after dispose must throw IllegalStateException")
        } catch (e: IllegalStateException) {
            assertTrue(e.message?.contains("disposed") == true)
        }

        // 2. runScriptAsync post-disposal
        val deferred = headless.runScriptAsync("2 + 2")
        try {
            deferred.await()
            fail("runScriptAsync after dispose must fail on await")
        } catch (e: Throwable) {
            assertTrue(e is IllegalStateException || e is CancellationException)
        }

        // 3. executeAction post-disposal
        val actionResult = headless.executeAction("STORAGE_GET", buildJsonObject { put("key", "test") })
        assertTrue("executeAction must return failure Result after dispose", actionResult.isFailure)
        assertTrue(actionResult.exceptionOrNull() is IllegalStateException)

        // 4. loadUrl post-disposal
        try {
            headless.loadUrl("https://example.com")
            fail("loadUrl after dispose must throw IllegalStateException")
        } catch (e: IllegalStateException) {
            assertTrue(e.message?.contains("disposed") == true)
        }

        // 5. loadHtml post-disposal
        try {
            headless.loadHtml("<html></html>")
            fail("loadHtml after dispose must throw IllegalStateException")
        } catch (e: IllegalStateException) {
            assertTrue(e.message?.contains("disposed") == true)
        }

        // 6. loadMiniApp post-disposal
        try {
            headless.loadMiniApp(File("/tmp"))
            fail("loadMiniApp after dispose must throw IllegalStateException")
        } catch (e: IllegalStateException) {
            assertTrue(e.message?.contains("disposed") == true)
        }

        // 7. Idempotent double/triple dispose must not crash
        headless.dispose()
        headless.dispose()
    }

    // ==========================================
    // CHALLENGE 3: ACTIVITY CONTEXT DETACHMENT & MEMORY LEAK PREVENTION
    // ==========================================

    @Test
    fun `challenge Activity context attachment and detachment lifecycle`() {
        val activity = FakeActivity(fakeAppContext)
        val headless = GoatHeadlessWebView(activity, appId = "activity_detach_app")

        val rootViewGroup = activity.findViewById<ViewGroup>(android.R.id.content)
        assertNotNull(rootViewGroup)
        assertEquals("WebView must be attached to Activity root hierarchy", 1, rootViewGroup?.childCount)
        assertSame(headless.webView, rootViewGroup?.getChildAt(0))
        assertEquals(View.INVISIBLE, headless.webView.visibility)

        val mutableWrapper = headless.webView.context as? MutableContextWrapper
        assertNotNull(mutableWrapper)
        assertSame("Base context before dispose must be Activity", activity, mutableWrapper?.baseContext)

        // Perform teardown / disposal
        headless.dispose()

        assertEquals("WebView must be detached from Activity root hierarchy", 0, rootViewGroup?.childCount)
        assertSame("Base context after dispose must be restored to applicationContext", fakeAppContext, mutableWrapper?.baseContext)
        assertTrue("WebView must be marked destroyed", headless.webView.isDestroyed)
    }

    @Test
    fun `challenge nested ContextWrapper resolution unwraps Activity correctly`() {
        val activity = FakeActivity(fakeAppContext)
        val innerWrapper = object : ContextWrapper(activity) {
            override fun getBaseContext(): Context = activity
        }
        val outerWrapper = object : ContextWrapper(innerWrapper) {
            override fun getBaseContext(): Context = innerWrapper
        }

        val headless = GoatHeadlessWebView(outerWrapper, appId = "nested_wrapper_app")
        val rootViewGroup = activity.findViewById<ViewGroup>(android.R.id.content)
        assertNotNull(rootViewGroup)
        assertEquals(1, rootViewGroup?.childCount)

        headless.dispose()
        assertEquals(0, rootViewGroup?.childCount)
    }

    // ==========================================
    // CHALLENGE 4: ERROR PROPAGATION & CANCELLATION
    // ==========================================

    @Test
    fun `challenge JavaScript engine runtime exception propagation`() = runTest {
        val headless = GoatHeadlessWebView(fakeAppContext, appId = "error_propagation_app")

        WebView.customEvaluateJavascript = { _, _ ->
            throw RuntimeException("V8 JavaScript Engine Fatal Error: OOM")
        }

        try {
            headless.runScript("throw new Error('fatal');")
            fail("runScript must propagate exception thrown by evaluateJavascript")
        } catch (e: RuntimeException) {
            assertTrue(e.message?.contains("V8 JavaScript Engine Fatal Error: OOM") == true)
        }

        headless.dispose()
    }

    @Test
    fun `challenge unknown bridge action returns structured Result failure`() = runTest {
        val headless = GoatHeadlessWebView(fakeAppContext, appId = "unknown_action_app")
        val result = headless.executeAction("NON_EXISTENT_SUPER_ACTION_XYZ", buildJsonObject {})

        assertTrue("Unknown action must return Result.failure", result.isFailure)
        val exception = result.exceptionOrNull()
        assertNotNull(exception)
        assertTrue(
            "Exception must describe unhandled action",
            exception?.message?.contains("Unhandled bridge action") == true || exception is IllegalArgumentException
        )

        headless.dispose()
    }
}
