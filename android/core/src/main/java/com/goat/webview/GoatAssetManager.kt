package com.goat.webview

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedInputStream
import java.io.File
import java.io.InputStream
import java.security.MessageDigest
import java.security.PublicKey
import java.util.zip.ZipInputStream

/**
 * Enterprise-grade asset manager for Goat WebView:
 * 1. Fast integrity check using SHA-256 checksums vs SharedPreferences cache
 * 2. Safe, atomic unzipping with Zip Slip attack protection
 * 3. Zero-delay startup when assets are already cached and validated
 */
class GoatAssetManager(private val context: Context) {

    companion object {
        private const val TAG = "GoatAssetManager"
        const val BUNDLE_FILE = "miniapp.zip"
        const val DEFAULT_APP_ID = "default"
        const val EXTRACTED_DIR = "miniapp_bundle"
        const val STAGING_DIR = "miniapp_bundle_staging"
        const val PREFS_NAME = "goat_miniapp_meta"
        const val KEY_BUNDLE_HASH = "bundle_sha256"
        const val BUFFER_SIZE = 8192

        /**
         * Resolves the target extraction directory for a specific mini-app tenant.
         */
        fun getTargetDirectory(filesDir: File, appId: String = DEFAULT_APP_ID): File {
            return if (appId == DEFAULT_APP_ID || appId == EXTRACTED_DIR) {
                File(filesDir, EXTRACTED_DIR)
            } else {
                File(File(filesDir, "miniapps"), appId)
            }
        }

        /**
         * Resolves the staging directory for atomic extraction.
         */
        fun getStagingDirectory(filesDir: File, appId: String = DEFAULT_APP_ID): File {
            return if (appId == DEFAULT_APP_ID || appId == EXTRACTED_DIR) {
                File(filesDir, STAGING_DIR)
            } else {
                File(File(filesDir, "miniapps_staging"), appId)
            }
        }

        /**
         * Extracts a ZipInputStream into destDir with strict Zip Slip security check.
         */
        fun extractZipStream(inputStream: InputStream, destDir: File) {
            val destCanonicalPath = destDir.canonicalPath
            ZipInputStream(BufferedInputStream(inputStream, BUFFER_SIZE)).use { zipIn ->
                var entry = zipIn.nextEntry
                while (entry != null) {
                    val file = File(destDir, entry.name)
                    val canonicalPath = file.canonicalPath

                    // Zip Slip Vulnerability Guard
                    if (!canonicalPath.startsWith(destCanonicalPath + File.separator) && canonicalPath != destCanonicalPath) {
                        throw SecurityException("Zip Slip exploit detected in entry: ${entry.name}")
                    }

                    if (entry.isDirectory) {
                        file.mkdirs()
                    } else {
                        file.parentFile?.mkdirs()
                        file.outputStream().buffered(BUFFER_SIZE).use { out ->
                            zipIn.copyTo(out)
                        }
                    }
                    zipIn.closeEntry()
                    entry = zipIn.nextEntry
                }
            }
        }

        private val HEX_CHARS = "0123456789abcdef".toCharArray()

        private fun bytesToHex(bytes: ByteArray): String {
            val hex = CharArray(bytes.size * 2)
            for (i in bytes.indices) {
                val b = bytes[i].toInt() and 0xFF
                hex[i * 2] = HEX_CHARS[b ushr 4]
                hex[i * 2 + 1] = HEX_CHARS[b and 0x0F]
            }
            return String(hex)
        }

        /**
         * Computes SHA-256 checksum of an InputStream.
         */
        fun computeStreamHash(inputStream: InputStream): String {
            inputStream.use { input ->
                val digest = MessageDigest.getInstance("SHA-256")
                val buffer = ByteArray(BUFFER_SIZE)
                var read: Int
                while (input.read(buffer).also { read = it } != -1) {
                    digest.update(buffer, 0, read)
                }
                return bytesToHex(digest.digest())
            }
        }
    }

    /**
     * Ensures miniapp assets are extracted and ready for consumption by WebViewAssetLoader.
     * Operates completely asynchronously on Dispatchers.IO with multi-tenant appId scoping.
     */
    suspend fun ensureAssetsReady(
        bundleAssetPath: String = BUNDLE_FILE,
        appId: String = DEFAULT_APP_ID
    ): File = withContext(Dispatchers.IO) {
        val targetDir = getTargetDirectory(context.filesDir, appId)
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val hashKey = "${KEY_BUNDLE_HASH}_$appId"
        val savedHash = prefs.getString(hashKey, null) ?: prefs.getString(KEY_BUNDLE_HASH, null)

        val currentHash = try {
            computeAssetToken(bundleAssetPath)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to compute asset token for $bundleAssetPath", e)
            ""
        }

        val needsExtraction = savedHash != currentHash || !targetDir.exists() || (targetDir.listFiles()?.isEmpty() == true)

        if (needsExtraction) {
            Log.i(TAG, "Extracting Goat mini-app bundle (appId=$appId, currentHash=$currentHash, savedHash=$savedHash)...")
            extractBundleAtomically(bundleAssetPath, targetDir, appId)
            prefs.edit()
                .putString(hashKey, currentHash)
                .putString(KEY_BUNDLE_HASH, currentHash)
                .apply()
            Log.i(TAG, "Goat mini-app bundle extraction complete -> ${targetDir.absolutePath}")
        } else {
            Log.d(TAG, "Assets already up-to-date for appId=$appId (0ms extraction delay).")
        }

        targetDir
    }

    /**
     * Atomically extracts the ZIP archive into a temporary staging folder,
     * verifies canonical paths against Zip Slip vulnerabilities, and renames to targetDir.
     */
    fun extractBundleAtomically(
        assetZipName: String,
        targetDir: File,
        appId: String = DEFAULT_APP_ID
    ) {
        context.assets.open(assetZipName).use { input ->
            extractBundleStreamAtomically(input, targetDir, appId)
        }
    }

    /**
     * Cryptographically verifies the digital signature of the bundle stream before atomic extraction.
     * Fulfills OWASP MASVS-CRYPTO (MSTG-CRYPTO-01).
     *
     * @param inputStream The ZIP archive input stream.
     * @param signatureBytes Cryptographic digital signature bytes.
     * @param publicKey Public key corresponding to the publisher's private signing key.
     * @param targetDir Destination directory.
     * @param appId Unique tenant identifier.
     * @param algorithm Cryptographic signature algorithm (default: SHA256withECDSA).
     * @throws SecurityException If the digital signature is invalid, missing, or tampered.
     * @throws java.io.IOException If I/O or archive decompression fails.
     */
    @Throws(SecurityException::class, java.io.IOException::class)
    fun extractSignedBundleStreamAtomically(
        inputStream: InputStream,
        signatureBytes: ByteArray,
        publicKey: PublicKey,
        targetDir: File,
        appId: String = DEFAULT_APP_ID,
        algorithm: String = GoatSecurityManager.ALGORITHM_ECDSA
    ) {
        val bundleBytes = inputStream.use { it.readBytes() }
        val isValid = GoatSecurityManager.verifyBytesSignature(
            data = bundleBytes,
            signatureBytes = signatureBytes,
            publicKey = publicKey,
            algorithm = algorithm
        )

        if (!isValid) {
            val stagingDir = getStagingDirectory(context.filesDir, appId)
            if (stagingDir.exists()) {
                stagingDir.deleteRecursively()
            }
            throw SecurityException(
                "Digital signature verification failed for bundle (appId=$appId, algorithm=$algorithm). Archive is untrusted or tampered."
            )
        }

        extractBundleStreamAtomically(
            inputStream = java.io.ByteArrayInputStream(bundleBytes),
            targetDir = targetDir,
            appId = appId
        )
    }

    /**
     * Atomically extracts an InputStream containing a ZIP archive into targetDir with
     * strict Zip Slip validation and guaranteed staging cleanup on failure.
     *
     * @param inputStream The ZIP archive input stream.
     * @param targetDir Destination directory.
     * @param appId Unique tenant identifier.
     * @throws SecurityException If a directory traversal attempt is detected.
     */
    fun extractBundleStreamAtomically(
        inputStream: InputStream,
        targetDir: File,
        appId: String = DEFAULT_APP_ID
    ) {
        val stagingDir = getStagingDirectory(context.filesDir, appId)
        if (stagingDir.exists()) {
            stagingDir.deleteRecursively()
        }
        stagingDir.mkdirs()

        try {
            extractZipStream(inputStream, stagingDir)

            if (targetDir.exists()) {
                targetDir.deleteRecursively()
            }

            val parentDir = targetDir.parentFile
            if (parentDir != null && !parentDir.exists()) {
                parentDir.mkdirs()
            }

            val renameSuccess = stagingDir.renameTo(targetDir)
            if (!renameSuccess) {
                // Fallback for filesystems that do not support directory rename
                stagingDir.copyRecursively(targetDir, overwrite = true)
                stagingDir.deleteRecursively()
            }
        } catch (e: Exception) {
            if (stagingDir.exists()) {
                stagingDir.deleteRecursively()
            }
            throw e
        }
    }

    /**
     * Computes the SHA-256 checksum of an asset file.
     */
    fun computeAssetHash(assetName: String): String {
        return context.assets.open(assetName).use { input ->
            computeStreamHash(input)
        }
    }

    /**
     * Lightweight identity token for a bundled asset, used to decide whether re-extraction is
     * needed. A packaged asset is immutable between installs, so the package version code plus
     * install timestamp uniquely identify its contents without hashing a multi-MB archive on
     * every launch. Falls back to the content hash only if package info is unavailable.
     */
    fun computeAssetToken(assetName: String): String {
        return try {
            val info = context.packageManager.getPackageInfo(context.packageName, 0)
            val versionCode = if (android.os.Build.VERSION.SDK_INT >= 28) {
                info.longVersionCode
            } else {
                @Suppress("DEPRECATION") info.versionCode.toLong()
            }
            "$assetName|v$versionCode|u${info.lastUpdateTime}"
        } catch (e: Exception) {
            Log.w(TAG, "Package info unavailable; falling back to content hash for $assetName", e)
            computeAssetHash(assetName)
        }
    }

    /**
     * Clears extracted bundle cache for a specific mini-app tenant or all tenants.
     */
    fun clearCache(appId: String = DEFAULT_APP_ID) {
        val targetDir = getTargetDirectory(context.filesDir, appId)
        if (targetDir.exists()) targetDir.deleteRecursively()
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .remove("${KEY_BUNDLE_HASH}_$appId")
            .remove(KEY_BUNDLE_HASH)
            .apply()
    }

    /**
     * Completely purges bundle assets and staging directories for a specific mini-app tenant.
     *
     * @param appId The unique mini-app identifier.
     * @return Boolean indicating successful purge.
     */
    fun purgeTenant(appId: String = DEFAULT_APP_ID): Boolean {
        clearCache(appId)
        val stagingDir = getStagingDirectory(context.filesDir, appId)
        if (stagingDir.exists()) {
            stagingDir.deleteRecursively()
        }
        val tenantBaseDir = if (appId == DEFAULT_APP_ID) {
            File(context.filesDir, EXTRACTED_DIR)
        } else {
            File(File(context.filesDir, "miniapps"), appId)
        }
        val deleted = if (tenantBaseDir.exists()) {
            tenantBaseDir.deleteRecursively()
        } else {
            true
        }
        Log.i(TAG, "Purged tenant asset bundle directory for appId=$appId (success=$deleted)")
        return deleted
    }
}
