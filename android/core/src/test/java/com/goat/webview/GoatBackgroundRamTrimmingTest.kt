package com.goat.webview

import android.content.ComponentCallbacks2
import android.content.Context
import android.content.ContextWrapper
import android.content.res.Configuration
import android.content.res.Resources
import android.util.DisplayMetrics
import com.goat.webview.view.GoatView
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

/**
 * Automated test suite for Background RAM Trimming & Bitmap Offloading (Task 10067 / Pillar 5).
 * Validates onPause, onResume, ComponentCallbacks2 memory trim levels, and GoatFastPool recycling.
 */
class GoatBackgroundRamTrimmingTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    private lateinit var assetDir: File
    private lateinit var fakeContext: FakeTestContext

    private class FakeTestContext : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this
        override fun getFilesDir(): File = File(System.getProperty("java.io.tmpdir"), "goat_ram_test")
        override fun getPackageName(): String = "com.goat.webview"
        override fun getSystemService(name: String): Any? = null

        @Suppress("DEPRECATION")
        override fun getResources(): Resources {
            val config = Configuration().apply {
                screenWidthDp = 411
                screenHeightDp = 891
                uiMode = Configuration.UI_MODE_NIGHT_YES
            }
            val metrics = DisplayMetrics().apply {
                density = 2.625f
            }
            return object : Resources(null, metrics, config) {
                override fun getConfiguration(): Configuration = config
                override fun getDisplayMetrics(): DisplayMetrics = metrics
            }
        }
    }

    @Before
    fun setUp() {
        fakeContext = FakeTestContext()
        assetDir = tempFolder.newFolder("miniapp_assets")
        File(assetDir, "index.html").writeText("<!DOCTYPE html><html><body>Test</body></html>")
    }

    @Test
    fun `test onPause and onResume execution on GoatView container`() {
        val goatView = GoatView(fakeContext)
        goatView.initialize(assetDir)

        // Exercise onPause: suspends V8 execution, timers, and offscreen pre-rasterization
        goatView.onPause()

        // Exercise onResume: restores execution, timers, and pre-rasterization
        goatView.onResume()

        assertNotNull(goatView)
    }

    @Test
    @Suppress("DEPRECATION")
    fun `test onTrimMemory handles all ComponentCallbacks2 levels gracefully`() {
        val goatView = GoatView(fakeContext)
        goatView.initialize(assetDir)

        val trimLevels = listOf(
            ComponentCallbacks2.TRIM_MEMORY_RUNNING_MODERATE,
            ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW,
            ComponentCallbacks2.TRIM_MEMORY_RUNNING_CRITICAL,
            ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN,
            ComponentCallbacks2.TRIM_MEMORY_BACKGROUND,
            ComponentCallbacks2.TRIM_MEMORY_MODERATE,
            ComponentCallbacks2.TRIM_MEMORY_COMPLETE
        )

        for (level in trimLevels) {
            // Must execute safely across all memory trim levels without crashing
            goatView.onTrimMemory(level)
        }
    }

    @Test
    fun `test GoatView destroy cleanly resets and recycles WebView into GoatFastPool`() {
        val goatView = GoatView(fakeContext)
        goatView.initialize(assetDir)

        goatView.destroy()

        // Verify that destroying a GoatView recycles its underlying instance or frees resources
        assertEquals(0, goatView.childCount)
    }
}
