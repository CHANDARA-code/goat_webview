package com.goat.webview

import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File

class GoatBytecodePrecompilerTest {

    private lateinit var precompiler: GoatBytecodePrecompiler
    private lateinit var tempTestDir: File
    private lateinit var sampleBundle: File

    @Before
    fun setup() {
        precompiler = GoatBytecodePrecompiler()
        tempTestDir = File(System.getProperty("java.io.tmpdir"), "goat_test_bundles_${System.currentTimeMillis()}")
        tempTestDir.mkdirs()
        sampleBundle = File(tempTestDir, "main.bundle.js")
        sampleBundle.writeText("function renderApp() { console.log('Initializing V8 Goat Engine'); return 42; }")
    }

    @After
    fun tearDown() = runTest {
        precompiler.clearBytecodeCache("test_app_v8")
        tempTestDir.deleteRecursively()
    }

    @Test
    fun `test precompileBundle generates persistent bytecode cache (Task 10084)`() = runTest {
        val result = precompiler.precompileBundle("test_app_v8", sampleBundle)
        assertTrue(result.isSuccess)
        assertEquals("test_app_v8", result.appId)
        assertTrue(result.bytecodeSizeBytes > 0L)
        assertTrue(File(result.cachePath).exists())

        assertTrue(precompiler.isBytecodeCacheWarm("test_app_v8"))

        val stats = precompiler.getCacheStats()
        assertTrue(stats.totalCachedBundles >= 1)
        assertTrue(stats.isWarm)
    }

    @Test
    fun `test precompileBundle handles missing or empty bundle gracefully`() = runTest {
        val emptyBundle = File(tempTestDir, "empty.js")
        emptyBundle.writeText("")

        val result = precompiler.precompileBundle("test_empty", emptyBundle)
        assertFalse(result.isSuccess)
        assertNotNull(result.errorMessage)
    }

    @Test
    fun `test clearBytecodeCache deletes persistent artifacts`() = runTest {
        precompiler.precompileBundle("test_app_v8", sampleBundle)
        assertTrue(precompiler.isBytecodeCacheWarm("test_app_v8"))

        val cleared = precompiler.clearBytecodeCache("test_app_v8")
        assertTrue(cleared)
        assertFalse(precompiler.isBytecodeCacheWarm("test_app_v8"))
    }
}
