package com.goat.webview.storage

import android.content.Context
import android.content.SharedPreferences
import com.goat.webview.GoatStorageManager
import java.io.File
import java.util.UUID

/**
 * Account-Scoped Storage Sandbox & Anonymous Identity Provider (Task 10203 / Pillar 1).
 *
 * Implements:
 * 1. Account-scoped storage sandbox partitioning: Data partitioned by `{appId}/{accountId}`.
 * 2. Install-scoped anonymous GUID (`installGuid`): Stable identifier regenerated on fresh install.
 */
object GoatAccountScopedSandbox {
    private const val IDENTITY_PREFS = "goat_identity_sandbox"
    private const val KEY_INSTALL_GUID = "install_guid"
    private const val PREFS_PREFIX = "goat_storage_"
    private const val SECURE_PREFS_PREFIX = "goat_secure_storage_"
    private const val KEY_ALIAS_PREFIX = "goat_sec_key_"

    /**
     * Optional host-app supplied account identifier provider callback.
     * When set, storage is keyed by `{appId}_{accountId}` instead of just `{appId}`.
     */
    @Volatile
    var accountProvider: (() -> String?)? = null

    /**
     * Resolves the active account ID string, or null if no account is active.
     */
    fun getCurrentAccountId(): String? {
        return try {
            accountProvider?.invoke()?.trim()?.takeIf { it.isNotBlank() }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Resolves the standard storage preference name, accounting for any active account sandbox.
     */
    fun getScopedPreferencesName(appId: String): String {
        val sanitizedAppId = GoatStorageManager.sanitizeIdentifier(appId)
        val accountId = getCurrentAccountId()
        return if (accountId != null) {
            val sanitizedAccount = GoatStorageManager.sanitizeIdentifier(accountId)
            "${PREFS_PREFIX}${sanitizedAppId}_$sanitizedAccount"
        } else {
            "${PREFS_PREFIX}$sanitizedAppId"
        }
    }

    /**
     * Resolves the secure storage preference table name, accounting for any active account sandbox.
     */
    fun getScopedSecurePreferencesName(appId: String): String {
        val sanitizedAppId = GoatStorageManager.sanitizeIdentifier(appId)
        val accountId = getCurrentAccountId()
        return if (accountId != null) {
            val sanitizedAccount = GoatStorageManager.sanitizeIdentifier(accountId)
            "${SECURE_PREFS_PREFIX}${sanitizedAppId}_$sanitizedAccount"
        } else {
            "${SECURE_PREFS_PREFIX}$sanitizedAppId"
        }
    }

    /**
     * Resolves the Android KeyStore alias for tenant master key, accounting for any active account sandbox.
     */
    fun getScopedKeyAlias(appId: String): String {
        val sanitizedAppId = GoatStorageManager.sanitizeIdentifier(appId)
        val accountId = getCurrentAccountId()
        return if (accountId != null) {
            val sanitizedAccount = GoatStorageManager.sanitizeIdentifier(accountId)
            "${KEY_ALIAS_PREFIX}${sanitizedAppId}_$sanitizedAccount"
        } else {
            "${KEY_ALIAS_PREFIX}$sanitizedAppId"
        }
    }

    /**
     * Resolves the sandboxed data directory, accounting for any active account sandbox.
     */
    fun getScopedDataDirectory(filesDir: File, appId: String): File {
        val sanitizedAppId = GoatStorageManager.sanitizeIdentifier(appId)
        val accountId = getCurrentAccountId()
        val baseDir = if (sanitizedAppId == GoatStorageManager.DEFAULT_APP_ID) {
            File(filesDir, "miniapp_data")
        } else {
            File(File(filesDir, "miniapps"), sanitizedAppId)
        }

        return if (accountId != null) {
            val sanitizedAccount = GoatStorageManager.sanitizeIdentifier(accountId)
            File(File(baseDir, sanitizedAccount), "data")
        } else {
            File(baseDir, "data")
        }
    }

    /**
     * Returns the stable anonymous install GUID for the current device install.
     * Regenerates only upon application reinstall / storage data wipe.
     */
    fun getInstallGuid(context: Context): String {
        val prefs = context.getSharedPreferences(IDENTITY_PREFS, Context.MODE_PRIVATE)
        var guid = prefs.getString(KEY_INSTALL_GUID, null)
        if (guid.isNullOrBlank()) {
            synchronized(this) {
                guid = prefs.getString(KEY_INSTALL_GUID, null)
                if (guid.isNullOrBlank()) {
                    guid = UUID.randomUUID().toString()
                    prefs.edit().putString(KEY_INSTALL_GUID, guid).commit()
                }
            }
        }
        return guid!!
    }

    /**
     * For testing/audit purposes: forces regeneration of the install GUID.
     */
    fun resetInstallGuidForTest(context: Context): String {
        val prefs = context.getSharedPreferences(IDENTITY_PREFS, Context.MODE_PRIVATE)
        val guid = UUID.randomUUID().toString()
        prefs.edit().putString(KEY_INSTALL_GUID, guid).commit()
        return guid
    }
}
