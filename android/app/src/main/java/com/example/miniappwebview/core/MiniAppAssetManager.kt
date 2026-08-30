package com.example.miniappwebview.core

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedInputStream
import java.io.File
import java.io.InputStream
import java.security.MessageDigest
import java.util.zip.ZipInputStream

/**
 * Enterprise-grade asset manager responsible for:
 * 1. Fast integrity check using SHA-256 checksums vs SharedPreferences cache
 * 2. Safe, atomic unzipping with Zip Slip attack protection
 * 3. Zero-delay startup when assets are already cached and validated
 */
class MiniAppAssetManager(private val context: Context) {

    companion object {
        private const val TAG = "MiniAppAssetManager"
        const val BUNDLE_FILE = "miniapp.zip"
        const val EXTRACTED_DIR = "miniapp_bundle"
        const val STAGING_DIR = "miniapp_bundle_staging"
        const val PREFS_NAME = "miniapp_meta"
        const val KEY_BUNDLE_HASH = "bundle_sha256"
        const val BUFFER_SIZE = 8192

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
                return digest.digest().joinToString("") { "%02x".format(it) }
            }
        }
    }

    /**
     * Ensures miniapp assets are extracted and ready for consumption by WebViewAssetLoader.
     * Operates completely asynchronously on Dispatchers.IO.
     */
    suspend fun ensureAssetsReady(): File = withContext(Dispatchers.IO) {
        val targetDir = File(context.filesDir, EXTRACTED_DIR)
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val savedHash = prefs.getString(KEY_BUNDLE_HASH, null)

        val currentHash = try {
            computeAssetHash(BUNDLE_FILE)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to compute asset hash for $BUNDLE_FILE", e)
            ""
        }

        val needsExtraction = savedHash != currentHash || !targetDir.exists() || (targetDir.listFiles()?.isEmpty() == true)

        if (needsExtraction) {
            Log.i(TAG, "Extracting mini-app bundle (currentHash=$currentHash, savedHash=$savedHash)...")
            extractBundleAtomically(BUNDLE_FILE, targetDir)
            prefs.edit().putString(KEY_BUNDLE_HASH, currentHash).apply()
            Log.i(TAG, "Mini-app bundle extraction complete -> ${targetDir.absolutePath}")
        } else {
            Log.d(TAG, "Assets already up-to-date (0ms extraction delay).")
        }

        targetDir
    }

    /**
     * Atomically extracts the ZIP archive into a temporary staging folder,
     * verifies canonical paths against Zip Slip vulnerabilities, and renames to targetDir.
     */
    fun extractBundleAtomically(assetZipName: String, targetDir: File) {
        val stagingDir = File(context.filesDir, STAGING_DIR)
        if (stagingDir.exists()) {
            stagingDir.deleteRecursively()
        }
        stagingDir.mkdirs()

        context.assets.open(assetZipName).use { input ->
            extractZipStream(input, stagingDir)
        }

        if (targetDir.exists()) {
            targetDir.deleteRecursively()
        }

        val renameSuccess = stagingDir.renameTo(targetDir)
        if (!renameSuccess) {
            // Fallback for filesystems that do not support directory rename
            stagingDir.copyRecursively(targetDir, overwrite = true)
            stagingDir.deleteRecursively()
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
}
