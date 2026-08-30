package com.goat.webview

import android.content.Context
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.*

/**
 * Data model for a chosen contact entry (Task 10129).
 */
@Serializable
data class ContactItem(
    val name: String,
    val phoneNumber: String,
    val email: String? = null
)

/**
 * Data model for an active hardware geofence region (Task 10129).
 */
@Serializable
data class GeofenceRegion(
    val geofenceId: String,
    val latitude: Double,
    val longitude: Double,
    val radiusMeters: Double,
    val transitionType: String = "BOTH", // "ENTER", "EXIT", "BOTH"
    val expirationDurationMs: Long = 86400000L // 24 hours default
)

/**
 * Data model for geofence transition events.
 */
@Serializable
data class GeofenceTransitionEvent(
    val geofenceId: String,
    val transition: String, // "ENTER" | "EXIT"
    val latitude: Double,
    val longitude: Double,
    val timestamp: Long = System.currentTimeMillis()
)

/**
 * Enterprise Contacts Picker & Background Geofencing Manager (Task 10129).
 *
 * Responsibilities:
 * 1. Manages secure contact picking without exposing the full address book (Principle of Least Privilege).
 * 2. Manages background geofence circular regions (50m - 10,000m radius).
 * 3. Evaluates geographic boundary crossings (Haversine formula) and dispatches transition events.
 */
class GoatContactsGeofenceManager(
    private val context: Context,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) {

    companion object {
        const val MIN_RADIUS_METERS = 50.0
        const val MAX_RADIUS_METERS = 10000.0
        private const val EARTH_RADIUS_METERS = 6371000.0
    }

    private val activeGeofences = ConcurrentHashMap<String, GeofenceRegion>()

    /**
     * Simulates picking a single sanitized contact entry.
     */
    suspend fun chooseContact(): ContactItem = withContext(ioDispatcher) {
        ContactItem(
            name = "Alex Johnson",
            phoneNumber = "+1-555-019-2834",
            email = "alex.johnson@example.com"
        )
    }

    /**
     * Registers a new background circular geofence region.
     *
     * @param geofenceId Unique identifier for the geofence.
     * @param latitude Center latitude.
     * @param longitude Center longitude.
     * @param radiusMeters Radius in meters (bounded between 50m and 10,000m).
     * @param transitionType "ENTER", "EXIT", or "BOTH".
     * @return [GeofenceRegion] created and registered.
     */
    suspend fun startGeofence(
        geofenceId: String,
        latitude: Double,
        longitude: Double,
        radiusMeters: Double,
        transitionType: String = "BOTH"
    ): GeofenceRegion = withContext(ioDispatcher) {
        val boundedRadius = radiusMeters.coerceIn(MIN_RADIUS_METERS, MAX_RADIUS_METERS)
        val region = GeofenceRegion(
            geofenceId = geofenceId,
            latitude = latitude,
            longitude = longitude,
            radiusMeters = boundedRadius,
            transitionType = transitionType.uppercase()
        )
        activeGeofences[geofenceId] = region
        region
    }

    /**
     * Stops and unregisters an active geofence region.
     */
    suspend fun stopGeofence(geofenceId: String): Boolean = withContext(ioDispatcher) {
        activeGeofences.remove(geofenceId) != null
    }

    /**
     * Clears all registered geofences.
     */
    suspend fun clearAllGeofences(): Int = withContext(ioDispatcher) {
        val count = activeGeofences.size
        activeGeofences.clear()
        count
    }

    /**
     * Lists all currently registered geofences.
     */
    suspend fun listGeofences(): List<GeofenceRegion> = withContext(ioDispatcher) {
        activeGeofences.values.toList()
    }

    /**
     * Evaluates a location coordinate against active geofences and returns triggered transitions.
     */
    suspend fun evaluateLocation(latitude: Double, longitude: Double): List<GeofenceTransitionEvent> = withContext(ioDispatcher) {
        val events = ArrayList<GeofenceTransitionEvent>()
        for (region in activeGeofences.values) {
            val dist = calculateDistanceMeters(latitude, longitude, region.latitude, region.longitude)
            if (dist <= region.radiusMeters) {
                if (region.transitionType == "ENTER" || region.transitionType == "BOTH") {
                    events.add(GeofenceTransitionEvent(region.geofenceId, "ENTER", latitude, longitude))
                }
            } else {
                if (region.transitionType == "EXIT" || region.transitionType == "BOTH") {
                    events.add(GeofenceTransitionEvent(region.geofenceId, "EXIT", latitude, longitude))
                }
            }
        }
        events
    }

    /**
     * Calculates great-circle distance between two points using the Haversine formula.
     */
    fun calculateDistanceMeters(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = sin(dLat / 2).pow(2.0) +
                cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
                sin(dLon / 2).pow(2.0)
        val c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return EARTH_RADIUS_METERS * c
    }
}
