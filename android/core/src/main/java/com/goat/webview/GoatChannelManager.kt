package com.goat.webview

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.security.MessageDigest
import kotlin.math.abs

/**
 * Release channels for staged mini-app deployments (Task 10125).
 */
enum class ReleaseChannel(val tag: String, val level: Int) {
    PRODUCTION("production", 0),
    BETA("beta", 1),
    CANARY("canary", 2);

    companion object {
        fun fromTag(tag: String?): ReleaseChannel {
            return entries.firstOrNull { it.tag.equals(tag, ignoreCase = true) } ?: PRODUCTION
        }
    }
}

/**
 * Enterprise Grayscale (1%-100%) Rollout, Channel, and Instant Rollback Manager.
 *
 * Responsibilities:
 * 1. Manages deployment tracks (Production, Beta, Canary).
 * 2. Deterministically hashes user IDs to evaluate percentage-based canary buckets (1% - 100%).
 * 3. Records historical version pointers and executes instant 1-click cloud rollback.
 */
class GoatChannelManager(
    private val context: Context,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) {

    companion object {
        private const val PREFS_NAME = "goat_channel_manager_prefs"
        private const val KEY_CHANNEL_PREFIX = "channel_"
        private const val KEY_VERSION_HISTORY_PREFIX = "history_"
        private const val KEY_ACTIVE_VERSION_PREFIX = "active_ver_"
        private const val KEY_LAST_KNOWN_GOOD_PREFIX = "last_good_ver_"
    }

    private val prefs: SharedPreferences by lazy {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    /**
     * Sets the active release track channel for a specific mini-app.
     */
    suspend fun setChannel(appId: String, channel: ReleaseChannel) = withContext(ioDispatcher) {
        prefs.edit().putString("$KEY_CHANNEL_PREFIX$appId", channel.tag).commit()
    }

    /**
     * Gets the active release track channel for a specific mini-app. Defaults to [ReleaseChannel.PRODUCTION].
     */
    suspend fun getChannel(appId: String): ReleaseChannel = withContext(ioDispatcher) {
        val tag = prefs.getString("$KEY_CHANNEL_PREFIX$appId", ReleaseChannel.PRODUCTION.tag)
        ReleaseChannel.fromTag(tag)
    }

    /**
     * Evaluates whether a given user is eligible for a percentage-based grayscale rollout.
     * Uses deterministic SHA-256 bucketing across `[0, 99]`.
     *
     * @param manifest The candidate release manifest.
     * @param userId Unique user identifier (e.g. device GUID, user UUID).
     * @return `true` if the computed hash bucket falls within `[0, rolloutPercentage)`.
     */
    fun evaluateRollout(manifest: ReleaseManifest, userId: String): Boolean {
        if (manifest.rolloutPercentage >= 100) return true
        if (manifest.rolloutPercentage <= 0) return false
        if (userId.isBlank()) return false

        // Compute deterministic bucket using SHA-256
        val digest = MessageDigest.getInstance("SHA-256")
        val input = "$userId:${manifest.appId}:${manifest.version}".toByteArray(Charsets.UTF_8)
        val hashBytes = digest.digest(input)

        // Convert first 4 bytes to an integer
        val rawVal = ((hashBytes[0].toInt() and 0xFF) shl 24) or
                ((hashBytes[1].toInt() and 0xFF) shl 16) or
                ((hashBytes[2].toInt() and 0xFF) shl 8) or
                (hashBytes[3].toInt() and 0xFF)

        val bucket = abs(rawVal) % 100
        return bucket < manifest.rolloutPercentage
    }

    /**
     * Evaluates whether a release candidate matches or is accessible by the device's configured channel.
     * Higher privilege channels (e.g. CANARY) can access BETA and PRODUCTION releases.
     */
    fun evaluateChannelEligibility(targetChannel: ReleaseChannel, clientChannel: ReleaseChannel): Boolean {
        return clientChannel.level >= targetChannel.level
    }

    /**
     * Records a newly activated bundle version in the local history trail.
     */
    suspend fun recordVersionActivation(appId: String, newVersion: String) = withContext(ioDispatcher) {
        val currentActive = prefs.getString("$KEY_ACTIVE_VERSION_PREFIX$appId", null)
        if (currentActive != null && currentActive != newVersion) {
            // Save currentActive as the last known good fallback
            prefs.edit().putString("$KEY_LAST_KNOWN_GOOD_PREFIX$appId", currentActive).apply()
        }

        val historyStr = prefs.getString("$KEY_VERSION_HISTORY_PREFIX$appId", "") ?: ""
        val historyList = historyStr.split(",").filter { it.isNotBlank() }.toMutableList()

        if (!historyList.contains(newVersion)) {
            historyList.add(0, newVersion)
            // Keep at most 10 versions in history
            val trimmed = historyList.take(10).joinToString(",")
            prefs.edit()
                .putString("$KEY_VERSION_HISTORY_PREFIX$appId", trimmed)
                .putString("$KEY_ACTIVE_VERSION_PREFIX$appId", newVersion)
                .commit()
        } else {
            prefs.edit().putString("$KEY_ACTIVE_VERSION_PREFIX$appId", newVersion).commit()
        }
    }

    /**
     * Returns the active version string for the given mini-app.
     */
    suspend fun getActiveVersion(appId: String): String? = withContext(ioDispatcher) {
        prefs.getString("$KEY_ACTIVE_VERSION_PREFIX$appId", null)
    }

    /**
     * Returns the last known good fallback version before the active version.
     */
    suspend fun getLastKnownGoodVersion(appId: String): String? = withContext(ioDispatcher) {
        prefs.getString("$KEY_LAST_KNOWN_GOOD_PREFIX$appId", null)
    }

    /**
     * Returns the full version history trail for the given mini-app.
     */
    suspend fun getVersionHistory(appId: String): List<String> = withContext(ioDispatcher) {
        val historyStr = prefs.getString("$KEY_VERSION_HISTORY_PREFIX$appId", "") ?: ""
        historyStr.split(",").filter { it.isNotBlank() }
    }

    /**
     * Executes an instant 1-click local rollback to the last known good bundle version.
     *
     * @param appId Unique mini-app identifier.
     * @return The rollback target version string if successfully rolled back, or `null` if no previous version exists.
     */
    suspend fun rollback(appId: String): String? = withContext(ioDispatcher) {
        val lastGood = getLastKnownGoodVersion(appId) ?: run {
            val history = getVersionHistory(appId)
            if (history.size > 1) history[1] else null
        } ?: return@withContext null

        val currentActive = getActiveVersion(appId)
        prefs.edit()
            .putString("$KEY_ACTIVE_VERSION_PREFIX$appId", lastGood)
            .apply()

        lastGood
    }
}
