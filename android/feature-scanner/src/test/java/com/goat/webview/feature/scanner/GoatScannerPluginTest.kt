package com.goat.webview.feature.scanner

import android.content.Context
import android.content.ContextWrapper
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class GoatScannerPluginTest {

    private lateinit var fakeContext: FakeTestContext

    private class FakeTestContext : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this
    }

    @Before
    fun setUp() {
        fakeContext = FakeTestContext()
    }

    @Test
    fun testPluginIdAndSupportedActions() {
        val plugin = GoatScannerPlugin(fakeContext)
        assertEquals("scanner", plugin.pluginId)
        assertTrue(plugin.supportedActions.contains("SCAN_CODE"))
    }

    @Test
    fun testScanCodeWithoutCameraHardwareFails() = runTest {
        val plugin = GoatScannerPlugin(fakeContext, hasCameraHardware = { false })
        val result = plugin.execute("SCAN_CODE", buildJsonObject {})
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("No camera hardware") == true)
    }

    @Test
    fun testScanCodeWithoutDelegateFails() = runTest {
        val plugin = GoatScannerPlugin(fakeContext, scanDelegate = null, hasCameraHardware = { true })
        val result = plugin.execute("SCAN_CODE", buildJsonObject {})
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("delegate not attached") == true)
    }

    @Test
    fun testScanCodeWithDelegateSucceeds() = runTest {
        val plugin = GoatScannerPlugin(
            fakeContext,
            hasCameraHardware = { true },
            scanDelegate = {
                Result.success(buildJsonObject {
                    put("result", "https://example.com/qr")
                    put("scanType", "QR_CODE")
                })
            }
        )
        val result = plugin.execute("SCAN_CODE", buildJsonObject {})
        assertTrue(result.isSuccess)
        val data = result.getOrNull()
        assertEquals("https://example.com/qr", data?.get("result")?.jsonPrimitive?.content)
    }

    @Test
    fun testUnsupportedActionFails() = runTest {
        val plugin = GoatScannerPlugin(fakeContext)
        val result = plugin.execute("UNKNOWN_ACTION", buildJsonObject {})
        assertTrue(result.isFailure)
    }
}
