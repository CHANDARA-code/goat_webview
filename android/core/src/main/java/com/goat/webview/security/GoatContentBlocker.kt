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
    ): Boolean = compile(allowedDomains, tenantDomain).isUriAllowed(uri)

    /**
     * An allowlist with its normalisation already done.
     *
     * [isUriAllowed] runs on **every subresource request** — scripts, images, CSS, XHR — so a
     * page with a few hundred resources calls it a few hundred times. Normalising the domain set
     * inside that call meant re-lowercasing every entry into a fresh list, and re-splitting every
     * wildcard pattern with `removePrefix`, on each one: a few thousand identical throwaway
     * strings per page load, all immediately garbage.
     *
     * The allowlist is fixed for a client's lifetime, so [compile] it once and keep it. This type
     * is immutable, so it is safe to share across the WebView's background request threads.
     */
    class CompiledAllowlist internal constructor(
        /** Every normalised pattern, wildcards included, matched literally first — preserves the
         *  original behaviour where a raw pattern string could itself equal the host. */
        private val literals: Set<String>,
        /** Suffixes from `*.example.com` / `.example.com`, pre-stripped. */
        private val suffixes: List<String>,
        /** The same suffixes with the leading dot already attached. Built once at compile time
         *  because the match below runs for every subresource request: composing ".$suffix" in
         *  the loop allocated one String per suffix per request. */
        private val dottedSuffixes: List<String>,
        private val tenantDomain: String
    ) {
        fun isUriAllowed(uri: Uri): Boolean {
            val scheme = uri.scheme ?: return false
            if (scheme.equals("https", ignoreCase = true) || scheme.equals("http", ignoreCase = true)) {
                val host = uri.host ?: return false

                // 1. Virtual domain check (fast path: matches tenant or default domain directly without allocation)
                if (host.equals(tenantDomain, ignoreCase = true) || host.equals("appassets.androidplatform.net", ignoreCase = true)) {
                    return true
                }

                val lowerHost = host.lowercase()

                // 2. Exact match in manifest allowlist
                if (lowerHost in literals) {
                    return true
                }

                // 3. Wildcard subdomain match (e.g. `*.api.example.com` or `.example.com`)
                for (i in suffixes.indices) {
                    if (lowerHost == suffixes[i] || lowerHost.endsWith(dottedSuffixes[i])) {
                        return true
                    }
                }

                Log.w(TAG, "Blocked unauthorized subresource request to non-allowlisted host: $lowerHost")
                return false
            }

            // Non-http/https schemes (blob, data, about, goat)
            return STANDARD_ALLOWED_SCHEMES.any { it.equals(scheme, ignoreCase = true) }
        }
    }

    /** Normalises [allowedDomains] and [tenantDomain] once for repeated [CompiledAllowlist.isUriAllowed] calls. */
    fun compile(
        allowedDomains: Set<String> = emptySet(),
        tenantDomain: String = "appassets.androidplatform.net"
    ): CompiledAllowlist {
        val normalized = allowedDomains.mapTo(LinkedHashSet()) { it.lowercase().trim() }
        val suffixes = ArrayList<String>(normalized.size)
        for (pattern in normalized) {
            when {
                pattern.startsWith("*.") -> suffixes.add(pattern.removePrefix("*."))
                pattern.startsWith(".") -> suffixes.add(pattern.removePrefix("."))
            }
        }
        val dotted = suffixes.mapTo(ArrayList(suffixes.size)) { ".$it" }
        return CompiledAllowlist(normalized, suffixes, dotted, tenantDomain.lowercase())
    }

    private val EMPTY_BYTES = ByteArray(0)
    private val BLOCKED_HEADERS = mapOf(
        "X-Goat-Blocked" to "Origin not in security.allowedDomains allowlist",
        "Cache-Control" to "no-store"
    )

    /**
     * Generates an HTTP 403 Forbidden [WebResourceResponse] to cleanly abort blocked requests.
     */
    fun createBlockedResponse(): WebResourceResponse {
        return WebResourceResponse(
            "text/plain",
            "UTF-8",
            403,
            "Forbidden",
            BLOCKED_HEADERS,
            ByteArrayInputStream(EMPTY_BYTES)
        )
    }
}
