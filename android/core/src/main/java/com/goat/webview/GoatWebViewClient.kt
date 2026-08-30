package com.goat.webview

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.util.Log
import android.net.http.SslError
import android.webkit.HttpAuthHandler
import android.webkit.RenderProcessGoneDetail
import android.webkit.SslErrorHandler
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import com.goat.webview.auth.GoatHttpAuthManager
import com.goat.webview.security.GoatContentBlocker
import com.goat.webview.ui.GoatExternalLinkWarningDialog
import java.io.File
import kotlinx.coroutines.runBlocking

/**
 * Custom WebViewClient using AndroidX WebViewAssetLoader to map internal storage files
 * to dynamic virtual domain `https://${domain}/assets/`.
 */
open class GoatWebViewClient(
    private val context: Context,
    private val extractedDir: File,
    val appId: String = GoatAssetManager.DEFAULT_APP_ID,
    val onPageStarted: (() -> Unit)? = null,
    val onPageLoaded: (() -> Unit)? = null,
    val onRenderCrashed: ((didCrash: Boolean) -> Unit)? = null,
    private val httpAuthManager: GoatHttpAuthManager? = null,
    private val manifestDomainAllowlist: Set<String>? = null,
    private val launchHashSecretKey: ByteArray? = null,
    private val onLaunchHashRejected: ((String) -> Unit)? = null
) : WebViewClient() {

    val domain: String = resolveDomain(appId)
    val origin: String = "https://$domain"
    val entryUrl: String = "$origin/assets/index.html"

    companion object {
        private const val TAG = "GoatWebViewClient"
        const val DEFAULT_DOMAIN = "appassets.androidplatform.net"
        const val VIRTUAL_DOMAIN = "appassets.androidplatform.net"
        const val ASSETS_PATH = "/assets/"

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

    private val assetLoader: WebViewAssetLoader by lazy {
        createAssetLoader()
    }

    protected open fun createAssetLoader(): WebViewAssetLoader {
        return WebViewAssetLoader.Builder()
            .setDomain(domain)
            .setHttpAllowed(false)
            .addPathHandler(ASSETS_PATH, WebViewAssetLoader.InternalStoragePathHandler(context, extractedDir))
            .build()
    }

    override fun shouldInterceptRequest(
        view: WebView,
        request: WebResourceRequest
    ): WebResourceResponse? {
        val url = request.url

        // Declarative Content Blocker Allowlist check (Task 10205)
        if (manifestDomainAllowlist != null && manifestDomainAllowlist.isNotEmpty()) {
            if (!GoatContentBlocker.isUriAllowed(url, manifestDomainAllowlist, domain)) {
                return GoatContentBlocker.createBlockedResponse()
            }
        }

        val response = assetLoader.shouldInterceptRequest(url)
        if (response != null) {
            return response
        }
        return super.shouldInterceptRequest(view, request)
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
        val cleanHost = host?.lowercase()
        val cleanScheme = scheme?.lowercase()

        // 1. Allow internal navigation within the tenant's scoped virtual domain or default domain
        if (cleanHost == domain || cleanHost == DEFAULT_DOMAIN) {
            return false
        }

        // 2. Safely route verified system URL schemes (tel:, mailto:, sms:, geo:) to Android Intents
        if (cleanScheme in setOf("tel", "mailto", "sms", "geo")) {
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
            return true
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

    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
        val uri = request?.url ?: return false
        if (!isLaunchHashAuthorized(uri.toString())) {
            Log.w(TAG, "Navigation blocked: mini-app launch hash failed HMAC verification")
            onLaunchHashRejected?.invoke(uri.toString())
            return true
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
                webView.loadUrl("about:blank")
                (webView.parent as? android.view.ViewGroup)?.removeView(webView)
                webView.destroy()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error cleaning up crashed WebView instance", e)
        }

        this.onRenderCrashed?.invoke(didCrash)
        // Return true to prevent host application crash
        return true
    }
}
