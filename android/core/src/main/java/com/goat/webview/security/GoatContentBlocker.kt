package com.goat.webview.security

import android.net.Uri
import android.util.Log
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream

/**
 * Declarative Content Blocker & Subresource Origin Allowlist Enforcer (Task 10205 / Pillar 1).
 *
 * Enforces native-layer defense-in-depth against off-origin subresource loading by blocking
 * any network request whose origin is not in the sandboxed virtual domain or explicitly
 * allowlisted in `manifest.json` `security.allowedDomains`.
 */
object GoatContentBlocker {
    private const val TAG = "GoatContentBlocker"

    private val STANDARD_ALLOWED_SCHEMES = setOf("blob", "data", "about", "goat")
    private val DEFAULT_ALLOWED_DOMAINS = setOf("appassets.androidplatform.net")

    /**
     * Evaluates whether a given URI is allowed to load as a subresource or navigation.
     *
     * @param uri The resource URI to check.
     * @param allowedDomains Custom allowlisted domain set from manifest.json.
     * @param tenantDomain The mini-app's scoped virtual domain (e.g. `app1.appassets.androidplatform.net`).
     * @return true if allowed, false if blocked.
     */
    fun isUriAllowed(
        uri: Uri,
        allowedDomains: Set<String> = emptySet(),
        tenantDomain: String = "appassets.androidplatform.net"
    ): Boolean {
        val scheme = uri.scheme?.lowercase() ?: return false
        if (scheme in STANDARD_ALLOWED_SCHEMES) {
            return true
        }
        if (scheme != "http" && scheme != "https") {
            return false
        }

        val host = uri.host?.lowercase() ?: return false

        // 1. Virtual domain check
        if (host == tenantDomain.lowercase() || host in DEFAULT_ALLOWED_DOMAINS) {
            return true
        }

        // 2. Exact match in manifest allowlist
        val normalizedAllowed = allowedDomains.map { it.lowercase().trim() }
        if (host in normalizedAllowed) {
            return true
        }

        // 3. Wildcard subdomain match (e.g. `*.api.example.com` or `.example.com`)
        for (pattern in normalizedAllowed) {
            if (pattern.startsWith("*.")) {
                val suffix = pattern.removePrefix("*.")
                if (host == suffix || host.endsWith(".$suffix")) {
                    return true
                }
            } else if (pattern.startsWith(".")) {
                val suffix = pattern.removePrefix(".")
                if (host == suffix || host.endsWith(".$suffix")) {
                    return true
                }
            }
        }

        Log.w(TAG, "Blocked unauthorized subresource request to non-allowlisted host: $host")
        return false
    }

    /**
     * Generates an HTTP 403 Forbidden [WebResourceResponse] to cleanly abort blocked requests.
     */
    fun createBlockedResponse(): WebResourceResponse {
        val emptyStream = ByteArrayInputStream(ByteArray(0))
        val headers = mapOf(
            "X-Goat-Blocked" to "Origin not in security.allowedDomains allowlist",
            "Cache-Control" to "no-store"
        )
        return WebResourceResponse(
            "text/plain",
            "UTF-8",
            403,
            "Forbidden",
            headers,
            emptyStream
        )
    }
}
