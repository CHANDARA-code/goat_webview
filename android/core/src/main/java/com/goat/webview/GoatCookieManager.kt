package com.goat.webview

import android.os.Build
import android.util.Log
import android.webkit.CookieManager
import android.webkit.ValueCallback
import androidx.webkit.CookieManagerCompat
import androidx.webkit.Profile
import androidx.webkit.ProfileStore
import androidx.webkit.WebViewFeature
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.ConcurrentHashMap
import kotlin.coroutines.resume

/**
 * Data model representing an RFC 6265 HTTP cookie.
 */
data class GoatCookie(
    val name: String,
    val value: String,
    val domain: String? = null,
    val path: String = "/",
    val expiresDate: Long? = null,
    val maxAge: Long? = null,
    val isSecure: Boolean = true,
    val isHttpOnly: Boolean = false,
    val sameSite: String? = "Lax",
    val isSessionOnly: Boolean = false
)

/**
 * Enterprise Cookie Manager providing granular, per-tenant cookie partitioning and lifecycle management.
 */
object GoatCookieManager {
    private const val TAG = "GoatCookieManager"

    private val gmtTimeZone = TimeZone.getTimeZone("GMT")
    private val rfc1123ThreadLocal = ThreadLocal.withInitial {
        SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss z", Locale.US).apply {
            timeZone = gmtTimeZone
        }
    }
    private val rfc1123DateFormat: SimpleDateFormat
        get() = rfc1123ThreadLocal.get() ?: SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss z", Locale.US).apply {
            timeZone = gmtTimeZone
        }

    const val PROFILE_PREFIX = "goat_tenant_"

    @Volatile
    var coroutineDispatcher: kotlinx.coroutines.CoroutineDispatcher = Dispatchers.IO

    @Volatile
    var mockCookieManager: CookieManager? = null

    @Volatile
    var mockProfileStore: ProfileStore? = null

    // Tenant-isolated in-memory fallback for JVM Unit Test environments:
    // profileName -> (domainKey -> (cookieName -> GoatCookie))
    private val tenantInMemoryCookies =
        ConcurrentHashMap<String, ConcurrentHashMap<String, ConcurrentHashMap<String, GoatCookie>>>()

    // Global in-memory fallback for legacy default profile
    private val inMemoryCookies = ConcurrentHashMap<String, ConcurrentHashMap<String, GoatCookie>>()

    /**
     * Resolves the profile name for a given mini-app tenant.
     */
    fun getProfileName(appId: String?): String {
        if (appId.isNullOrBlank() || appId == GoatAssetManager.DEFAULT_APP_ID || appId == "default") {
            return Profile.DEFAULT_PROFILE_NAME
        }
        val safeAppId = appId.replace(Regex("[^a-zA-Z0-9]"), "_").trim('_')
        return if (safeAppId.isBlank() || safeAppId.equals("default", ignoreCase = true)) {
            Profile.DEFAULT_PROFILE_NAME
        } else {
            val truncated = if (safeAppId.length > 50) safeAppId.substring(0, 50) else safeAppId
            "$PROFILE_PREFIX$truncated"
        }
    }

    /**
     * Retrieves or allocates the dedicated AndroidX Profile for a given tenant appId.
     */
    fun getProfileForAppId(appId: String): Profile? {
        mockProfileStore?.let {
            return it.getOrCreateProfile(getProfileName(appId))
        }
        try {
            if (!WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE)) {
                return null
            }
            val profileName = getProfileName(appId)
            return ProfileStore.getInstance().getOrCreateProfile(profileName)
        } catch (e: Throwable) {
            Log.e(TAG, "Failed to get/create profile for '$appId'", e)
            return null
        }
    }

    /**
     * Retrieves the CookieManager for a specific tenant, respecting MULTI_PROFILE when supported.
     */
    fun getCookieManagerForTenant(appId: String? = null): CookieManager? {
        if (!appId.isNullOrBlank() && appId != GoatAssetManager.DEFAULT_APP_ID && appId != "default") {
            try {
                if (mockProfileStore != null || WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE)) {
                    val profile = getProfileForAppId(appId)
                    if (profile != null) {
                        return try {
                            profile.cookieManager
                        } catch (e: Throwable) {
                            null
                        }
                    }
                }
            } catch (e: Throwable) {
                // MULTI_PROFILE not supported
            }
            // Multi-profile is unsupported on this runtime for this tenant.
            // Return null so callers fall back to tenant-isolated in-memory storage.
            return null
        }
        return mockCookieManager ?: getSystemCookieManager()
    }

    /**
     * Safely retrieves the system CookieManager instance with exception guards.
     */
    fun getSystemCookieManager(): CookieManager? {
        mockCookieManager?.let { return it }
        return try {
            CookieManager.getInstance()
        } catch (e: Throwable) {
            null
        }
    }

    /**
     * Resolves the virtual origin URL for a given mini-app tenant.
     */
    fun getTenantOrigin(appId: String): String {
        val domain = GoatWebViewClient.resolveDomain(appId)
        return "https://$domain/"
    }

    /**
     * Resolves the virtual domain for a given mini-app tenant.
     */
    fun getTenantDomain(appId: String): String {
        return GoatWebViewClient.resolveDomain(appId)
    }

    /**
     * Formats a [GoatCookie] into an RFC 6265 Set-Cookie header string.
     */
    fun formatCookieString(cookie: GoatCookie): String {
        val builder = StringBuilder("${cookie.name}=${cookie.value}; Path=${cookie.path}")

        if (!cookie.domain.isNullOrBlank()) {
            builder.append("; Domain=").append(cookie.domain)
        }
        if (cookie.expiresDate != null) {
            builder.append("; Expires=").append(rfc1123DateFormat.format(Date(cookie.expiresDate)))
        }
        if (cookie.maxAge != null) {
            builder.append("; Max-Age=").append(cookie.maxAge)
        }
        if (cookie.isSecure) {
            builder.append("; Secure")
        }
        if (cookie.isHttpOnly) {
            builder.append("; HttpOnly")
        }
        if (!cookie.sameSite.isNullOrBlank()) {
            builder.append("; SameSite=").append(cookie.sameSite)
        }
        builder.append(";")
        return builder.toString()
    }

    /**
     * Sets a cookie on the specified URL with tenant scoping.
     */
    // Dispatchers.Main, not coroutineDispatcher (IO): android.webkit.CookieManager's write methods
    // (setCookie/removeSessionCookies/removeAllCookies) throw IllegalStateException off a thread
    // without a Looper - IO-pool threads don't have one, so every mutation silently failed.
    @JvmOverloads
    suspend fun setCookie(url: String, cookie: GoatCookie, appId: String? = null): Boolean = withContext(Dispatchers.Main) {
        val manager = getCookieManagerForTenant(appId)
        if (manager == null) {
            val profileKey = getProfileName(appId)
            val uriHost = try { java.net.URI(url).host } catch (_: Throwable) { null }
            val domainKey = cookie.domain ?: uriHost ?: getTenantDomain(appId ?: "default")
            tenantInMemoryCookies
                .computeIfAbsent(profileKey) { ConcurrentHashMap() }
                .computeIfAbsent(domainKey) { ConcurrentHashMap() }[cookie.name] = cookie

            if (profileKey == Profile.DEFAULT_PROFILE_NAME || appId == null) {
                inMemoryCookies.computeIfAbsent(domainKey) { ConcurrentHashMap() }[cookie.name] = cookie
            }
            return@withContext true
        }

        val cookieValue = formatCookieString(cookie)
        suspendCancellableCoroutine { continuation ->
            try {
                manager.setCookie(url, cookieValue) { success ->
                    if (continuation.isActive) {
                        continuation.resume(success)
                    }
                }
                manager.flush()
            } catch (e: Exception) {
                Log.e(TAG, "Error setting cookie for $url", e)
                if (continuation.isActive) {
                    continuation.resume(false)
                }
            }
        }
    }

    /**
     * Convenience method to set a cookie with explicit parameters.
     */
    @JvmOverloads
    suspend fun setCookie(
        url: String,
        name: String,
        value: String,
        domain: String? = null,
        path: String = "/",
        expiresDate: Long? = null,
        maxAge: Long? = null,
        isSecure: Boolean = true,
        isHttpOnly: Boolean = false,
        sameSite: String? = "Lax",
        appId: String? = null
    ): Boolean {
        val cookie = GoatCookie(
            name = name,
            value = value,
            domain = domain,
            path = path,
            expiresDate = expiresDate,
            maxAge = maxAge,
            isSecure = isSecure,
            isHttpOnly = isHttpOnly,
            sameSite = sameSite
        )
        return setCookie(url, cookie, appId = appId)
    }

    /**
     * Sets a cookie scoped directly to a specific mini-app tenant.
     */
    @JvmOverloads
    suspend fun setCookieForTenant(
        appId: String,
        name: String,
        value: String,
        domain: String? = null,
        path: String = "/",
        expiresDate: Long? = null,
        maxAge: Long? = null,
        isSecure: Boolean = true,
        isHttpOnly: Boolean = false,
        sameSite: String? = "Lax"
    ): Boolean {
        val origin = getTenantOrigin(appId)
        val targetDomain = domain ?: getTenantDomain(appId)
        val cookie = GoatCookie(
            name = name,
            value = value,
            domain = targetDomain,
            path = path,
            expiresDate = expiresDate,
            maxAge = maxAge,
            isSecure = isSecure,
            isHttpOnly = isHttpOnly,
            sameSite = sameSite
        )
        return setCookie(origin, cookie, appId = appId)
    }

    /**
     * Retrieves all parsed cookies for a given URL, optionally scoped to a tenant profile.
     */
    @JvmOverloads
    fun getCookies(url: String, appId: String? = null): List<GoatCookie> {
        val manager = getCookieManagerForTenant(appId)
        if (manager == null) {
            val uriHost = try { java.net.URI(url).host } catch (_: Throwable) { null }
            if (appId != null) {
                val profileKey = getProfileName(appId)
                val profileCookies = tenantInMemoryCookies[profileKey] ?: return emptyList()
                return if (uriHost != null && profileCookies.containsKey(uriHost)) {
                    profileCookies[uriHost]?.values?.toList() ?: emptyList()
                } else if (uriHost != null) {
                    emptyList()
                } else {
                    profileCookies.values.flatMap { it.values }.toList()
                }
            } else {
                if (uriHost != null && uriHost.endsWith(".appassets.androidplatform.net")) {
                    val subdomain = uriHost.substringBefore(".appassets.androidplatform.net")
                    if (subdomain != "appassets" && subdomain.isNotBlank()) {
                        val profileKey = getProfileName(subdomain)
                        val profileCookies = tenantInMemoryCookies[profileKey]
                        if (profileCookies != null) {
                            return profileCookies[uriHost]?.values?.toList()
                                ?: profileCookies.values.flatMap { it.values }.toList()
                        }
                    }
                }
                val defaultCookies = tenantInMemoryCookies[Profile.DEFAULT_PROFILE_NAME]
                if (defaultCookies != null && uriHost != null && defaultCookies.containsKey(uriHost)) {
                    return defaultCookies[uriHost]?.values?.toList() ?: emptyList()
                }
                if (uriHost != null && inMemoryCookies.containsKey(uriHost)) {
                    return inMemoryCookies[uriHost]?.values?.toList() ?: emptyList()
                }
                return inMemoryCookies.values.flatMap { it.values }.toList()
            }
        }

        val cookieList = mutableListOf<GoatCookie>()
        try {
            val rawCookies: List<String> = try {
                if (WebViewFeature.isFeatureSupported(WebViewFeature.GET_COOKIE_INFO)) {
                    CookieManagerCompat.getCookieInfo(manager, url)
                } else {
                    null
                }
            } catch (e: Throwable) {
                null
            } ?: run {
                val cookieString = manager.getCookie(url)
                if (cookieString.isNullOrBlank()) emptyList() else cookieString.split(";")
            }

            for (cookieEntry in rawCookies) {
                val parts = cookieEntry.split(";")
                if (parts.isEmpty()) continue

                val mainPair = parts[0].split("=", limit = 2)
                val name = mainPair[0].trim()
                if (name.isEmpty()) continue
                val value = if (mainPair.size > 1) mainPair[1].trim() else ""

                var path = "/"
                var domain: String? = null
                var expiresDate: Long? = null
                var maxAge: Long? = null
                var isSecure = false
                var isHttpOnly = false
                var sameSite: String? = null

                for (i in 1 until parts.size) {
                    val attr = parts[i].split("=", limit = 2)
                    val attrName = attr[0].trim().lowercase()
                    val attrValue = if (attr.size > 1) attr[1].trim() else ""

                    when (attrName) {
                        "path" -> path = attrValue
                        "domain" -> domain = attrValue
                        "secure" -> isSecure = true
                        "httponly" -> isHttpOnly = true
                        "samesite" -> sameSite = attrValue
                        "max-age" -> {
                            maxAge = attrValue.toLongOrNull()
                            if (maxAge != null) {
                                expiresDate = System.currentTimeMillis() + (maxAge * 1000)
                            }
                        }
                        "expires" -> {
                            try {
                                val parsed = rfc1123DateFormat.parse(attrValue)
                                if (parsed != null) expiresDate = parsed.time
                            } catch (e: Exception) {
                                // Ignore unparseable date
                            }
                        }
                    }
                }

                cookieList.add(
                    GoatCookie(
                        name = name,
                        value = value,
                        domain = domain,
                        path = path,
                        expiresDate = expiresDate,
                        maxAge = maxAge,
                        isSecure = isSecure,
                        isHttpOnly = isHttpOnly,
                        sameSite = sameSite
                    )
                )
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed reading cookies for $url", e)
        }

        return cookieList
    }

    /**
     * Retrieves all cookies scoped to a specific mini-app tenant.
     */
    @JvmOverloads
    fun getCookiesForTenant(appId: String, url: String? = null): List<GoatCookie> {
        val origin = url ?: getTenantOrigin(appId)
        return getCookies(origin, appId = appId)
    }

    /**
     * Retrieves raw cookie header string for a URL.
     */
    @JvmOverloads
    fun getCookieHeader(url: String, appId: String? = null): String? {
        val manager = getCookieManagerForTenant(appId)
        if (manager == null) {
            val cookies = getCookies(url, appId = appId)
            return if (cookies.isEmpty()) null else cookies.joinToString("; ") { "${it.name}=${it.value}" }
        }
        return try {
            manager.getCookie(url)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting raw cookie string for $url", e)
            null
        }
    }

    /**
     * Deletes a single cookie by name and path on a URL.
     */
    @JvmOverloads
    suspend fun deleteCookie(
        url: String,
        name: String,
        domain: String? = null,
        path: String = "/",
        appId: String? = null
    ): Boolean = withContext(Dispatchers.Main) {
        val manager = getCookieManagerForTenant(appId)
        if (manager == null) {
            val profileKey = getProfileName(appId)
            val profileCookies = tenantInMemoryCookies[profileKey]
            val uriHost = try { java.net.URI(url).host } catch (_: Throwable) { null }
            val targetDomain = domain ?: uriHost
            if (targetDomain != null && profileCookies != null) {
                profileCookies[targetDomain]?.remove(name)
            } else {
                profileCookies?.values?.forEach { it.remove(name) }
            }
            if (targetDomain != null) {
                inMemoryCookies[targetDomain]?.remove(name)
            } else {
                inMemoryCookies.values.forEach { it.remove(name) }
            }
            return@withContext true
        }
        // isSecure defaults to true on GoatCookie, but Chromium silently refuses to set a
        // `Secure` cookie on a plain http:// origin — which would make this expiry a no-op for
        // any http:// url. Deletion doesn't depend on the Secure attribute matching, so turn it
        // off here regardless of the original cookie's flags. Max-Age=0 (not a negative value)
        // is the form Chromium's cookie parser reliably treats as "expire immediately".
        val expiredCookie = GoatCookie(
            name = name,
            value = "",
            domain = domain,
            path = path,
            maxAge = 0,
            expiresDate = 0L,
            isSecure = false
        )
        setCookie(url, expiredCookie, appId = appId)
    }

    /**
     * Deletes a cookie scoped to a specific mini-app tenant.
     */
    suspend fun deleteCookieForTenant(appId: String, name: String, path: String = "/"): Boolean {
        val origin = getTenantOrigin(appId)
        val domain = getTenantDomain(appId)
        return deleteCookie(origin, name, domain, path, appId = appId)
    }

    /**
     * Clears all cookies associated with a specific mini-app tenant.
     */
    suspend fun clearTenantCookies(appId: String): Boolean = withContext(Dispatchers.Main) {
        val origin = getTenantOrigin(appId)
        val domain = getTenantDomain(appId)
        val profileKey = getProfileName(appId)

        tenantInMemoryCookies.remove(profileKey)
        inMemoryCookies.remove(domain)
        if (profileKey == Profile.DEFAULT_PROFILE_NAME) {
            inMemoryCookies.remove(getTenantDomain("default"))
        }

        try {
            if (mockProfileStore != null || WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE)) {
                val manager = getCookieManagerForTenant(appId)
                if (manager != null) {
                    return@withContext suspendCancellableCoroutine { continuation ->
                        try {
                            manager.removeAllCookies { success ->
                                manager.flush()
                                if (continuation.isActive) continuation.resume(success)
                            }
                        } catch (e: Exception) {
                            if (continuation.isActive) continuation.resume(false)
                        }
                    }
                }
            }
        } catch (_: Throwable) {
            // MULTI_PROFILE not supported
        }

        if (getSystemCookieManager() == null) {
            return@withContext true
        }

        val cookies = getCookies(origin, appId = appId)
        var allCleared = true

        for (cookie in cookies) {
            val cleared = deleteCookie(origin, cookie.name, domain, cookie.path, appId = appId)
            if (!cleared) allCleared = false
        }
        flush()
        allCleared
    }

    /**
     * Purges all in-memory tenant and default cookie caches synchronously.
     */
    fun purgeAllInMemoryCookies() {
        tenantInMemoryCookies.clear()
        inMemoryCookies.clear()
    }

    /**
     * Purges all cookies in the system CookieManager.
     */
    suspend fun clearAllCookies(): Boolean = withContext(Dispatchers.Main) {
        purgeAllInMemoryCookies()
        val manager = getSystemCookieManager() ?: return@withContext true
        suspendCancellableCoroutine { continuation ->
            try {
                manager.removeAllCookies { success ->
                    manager.flush()
                    if (continuation.isActive) {
                        continuation.resume(success)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error in clearAllCookies", e)
                if (continuation.isActive) {
                    continuation.resume(false)
                }
            }
        }
    }

    /**
     * Removes session-only cookies.
     */
    suspend fun removeSessionCookies(): Boolean = withContext(Dispatchers.Main) {
        val manager = getSystemCookieManager() ?: return@withContext true
        suspendCancellableCoroutine { continuation ->
            try {
                manager.removeSessionCookies { success ->
                    manager.flush()
                    if (continuation.isActive) {
                        continuation.resume(success)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error in removeSessionCookies", e)
                if (continuation.isActive) {
                    continuation.resume(false)
                }
            }
        }
    }

    /**
     * Flushes pending cookie writes to persistent storage.
     */
    fun flush() {
        try {
            getSystemCookieManager()?.flush()
        } catch (e: Exception) {
            Log.e(TAG, "Error flushing CookieManager", e)
        }
    }
}
