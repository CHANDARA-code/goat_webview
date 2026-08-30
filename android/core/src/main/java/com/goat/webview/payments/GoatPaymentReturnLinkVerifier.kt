package com.goat.webview.payments

import android.net.Uri

/**
 * App2App Deep-Link Protection (Task 10206 / §7 L5, threat A3).
 *
 * Alipay/PayPay app2app return navigation MUST arrive via a verified HTTPS Universal Link /
 * Android App Link (`https://domain.com/payment/return`) whose domain is explicitly allowlisted
 * by the host — a legacy unverified custom scheme (`goat://`, `alipays://`, or any non-HTTPS
 * scheme claiming to be a payment return) is never trusted, even if it otherwise looks
 * well-formed. This mirrors the OS-level guarantee that an `https://` intent-filter with
 * `autoVerify="true"` only reaches the app once Android has verified the domain's
 * `assetlinks.json` — the allowlist check here is the app-level half of that contract.
 */
object GoatPaymentReturnLinkVerifier {
    fun extractQueryParam(uri: Uri, paramName: String): String? {
        try {
            val qp = uri.getQueryParameter(paramName)
            if (!qp.isNullOrEmpty()) return qp
        } catch (_: Throwable) {}

        val urlStr = uri.toString()
        val queryIdx = urlStr.indexOf('?')
        if (queryIdx != -1 && queryIdx < urlStr.length - 1) {
            val query = urlStr.substring(queryIdx + 1)
            for (pair in query.split("&")) {
                val eq = pair.indexOf('=')
                val key = if (eq != -1) pair.substring(0, eq) else pair
                if (key == paramName && eq != -1 && eq < pair.length - 1) {
                    return pair.substring(eq + 1)
                }
            }
        }
        return null
    }

    fun isValidReturnUrl(uri: Uri, allowedReturnDomains: Set<String>): Boolean {
        if (allowedReturnDomains.isEmpty()) return false

        val rawStr = uri.toString()
        val scheme = try {
            uri.scheme?.lowercase()
        } catch (_: Throwable) { null } ?: run {
            val colon = rawStr.indexOf("://")
            if (colon != -1) rawStr.substring(0, colon).lowercase() else null
        }
        if (scheme != "https") return false

        val host = try {
            uri.host?.lowercase()
        } catch (_: Throwable) { null } ?: run {
            val colon = rawStr.indexOf("://")
            if (colon != -1) {
                val afterScheme = rawStr.substring(colon + 3)
                val slash = afterScheme.indexOfAny(charArrayOf('/', '?', '#', ':'))
                val hostPort = if (slash != -1) afterScheme.substring(0, slash) else afterScheme
                val at = hostPort.lastIndexOf('@')
                val clean = if (at != -1) hostPort.substring(at + 1) else hostPort
                clean.lowercase().ifEmpty { null }
            } else null
        } ?: return false

        return allowedReturnDomains.any { rawPattern ->
            val pattern = rawPattern.lowercase().trim()
            if (pattern.startsWith("*.")) {
                val suffix = pattern.removePrefix("*.")
                host == suffix || host.endsWith(".$suffix")
            } else {
                host == pattern
            }
        }
    }
}
