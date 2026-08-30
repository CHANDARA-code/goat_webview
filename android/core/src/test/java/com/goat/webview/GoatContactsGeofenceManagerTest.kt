package com.goat.webview

import android.content.Context
import android.content.ContextWrapper
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GoatContactsGeofenceManagerTest {

    private lateinit var fakeContext: FakeTestContext
    private lateinit var manager: GoatContactsGeofenceManager

    private class FakeTestContext : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this
    }

    @Before
    fun setUp() {
        fakeContext = FakeTestContext()
        manager = GoatContactsGeofenceManager(fakeContext)
    }

    @Test
    fun testChooseContactReturnsSanitizedContact() = runTest {
        val contact = manager.chooseContact()
        assertNotNull(contact)
        assertEquals("Alex Johnson", contact.name)
        assertEquals("+1-555-019-2834", contact.phoneNumber)
        assertEquals("alex.johnson@example.com", contact.email)
    }

    @Test
    fun testGeofenceRegistrationAndRadiusBounds() = runTest {
        // Test lower radius clamping (<50m clamped to 50m)
        val geo1 = manager.startGeofence("geo_store_1", 37.7749, -122.4194, 20.0)
        assertEquals(50.0, geo1.radiusMeters, 0.001)

        // Test upper radius clamping (>10,000m clamped to 10,000m)
        val geo2 = manager.startGeofence("geo_store_2", 37.7749, -122.4194, 25000.0)
        assertEquals(10000.0, geo2.radiusMeters, 0.001)

        // Verify list geofences
        val list = manager.listGeofences()
        assertEquals(2, list.size)

        // Stop geofence
        val stopped = manager.stopGeofence("geo_store_1")
        assertTrue(stopped)
        assertEquals(1, manager.listGeofences().size)

        // Clear all
        val cleared = manager.clearAllGeofences()
        assertEquals(1, cleared)
        assertTrue(manager.listGeofences().isEmpty())
    }

    @Test
    fun testGeofenceTransitionEvaluation() = runTest {
        // Register store geofence in San Francisco (37.7749, -122.4194) with 500m radius
        manager.startGeofence("store_sf", 37.7749, -122.4194, 500.0, "BOTH")

        // Location 1: Inside geofence (~50m away)
        val insideEvents = manager.evaluateLocation(37.7750, -122.4195)
        assertEquals(1, insideEvents.size)
        assertEquals("ENTER", insideEvents[0].transition)
        assertEquals("store_sf", insideEvents[0].geofenceId)

        // Location 2: Outside geofence (~20km away in Oakland)
        val outsideEvents = manager.evaluateLocation(37.8044, -122.2712)
        assertEquals(1, outsideEvents.size)
        assertEquals("EXIT", outsideEvents[0].transition)
    }
}
