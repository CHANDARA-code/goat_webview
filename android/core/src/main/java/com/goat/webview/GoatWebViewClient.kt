package com.goat.webview

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.util.Log
import android.net.http.SslError
import android.webkit.HttpAuthHandler
import android.webkit.RenderProcessGoneDetail
import android.webkit.SslErrorHandler
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.MimeTypeMap
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import com.goat.webview.auth.GoatHttpAuthManager
import com.goat.webview.cache.ByteRangeResult
import com.goat.webview.cache.GoatAssetByteCache
import com.goat.webview.security.GoatContentBlocker
import com.goat.webview.ui.GoatExternalLinkWarningDialog
import java.io.ByteArrayInputStream
import java.io.File
import java.net.URISyntaxException
import kotlinx.coroutines.runBlocking

/**
 * Custom WebViewClient using AndroidX WebViewAssetLoader to map internal storage files
 * to dynamic virtual domain `https://${domain}/assets/`.
 */
open class GoatWebViewClient(
    private val context: Context,
    /** Extracted mini-app bundle dir served under the virtual `/assets/` domain. `null` when the
     *  view is loading a plain URL (mini-app-by-URL / performance fast path) — no asset loader is
     *  built and per-request interception is skipped entirely. */
    private val extractedDir: File?,
    val appId: String = GoatAssetManager.DEFAULT_APP_ID,
    val onPageStarted: (() -> Unit)? = null,
    val onPageLoaded: (() -> Unit)? = null,
    val onRenderCrashed: ((didCrash: Boolean) -> Unit)? = null,
    private val httpAuthManager: GoatHttpAuthManager? = null,
    private val manifestDomainAllowlist: Set<String>? = null,
    private val launchHashSecretKey: ByteArray? = null,
    private val onLaunchHashRejected: ((String) -> Unit)? = null,
    /** T7 compat: see [com.goat.webview.view.GoatView.compatExternalSchemeResolver]. */
    private val compatExternalSchemeResolver: Boolean = false,
    private val compatExternalLinkHosts: Set<String> = DEFAULT_COMPAT_EXTERNAL_LINK_HOSTS,
    private val onExternalNavigation: ((url: String) -> Unit)? = null,
    /** T8 compat: each fires only when the matching `on*Compat` callback is non-null (G7) —
     *  no marshalling, no extra work, when the embedder didn't ask for that event. */
    private val onReceivedErrorCompat: ((url: String, errorCode: Int, description: String) -> Unit)? = null,
    private val onReceivedHttpErrorCompat: ((url: String, statusCode: Int) -> Unit)? = null,
    private val onPageCommitVisibleCompat: ((url: String) -> Unit)? = null,
    private val onLoadResourceCompat: ((url: String) -> Unit)? = null,
    private val onUpdateVisitedHistoryCompat: ((url: String, isReload: Boolean) -> Unit)? = null,
    private val assetByteCache: GoatAssetByteCache? = null,
    var onRehydrationHandler: ((didCrash: Boolean) -> Unit)? = null
) : WebViewClient() {

    val byteCache: GoatAssetByteCache by lazy { assetByteCache ?: GoatAssetByteCache.getInstance(context) }
    val domain: String = resolveDomain(appId)
    val origin: String = "https://$domain"
    val entryUrl: String = "$origin/assets/index.html"

    companion object {
        private const val TAG = "GoatWebViewClient"
        const val DEFAULT_DOMAIN = "appassets.androidplatform.net"
        const val VIRTUAL_DOMAIN = "appassets.androidplatform.net"
        const val ASSETS_PATH = "/assets/"

        val DEFAULT_COMPAT_EXTERNAL_LINK_HOSTS: Set<String> = setOf("t.me")
        val SYSTEM_SCHEMES: Set<String> = setOf("tel", "mailto", "sms", "geo")

        /** T7 compat: app-deep-link schemes resolved silently when
         *  [compatExternalSchemeResolver] is on, beyond the always-on tel/mailto/sms/geo set. */
        val COMPAT_DEEP_LINK_SCHEMES = setOf("tg", "fb", "whatsapp", "comgooglemaps")

        /**
         * Resolves the virtual domain for a given mini-app tenant.
         * Default/empty tenants resolve to "appassets.androidplatform.net".
         * Explicit tenants resolve to "${sanitizedAppId}.appassets.androidplatform.net".
         */
        fun resolveDomain(appId: String?): String {
            if (appId.isNullOrBlank() || appId == GoatAssetManager.DEFAULT_APP_ID || appId == "default") {
                return DEFAULT_DOMAIN
            }
            val sanitized = try {
                GoatStorageManager.sanitizeIdentifier(appId)
            } catch (e: Exception) {
                ""
            }
            return if (sanitized.isBlank() || sanitized == GoatAssetManager.DEFAULT_APP_ID || sanitized == "default") {
                DEFAULT_DOMAIN
            } else {
                "$sanitized.appassets.androidplatform.net"
            }
        }
    }

    /** Whether this client serves a packaged bundle (vs. a plain URL fast path). */
    /**
     * The manifest allowlist, normalised once. Null when no allowlist is configured, so the
     * per-request path stays a single null check.
     */
    /**
     * [compatExternalLinkHosts] normalised once.
     *
     * Hosts are compared against `uri.host?.lowercase()`, but the set arrives straight from the
     * embedder (Flutter passes `compatExternalLinkHosts` through untouched), so any entry with
     * capitalisation or stray whitespace — `"T.me"` — silently failed to match even though DNS
     * is case-insensitive. Normalising here fixes that and keeps it off the per-navigation path.
     */
    private val normalizedCompatExternalLinkHosts: Set<String> by lazy {
        compatExternalLinkHosts.mapTo(HashSet(compatExternalLinkHosts.size)) {
            it.lowercase().trim()
        }
    }

    private val compiledAllowlist: GoatContentBlocker.CompiledAllowlist? by lazy {
        manifestDomainAllowlist
            ?.takeIf { it.isNotEmpty() }
            ?.let { GoatContentBlocker.compile(it, domain) }
    }

    val servesBundle: Boolean get() = extractedDir != null

    private val assetLoader: WebViewAssetLoader? by lazy {
        if (extractedDir != null) createAssetLoader() else null
    }

    protected open fun createAssetLoader(): WebViewAssetLoader {
        return WebViewAssetLoader.Builder()
            .setDomain(domain)
            .setHttpAllowed(false)
            .addPathHandler(ASSETS_PATH, WebViewAssetLoader.InternalStoragePathHandler(context, extractedDir!!))
            .build()
    }

    override fun shouldInterceptRequest(
        view: WebView,
        request: WebResourceRequest
    ): WebResourceResponse? {
        val url = request.url

        // Declarative Content Blocker Allowlist check (Task 10205). Uses the pre-compiled
        // allowlist: this runs for every subresource on the page, and normalising the domain set
        // per call was allocating a fresh lowercased list (plus a string per wildcard) each time.
        val allowlist = compiledAllowlist
        if (allowlist != null && !allowlist.isUriAllowed(url)) {
            return GoatContentBlocker.createBlockedResponse()
        }

        val loader = assetLoader
        if (loader != null) {
            if (url.host == domain && url.path?.startsWith(ASSETS_PATH) == true && extractedDir != null) {
                val relativePath = url.path!!.removePrefix(ASSETS_PATH).removePrefix("/")
                val file = File(extractedDir, relativePath)
                if (file.exists() && file.isFile) {
                    val mimeType = guessMimeType(relativePath)
                    val rangeHeader = request.requestHeaders?.get("Range") ?: request.requestHeaders?.get("range")
                    if (!rangeHeader.isNullOrBlank()) {
                        val rangeResult = byteCache.parseByteRange(rangeHeader, file.length()) {
                            byteCache.openStream(file)
                        }
                        when (rangeResult) {
                            is ByteRangeResult.Satisfiable -> {
                                val headers = mutableMapOf(
                                    "Content-Type" to mimeType,
                                    "Content-Range" to "bytes ${rangeResult.start}-${rangeResult.end}/${rangeResult.total}",
                                    "Content-Length" to "${rangeResult.end - rangeResult.start + 1}",
                                    "Accept-Ranges" to "bytes"
                                )
                                return WebResourceResponse(mimeType, "utf-8", 206, "Partial Content", headers, rangeResult.stream)
                            }
                            is ByteRangeResult.Unsatisfiable -> {
                                val headers = mutableMapOf(
                                    "Content-Type" to "text/plain",
                                    "Content-Range" to "bytes */${rangeResult.total}"
                                )
                                return WebResourceResponse("text/plain", "utf-8", 416, "Range Not Satisfiable", headers, ByteArrayInputStream(ByteArray(0)))
                            }
                            is ByteRangeResult.Full -> {
                                val headers = mutableMapOf(
                                    "Content-Type" to mimeType,
                                    "Content-Length" to "${rangeResult.total}",
                                    "Accept-Ranges" to "bytes"
                                )
                                return WebResourceResponse(mimeType, "utf-8", 200, "OK", headers, rangeResult.stream)
                            }
                        }
                    }

                    val cached = byteCache.getCachedBytes(file.absolutePath)
                    if (cached != null) {
                        val headers = mutableMapOf(
                            "Content-Type" to mimeType,
                            "Content-Length" to "${cached.size}",
                            "Accept-Ranges" to "bytes"
                        )
                        return WebResourceResponse(mimeType, "utf-8", 200, "OK", headers, ByteArrayInputStream(cached))
                    }

                    val stream = byteCache.openStream(file)
                    if (stream != null) {
                        val headers = mutableMapOf(
                            "Content-Type" to mimeType,
                            "Content-Length" to "${file.length()}",
                            "Accept-Ranges" to "bytes"
                        )
                        return WebResourceResponse(mimeType, "utf-8", 200, "OK", headers, stream)
                    }
                }
            }

            val response = loader.shouldInterceptRequest(url)
            if (response != null) {
                return response
            }
        }
        return super.shouldInterceptRequest(view, request)
    }

    private fun guessMimeType(path: String): String {
        val ext = path.substringAfterLast('.', "").lowercase()
        return when (ext) {
            "html", "htm" -> "text/html"
            "js", "mjs" -> "application/javascript"
            "css" -> "text/css"
            "json" -> "application/json"
            "png" -> "image/png"
            "jpg", "jpeg" -> "image/jpeg"
            "gif" -> "image/gif"
            "webp" -> "image/webp"
            "svg" -> "image/svg+xml"
            "wasm" -> "application/wasm"
            "woff" -> "font/woff"
            "woff2" -> "font/woff2"
            "ttf" -> "font/ttf"
            "otf" -> "font/otf"
            "mp3" -> "audio/mpeg"
            "mp4" -> "video/mp4"
            "wav" -> "audio/wav"
            else -> MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext) ?: "application/octet-stream"
        }
    }

    /**
     * Unconditionally cancels any SSL error to prevent MITM bypass across all build variants (Task 10197).
     */
    override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
        Log.e(TAG, "SSL Error encountered: ${error?.primaryError} on URL: ${error?.url}. Unconditionally canceling request.")
        handler?.cancel()
    }

    /**
     * Handles HTTP Basic and Digest authentication challenges via encrypted credential store (Task 10204).
     */
    override fun onReceivedHttpAuthRequest(
        view: WebView?,
        handler: HttpAuthHandler?,
        host: String?,
        realm: String?
    ) {
        val targetHost = host ?: ""
        val targetRealm = realm ?: ""
        val cred = httpAuthManager?.let { mgr -> runBlocking { mgr.getCredential(appId, targetHost, targetRealm) } }
        if (cred != null) {
            Log.d(TAG, "Silently resolving HTTP Auth challenge for $appId @ $targetHost:$targetRealm")
            handler?.proceed(cred.username, cred.password)
        } else {
            Log.w(TAG, "No HTTP Auth credentials found for $appId @ $targetHost:$targetRealm, canceling challenge")
            handler?.cancel()
        }
    }

    open fun shouldOverrideUrl(host: String?, scheme: String?, uri: Uri? = null): Boolean {
        // 1. Allow internal navigation within the tenant's scoped virtual domain or default domain
        // Fast path: avoid lowercase string allocations for in-origin navigations
        if (host != null && (host.equals(domain, ignoreCase = true) || host.equals(DEFAULT_DOMAIN, ignoreCase = true))) {
            return false
        }

        val cleanHost = host?.lowercase()
        val cleanScheme = scheme?.lowercase()

        // 2. Safely route verified system URL schemes (tel:, mailto:, sms:, geo:) to Android Intents
        if (cleanScheme in SYSTEM_SCHEMES) {
            try {
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    action = Intent.ACTION_VIEW
                    if (uri != null) data = uri
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(intent)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to launch intent for scheme $cleanScheme", e)
            }
            if (compatExternalSchemeResolver) onExternalNavigation?.invoke(uri?.toString() ?: "")
            return true
        }

        // 2b. T7 compat: additional app-deep-link schemes + Android intent:// + configured
        // universal-link hosts, resolved silently (no sandbox warning dialog) with a
        // fire-and-forget notice — only when a host has opted in.
        if (compatExternalSchemeResolver) {
            if (cleanScheme == "intent") {
                return resolveIntentScheme(uri)
            }
            if (cleanScheme in COMPAT_DEEP_LINK_SCHEMES) {
                return resolveExternalIntent(uri, cleanScheme)
            }
            if (cleanHost != null && cleanHost in normalizedCompatExternalLinkHosts) {
                return resolveExternalIntent(uri, cleanScheme)
            }
        }

        // 3. Prompt user before navigating to external URL via GoatExternalLinkWarningDialog (Task 10192)
        if (uri != null) {
            val urlString = uri.toString()
            GoatExternalLinkWarningDialog.show(
                context = context,
                appId = appId,
                destinationUrl = urlString,
                onConfirm = {
                    GoatExternalLinkWarningDialog.openInSystemBrowser(context, urlString)
                },
                onCancel = {
                    Log.d(TAG, "User canceled navigation to external URL: $urlString")
                }
            )
            return true
        }

        // 4. Block unauthorized external web navigation inside the sandboxed container
        Log.w(TAG, "Navigation blocked to external untrusted URL: host=$cleanHost, scheme=$cleanScheme")
        return true
    }

    /**
     * T7 compat: launches [uri] as a plain `ACTION_VIEW` intent (used for the fixed deep-link
     * scheme set and configured universal-link hosts — none of these need the special
     * `intent://` URI parsing [resolveIntentScheme] does). Always returns `true` (navigation
     * handled/blocked either way — if no app can open it, nothing loads, matching how a real
     * browser behaves for an app-only scheme it can't resolve).
     */
    private fun resolveExternalIntent(uri: Uri?, scheme: String?): Boolean {
        if (uri != null) {
            try {
                context.startActivity(Intent(Intent.ACTION_VIEW, uri).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                })
            } catch (e: ActivityNotFoundException) {
                Log.w(TAG, "No app installed to handle scheme/host: $scheme")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to launch external intent for $scheme", e)
            }
        }
        onExternalNavigation?.invoke(uri?.toString() ?: "")
        return true
    }

    /**
     * T7 compat: Android's `intent://` URI scheme (`intent://host/path#Intent;...;end`), used by
     * e.g. Google Play / third-party app deep links. Parses via [Intent.parseUri]; if no app can
     * handle it, falls back to the intent's own `browser_fallback_url` extra when present — the
     * same contract Chrome and other browsers implement for this scheme.
     */
    private fun resolveIntentScheme(uri: Uri?): Boolean {
        val uriString = uri?.toString() ?: return true
        try {
            // Explicitly nullable: Intent.parseUri's real Android contract never returns null
            // (it throws URISyntaxException on failure instead), but treating the platform-type
            // return as nullable here is a defensive no-op in production and is what makes this
            // path exercisable in a JVM unit test (this module's isReturnDefaultValues config
            // has no Robolectric, so the stub genuinely returns null instead of parsing).
            val intent: Intent? = Intent.parseUri(uriString, Intent.URI_INTENT_SCHEME)
            if (intent == null) {
                Log.w(TAG, "Intent.parseUri returned null for: $uriString")
                onExternalNavigation?.invoke(uriString)
                return true
            }
            intent.addCategory(Intent.CATEGORY_BROWSABLE)
            intent.component = null
            intent.selector = null
            try {
                context.startActivity(intent.apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK })
            } catch (e: ActivityNotFoundException) {
                val fallbackUrl = intent.getStringExtra("browser_fallback_url")
                if (fallbackUrl != null) {
                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(fallbackUrl)).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    })
                } else {
                    Log.w(TAG, "No app installed to handle intent:// URI and no browser_fallback_url")
                }
            }
        } catch (e: URISyntaxException) {
            Log.e(TAG, "Malformed intent:// URI: $uriString", e)
        }
        onExternalNavigation?.invoke(uriString)
        return true
    }

    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
        val uri = request?.url ?: return false
        val secret = launchHashSecretKey
        if (secret != null) {
            val fragment = try { uri.fragment } catch (_: Throwable) { null }
            if (fragment != null && fragment.contains(GoatSecurityManager.LAUNCH_HASH_PARAM)) {
                if (!GoatSecurityManager.verifyLaunchHash("#$fragment", secret)) {
                    val urlStr = uri.toString()
                    Log.w(TAG, "Navigation blocked: mini-app launch hash failed HMAC verification")
                    onLaunchHashRejected?.invoke(urlStr)
                    return true
                }
            }
        }
        val host = try { uri.host } catch (e: Throwable) { null }
        val scheme = try { uri.scheme } catch (e: Throwable) { null }
        return shouldOverrideUrl(host, scheme, uri)
    }

    fun isLaunchHashAuthorized(url: String?): Boolean {
        val secret = launchHashSecretKey ?: return true
        if (url.isNullOrBlank()) return true
        val fragmentIndex = url.indexOf('#')
        if (fragmentIndex < 0) return true
        val fragment = url.substring(fragmentIndex)
        if (!fragment.contains(GoatSecurityManager.LAUNCH_HASH_PARAM)) return true
        return GoatSecurityManager.verifyLaunchHash(fragment, secret)
    }

    override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
        try {
            super.onPageStarted(view, url, favicon)
        } catch (e: Throwable) {
            // Ignored in unit test environment
        }
        Log.d(TAG, "onPageStarted: $url")
        this.onPageStarted?.invoke()
    }

    override fun onPageFinished(view: WebView?, url: String?) {
        try {
            super.onPageFinished(view, url)
        } catch (e: Throwable) {
            // Ignored in unit test environment
        }
        Log.d(TAG, "onPageFinished: $url")
        this.onPageLoaded?.invoke()
    }

    /** T8 compat: main-frame resource/navigation errors, opt-in via [onReceivedErrorCompat]. */
    override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
        super.onReceivedError(view, request, error)
        val cb = onReceivedErrorCompat ?: return
        if (request?.isForMainFrame != true) return
        cb(
            request.url?.toString() ?: "",
            error?.errorCode ?: -1,
            error?.description?.toString() ?: ""
        )
    }

    /** T8 compat: main-frame HTTP error responses (4xx/5xx), opt-in via [onReceivedHttpErrorCompat]. */
    override fun onReceivedHttpError(view: WebView?, request: WebResourceRequest?, errorResponse: WebResourceResponse?) {
        super.onReceivedHttpError(view, request, errorResponse)
        val cb = onReceivedHttpErrorCompat ?: return
        if (request?.isForMainFrame != true) return
        cb(request.url?.toString() ?: "", errorResponse?.statusCode ?: -1)
    }

    /** T8 compat: fires once the page is guaranteed visually committed, opt-in. */
    override fun onPageCommitVisible(view: WebView?, url: String?) {
        super.onPageCommitVisible(view, url)
        onPageCommitVisibleCompat?.invoke(url ?: "")
    }

    /** T8 compat: per-subresource load notice (script/img/css/...), opt-in — can be noisy, so it
     *  stays entirely off (no override cost beyond this null check) unless requested. */
    override fun onLoadResource(view: WebView?, url: String?) {
        super.onLoadResource(view, url)
        onLoadResourceCompat?.invoke(url ?: "")
    }

    /** T8 compat: fires on every history-affecting navigation (incl. SPA pushState), opt-in. */
    override fun doUpdateVisitedHistory(view: WebView?, url: String?, isReload: Boolean) {
        super.doUpdateVisitedHistory(view, url, isReload)
        onUpdateVisitedHistoryCompat?.invoke(url ?: "", isReload)
    }

    /**
     * Catches and isolates Chromium multi-process renderer crashes or OS low-memory kills.
     *
     * In compliance with CODE_RULE.md Pillar 2 (Native-Kill Blueprint & Zero-Leak Policy),
     * this method ALWAYS returns true to prevent the host application process from crashing,
     * safely tears down the dead WebView instance, and notifies the UI layer.
     *
     * @param view The dead [WebView] instance.
     * @param detail Crash details containing didCrash flag and exit priority.
     * @return true unconditionally to indicate handled crash.
     */
    override fun onRenderProcessGone(view: WebView?, detail: RenderProcessGoneDetail?): Boolean {
        val didCrash = detail?.didCrash() ?: false
        val priority = detail?.rendererPriorityAtExit() ?: -1
        Log.e(TAG, "WebView render process gone! didCrash=$didCrash, priority=$priority")

        try {
            view?.let { webView ->
                webView.stopLoading()
                (webView.parent as? android.view.ViewGroup)?.removeView(webView)
                webView.destroy()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error cleaning up crashed WebView instance", e)
        }

        try {
            this.onRenderCrashed?.invoke(didCrash)
            this.onRehydrationHandler?.invoke(didCrash)
        } catch (t: Throwable) {
            Log.e(TAG, "Error in crash handler", t)
        }
        // Return true to prevent host application crash
        return true
    }
}
