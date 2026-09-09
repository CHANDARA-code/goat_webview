package com.goat.webview.ui

import android.app.Activity
import android.content.pm.ActivityInfo
import android.util.Log
import com.goat.webview.manifest.MiniAppOrientation

/**
 * Runtime screen-orientation lock for mini-apps (Task 10175).
 *
 * Layers on top of the manifest-time default rather than replacing it: a mini-game can lock to
 * landscape for a gameplay route and drop back to whatever the manifest declared when that route
 * unmounts, and the host app's own orientation is restored when the mini-app is torn down.
 *
 * The host baseline is captured the first time anything changes orientation, which is what stops a
 * lock leaking out of the mini-app -- previously the manifest applier set `requestedOrientation`
 * and nothing ever recorded what it had been.
 */
object GoatOrientationController {

    private const val TAG = "GoatOrientation"

    const val PORTRAIT = "portrait"
    const val LANDSCAPE = "landscape"
    const val AUTO = "auto"

    @Volatile
    private var hostBaseline: Int? = null

    @Volatile
    private var manifestDefault: Int = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED

    @Volatile
    private var activeLock: String? = null

    /** The lock a mini-app has requested, or null when only the manifest default is in effect. */
    val currentLock: String?
        get() = activeLock

    internal fun parseOrientation(raw: String?): MiniAppOrientation? =
        when (raw?.trim()?.lowercase()) {
            PORTRAIT -> MiniAppOrientation.PORTRAIT
            LANDSCAPE -> MiniAppOrientation.LANDSCAPE
            AUTO -> MiniAppOrientation.AUTO
            else -> null
        }

    internal fun nameFor(activityInfoOrientation: Int): String =
        when (activityInfoOrientation) {
            ActivityInfo.SCREEN_ORIENTATION_PORTRAIT -> PORTRAIT
            ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE -> LANDSCAPE
            else -> AUTO
        }

    /**
     * Records the manifest-declared default for this mini-app, capturing the host's own setting
     * first so it can be handed back on teardown.
     */
    fun rememberManifestDefault(activity: Activity?, orientation: Int) {
        captureHostBaseline(activity)
        manifestDefault = orientation
    }

    private fun captureHostBaseline(activity: Activity?) {
        if (hostBaseline != null || activity == null) return
        hostBaseline = try {
            activity.requestedOrientation
        } catch (e: Throwable) {
            Log.w(TAG, "Could not read host orientation: ${e.message}")
            ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        }
    }

    /**
     * Applies a runtime lock. `"auto"` clears the lock and follows the sensor, per validation
     * rule 2 -- it is not the same as returning to the manifest default, which may itself be
     * portrait or landscape.
     */
    fun setLock(activity: Activity?, raw: String?): Boolean {
        val parsed = parseOrientation(raw) ?: return false
        captureHostBaseline(activity)
        val target = when (parsed) {
            MiniAppOrientation.PORTRAIT -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            MiniAppOrientation.LANDSCAPE -> ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
            MiniAppOrientation.AUTO -> ActivityInfo.SCREEN_ORIENTATION_SENSOR
        }
        activeLock = when (parsed) {
            MiniAppOrientation.AUTO -> null
            else -> parsed.manifestValue
        }
        return applyOrientation(activity, target)
    }

    /** Route unmount: drop any runtime lock and go back to the manifest-declared default. */
    fun releaseToManifestDefault(activity: Activity?): Boolean {
        activeLock = null
        return applyOrientation(activity, manifestDefault)
    }

    /**
     * Mini-app teardown: hand the host back exactly what it had.
     *
     * This is the case validation rule 1 is about -- without it a mini-app that locked to landscape
     * would leave the host, and the next mini-app, stuck in landscape.
     */
    fun releaseToHost(activity: Activity?): Boolean {
        activeLock = null
        manifestDefault = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        val baseline = hostBaseline ?: return false
        val applied = applyOrientation(activity, baseline)
        hostBaseline = null
        return applied
    }

    private fun applyOrientation(activity: Activity?, orientation: Int): Boolean {
        if (activity == null) return false
        return try {
            activity.requestedOrientation = orientation
            true
        } catch (e: Throwable) {
            Log.w(TAG, "Failed applying orientation $orientation: ${e.message}")
            false
        }
    }

    /** Test hook: clears all recorded state so cases cannot bleed into one another. */
    internal fun resetForTesting() {
        hostBaseline = null
        manifestDefault = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        activeLock = null
    }
}
