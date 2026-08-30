package com.goat.webview.auth

import android.content.Context
import android.util.Log
import com.goat.webview.GoatSecureStorageManager
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.util.concurrent.ConcurrentHashMap

/**
 * HTTP Basic/Digest Authentication Challenge & Encrypted Credential Manager (Task 10204 / Pillar 5).
 *
 * Securely stores HTTP authentication credentials encrypted per tenant appId, allowing
 * silent challenge resolution or explicit prompt handling.
 */
class GoatHttpAuthManager(
    private val context: Context,
    private val secureStorage: GoatSecureStorageManager = GoatSecureStorageManager(context),
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) {
    companion object {
        private const val TAG = "GoatHttpAuthManager"
        private const val AUTH_KEY_PREFIX = "http_auth_"
    }

    @Serializable
    data class HttpCredential(
        val username: String,
        val password: String,
        val host: String,
        val realm: String
    )

    private val json = Json { ignoreUnknownKeys = true }
    private val memoryCache = ConcurrentHashMap<String, HttpCredential>()

    private fun buildKey(appId: String, host: String, realm: String): String {
        val cleanHost = host.lowercase().trim()
        val cleanRealm = realm.lowercase().trim()
        return "$AUTH_KEY_PREFIX${appId}_${cleanHost}_$cleanRealm"
    }

    /**
     * Saves HTTP authentication credentials into encrypted storage for a tenant.
     */
    suspend fun saveCredential(
        appId: String,
        host: String,
        realm: String,
        username: String,
        password: String
    ): Boolean = withContext(ioDispatcher) {
        try {
            val key = buildKey(appId, host, realm)
            val cred = HttpCredential(username, password, host, realm)
            val serialized = json.encodeToString(cred)
            val success = secureStorage.setSecureValue(appId, key, serialized)
            if (success) {
                memoryCache["$appId:$host:$realm"] = cred
                Log.d(TAG, "Saved HTTP auth credential for $appId @ $host:$realm")
            }
            success
        } catch (e: Exception) {
            Log.e(TAG, "Failed saving HTTP auth credential", e)
            false
        }
    }

    /**
     * Retrieves HTTP authentication credentials for a tenant, checking memory cache then secure store.
     */
    fun getCredential(appId: String, host: String, realm: String): HttpCredential? {
        val cacheKey = "$appId:$host:$realm"
        memoryCache[cacheKey]?.let { return it }

        return try {
            val key = buildKey(appId, host, realm)
            val decrypted = runBlocking(ioDispatcher) {
                secureStorage.getSecureValue(appId, key)
            } ?: return null
            val cred = json.decodeFromString<HttpCredential>(decrypted)
            memoryCache[cacheKey] = cred
            cred
        } catch (e: Exception) {
            Log.w(TAG, "Could not read HTTP auth credential for $appId @ $host:$realm", e)
            null
        }
    }

    /**
     * Clears all saved HTTP credentials for a tenant, preserving non-auth secure storage keys.
     */
    suspend fun clearCredentials(appId: String): Boolean = withContext(ioDispatcher) {
        try {
            memoryCache.keys.filter { it.startsWith("$appId:") }.forEach { memoryCache.remove(it) }
            val allKeys = secureStorage.getAllSecureKeys(appId)
            var allSuccess = true
            allKeys.filter { it.startsWith(AUTH_KEY_PREFIX) }.forEach { key ->
                val removed = secureStorage.removeSecureValue(appId, key)
                if (!removed) {
                    allSuccess = false
                }
            }
            Log.d(TAG, "Cleared HTTP auth credentials for $appId")
            allSuccess
        } catch (e: Exception) {
            Log.e(TAG, "Failed clearing HTTP auth credentials for $appId", e)
            false
        }
    }
}
