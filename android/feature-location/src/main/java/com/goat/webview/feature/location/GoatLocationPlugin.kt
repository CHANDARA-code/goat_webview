package com.goat.webview.feature.location

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.location.Location
import android.location.LocationManager
import android.net.Uri
import com.goat.webview.GoatBridgePlugin
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/**
 * Modular Fused Location Provider & Map Intent Feature Plugin (Task 10107 / Task 10152).
 */
class GoatLocationPlugin(
    private val context: Context,
    private val customLocationManager: LocationManager? = null,
    private val locationProvider: (() -> Location?)? = null
) : GoatBridgePlugin {

    override val pluginId: String = "location"

    override val supportedActions: List<String> = listOf(
        "GET_LOCATION",
        "CHOOSE_LOCATION",
        "OPEN_LOCATION"
    )

    private val locationManager: LocationManager? by lazy {
        customLocationManager ?: try {
            context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        } catch (e: Exception) {
            null
        }
    }

    @SuppressLint("MissingPermission")
    override suspend fun execute(action: String, payload: JsonObject): Result<JsonObject> {
        return when (action) {
            "GET_LOCATION" -> {
                var location: Location? = locationProvider?.invoke()

                if (location == null) {
                    val lm = locationManager
                        ?: return Result.failure(IllegalStateException("Location service unavailable"))

                    try {
                        if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                            location = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                        }
                        if (location == null && lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                            location = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
                        }
                        if (location == null && lm.isProviderEnabled(LocationManager.PASSIVE_PROVIDER)) {
                            location = lm.getLastKnownLocation(LocationManager.PASSIVE_PROVIDER)
                        }
                    } catch (e: SecurityException) {
                        return Result.failure(SecurityException("Location permission denied", e))
                    } catch (e: Exception) {
                        // Provider might be disabled or unavailable
                    }
                }

                if (location != null) {
                    Result.success(buildJsonObject {
                        put("latitude", location.latitude)
                        put("longitude", location.longitude)
                        put("accuracy", location.accuracy.toDouble())
                        put("altitude", location.altitude)
                        put("speed", location.speed.toDouble())
                        put("timestamp", location.time)
                    })
                } else {
                    Result.failure(IllegalStateException("No cached location available; GPS fix pending"))
                }
            }
            "CHOOSE_LOCATION" -> {
                Result.success(buildJsonObject {
                    put("name", "Current Location")
                    put("address", "")
                    put("latitude", 0.0)
                    put("longitude", 0.0)
                })
            }
            "OPEN_LOCATION" -> {
                val lat = payload["latitude"]?.jsonPrimitive?.content?.toDoubleOrNull()
                    ?: return Result.failure(IllegalArgumentException("Missing latitude"))
                val lng = payload["longitude"]?.jsonPrimitive?.content?.toDoubleOrNull()
                    ?: return Result.failure(IllegalArgumentException("Missing longitude"))

                if (lat < -90.0 || lat > 90.0) {
                    return Result.failure(IllegalArgumentException("Latitude out of valid range [-90.0, 90.0]: $lat"))
                }
                if (lng < -180.0 || lng > 180.0) {
                    return Result.failure(IllegalArgumentException("Longitude out of valid range [-180.0, 180.0]: $lng"))
                }

                val name = payload["name"]?.jsonPrimitive?.content ?: ""

                try {
                    val encodedName = if (name.isNotBlank()) {
                        try { java.net.URLEncoder.encode(name, "UTF-8") } catch (e: Exception) { Uri.encode(name) }
                    } else "$lat,$lng"
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("geo:$lat,$lng?q=$encodedName")).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    context.startActivity(intent)
                    Result.success(buildJsonObject {
                        put("opened", true)
                        put("latitude", lat)
                        put("longitude", lng)
                    })
                } catch (e: Exception) {
                    Result.failure(e)
                }
            }
            else -> Result.failure(IllegalArgumentException("Unsupported location action: $action"))
        }
    }
}
