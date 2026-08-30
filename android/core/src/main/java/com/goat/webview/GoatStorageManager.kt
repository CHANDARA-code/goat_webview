package com.goat.webview

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/**
 * Enterprise multi-tenant storage sandboxing manager (OWASP MASVS-STORAGE-02).
 *
 * Provides strictly partitioned key-value storage (`SharedPreferences`) and sandboxed
 * filesystem directories (`context.filesDir/miniapps/{appId}/data/`) scoped per `appId`,
 * ensuring that independent mini-apps cannot inspect, mutate, or access cross-tenant data.
 *
 * @property context The Android application context.
 * @property ioDispatcher CoroutineDispatcher for asynchronous I/O operations (defaults to [Dispatchers.IO]).
 */
class GoatStorageManager(
    private val context: Context,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) {
    companion object {
        private const val TAG = "GoatStorageManager"
        private const val PREFS_PREFIX = "goat_storage_"
        private const val MINAAPPS_DIR = "miniapps"
        private const val DATA_DIR = "data"
        const val DEFAULT_APP_ID = "default"

        /**
         * Resolves the SharedPreferences preference table name for a tenant.
         *
         * @param appId The unique mini-app identifier.
         * @return The scoped SharedPreferences name string.
         */
        fun getPreferencesName(appId: String = DEFAULT_APP_ID): String {
            return com.goat.webview.storage.GoatAccountScopedSandbox.getScopedPreferencesName(appId)
        }

        /**
         * Resolves the sandboxed internal filesystem data directory for a tenant.
         *
         * @param filesDir The root `context.filesDir` of the application.
         * @param appId The unique mini-app identifier.
         * @return [File] pointing to scoped tenant directory.
         */
        fun getTenantDataDirectory(filesDir: File, appId: String = DEFAULT_APP_ID): File {
            return com.goat.webview.storage.GoatAccountScopedSandbox.getScopedDataDirectory(filesDir, appId)
        }

        /**
         * Sanitizes an appId to prevent path traversal characters.
         *
         * @param identifier The raw identifier string.
         * @return Sanitized identifier.
         * @throws SecurityException If directory traversal patterns like `..` are detected.
         */
        fun sanitizeIdentifier(identifier: String): String {
            require(identifier.isNotBlank()) { "appId cannot be blank" }
            if (identifier.contains("..") || identifier.contains("/") || identifier.contains("\\")) {
                throw SecurityException("Path traversal sequence detected in appId: $identifier")
            }
            return identifier.replace(Regex("[^a-zA-Z0-9._-]"), "_")
        }
    }

    /**
     * Retrieves the isolated [SharedPreferences] instance for the specified tenant.
     *
     * @param appId The unique mini-app identifier.
     * @return [SharedPreferences] scoped exclusively to the tenant.
     */
    fun getTenantPreferences(appId: String = DEFAULT_APP_ID): SharedPreferences {
        val prefsName = getPreferencesName(appId)
        return context.getSharedPreferences(prefsName, Context.MODE_PRIVATE)
    }

    /**
     * Resolves and creates (if missing) the sandboxed data directory for the specified tenant.
     *
     * @param appId The unique mini-app identifier.
     * @return [File] pointing to the ensured data directory.
     */
    fun ensureTenantDataDirectory(appId: String = DEFAULT_APP_ID): File {
        val dataDir = getTenantDataDirectory(context.filesDir, appId)
        if (!dataDir.exists()) {
            dataDir.mkdirs()
        }
        return dataDir
    }

    /**
     * Persists a key-value pair into the tenant's isolated keyspace asynchronously.
     *
     * @param appId The unique mini-app identifier.
     * @param key The key string.
     * @param value The value string.
     * @return Boolean indicating successful write.
     */
    suspend fun setValue(
        appId: String = DEFAULT_APP_ID,
        key: String,
        value: String
    ): Boolean = withContext(ioDispatcher) {
        require(key.isNotBlank()) { "Storage key cannot be blank" }
        val prefs = getTenantPreferences(appId)
        prefs.edit().putString(key, value).commit()
    }

    /**
     * Retrieves a stored value from the tenant's isolated keyspace asynchronously.
     *
     * @param appId The unique mini-app identifier.
     * @param key The key string.
     * @return The stored string value or `null` if not found.
     */
    suspend fun getValue(
        appId: String = DEFAULT_APP_ID,
        key: String
    ): String? = withContext(ioDispatcher) {
        require(key.isNotBlank()) { "Storage key cannot be blank" }
        val prefs = getTenantPreferences(appId)
        prefs.getString(key, null)
    }

    /**
     * Removes a stored key from the tenant's isolated keyspace asynchronously.
     *
     * @param appId The unique mini-app identifier.
     * @param key The key string.
     * @return Boolean indicating successful removal.
     */
    suspend fun removeValue(
        appId: String = DEFAULT_APP_ID,
        key: String
    ): Boolean = withContext(ioDispatcher) {
        require(key.isNotBlank()) { "Storage key cannot be blank" }
        val prefs = getTenantPreferences(appId)
        prefs.edit().remove(key).commit()
    }

    /**
     * Clears all key-value entries in the tenant's isolated keyspace asynchronously.
     *
     * @param appId The unique mini-app identifier.
     * @return Boolean indicating successful clear.
     */
    suspend fun clearValues(appId: String = DEFAULT_APP_ID): Boolean = withContext(ioDispatcher) {
        val prefs = getTenantPreferences(appId)
        prefs.edit().clear().commit()
    }

    /**
     * Completely purges a tenant's data partition (SharedPreferences keyspace and sandbox directory)
     * upon mini-app uninstallation, cache reset, or eviction.
     *
     * @param appId The unique mini-app identifier.
     * @return Boolean indicating complete purge.
     */
    suspend fun purgeTenantData(appId: String = DEFAULT_APP_ID): Boolean = withContext(ioDispatcher) {
        val prefsCleared = getTenantPreferences(appId).edit().clear().commit()
        val dataDir = getTenantDataDirectory(context.filesDir, appId)
        val dirDeleted = if (dataDir.exists()) {
            dataDir.deleteRecursively()
        } else {
            true
        }
        Log.i(TAG, "Purged tenant storage partition for appId=$appId (prefs=$prefsCleared, files=$dirDeleted)")
        prefsCleared && dirDeleted
    }

    /**
     * Resolves a relative path within the tenant's isolated data sandbox and strictly enforces
     * directory traversal (Zip Slip / Path Traversal) containment guards.
     *
     * @param appId The unique mini-app identifier.
     * @param relativePath Relative file or directory path.
     * @return [File] pointing to the validated location within the tenant's sandbox directory.
     * @throws SecurityException If the resolved canonical path attempts to escape the sandbox directory.
     */
    fun resolveTenantPath(appId: String = DEFAULT_APP_ID, relativePath: String): File {
        val tenantDataDir = ensureTenantDataDirectory(appId)
        val cleanRelativePath = relativePath.trim().removePrefix("/")
        val targetFile = File(tenantDataDir, cleanRelativePath)
        val targetCanonicalPath = targetFile.canonicalPath
        val baseCanonicalPath = tenantDataDir.canonicalPath
        if (!targetCanonicalPath.startsWith(baseCanonicalPath + File.separator) && targetCanonicalPath != baseCanonicalPath) {
            throw SecurityException("Path traversal breach detected outside tenant sandbox: $relativePath (appId=$appId)")
        }
        return targetFile
    }

    /**
     * Writes raw bytes to a file within the tenant's sandboxed filesystem.
     *
     * @param appId The unique mini-app identifier.
     * @param relativePath Destination path relative to sandbox root.
     * @param data Byte payload to write.
     * @param append If true, appends bytes to existing file rather than overwriting.
     * @return Boolean indicating success.
     */
    suspend fun writeFile(
        appId: String = DEFAULT_APP_ID,
        relativePath: String,
        data: ByteArray,
        append: Boolean = false
    ): Boolean = withContext(ioDispatcher) {
        val targetFile = resolveTenantPath(appId, relativePath)
        targetFile.parentFile?.mkdirs()
        if (append) {
            targetFile.appendBytes(data)
        } else {
            targetFile.writeBytes(data)
        }
        true
    }

    /**
     * Reads all bytes from a file within the tenant's sandboxed filesystem.
     *
     * @param appId The unique mini-app identifier.
     * @param relativePath Path relative to sandbox root.
     * @return Byte array of file content.
     * @throws java.io.FileNotFoundException If the file does not exist.
     */
    suspend fun readFile(
        appId: String = DEFAULT_APP_ID,
        relativePath: String
    ): ByteArray = withContext(ioDispatcher) {
        val targetFile = resolveTenantPath(appId, relativePath)
        if (!targetFile.exists() || !targetFile.isFile) {
            throw java.io.FileNotFoundException("File not found in tenant sandbox: $relativePath (appId=$appId)")
        }
        targetFile.readBytes()
    }

    /**
     * Creates a directory within the tenant's sandboxed filesystem.
     *
     * @param appId The unique mini-app identifier.
     * @param relativePath Directory path relative to sandbox root.
     * @param recursive If true, creates intermediate parent directories as needed.
     * @return Boolean indicating whether directory was created or already exists.
     */
    suspend fun makeDirectory(
        appId: String = DEFAULT_APP_ID,
        relativePath: String,
        recursive: Boolean = true
    ): Boolean = withContext(ioDispatcher) {
        val targetDir = resolveTenantPath(appId, relativePath)
        if (targetDir.exists()) {
            targetDir.isDirectory
        } else if (recursive) {
            targetDir.mkdirs()
        } else {
            targetDir.mkdir()
        }
    }

    /**
     * Removes a directory within the tenant's sandboxed filesystem.
     *
     * @param appId The unique mini-app identifier.
     * @param relativePath Directory path relative to sandbox root.
     * @param recursive If true, deletes directory and all contained files.
     * @return Boolean indicating success.
     */
    suspend fun removeDirectory(
        appId: String = DEFAULT_APP_ID,
        relativePath: String,
        recursive: Boolean = true
    ): Boolean = withContext(ioDispatcher) {
        val targetDir = resolveTenantPath(appId, relativePath)
        if (!targetDir.exists()) {
            return@withContext false
        }
        if (recursive) {
            targetDir.deleteRecursively()
        } else {
            targetDir.delete()
        }
    }

    /**
     * Deletes a file within the tenant's sandboxed filesystem (FS_UNLINK).
     *
     * @param appId The unique mini-app identifier.
     * @param relativePath Path relative to sandbox root.
     * @return Boolean indicating whether file was deleted.
     */
    suspend fun deleteFile(
        appId: String = DEFAULT_APP_ID,
        relativePath: String
    ): Boolean = withContext(ioDispatcher) {
        val targetFile = resolveTenantPath(appId, relativePath)
        if (targetFile.exists() && targetFile.isFile) {
            targetFile.delete()
        } else {
            false
        }
    }

    /**
     * Lists all file names and directories directly contained in a sandboxed directory (FS_LIST_DIR).
     *
     * @param appId The unique mini-app identifier.
     * @param relativePath Path relative to sandbox root.
     * @return List of file and directory names.
     */
    suspend fun listDirectory(
        appId: String = DEFAULT_APP_ID,
        relativePath: String = ""
    ): List<String> = withContext(ioDispatcher) {
        val targetDir = resolveTenantPath(appId, relativePath)
        if (!targetDir.exists() || !targetDir.isDirectory) {
            return@withContext emptyList()
        }
        targetDir.list()?.toList() ?: emptyList()
    }

    /**
     * Retrieves file metadata statistics (FS_STAT).
     *
     * @param appId The unique mini-app identifier.
     * @param relativePath Path relative to sandbox root.
     * @return Map containing file attributes (size, isDirectory, isFile, lastModified).
     * @throws java.io.FileNotFoundException If the file or directory does not exist.
     */
    suspend fun getFileStat(
        appId: String = DEFAULT_APP_ID,
        relativePath: String
    ): Map<String, Any> = withContext(ioDispatcher) {
        val targetFile = resolveTenantPath(appId, relativePath)
        if (!targetFile.exists()) {
            throw java.io.FileNotFoundException("Target path does not exist in sandbox: $relativePath (appId=$appId)")
        }
        mapOf(
            "size" to targetFile.length(),
            "isDirectory" to targetFile.isDirectory,
            "isFile" to targetFile.isFile,
            "lastModified" to targetFile.lastModified(),
            "name" to targetFile.name
        )
    }

    /**
     * Copies a file from one sandboxed path to another within the tenant partition (FS_COPY_FILE).
     *
     * @param appId The unique mini-app identifier.
     * @param srcRelativePath Source file path.
     * @param destRelativePath Destination file path.
     * @return Boolean indicating success.
     */
    suspend fun copyFile(
        appId: String = DEFAULT_APP_ID,
        srcRelativePath: String,
        destRelativePath: String
    ): Boolean = withContext(ioDispatcher) {
        val srcFile = resolveTenantPath(appId, srcRelativePath)
        val destFile = resolveTenantPath(appId, destRelativePath)
        if (!srcFile.exists()) {
            throw java.io.FileNotFoundException("Source file does not exist: $srcRelativePath (appId=$appId)")
        }
        destFile.parentFile?.mkdirs()
        srcFile.copyTo(destFile, overwrite = true)
        destFile.exists()
    }

    /**
     * Checks if a file or directory exists at the sandboxed path (FS_EXISTS).
     *
     * @param appId The unique mini-app identifier.
     * @param relativePath Path relative to sandbox root.
     * @return Boolean indicating whether the path exists.
     */
    suspend fun fileExists(
        appId: String = DEFAULT_APP_ID,
        relativePath: String
    ): Boolean = withContext(ioDispatcher) {
        val targetFile = resolveTenantPath(appId, relativePath)
        targetFile.exists()
    }
}
