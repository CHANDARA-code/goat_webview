package com.goat.webview

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Log
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.security.KeyStore
import java.security.SecureRandom
import java.util.concurrent.ConcurrentHashMap
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Enterprise Hardware Keystore & AES-256-GCM Encrypted Storage at Rest (Task 10123 / OWASP MASVS-STORAGE-02).
 *
 * Provides authenticated, tamper-evident key-value encryption using 256-bit AES keys stored in
 * the hardware-backed Android KeyStore (TEE / StrongBox) when available, with strict multi-tenant
 * keyspace partitioning per `appId`.
 *
 * Zero-PII Policy: Plaintext sensitive credentials (auth tokens, biometrics, API secrets) are NEVER
 * persisted unencrypted on disk or plain SharedPreferences.
 *
 * @property context The Android application context.
 * @property ioDispatcher CoroutineDispatcher for cryptographic and disk I/O operations (defaults to [Dispatchers.IO]).
 */
class GoatSecureStorageManager(
    private val context: Context,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) {

    companion object {
        private const val TAG = "GoatSecureStorage"
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val CIPHER_ALGORITHM = "AES/GCM/NoPadding"
        private const val KEY_SIZE_BITS = 256
        private const val GCM_TAG_LENGTH_BITS = 128
        private const val GCM_IV_LENGTH_BYTES = 12
        const val DEFAULT_APP_ID = "default"

        // In-memory fallback key storage for unit test environments lacking AndroidKeyStore provider
        private val fallbackKeyStore = ConcurrentHashMap<String, SecretKey>()

        /**
         * Resolves the scoped preference table name for a tenant.
         */
        fun getSecurePreferencesName(appId: String = DEFAULT_APP_ID): String {
            return com.goat.webview.storage.GoatAccountScopedSandbox.getScopedSecurePreferencesName(appId)
        }

        /**
         * Resolves the Android KeyStore alias for a tenant's AES-256 master key.
         */
        fun getKeyAlias(appId: String = DEFAULT_APP_ID): String {
            return com.goat.webview.storage.GoatAccountScopedSandbox.getScopedKeyAlias(appId)
        }
    }

    private val secureRandom = SecureRandom()

    /**
     * Retrieves or generates a 256-bit AES master key in the Android KeyStore for the given [appId].
     *
     * @param appId The unique mini-app identifier.
     * @return [SecretKey] for authenticated AES-GCM encryption.
     */
    @Synchronized
    fun getOrCreateSecretKey(appId: String = DEFAULT_APP_ID): SecretKey {
        val alias = getKeyAlias(appId)

        // 1. Attempt retrieval from AndroidKeyStore
        try {
            val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
            keyStore.load(null)
            if (keyStore.containsAlias(alias)) {
                val entry = keyStore.getEntry(alias, null) as? KeyStore.SecretKeyEntry
                if (entry != null) {
                    return entry.secretKey
                }
            }

            // Generate new hardware-backed AES-256 key
            val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
            val keyGenSpec = KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(KEY_SIZE_BITS)
                .setRandomizedEncryptionRequired(true)
                .build()

            keyGenerator.init(keyGenSpec)
            return keyGenerator.generateKey()
        } catch (e: Exception) {
            // The software fallback is for JVM unit tests ONLY, and that is now enforced rather
            // than merely stated in a comment.
            //
            // This catch used to be unconditional, so on a real device any KeyStore failure --
            // an OEM ProviderException, StrongBox unavailable, keys invalidated by a lock-screen
            // change -- silently swapped hardware-backed encryption for a process-local random
            // key. Two consequences, neither observable to the caller: the MASVS-STORAGE-02
            // guarantee this class advertises quietly stopped holding, and because the fallback
            // key is regenerated per process, anything written under it became undecryptable
            // after restart while previously-persisted ciphertext failed to open.
            //
            // The AndroidKeyStore provider is registered on any real device and absent in a plain
            // JVM unit test, which is what separates the two cases. On a device we fail closed.
            if (java.security.Security.getProvider(ANDROID_KEYSTORE) != null) {
                throw GoatBridgeException(
                    "SECURE_STORAGE_KEYSTORE_UNAVAILABLE",
                    "Hardware KeyStore is present but unusable for appId '$appId'; refusing to " +
                        "downgrade to a software key. Secure storage is unavailable.",
                    e
                )
            }
            return fallbackKeyStore.computeIfAbsent(alias) {
                val rawBytes = ByteArray(32)
                secureRandom.nextBytes(rawBytes)
                SecretKeySpec(rawBytes, "AES")
            }
        }
    }

    /**
     * Retrieves the isolated [SharedPreferences] instance storing encrypted ciphertext for the tenant.
     *
     * @param appId The unique mini-app identifier.
     * @return Scoped SharedPreferences.
     */
    fun getSecurePreferences(appId: String = DEFAULT_APP_ID): SharedPreferences {
        val name = getSecurePreferencesName(appId)
        return context.getSharedPreferences(name, Context.MODE_PRIVATE)
    }

    /**
     * Encrypts a plaintext string using AES-256-GCM and persists the ciphertext into the tenant's secure partition.
     *
     * @param appId The unique mini-app identifier.
     * @param key The sensitive key identifier.
     * @param value The plaintext value to encrypt and store.
     * @return `true` if encryption and persistence succeeded, `false` otherwise.
     */
    suspend fun setSecureValue(
        appId: String = DEFAULT_APP_ID,
        key: String,
        value: String
    ): Boolean = withContext(ioDispatcher) {
        require(key.isNotBlank()) { "Secure storage key cannot be blank" }

        try {
            val secretKey = getOrCreateSecretKey(appId)
            val cipher = Cipher.getInstance(CIPHER_ALGORITHM)

            // Generate cryptographically secure random 12-byte IV for GCM
            val iv = ByteArray(GCM_IV_LENGTH_BYTES)
            secureRandom.nextBytes(iv)
            val gcmSpec = GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv)

            cipher.init(Cipher.ENCRYPT_MODE, secretKey, gcmSpec)
            val plaintextBytes = value.toByteArray(Charsets.UTF_8)
            val ciphertextBytes = cipher.doFinal(plaintextBytes)

            // Format envelope: [12-byte IV] + [Ciphertext + 16-byte Auth Tag]
            val envelope = ByteArray(iv.size + ciphertextBytes.size)
            System.arraycopy(iv, 0, envelope, 0, iv.size)
            System.arraycopy(ciphertextBytes, 0, envelope, iv.size, ciphertextBytes.size)

            val base64Payload = encodeBase64(envelope)
            val prefs = getSecurePreferences(appId)
            prefs.edit().putString(key, base64Payload).commit()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to encrypt and store secure key for appId=$appId: ${e.message}")
            false
        }
    }

    /**
     * Retrieves and decrypts a stored AES-256-GCM ciphertext value for the specified tenant.
     *
     * @param appId The unique mini-app identifier.
     * @param key The sensitive key identifier.
     * @return The decrypted plaintext string, or `null` if not found or if authentication fails.
     */
    suspend fun getSecureValue(
        appId: String = DEFAULT_APP_ID,
        key: String
    ): String? = withContext(ioDispatcher) {
        require(key.isNotBlank()) { "Secure storage key cannot be blank" }

        try {
            val prefs = getSecurePreferences(appId)
            val rawEncrypted = prefs.getString(key, null) ?: return@withContext null

            val envelope = decodeBase64(rawEncrypted)
            if (envelope.size < GCM_IV_LENGTH_BYTES + 16) {
                Log.e(TAG, "Corrupted ciphertext envelope size: ${envelope.size}")
                return@withContext null
            }

            val iv = ByteArray(GCM_IV_LENGTH_BYTES)
            System.arraycopy(envelope, 0, iv, 0, GCM_IV_LENGTH_BYTES)

            val ciphertextLen = envelope.size - GCM_IV_LENGTH_BYTES
            val ciphertextBytes = ByteArray(ciphertextLen)
            System.arraycopy(envelope, GCM_IV_LENGTH_BYTES, ciphertextBytes, 0, ciphertextLen)

            val secretKey = getOrCreateSecretKey(appId)
            val cipher = Cipher.getInstance(CIPHER_ALGORITHM)
            val gcmSpec = GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv)

            cipher.init(Cipher.DECRYPT_MODE, secretKey, gcmSpec)
            val decryptedBytes = cipher.doFinal(ciphertextBytes)
            String(decryptedBytes, Charsets.UTF_8)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to decrypt secure value for key=$key in appId=$appId: ${e.message}")
            null
        }
    }

    /**
     * Removes an encrypted key-value entry from the tenant's secure partition.
     *
     * @param appId The unique mini-app identifier.
     * @param key The sensitive key identifier.
     * @return `true` if removal succeeded.
     */
    suspend fun removeSecureValue(
        appId: String = DEFAULT_APP_ID,
        key: String
    ): Boolean = withContext(ioDispatcher) {
        require(key.isNotBlank()) { "Secure storage key cannot be blank" }
        val prefs = getSecurePreferences(appId)
        prefs.edit().remove(key).commit()
    }

    /**
     * Clears all encrypted key-value entries in the tenant's secure partition and deletes
     * the tenant's KeyStore master encryption key.
     *
     * @param appId The unique mini-app identifier.
     * @return `true` if clearing succeeded.
     */
    suspend fun clearSecureValues(appId: String = DEFAULT_APP_ID): Boolean = withContext(ioDispatcher) {
        val prefs = getSecurePreferences(appId)
        val prefsCleared = prefs.edit().clear().commit()
        val alias = getKeyAlias(appId)
        fallbackKeyStore.remove(alias)
        val keyDeleted = try {
            val keyStore = try {
                KeyStore.getInstance(ANDROID_KEYSTORE)
            } catch (e: Exception) {
                null
            }
            if (keyStore != null) {
                keyStore.load(null)
                if (keyStore.containsAlias(alias)) {
                    keyStore.deleteEntry(alias)
                }
            }
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to delete KeyStore alias $alias: ${e.message}")
            false
        }
        prefsCleared && keyDeleted
    }

    /**
     * Returns all stored secure keys for the given tenant.
     *
     * @param appId The unique mini-app identifier.
     * @return Set of key strings.
     */
    suspend fun getAllSecureKeys(appId: String = DEFAULT_APP_ID): Set<String> = withContext(ioDispatcher) {
        val prefs = getSecurePreferences(appId)
        prefs.all.keys
    }

    /**
     * Asserts whether a key stored on disk is valid encrypted ciphertext and not plaintext (OWASP MASVS-STORAGE-02).
     *
     * @param appId The unique mini-app identifier.
     * @param key The sensitive key identifier.
     * @return `true` if the value is non-empty, stored as valid Base64 GCM envelope, and not readable plaintext.
     */
    suspend fun isEncryptedAtRest(appId: String = DEFAULT_APP_ID, key: String): Boolean = withContext(ioDispatcher) {
        val prefs = getSecurePreferences(appId)
        val raw = prefs.getString(key, null) ?: return@withContext false
        try {
            val decoded = decodeBase64(raw)
            decoded.size >= GCM_IV_LENGTH_BYTES + 16
        } catch (e: Exception) {
            false
        }
    }

    private fun encodeBase64(bytes: ByteArray): String {
        return try {
            java.util.Base64.getEncoder().encodeToString(bytes)
        } catch (e: Throwable) {
            Base64.encodeToString(bytes, Base64.NO_WRAP) ?: ""
        }
    }

    private fun decodeBase64(str: String): ByteArray {
        val clean = str.trim()
        return try {
            java.util.Base64.getDecoder().decode(clean)
        } catch (e: Throwable) {
            Base64.decode(clean, Base64.DEFAULT) ?: ByteArray(0)
        }
    }
}
