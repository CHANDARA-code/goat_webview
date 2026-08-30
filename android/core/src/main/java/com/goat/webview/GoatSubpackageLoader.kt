package com.goat.webview

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import java.io.BufferedInputStream
import java.io.File
import java.io.InputStream
import java.util.concurrent.ConcurrentHashMap
import java.util.zip.ZipInputStream

/**
 * Metadata descriptor for a dynamically loaded subpackage module.
 */
@Serializable
data class SubpackageMetadata(
    val subpackageName: String,
    val appId: String,
    val extractedPath: String,
    val byteSize: Long,
    val fileCount: Int,
    val cachedAt: Long
)

/**
 * Result model for subpackage dynamic loading.
 */
@Serializable
data class SubpackageLoadResult(
    val appId: String,
    val subpackageName: String,
    val isSuccess: Boolean,
    val isCached: Boolean,
    val extractedPath: String,
    val byteSize: Long,
    val errorMessage: String? = null
)

/**
 * Subpackage Dynamic Route On-Demand Loader (Task 10092 & 10190).
 *
 * Dynamically downloads, unpacks, and mounts subpackage modules (`subpackages/{name}/`)
 * into the isolated mini-app tenant asset directory on-demand. Strictly enforces Zip Slip
 * and directory traversal containment rules. Eliminates dummy chunk.js synthesis on missing streams.
 */
class GoatSubpackageLoader(
    private val context: Context? = null,
    private val customBaseDir: File? = null
) {
    companion object {
        private const val BUFFER_SIZE = 8192
        private val ILLEGAL_CHARS_REGEX = Regex("[\\\\/:*?\"<>|\\x00-\\x1F]")
        /** Anti-DOS maximum allowed subpackage decompression size limit (50MB). */
        const val MAX_ALLOWED_SUBPACKAGE_SIZE = 50 * 1024 * 1024L
    }

    private val memoryRegistry = ConcurrentHashMap<String, MutableSet<String>>()
    private val metadataRegistry = ConcurrentHashMap<String, ConcurrentHashMap<String, SubpackageMetadata>>()

    private fun getBaseDirectory(): File {
        return customBaseDir ?: context?.filesDir ?: File(System.getProperty("java.io.tmpdir"), "goat_miniapps")
    }

    /**
     * Validates path containment and returns the canonical target directory for a subpackage.
     * Throws [SecurityException] or [IllegalArgumentException] if traversal attempt is detected.
     */
    fun resolveSubpackageDir(appId: String, subpackageName: String): File {
        val trimmedAppId = appId.trim()
        val trimmedSubpkg = subpackageName.trim()

        if (trimmedAppId.isBlank() || trimmedSubpkg.isBlank()) {
            throw IllegalArgumentException("App ID and subpackage name must not be blank")
        }

        // Detect directory traversal patterns or illegal characters
        if (trimmedSubpkg.contains("..") ||
            trimmedSubpkg.contains("/") ||
            trimmedSubpkg.contains("\\") ||
            trimmedSubpkg.contains("%2e%2e", ignoreCase = true) ||
            trimmedSubpkg.contains("%2f", ignoreCase = true) ||
            trimmedSubpkg.contains("%5c", ignoreCase = true) ||
            trimmedSubpkg.contains("\u0000") ||
            ILLEGAL_CHARS_REGEX.containsMatchIn(trimmedSubpkg)
        ) {
            throw SecurityException("Invalid subpackage name or path traversal attempt: '$subpackageName'")
        }

        if (trimmedAppId.contains("..") ||
            trimmedAppId.contains("/") ||
            trimmedAppId.contains("\\") ||
            ILLEGAL_CHARS_REGEX.containsMatchIn(trimmedAppId)
        ) {
            throw SecurityException("Invalid app ID: '$appId'")
        }

        val baseDir = getBaseDirectory()
        val tenantBase = File(baseDir, "miniapps/$trimmedAppId/subpackages")
        val targetDir = File(tenantBase, trimmedSubpkg)

        // Strict canonical path containment verification
        val targetCanonical = targetDir.canonicalPath
        val baseCanonical = tenantBase.canonicalPath
        if (!targetCanonical.startsWith(baseCanonical + File.separator) && targetCanonical != baseCanonical) {
            throw SecurityException("Path containment violation for subpackage: '$subpackageName'")
        }

        return targetDir
    }

    /**
     * Extracts a Zip stream into the destination directory with strict entry-by-entry Zip Slip verification.
     */
    private fun extractSubpackageZip(inputStream: InputStream, destDir: File): Long {
        if (destDir.exists()) {
            destDir.deleteRecursively()
        }
        destDir.mkdirs()
        val destCanonicalPath = destDir.canonicalPath
        var totalBytes = 0L

        ZipInputStream(BufferedInputStream(inputStream, BUFFER_SIZE)).use { zipIn ->
            var entry = zipIn.nextEntry
            while (entry != null) {
                if (entry.name.contains("\u0000") || entry.name.contains("%2e%2e", ignoreCase = true)) {
                    throw SecurityException("Zip Slip exploit detected in entry: ${entry.name}")
                }

                val file = File(destDir, entry.name)
                val entryCanonical = file.canonicalPath

                // Zip Slip exploit prevention
                if (!entryCanonical.startsWith(destCanonicalPath + File.separator) && entryCanonical != destCanonicalPath) {
                    throw SecurityException("Zip Slip exploit detected in entry: ${entry.name}")
                }

                if (entry.isDirectory) {
                    file.mkdirs()
                } else {
                    file.parentFile?.mkdirs()
                    file.outputStream().buffered(BUFFER_SIZE).use { out ->
                        val copied = zipIn.copyTo(out)
                        totalBytes += copied
                    }
                    if (totalBytes > MAX_ALLOWED_SUBPACKAGE_SIZE) {
                        throw SecurityException("Subpackage archive decompression exceeded size limit ($MAX_ALLOWED_SUBPACKAGE_SIZE bytes)")
                    }
                }
                zipIn.closeEntry()
                entry = zipIn.nextEntry
            }
        }
        return totalBytes
    }

    /**
     * Loads or verifies a dynamic subpackage route module.
     * Extracts provided zip stream if present or verifies existing pre-extracted subpackage files on disk.
     * Returns isSuccess = false if subpackage does not exist and no zip stream is provided.
     */
    suspend fun loadSubpackage(
        appId: String,
        subpackageName: String,
        sourceZipStream: InputStream? = null
    ): SubpackageLoadResult = withContext(Dispatchers.IO) {
        val targetDir = try {
            resolveSubpackageDir(appId, subpackageName)
        } catch (e: Exception) {
            return@withContext SubpackageLoadResult(
                appId = appId,
                subpackageName = subpackageName,
                isSuccess = false,
                isCached = false,
                extractedPath = "",
                byteSize = 0L,
                errorMessage = e.message ?: "Invalid subpackage name"
            )
        }

        val cleanName = subpackageName.trim()
        val subpackages = memoryRegistry.getOrPut(appId) { ConcurrentHashMap.newKeySet() }
        val wasCached = subpackages.contains(cleanName) && targetDir.exists() && (targetDir.listFiles()?.isNotEmpty() == true)

        try {
            var extractedSize = 0L
            var fileCount = 0

            if (sourceZipStream != null) {
                extractedSize = extractSubpackageZip(sourceZipStream, targetDir)
                fileCount = targetDir.walkTopDown().filter { it.isFile }.count()
                if (fileCount == 0) {
                    throw IllegalArgumentException("Corrupted zip archive: no valid files extracted")
                }
            } else if (targetDir.exists() && targetDir.listFiles()?.isNotEmpty() == true) {
                extractedSize = targetDir.walkTopDown().filter { it.isFile }.map { it.length() }.sum()
                fileCount = targetDir.walkTopDown().filter { it.isFile }.count()
            } else {
                return@withContext SubpackageLoadResult(
                    appId = appId,
                    subpackageName = cleanName,
                    isSuccess = false,
                    isCached = false,
                    extractedPath = "",
                    byteSize = 0L,
                    errorMessage = "SUBPACKAGE_NOT_FOUND: Subpackage '$cleanName' does not exist on disk and no zip stream was provided"
                )
            }

            subpackages.add(cleanName)

            val metaMap = metadataRegistry.getOrPut(appId) { ConcurrentHashMap() }
            metaMap[cleanName] = SubpackageMetadata(
                subpackageName = cleanName,
                appId = appId,
                extractedPath = targetDir.absolutePath,
                byteSize = extractedSize,
                fileCount = fileCount,
                cachedAt = System.currentTimeMillis()
            )

            SubpackageLoadResult(
                appId = appId,
                subpackageName = cleanName,
                isSuccess = true,
                isCached = wasCached,
                extractedPath = targetDir.absolutePath,
                byteSize = extractedSize
            )
        } catch (e: Exception) {
            if (targetDir.exists()) {
                targetDir.deleteRecursively()
            }
            SubpackageLoadResult(
                appId = appId,
                subpackageName = cleanName,
                isSuccess = false,
                isCached = false,
                extractedPath = "",
                byteSize = 0L,
                errorMessage = "Failed extracting subpackage: ${e.message}"
            )
        }
    }

    /**
     * Checks if a subpackage is already mounted and cached on disk and in memory.
     */
    fun isSubpackageCached(appId: String, subpackageName: String): Boolean {
        return try {
            val cleanName = subpackageName.trim()
            val targetDir = resolveSubpackageDir(appId, cleanName)
            memoryRegistry[appId]?.contains(cleanName) == true && targetDir.exists() && (targetDir.listFiles()?.isNotEmpty() == true)
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Returns all currently cached subpackages for an application.
     */
    fun getSubpackages(appId: String): List<String> {
        return memoryRegistry[appId]?.toList() ?: emptyList()
    }

    /**
     * Returns detailed metadata descriptor for a cached subpackage.
     */
    fun getSubpackageMetadata(appId: String, subpackageName: String): SubpackageMetadata? {
        return metadataRegistry[appId]?.get(subpackageName.trim())
    }

    /**
     * Clears subpackage cache entries from memory and physically purges from disk.
     */
    suspend fun clearSubpackageCache(appId: String, subpackageName: String? = null): Boolean = withContext(Dispatchers.IO) {
        if (subpackageName != null) {
            val cleanName = subpackageName.trim()
            memoryRegistry[appId]?.remove(cleanName)
            metadataRegistry[appId]?.remove(cleanName)
            try {
                val dir = resolveSubpackageDir(appId, cleanName)
                if (dir.exists()) {
                    dir.deleteRecursively()
                }
            } catch (_: Exception) {}
        } else {
            memoryRegistry.remove(appId)
            metadataRegistry.remove(appId)
            try {
                val baseDir = getBaseDirectory()
                val tenantSubpkgDir = File(baseDir, "miniapps/${appId.trim()}/subpackages")
                if (tenantSubpkgDir.exists()) {
                    tenantSubpkgDir.deleteRecursively()
                }
            } catch (_: Exception) {}
        }
        true
    }
}
