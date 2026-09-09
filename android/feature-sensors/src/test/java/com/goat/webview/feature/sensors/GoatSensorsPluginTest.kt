package com.goat.webview.feature.sensors

import android.content.Context
import android.content.ContextWrapper
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GoatSensorsPluginTest {

    private lateinit var plugin: GoatSensorsPlugin
    private lateinit var manager: GoatSensorManager

    private class FakeTestContext : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this
    }

    @Before
    fun setUp() {
        val context = FakeTestContext()
        manager = GoatSensorManager(context)
        plugin = GoatSensorsPlugin(context, sensorManager = manager)
    }

    private fun field(action: String, key: String, payload: kotlinx.serialization.json.JsonObject = buildJsonObject {}): String? {
        var out: String? = null
        kotlinx.coroutines.runBlocking {
            out = plugin.execute(action, payload).getOrNull()?.get(key)?.jsonPrimitive?.content
        }
        return out
    }

    @Test
    fun testPluginIdentityAndActionSurface() {
        assertEquals("sensors", plugin.pluginId)
        assertEquals(11, plugin.supportedActions.size)
        listOf(
            "START_ACCELEROMETER", "STOP_ACCELEROMETER", "GET_LATEST_ACCELEROMETER",
            "START_GYROSCOPE", "STOP_GYROSCOPE", "GET_LATEST_GYROSCOPE",
            "START_COMPASS", "STOP_COMPASS",
            "START_DEVICE_MOTION", "STOP_DEVICE_MOTION", "GET_LATEST_DEVICE_MOTION"
        ).forEach { assertTrue("$it not handled", plugin.canHandle(it)) }
        assertFalse(plugin.canHandle("STORAGE_SET"))
    }

    @Test
    fun testCompassStartStopIsBackedByTheManager() = runTest {
        val started = plugin.execute("START_COMPASS", buildJsonObject {}).getOrNull()
        assertEquals("true", started?.get("started")?.jsonPrimitive?.content)
        assertTrue(manager.isCompassStreamActive())

        val stopped = plugin.execute("STOP_COMPASS", buildJsonObject {}).getOrNull()
        assertEquals("true", stopped?.get("stopped")?.jsonPrimitive?.content)
        assertFalse(manager.isCompassStreamActive())

        // A second stop reports it was already inactive rather than fabricating success.
        val again = plugin.execute("STOP_COMPASS", buildJsonObject {}).getOrNull()
        assertEquals("false", again?.get("stopped")?.jsonPrimitive?.content)
    }

    @Test
    fun testAccelerometerAndGyroscopeAreRealStreamsNotStubs() = runTest {
        // Before starting, GET_LATEST reports no sample rather than a hardcoded vector.
        val cold = plugin.execute("GET_LATEST_ACCELEROMETER", buildJsonObject {}).getOrNull()
        assertEquals("false", cold?.get("hasSample")?.jsonPrimitive?.content)

        plugin.execute("START_ACCELEROMETER", buildJsonObject { put("interval", "game") })
        assertTrue(manager.isSensorStreamActive("accelerometer"))
        manager.ingestSample(1f, 2f, 3f, "accelerometer")

        val warm = plugin.execute("GET_LATEST_ACCELEROMETER", buildJsonObject {}).getOrNull()
        assertEquals("true", warm?.get("hasSample")?.jsonPrimitive?.content)
        assertEquals("1.0", warm?.get("x")?.jsonPrimitive?.content)

        plugin.execute("STOP_ACCELEROMETER", buildJsonObject {})
        assertFalse(manager.isSensorStreamActive("accelerometer"))

        plugin.execute("START_GYROSCOPE", buildJsonObject {})
        assertTrue(manager.isSensorStreamActive("gyroscope"))
        plugin.execute("STOP_GYROSCOPE", buildJsonObject {})
        assertFalse(manager.isSensorStreamActive("gyroscope"))
    }

    @Test
    fun testStartHonoursTheIntervalMode() = runTest {
        val res = plugin.execute("START_ACCELEROMETER", buildJsonObject { put("interval", "game") }).getOrNull()
        assertEquals("game", res?.get("interval")?.jsonPrimitive?.content)
        assertEquals(16L, manager.getThrottleIntervalMs())
    }

    @Test
    fun testDeviceMotionLifecycle() = runTest {
        val started = plugin.execute("START_DEVICE_MOTION", buildJsonObject {}).getOrNull()
        assertEquals("true", started?.get("started")?.jsonPrimitive?.content)
        assertTrue(manager.isStreamActive())

        val latest = plugin.execute("GET_LATEST_DEVICE_MOTION", buildJsonObject {}).getOrNull()
        assertEquals("true", latest?.get("isStreaming")?.jsonPrimitive?.content)

        val stopped = plugin.execute("STOP_DEVICE_MOTION", buildJsonObject {}).getOrNull()
        assertEquals("true", stopped?.get("stopped")?.jsonPrimitive?.content)
        assertFalse(manager.isStreamActive())
    }

    @Test
    fun testUnsupportedActionFails() = runTest {
        val res = plugin.execute("NOT_A_SENSOR_ACTION", buildJsonObject {})
        assertTrue(res.isFailure)
        assertTrue(res.exceptionOrNull() is IllegalArgumentException)
    }
}
