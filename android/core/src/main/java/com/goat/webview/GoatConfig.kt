package com.goat.webview

import com.goat.webview.storage.GoatAccountScopedSandbox

/**
 * Public host-application configuration interface for the Goat WebView engine (Task 10203).
 *
 * Provides hooks for host applications to configure engine-wide behaviors such as
 * active account identification, debugging endpoints, and engine defaults.
 */
object GoatConfig {

    /**
     * Host-app supplied account identifier provider callback.
     *
     * When configured and returning a non-blank account ID (e.g. "user_12345"),
     * both standard storage (SharedPreferences, sandboxed filesystem) and secure
     * encrypted storage (Android KeyStore, encrypted preferences) are partitioned
     * under `{appId}/{accountId}`.
     *
     * When unconfigured or returning null/blank, storage seamlessly falls back to
     * legacy `{appId}` sandboxing, guaranteeing 100% backward compatibility.
     *
     * Example (Kotlin):
     * ```kotlin
     * GoatConfig.accountProvider = { userSessionManager.currentUserId }
     * ```
     *
     * Example (Java):
     * ```java
     * GoatConfig.setAccountProvider(() -> userSessionManager.getCurrentUserId());
     * ```
     */
    @JvmStatic
    var accountProvider: (() -> String?)?
        get() = GoatAccountScopedSandbox.accountProvider
        set(value) {
            GoatAccountScopedSandbox.accountProvider = value
        }

    /**
     * Optional remote dev server debug URL for local development and HMR.
     * Example: "http://10.0.2.2:5173" (Android Emulator) or "http://localhost:5173".
     */
    @Volatile
    @JvmStatic
    var debugUrl: String? = null

    /**
     * Hosts to DNS-resolve and TCP pre-connect during app startup (instant-startup prewarm).
     * Hosts should be declared here, e.g. GoatConfig.preconnectHosts = listOf("api.example.com").
     */
    @Volatile
    @JvmStatic
    var preconnectHosts: List<String> = emptyList()

    /**
     * Resets all configuration hooks to defaults (useful during testing and teardown).
     */
    @JvmStatic
    fun reset() {
        accountProvider = null
        debugUrl = null
        preconnectHosts = emptyList()
    }
}
