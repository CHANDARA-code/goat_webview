package com.goat.webview.headless

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.MutableContextWrapper
import android.content.SharedPreferences
import android.view.View
import android.view.ViewGroup
import com.goat.webview.GoatAssetManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
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
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.util.concurrent.ConcurrentHashMap

/**
 * Unit test suite for GoatHeadlessWebView background JS execution and lifecycle management (Milestone 1).
 */
@OptIn(ExperimentalCoroutinesApi::class)
class GoatHeadlessWebViewTest {

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
        rootFilesDir = tempFolder.newFolder("filesDir")
        fakeAppContext = FakeTestContext(rootFilesDir)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `test headless initialization with application context`() {
        val headless = GoatHeadlessWebView(fakeAppContext, appId = "test_app_1")
        assertEquals("test_app_1", headless.appId)
        assertNotNull(headless.webView)
        assertEquals(View.INVISIBLE, headless.webView.visibility)
        headless.dispose()
    }

    @Test
    fun `test headless initialization with activity context binds and attaches`() {
        val activity = FakeActivity(fakeAppContext)
        val headless = GoatHeadlessWebView(activity, appId = "test_activity_app")

        val rootContent = activity.findViewById<ViewGroup>(android.R.id.content)
        assertNotNull(rootContent)
        assertEquals(1, rootContent?.childCount)
        assertSame(headless.webView, rootContent?.getChildAt(0))

        headless.dispose()
        assertEquals(0, rootContent?.childCount)
    }

    @Test
    fun `test runScript evaluates javascript and returns result`() = runTest {
        val headless = GoatHeadlessWebView(fakeAppContext, appId = "script_app")
        val result = headless.runScript("console.log('hello');")
        assertEquals("\"mock_result\"", result)
        headless.dispose()
    }

    @Test
    fun `test runScriptAsync evaluates deferred result`() = runTest {
        val headless = GoatHeadlessWebView(fakeAppContext, appId = "async_app")
        val deferred = headless.runScriptAsync("1 + 1")
        val result = deferred.await()
        assertEquals("\"mock_result\"", result)
        headless.dispose()
    }

    @Test
    fun `test executeAction executes native bridge action`() = runTest {
        val headless = GoatHeadlessWebView(fakeAppContext, appId = "bridge_app")
        val payload = buildJsonObject {
            put("key", "test_key")
            put("value", "test_val")
        }
        val result = headless.executeAction("STORAGE_SET", payload)
        assertTrue("Expected STORAGE_SET to succeed: ${result.exceptionOrNull()?.message}", result.isSuccess)
        val data = result.getOrNull()
        assertNotNull(data)
        assertEquals("true", data?.get("saved")?.toString())

        val getPayload = buildJsonObject {
            put("key", "test_key")
        }
        val getResult = headless.executeAction("STORAGE_GET", getPayload)
        assertTrue("Expected STORAGE_GET to succeed: ${getResult.exceptionOrNull()?.message}", getResult.isSuccess)
        val getData = getResult.getOrNull()
        assertEquals("\"test_val\"", getData?.get("value")?.toString())

        headless.dispose()
    }

    @Test
    fun `test loadUrl and loadHtml invoke webView methods`() {
        val headless = GoatHeadlessWebView(fakeAppContext, appId = "loader_app")
        headless.loadUrl("https://example.com/headless")
        assertEquals("https://example.com/headless", headless.webView.lastLoadedUrl)

        headless.loadHtml("<html><body>Headless DOM</body></html>")
        assertEquals("<html><body>Headless DOM</body></html>", headless.webView.lastData)
        assertTrue(headless.webView.lastBaseUrl?.contains("loader_app") == true)

        headless.dispose()
    }

    @Test
    fun `test loadMiniApp sets webViewClient and loads entry URL`() {
        val bundleDir = tempFolder.newFolder("mini_app_bundle")
        File(bundleDir, "index.html").writeText("<!DOCTYPE html><html><body>MiniApp</body></html>")

        val headless = GoatHeadlessWebView(fakeAppContext, appId = "bundle_app")
        headless.loadMiniApp(bundleDir)

        assertEquals("https://bundle_app.appassets.androidplatform.net/assets/index.html", headless.webView.lastLoadedUrl)
        assertNotNull(headless.webView.webViewClient)

        headless.dispose()
    }

    @Test
    fun `test dispose teardown prevents subsequent actions`() = runTest {
        val headless = GoatHeadlessWebView(fakeAppContext, appId = "dispose_app")
        headless.dispose()

        try {
            headless.runScript("console.log('test')")
            fail("Expected IllegalStateException after dispose")
        } catch (e: IllegalStateException) {
            assertTrue(e.message?.contains("disposed") == true)
        }

        val actionResult = headless.executeAction("GET_DEVICE_INFO", buildJsonObject {})
        assertTrue("executeAction after dispose must fail", actionResult.isFailure)
        assertTrue(actionResult.exceptionOrNull() is IllegalStateException)

        assertTrue(headless.webView.isDestroyed)
    }

    @Test
    fun `test multi-tenant appId separation`() {
        val headlessA = GoatHeadlessWebView(fakeAppContext, appId = "tenant_alpha")
        val headlessB = GoatHeadlessWebView(fakeAppContext, appId = "tenant_beta")

        assertEquals("tenant_alpha", headlessA.appId)
        assertEquals("tenant_beta", headlessB.appId)

        headlessA.dispose()
        headlessB.dispose()
    }
}
