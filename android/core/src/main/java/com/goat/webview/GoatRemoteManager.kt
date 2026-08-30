package com.goat.webview

import android.content.Context
import android.util.Base64
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.security.PublicKey

/**
 * Data model representing an OTA release manifest fetched from the CDN.
 *
 * @property appId The target mini-app identifier.
 * @property version Semantic version of the release (e.g. "1.1.0").
 * @property bundleUrl Full URL to the remote .zip bundle archive.
 * @property sha256 Expected SHA-256 hexadecimal hash of the bundle archive.
 * @property signature Optional base64-encoded digital signature for cryptographic verification.
 * @property signatureAlgorithm Signature algorithm (e.g. "SHA256withECDSA" or "SHA256withRSA").
 * @property rolloutPercentage Percentage of user base eligible for this update (0 - 100).
 * @property minEngineVersion Minimum Goat WebView engine version required.
 * @property isRollback Whether this release acts as a forced rollback directive.
 */
@Serializable
data class ReleaseManifest(
    val appId: String,
    val version: String,
    val bundleUrl: String,
    val sha256: String,
    val signature: String? = null,
    val signatureAlgorithm: String = GoatSecurityManager.ALGORITHM_ECDSA,
    val rolloutPercentage: Int = 100,
    val minEngineVersion: String? = null,
    val isRollback: Boolean = false
)

/**
 * Sealed class representing progress and status states during an OTA update lifecycle.
 */
sealed class UpdateProgress {
    /** Checking remote CDN for available updates. */
    data class Checking(val appId: String) : UpdateProgress()

    /** Active bundle is already at latest version or device is excluded from rollout. */
    data class UpToDate(val appId: String, val currentVersion: String) : UpdateProgress()

    /** Downloading remote bundle archive with real-time byte counters and progress percentage. */
    data class Downloading(
        val appId: String,
        val bytesDownloaded: Long,
        val totalBytes: Long,
        val progressPercentage: Int
    ) : UpdateProgress()

    /** Verifying SHA-256 checksum and digital signature. */
    data class Verifying(val appId: String) : UpdateProgress()

    /** Extracting bundle to versioned staging directory. */
    data class Staging(val appId: String, val targetVersion: String) : UpdateProgress()

    /** Update successfully verified, staged, and ready for consumption. */
    data class Ready(val appId: String, val version: String, val bundleDir: File) : UpdateProgress()

    /** Update failed with error description and optional exception. */
    data class Failed(val appId: String, val error: String, val throwable: Throwable? = null) : UpdateProgress()
}

/**
 * Functional interface abstracting HTTP operations for testing and network configuration.
 */
fun interface HttpDownloader {
    /**
     * Downloads data from the given URL and writes to target file while reporting progress.
     */
    fun downloadToFile(
        url: String,
        targetFile: File,
        onProgress: (bytesDownloaded: Long, totalBytes: Long) -> Unit
    )
}

/**
 * Enterprise OTA Remote Update Manager for Goat WebView.
 *
 * Responsibilities:
 * 1. Checks remote CDN for latest mini-app release manifests.
 * 2. Downloads `.zip` bundle packages in background on [Dispatchers.IO].
 * 3. Enforces multi-tenant isolation and SHA-256 + RSA/ECDSA cryptographic verification.
 * 4. Atomically stages validated packages via [GoatAssetManager] with zero impact on active sessions.
 * 5. Supports gradual rollout bucketing (`userId.hashCode() % 100 < rolloutPercentage`) and instant rollback.
 */
open class GoatRemoteManager(
    private val context: Context,
    private val assetManager: GoatAssetManager = GoatAssetManager(context),
    private val httpDownloader: HttpDownloader = DefaultHttpDownloader()
) {
    companion object {
        private const val TAG = "GoatRemoteManager"
        private const val PREFS_VERSIONS = "goat_remote_versions"
        private const val KEY_INSTALLED_VERSION = "installed_version_"
        private const val KEY_INSTALLED_HASH = "installed_hash_"
        private const val BUFFER_SIZE = 8192

        private val jsonParser = Json {
            ignoreUnknownKeys = true
            isLenient = true
        }

        /**
         * Evaluates whether a given user ID falls within the specified rollout percentage bucket.
         */
        fun isEligibleForRollout(userId: String, rolloutPercentage: Int): Boolean {
            if (rolloutPercentage >= 100) return true
            if (rolloutPercentage <= 0) return false
            val bucket = Math.abs(userId.hashCode()) % 100
            return bucket < rolloutPercentage
        }

        /**
         * Compares two semantic version strings (e.g. "1.2.0" vs "1.1.9").
         * Returns `true` if `newVersion` is strictly greater than `currentVersion`.
         */
        fun isNewerVersion(currentVersion: String, newVersion: String): Boolean {
            val currentParts = currentVersion.split('.').mapNotNull { it.toIntOrNull() }
            val newParts = newVersion.split('.').mapNotNull { it.toIntOrNull() }

            val maxLen = maxOf(currentParts.size, newParts.size)
            for (i in 0 until maxLen) {
                val curr = currentParts.getOrElse(i) { 0 }
                val target = newParts.getOrElse(i) { 0 }
                if (target > curr) return true
                if (target < curr) return false
            }
            return false
        }
    }

    /**
     * Retrieves the currently recorded installed version for a mini-app tenant.
     */
    fun getInstalledVersion(appId: String = GoatAssetManager.DEFAULT_APP_ID): String {
        val prefs = context.getSharedPreferences(PREFS_VERSIONS, Context.MODE_PRIVATE)
        return prefs.getString("$KEY_INSTALLED_VERSION$appId", "1.0.0") ?: "1.0.0"
    }

    /**
     * Records the successfully staged version for a mini-app tenant.
     */
    fun setInstalledVersion(appId: String, version: String, hash: String) {
        val prefs = context.getSharedPreferences(PREFS_VERSIONS, Context.MODE_PRIVATE)
        prefs.edit()
            .putString("$KEY_INSTALLED_VERSION$appId", version)
            .putString("$KEY_INSTALLED_HASH$appId", hash)
            .apply()
    }

    /**
     * Executes a complete, resilient OTA update check and download flow.
     *
     * @param appId The unique mini-app identifier.
     * @param manifestUrl The CDN URL returning the JSON [ReleaseManifest].
     * @param userId Optional user identifier for gradual rollout bucketing.
     * @param publicKey Optional publisher [PublicKey] for cryptographic signature verification.
     * @return A cold [Flow] emitting [UpdateProgress] events.
     */
    fun checkAndUpdate(
        appId: String = GoatAssetManager.DEFAULT_APP_ID,
        manifestUrl: String,
        userId: String = "",
        publicKey: PublicKey? = null
    ): Flow<UpdateProgress> = flow {
        emit(UpdateProgress.Checking(appId))

        // 1. Fetch and parse manifest
        val manifest = try {
            fetchManifest(manifestUrl)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to fetch or parse release manifest from $manifestUrl", e)
            emit(UpdateProgress.Failed(appId, "Manifest fetch failed: ${e.message}", e))
            return@flow
        }

        val currentVersion = getInstalledVersion(appId)

        // 2. Check Rollback directive or Version Eligibility
        if (!manifest.isRollback) {
            if (!isNewerVersion(currentVersion, manifest.version)) {
                Log.d(TAG, "Mini-app $appId is up to date (current: $currentVersion, remote: ${manifest.version})")
                emit(UpdateProgress.UpToDate(appId, currentVersion))
                return@flow
            }

            if (userId.isNotBlank() && !isEligibleForRollout(userId, manifest.rolloutPercentage)) {
                Log.d(TAG, "User $userId not in rollout bucket (${manifest.rolloutPercentage}%) for $appId")
                emit(UpdateProgress.UpToDate(appId, currentVersion))
                return@flow
            }
        }

        // 3. Download bundle archive to temporary cache file
        val tempDownloadDir = File(context.cacheDir, "goat_ota_downloads").apply { mkdirs() }
        val tempBundleFile = File(tempDownloadDir, "${appId}_${manifest.version}_${System.currentTimeMillis()}.zip")

        try {
            httpDownloader.downloadToFile(manifest.bundleUrl, tempBundleFile) { downloaded, total ->
                val percent = if (total > 0) ((downloaded * 100) / total).toInt() else 0
            }

            emit(UpdateProgress.Downloading(appId, tempBundleFile.length(), tempBundleFile.length(), 100))

            // 4. Verify Integrity (SHA-256 and Signature)
            emit(UpdateProgress.Verifying(appId))
            val actualHash = computeFileSha256(tempBundleFile)
            if (!actualHash.equals(manifest.sha256, ignoreCase = true)) {
                val errorMsg = "SHA-256 checksum mismatch! Expected: ${manifest.sha256}, Actual: $actualHash"
                Log.e(TAG, errorMsg)
                tempBundleFile.delete()
                emit(UpdateProgress.Failed(appId, errorMsg))
                return@flow
            }

            // Cryptographic signature check if signature is supplied
            if (!manifest.signature.isNullOrBlank() && publicKey != null) {
                val signatureBytes = Base64.decode(manifest.signature, Base64.DEFAULT)
                val isValidSig = GoatSecurityManager.verifyFileSignature(
                    bundleFile = tempBundleFile,
                    signatureBytes = signatureBytes,
                    publicKey = publicKey,
                    algorithm = manifest.signatureAlgorithm
                )
                if (!isValidSig) {
                    val errorMsg = "Cryptographic signature verification failed for remote bundle!"
                    Log.e(TAG, errorMsg)
                    tempBundleFile.delete()
                    emit(UpdateProgress.Failed(appId, errorMsg))
                    return@flow
                }
            }

            // 5. Staging & Extraction
            emit(UpdateProgress.Staging(appId, manifest.version))
            val targetDir = GoatAssetManager.getTargetDirectory(context.filesDir, appId)

            FileInputStream(tempBundleFile).use { input ->
                assetManager.extractBundleStreamAtomically(input, targetDir, appId)
            }

            // Record new active version
            setInstalledVersion(appId, manifest.version, manifest.sha256)
            tempBundleFile.delete()

            Log.i(TAG, "Successfully installed OTA update for $appId to version ${manifest.version}")
            emit(UpdateProgress.Ready(appId, manifest.version, targetDir))

        } catch (e: Exception) {
            Log.e(TAG, "Error processing OTA update for $appId", e)
            if (tempBundleFile.exists()) {
                tempBundleFile.delete()
            }
            emit(UpdateProgress.Failed(appId, "Update process failed: ${e.message}", e))
        }
    }.flowOn(Dispatchers.IO)

    /**
     * Fetches and parses a [ReleaseManifest] from a URL or manifest provider.
     */
    open suspend fun fetchManifest(manifestUrl: String): ReleaseManifest = withContext(Dispatchers.IO) {
        val url = URL(manifestUrl)
        val conn = (url.openConnection() as HttpURLConnection).apply {
            connectTimeout = 10000
            readTimeout = 10000
            requestMethod = "GET"
            setRequestProperty("Accept", "application/json")
        }

        conn.inputStream.bufferedReader().use { reader ->
            val content = reader.readText()
            jsonParser.decodeFromString<ReleaseManifest>(content)
        }
    }

    /**
     * Computes the SHA-256 checksum of a physical file.
     */
    fun computeFileSha256(file: File): String {
        return FileInputStream(file).use { input ->
            val digest = MessageDigest.getInstance("SHA-256")
            val buffer = ByteArray(BUFFER_SIZE)
            var read: Int
            while (input.read(buffer).also { read = it } != -1) {
                digest.update(buffer, 0, read)
            }
            digest.digest().joinToString("") { "%02x".format(it) }
        }
    }
}

/**
 * Standard production [HttpDownloader] implementation using [HttpURLConnection] on [Dispatchers.IO].
 */
class DefaultHttpDownloader : HttpDownloader {
    override fun downloadToFile(
        url: String,
        targetFile: File,
        onProgress: (bytesDownloaded: Long, totalBytes: Long) -> Unit
    ) {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 15000
            readTimeout = 30000
            requestMethod = "GET"
        }

        val totalBytes = connection.contentLength.toLong()
        var downloadedBytes = 0L

        targetFile.parentFile?.mkdirs()
        connection.inputStream.buffered(8192).use { input ->
            FileOutputStream(targetFile).buffered(8192).use { output ->
                val buffer = ByteArray(8192)
                var bytesRead: Int
                while (input.read(buffer).also { bytesRead = it } != -1) {
                    output.write(buffer, 0, bytesRead)
                    downloadedBytes += bytesRead
                    onProgress(downloadedBytes, totalBytes)
                }
                output.flush()
            }
        }
    }
}
