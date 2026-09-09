package com.goat.webview.debug

import android.util.Log
import androidx.webkit.ProxyConfig
import androidx.webkit.ProxyController
import androidx.webkit.WebViewFeature
import java.util.concurrent.Executor

/**
 * Debug-only HTTP(S) proxy override for QA and staging interception (Task 10186).
 *
 * This file lives in `src/debug/`, so it is compiled into the debug variant only and is absent
 * from the release AAR by construction rather than by relying on R8 to strip it. That is the
 * difference between "shrunk out if nothing references it" and "cannot be linked at all".
 *
 * Deliberately not reachable from the bridge: there is no action name bound to any method here, so
 * mini-app JS can neither read nor set the proxy. Configuration is host-app/QA tooling only.
 */
object GoatProxyController {

    private const val TAG = "GoatProxyController"

    @Volatile
    private var appliedOverride: String? = null

    /** The proxy currently installed as "host:port", or null when none is active. */
    val activeOverride: String?
        get() = appliedOverride

    fun isSupported(): Boolean =
        WebViewFeature.isFeatureSupported(WebViewFeature.PROXY_OVERRIDE)

    /**
     * Routes WebView traffic through [host]:[port] for this debug session.
     *
     * Loopback is bypassed so a proxy running on the host machine does not try to route its own
     * traffic back through itself.
     *
     * @return true when the override was handed to the WebView networking layer.
     */
    fun setProxyOverride(
        host: String,
        port: Int,
        executor: Executor = Executor { it.run() },
        onApplied: () -> Unit = {}
    ): Boolean {
        val trimmedHost = host.trim()
        if (trimmedHost.isEmpty()) {
            Log.w(TAG, "Ignoring proxy override with a blank host")
            return false
        }
        if (port !in 1..65535) {
            Log.w(TAG, "Ignoring proxy override with out-of-range port $port")
            return false
        }
        if (!isSupported()) {
            Log.w(TAG, "PROXY_OVERRIDE is unsupported on this WebView; override not applied")
            return false
        }
        return try {
            val config = ProxyConfig.Builder()
                .addProxyRule("$trimmedHost:$port")
                .addDirect()
                .bypassSimpleHostnames()
                .build()
            ProxyController.getInstance().setProxyOverride(config, executor) {
                appliedOverride = "$trimmedHost:$port"
                onApplied()
            }
            true
        } catch (e: Throwable) {
            Log.e(TAG, "Failed to install proxy override", e)
            false
        }
    }

    /** Restores normal networking. */
    fun clearProxyOverride(
        executor: Executor = Executor { it.run() },
        onCleared: () -> Unit = {}
    ): Boolean {
        if (!isSupported()) return false
        return try {
            ProxyController.getInstance().clearProxyOverride(executor) {
                appliedOverride = null
                onCleared()
            }
            true
        } catch (e: Throwable) {
            Log.e(TAG, "Failed to clear proxy override", e)
            false
        }
    }
}
