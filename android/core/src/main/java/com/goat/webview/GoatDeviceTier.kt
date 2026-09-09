package com.goat.webview

import android.app.ActivityManager
import android.content.Context
import android.util.Log

/**
 * Classifies the device so the engine can spend less on constrained hardware.
 *
 * Before this, goat behaved identically on a 2 GB phone and a 12 GB flagship: it prewarmed a
 * standby WebView at startup and kept up to two parked instances, which is a good trade when RAM
 * is plentiful and a bad one when it is not.
 *
 * Low-end matters more than the app-process number suggests. Android's low-memory killer judges
 * the whole process group, and a mini-app host is app process (~140 MB measured on an SM-N975F)
 * plus a Chromium renderer (~77 MB). On a 2 GB device that group is a large share of everything
 * available, so being the fattest thing on the system gets you reaped -- and the user's next
 * launch is a full cold start.
 */
object GoatDeviceTier {

    private const val TAG = "GoatDeviceTier"

    /**
     * Devices at or below this are treated as low-end even when the OEM has not set the low-RAM
     * flag. `ActivityManager.isLowRamDevice()` is only true for devices explicitly configured as
     * Android Go class, which leaves ordinary 2-3 GB phones -- the bulk of constrained hardware in
     * practice -- reported as normal.
     */
    private const val LOW_END_TOTAL_MEM_BYTES = 3L * 1024 * 1024 * 1024  // 3 GB

    @Volatile
    private var cached: Boolean? = null

    @Volatile
    private var override: Boolean? = null

    /**
     * True when the engine should favour memory over warm-start latency.
     *
     * Cached: this cannot change during a process's life, and querying ActivityManager on every
     * mount would be pure overhead.
     */
    fun isLowEnd(context: Context): Boolean {
        override?.let { return it }
        cached?.let { return it }
        val result = try {
            val am = context.applicationContext
                ?.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
            if (am == null) {
                false
            } else {
                val info = ActivityManager.MemoryInfo()
                am.getMemoryInfo(info)
                val flagged = am.isLowRamDevice
                val small = info.totalMem in 1..LOW_END_TOTAL_MEM_BYTES
                if (flagged || small) {
                    Log.i(
                        TAG,
                        "Low-end device (isLowRamDevice=$flagged totalMem=${info.totalMem / (1024 * 1024)}MB); " +
                            "engine will skip pool prewarm and keep fewer parked instances"
                    )
                }
                flagged || small
            }
        } catch (e: Throwable) {
            // Never let tiering itself break startup; assume the generous path.
            Log.w(TAG, "Device tier detection failed, assuming normal: ${e.message}")
            false
        }
        cached = result
        return result
    }

    /** Host escape hatch: force a tier regardless of what the hardware reports. */
    @JvmStatic
    fun setLowEndOverride(value: Boolean?) {
        override = value
    }

    internal fun resetForTesting() {
        cached = null
        override = null
    }
}
