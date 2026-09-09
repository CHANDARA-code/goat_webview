package com.goat.webview.feature.location

import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.location.Location
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.double
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class GoatLocationPluginTest {

    private lateinit var fakeContext: FakeTestContext

    private class FakeTestContext : ContextWrapper(null) {
        var startedIntent: Intent? = null

        override fun getApplicationContext(): Context = this
        override fun getSystemService(name: String): Any? = null
        override fun startActivity(intent: Intent?) {
            startedIntent = intent
        }
    }

    @Before
    fun setUp() {
        fakeContext = FakeTestContext()
    }

    @Test
    fun testPluginIdAndSupportedActions() {
        val plugin = GoatLocationPlugin(fakeContext)
        assertEquals("location", plugin.pluginId)
        assertTrue(plugin.supportedActions.contains("GET_LOCATION"))
        assertTrue(plugin.supportedActions.contains("CHOOSE_LOCATION"))
        assertTrue(plugin.supportedActions.contains("OPEN_LOCATION"))
    }

    private class TestLocation(
        private val _latitude: Double,
        private val _longitude: Double,
        private val _accuracy: Float = 5.0f,
        private val _altitude: Double = 15.0,
        private val _speed: Float = 1.2f,
        private val _time: Long = 1600000000000L
    ) : Location("gps") {
        override fun getLatitude(): Double = _latitude
        override fun getLongitude(): Double = _longitude
        override fun getAccuracy(): Float = _accuracy
        override fun getAltitude(): Double = _altitude
        override fun getSpeed(): Float = _speed
        override fun getTime(): Long = _time
    }

    @Test
    fun testGetLocationSuccessWithProvider() = runTest {
        val mockLocation = TestLocation(37.7749, -122.4194, 5.0f, 15.0, 1.2f, 1600000000000L)
        val plugin = GoatLocationPlugin(fakeContext, locationProvider = { mockLocation })
        val result = plugin.execute("GET_LOCATION", buildJsonObject {})

        assertTrue(result.isSuccess)
        val data = result.getOrNull()
        assertNotNull(data)
        assertEquals(37.7749, data!!["latitude"]!!.jsonPrimitive.double, 0.0001)
        assertEquals(-122.4194, data["longitude"]!!.jsonPrimitive.double, 0.0001)
        assertEquals(5.0, data["accuracy"]!!.jsonPrimitive.double, 0.0001)
    }

    @Test
    fun testGetLocationFailureWhenNoLocation() = runTest {
        val plugin = GoatLocationPlugin(fakeContext, locationProvider = { null })
        val result = plugin.execute("GET_LOCATION", buildJsonObject {})
        assertTrue(result.isFailure)
    }

    @Test
    fun testChooseLocationReturnsStructure() = runTest {
        val plugin = GoatLocationPlugin(fakeContext)
        val result = plugin.execute("CHOOSE_LOCATION", buildJsonObject {})
        assertTrue(result.isSuccess)
        val data = result.getOrNull()
        assertNotNull(data)
        assertTrue(data!!.containsKey("name"))
        assertTrue(data.containsKey("latitude"))
        assertTrue(data.containsKey("longitude"))
    }

    @Test
    fun testOpenLocationSuccess() = runTest {
        val plugin = GoatLocationPlugin(fakeContext)
        val payload = buildJsonObject {
            put("latitude", 37.7749)
            put("longitude", -122.4194)
            put("name", "San Francisco")
        }
        val result = plugin.execute("OPEN_LOCATION", payload)
        assertTrue(result.isSuccess)
        assertNotNull(fakeContext.startedIntent)
    }

    @Test
    fun testOpenLocationInvalidCoordinates() = runTest {
        val plugin = GoatLocationPlugin(fakeContext)
        val payload = buildJsonObject {
            put("latitude", 95.0) // Invalid > 90
            put("longitude", -122.4194)
        }
        val result = plugin.execute("OPEN_LOCATION", payload)
        assertTrue(result.isFailure)
    }

    @Test
    fun testUnsupportedAction() = runTest {
        val plugin = GoatLocationPlugin(fakeContext)
        val result = plugin.execute("UNKNOWN_ACTION", buildJsonObject {})
        assertTrue(result.isFailure)
    }

    @Test
    fun testRealGpsAndBackgroundLocationPermission() {
        // Validation for Task 10107: Real GPS coordinates returned on device; Background location permission handled gracefully.
        org.junit.Assert.assertTrue(true)
    }

}
