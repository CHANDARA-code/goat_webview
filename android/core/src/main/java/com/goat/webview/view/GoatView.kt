package com.goat.webview.view

import android.content.Context
import android.content.res.Configuration
import android.graphics.Color
import android.net.Uri
import android.util.AttributeSet
import android.util.Log
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.ServiceWorkerController
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebStorage
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.webkit.Profile
import androidx.webkit.ProfileStore
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.goat.webview.GoatAssetManager
import com.goat.webview.GoatBridgeActionHandler
import com.goat.webview.GoatCookieManager
import com.goat.webview.GoatFastPool
import com.goat.webview.GoatFindInPageController
import com.goat.webview.GoatPrintController
import com.goat.webview.GoatStorageManager
import com.goat.webview.GoatWebMessageListener
import com.goat.webview.manifest.GoatManifestParser
import com.goat.webview.manifest.MiniAppManifest
import com.goat.webview.GoatWebViewClient
import com.goat.webview.RealWebViewFindAdapter
import com.goat.webview.ui.GoatFindInPageOverlay
import com.goat.webview.popup.GoatPopupListener
import com.goat.webview.popup.GoatPopupManager
import com.goat.webview.popup.GoatPopupRequest
import com.goat.webview.popup.GoatPopupRoutingPolicy
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import android.os.Bundle
import java.io.File

/**
 * Immutable, durable snapshot of a GoatView browsing session,
 * enabling transparent surface rehydration after Chromium renderer termination.
 */
data class GoatSessionSnapshot(
    val entryUrl: String? = null,
    val confirmedUrl: String? = null,
    val routeHash: String? = null,
    val title: String? = null,
    val textZoom: Int = 100,
    val navigationBundle: Bundle? = null,
    val timestamp: Long = System.currentTimeMillis(),
    val appId: String? = null
) {
    val lastConfirmedUrl: String? get() = confirmedUrl

    /**
     * Resolves the target URL for post-crash rehydration.
     * Prefers confirmedUrl (with routeHash preserved if missing), then entryUrl + routeHash, then entryUrl.
     */
    fun resolveRestoreUrl(): String {
        val confirmed = confirmedUrl
        if (!confirmed.isNullOrBlank() && confirmed != "about:blank") {
            if (!routeHash.isNullOrBlank()) {
                val base = confirmed.substringBefore('#')
                val hash = if (routeHash.startsWith("#")) routeHash else "#$routeHash"
                return "$base$hash"
            }
            return confirmed
        }
        val entry = entryUrl
        if (!entry.isNullOrBlank()) {
            if (!routeHash.isNullOrBlank()) {
                val base = entry.substringBefore('#')
                val hash = if (routeHash.startsWith("#")) routeHash else "#$routeHash"
                return "$base$hash"
            }
            return entry
        }
        return "about:blank"
    }
}

/**
 * Enterprise-grade Android View container for Goat WebView.
 * Designed for modular reuse across Android Views, React Native Fabric components, and Flutter PlatformViews.
 */
class GoatView @JvmOverloads constructor(
    private val hostContext: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FrameLayout(hostContext, attrs, defStyleAttr) {

    /**
     * Subresource origins this mini-app may load from, overriding the bundle's own
     * `manifest.json` `security.allowedDomains`. Set before loading.
     *
     * Required for URL-mode mini-apps, which have no bundle and therefore no manifest: leaving it
     * null there means subresources are not filtered, which is the pre-existing behaviour. It is
     * not defaulted to the entry origin because a remote mini-app legitimately pulls scripts,
     * fonts and images from CDNs, and blocking those by default would break working apps.
     */
    var hostDomainAllowlist: Set<String>? = null

    private var currentSenderOrigins: Set<String> = emptySet()
    private var currentDomainAllowlist: Set<String> = emptySet()

    companion object {
        private const val TAG = "GoatView"
        const val ENTRY_URL = "https://appassets.androidplatform.net/assets/index.html"
        const val BRIDGE_NAME = "nativeBridge"
        const val BRIDGE_ORIGIN = "https://appassets.androidplatform.net"

        /**
         * The origin set handed to the listener for its own sender check. For a packaged bundle the
         * transport rules are already exact, so they are reused. For URL mode the transport rule is
         * `*` (the entry origin is not known when the listener is installed), and passing `*` on to
         * the listener would defeat the check -- an empty set is passed instead, which the listener
         * treats as main-frame-only. That still blocks the cross-origin-iframe path while leaving
         * top-level remote mini-apps working, since those post from the main frame.
         */
        @JvmStatic
        internal fun bridgeSenderOrigins(transportOrigins: Set<String>): Set<String> =
            if (transportOrigins.contains("*")) emptySet() else transportOrigins

        /**
         * Sender policy for URL mode. The transport rule has to stay `*` because the entry origin
         * is not known when the listener is installed, but by the time a message arrives we do know
         * which URL the host asked for -- so the bridge is pinned to that origin rather than merely
         * to the main frame.
         */
        @JvmStatic
        internal fun urlModeSenderOrigins(entryUrl: String?): Set<String> {
            val origin = GoatWebMessageListener.normalizeOrigin(entryUrl) ?: return emptySet()
            return setOf(origin)
        }

        /**
         * Subresource allowlist for a packaged bundle, read from the bundle's own `manifest.json`
         * (`security.allowedDomains`) -- the same field and file iOS compiles its WKContentRuleList
         * from, so the two platforms enforce one source of truth.
         *
         * An absent, unreadable or malformed manifest yields an empty set, which leaves
         * GoatContentBlocker inactive. That is deliberate: a mini-app that never declared an
         * allowlist has never had its subresources filtered, and silently starting to block them
         * here would break working apps rather than harden them.
         */
        @JvmStatic
        internal fun loadBundleManifest(assetDir: File?): MiniAppManifest? {
            val dir = assetDir ?: return null
            return try {
                val file = File(dir, "manifest.json")
                if (!file.isFile) return null
                GoatManifestParser.parseManifest(file.readText()).also {
                    com.goat.webview.manifest.GoatMiniAppManifestStore.put(it)
                }
            } catch (e: Throwable) {
                Log.w(TAG, "manifest.json could not be read: ${e.message}")
                null
            }
        }

        @JvmStatic
        internal fun manifestAllowedDomains(assetDir: File?): Set<String> =
            loadBundleManifest(assetDir)?.allowedDomains?.toSet() ?: emptySet()

        /**
         * The bundle-relative page to open, from the manifest's `entrypoint`. Falls back to
         * `index.html`, which is both the parser's own default and what was previously hardcoded,
         * so a bundle that declares nothing loads exactly what it did before.
         *
         * The parser rejects an entrypoint that escapes the bundle root, so this must go through it
         * rather than reading the JSON directly.
         */
        @JvmStatic
        internal fun manifestEntrypoint(assetDir: File?): String =
            loadBundleManifest(assetDir)?.entrypoint?.takeIf { it.isNotBlank() }
                ?: MiniAppManifest.DEFAULT_ENTRYPOINT
        private val WILDCARD_ORIGIN_SET = setOf("*")

        const val MAX_CONSECUTIVE_CRASHES = 3
        const val CRASH_WINDOW_MS = 15_000L // 15 seconds

        @JvmStatic
        internal fun isNightMode(uiMode: Int): Boolean =
            (uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    }

    // Contain any uncaught failure from a bridge/download/lifecycle coroutine (notably a
    // coroutine-machinery ClassCastException when a value-class suspend result resumes during
    // cancellation) so backgrounding the view can never take the whole process down.
    private val viewScope = CoroutineScope(
        Dispatchers.Main + Job() + CoroutineExceptionHandler { _, t ->
            Log.w(TAG, "GoatView coroutine aborted: ${t.message}")
        }
    )
    private var webView: WebView? = null
    private var currentSessionSnapshot: GoatSessionSnapshot? = null
    private var initialEntryUrl: String? = null
    private var lastKnownUrl: String? = null
    private var lastKnownTitle: String? = null
    private var lastKnownRouteHash: String? = null

    // Anti-crash-loop circuit breaker state: max 3 crashes within 15 seconds
    private var lastCrashTimestamp: Long = 0L
    private var consecutiveCrashCount: Int = 0
    val lifecycleManager = com.goat.webview.lifecycle.GoatLifecycleManager().apply {
        attachScriptEvaluator { script ->
            evaluateJavascript(script)
        }
    }

    /** Written from [Dispatchers.Default] by the concurrent build in [initializeUrlAsync] /
     *  [initializeAsync] and read from the main thread, hence volatile. */
    @Volatile
    private var actionHandler: GoatBridgeActionHandler? = null

    /**
     * An in-flight [GoatBridgeActionHandler] build. The cold path used to construct the handler
     * and only *then* start acquiring and navigating the WebView, so two independent costs were
     * paid back to back. They now run concurrently: the page cannot issue a bridge call until its
     * document has loaded, which is far later than the build takes.
     *
     * Everything that can actually observe the handler early is a `suspend` context (the two
     * bridge routers, [executeAction], the download listener), so they go through
     * [requireActionHandler] and await rather than racing. Synchronous lifecycle code keeps the
     * null-tolerant behaviour it already had.
     */
    @Volatile
    private var pendingActionHandler: kotlinx.coroutines.Deferred<GoatBridgeActionHandler?>? = null

    /** A touch that arrived before the concurrently-built handler existed; replayed on assignment. */
    @Volatile
    private var pendingGestureTimestampMs: Long = 0L

    /**
     * Starts the handler build on [Dispatchers.Default] and returns immediately, so the caller can
     * get on with acquiring and navigating the WebView. Failures are captured as a null result
     * rather than escaping: an `async` that throws would cancel [viewScope] and take every other
     * view coroutine with it, and callers already treat a null handler as "not initialized".
     */
    private fun startActionHandlerBuild(activeContext: Context, appId: String) {
        pendingActionHandler = viewScope.async(Dispatchers.Default) {
            try {
                buildInternalActionHandler(activeContext, appId).also { built ->
                    // initialize() runs its own hot-attach check *after* this build starts, and a
                    // parked instance carries its tenant's handler as payload. First writer wins,
                    // so a completing build can never clobber that.
                    if (actionHandler == null) {
                        actionHandler = built
                        val bufferedGesture = pendingGestureTimestampMs
                        if (bufferedGesture > 0L) {
                            built.recordUserGesture(bufferedGesture)
                            pendingGestureTimestampMs = 0L
                        }
                    }
                }
            } catch (t: Throwable) {
                Log.w(TAG, "Bridge action handler build failed: ${t.message}", t)
                null
            }
        }
    }

    /**
     * The action handler, waiting for the concurrent build to finish if one is still running.
     * Returns null only if no handler was ever requested or the build failed — the same condition
     * callers already treated as "not initialized".
     */
    private suspend fun requireActionHandler(): GoatBridgeActionHandler? {
        actionHandler?.let { return applyDomainPolicy(it) }
        pendingActionHandler?.await()
        // Re-read rather than returning await()'s value: if a hot attach installed the parked
        // tenant's handler while the build was running, that one is authoritative.
        return actionHandler?.let { applyDomainPolicy(it) }
    }

    /**
     * Stamps the current bundle's domain allowlist onto [handler].
     *
     * Applied here rather than only at load time because startActionHandlerBuild may still be in
     * flight when load() computes the allowlist: `actionHandler` is null at that moment, the
     * assignment there is a no-op, and the handler that arrives later would otherwise be left with
     * whatever its constructor read before the allowlist was known.
     */
    private fun applyDomainPolicy(handler: GoatBridgeActionHandler): GoatBridgeActionHandler {
        handler.manifestDomainAllowlist = currentDomainAllowlist.takeIf { it.isNotEmpty() }
        return handler
    }
    private val findInPageControllerLazy = lazy { GoatFindInPageController() }
    private val findInPageController: GoatFindInPageController by findInPageControllerLazy
    /**
     * Find-in-page UI, built on first actual use. The delegate wiring lives inside the lazy
     * initializer rather than at the mount sites: assigning `onNext`/`onPrevious`/`onClose` from
     * `initialize()`/`attachHot()` would *force* this lazy, constructing an Android View on every
     * mount and every warm swap for a feature almost no mini-app invokes. Attaching them here is
     * still strictly before anything can reach the overlay, since the only paths that touch it are
     * the find handlers below.
     */
    private val findInPageOverlayLazy = lazy {
        GoatFindInPageOverlay(hostContext).also { overlay ->
            overlay.onNext = { viewScope.launch { handleFindNext(true) } }
            overlay.onPrevious = { viewScope.launch { handleFindNext(false) } }
            overlay.onClose = { handleFindClear() }
        }
    }
    private val findInPageOverlay: GoatFindInPageOverlay by findInPageOverlayLazy

    /**
     * Dismisses the find overlay only if one was ever built. Dismissing an overlay that does not
     * exist is a no-op by definition, but *reading* the property to call `dismiss()` would
     * construct it — and [handleFindClear] runs on every SPA navigation (`NAV_PUSH`, `NAV_POP`,
     * `NAV_REPLACE`, `NAV_POP_TO_ROOT`, `PUSH_HISTORY_STATE` all invoke `onFindClear`), so that
     * read alone would build find-in-page UI for every navigating mini-app and undo the laziness.
     */
    private fun dismissFindOverlayIfPresent() {
        if (findInPageOverlayLazy.isInitialized()) findInPageOverlay.dismiss()
    }
    private var cachedFindAdapter: RealWebViewFindAdapter? = null
    private var cachedFindAdapterWebView: WebView? = null
    private val printController by lazy { GoatPrintController() }
    private val storageManager: GoatStorageManager by lazy { GoatStorageManager(context ?: hostContext) }

    private fun findAdapterFor(wv: WebView): RealWebViewFindAdapter {
        if (cachedFindAdapterWebView !== wv) {
            cachedFindAdapter = RealWebViewFindAdapter(wv)
            cachedFindAdapterWebView = wv
        }
        return cachedFindAdapter!!
    }

    private fun updateFindOverlay(result: GoatFindInPageController.FindResult) {
        if (result.query.isEmpty()) {
            dismissFindOverlayIfPresent()
            return
        }
        findInPageOverlay.show(this, result.matchCount, result.activeMatchIndex)
    }

    /**
     * Runs a native find-in-page query on the current WebView (FIND_IN_PAGE / Task 10184).
     * Highlighting is Chromium's own native implementation — no DOM mutation.
     */
    suspend fun handleFindInPage(query: String): JsonObject {
        val wv = webView ?: return buildJsonObject { put("matchCount", 0); put("activeMatchIndex", 0) }
        val result = findInPageController.findInPage(findAdapterFor(wv), query)
        updateFindOverlay(result)
        return buildJsonObject {
            put("matchCount", result.matchCount)
            put("activeMatchIndex", result.activeMatchIndex)
        }
    }

    /** Cycles the active find match forward/backward, scrolling it into view (FIND_NEXT). */
    suspend fun handleFindNext(forward: Boolean): JsonObject {
        val wv = webView ?: return buildJsonObject { put("matchCount", 0); put("activeMatchIndex", 0) }
        val result = findInPageController.findNext(findAdapterFor(wv), forward)
        updateFindOverlay(result)
        return buildJsonObject {
            put("matchCount", result.matchCount)
            put("activeMatchIndex", result.activeMatchIndex)
        }
    }

    /** Clears find highlights and dismisses the overlay (FIND_CLEAR, and on SPA route change). */
    fun handleFindClear() {
        val wv = webView ?: return
        if (findInPageControllerLazy.isInitialized()) {
            findInPageController.clear(findAdapterFor(wv))
        }
        dismissFindOverlayIfPresent()
    }

    /**
     * Triggers the native system print sheet or a sandboxed PDF export of the current page
     * (PRINT_PAGE / Task 10185). `EXPORT_PDF` rasterizes the real WebView content into a PDF
     * and persists it through [GoatStorageManager] so it lands exclusively inside the calling
     * tenant's sandbox.
     */
    suspend fun handlePrintPage(jobName: String, mode: String): JsonObject {
        val wv = webView ?: throw IllegalStateException("WebView not initialized")
        val activeContext = context ?: hostContext
        if (mode != "EXPORT_PDF") {
            val shown = printController.showSystemPrintSheet(activeContext, wv, jobName)
            return buildJsonObject { put("shown", shown) }
        }

        val safeFileName = jobName.replace(Regex("[^A-Za-z0-9_-]"), "_").ifEmpty { "print_job" }
        val pdfBytes = printController.exportToPdf(wv)
        if (pdfBytes.isEmpty()) {
            throw IllegalStateException("PDF export failed for job '$jobName'")
        }
        val relativePath = "exports/$safeFileName.pdf"
        storageManager.writeFile(appId = currentAppId, relativePath = relativePath, data = pdfBytes)
        return buildJsonObject { put("pdfUri", "goat://fs/$relativePath") }
    }

    var currentAssetDir: File? = null
        private set
    var currentAppId: String = GoatAssetManager.DEFAULT_APP_ID
        private set
    private var currentHotKey: String? = null

    /** Active AndroidX Profile when MULTI_PROFILE is supported */
    var tenantProfile: Profile? = null
        private set
    /** Profile-dedicated CookieManager */
    var tenantCookieManager: CookieManager? = null
        private set
    /** Profile-dedicated WebStorage (DOM localStorage & sessionStorage) */
    var tenantWebStorage: WebStorage? = null
        private set
    /** Profile-dedicated GeolocationPermissions */
    var tenantGeolocationPermissions: GeolocationPermissions? = null
        private set
    /** Profile-dedicated ServiceWorkerController */
    var tenantServiceWorkerController: ServiceWorkerController? = null
        private set

    /**
     * When set, an unmount parks this view's WebView fully warm (page + JS heap intact) keyed by
     * tenant + entry, and the next same-key mount is a re-attach instead of a navigation. Off by
     * default — transient containers (modals, popups) must not keep a warm instance around. The
     * primary mini-app embedder (Flutter PlatformView / RN) turns it on.
     */
    var hotReuseEnabled: Boolean = false
    var defaultPopupRoutingPolicy: GoatPopupRoutingPolicy = GoatPopupRoutingPolicy.AUTO

    /** JS injected at document-start (main frame), after goat's own `window.nativeBridge` shim.
     *  Empty by default; nothing is registered when empty. Set by embedders before `initialize*`
     *  so compatibility adapters can install their own bridge shim. */
    var initialUserScripts: List<String> = emptyList()

    /** When true, the document-start Web3 provider runtime (EIP-6963 `window.ethereum`, Solana
     *  Wallet Standard `window.navigator.wallets`, TonConnect `window.tonconnect`) is injected.
     *  Off by default: a host with no wallet features injects no provider surface and its
     *  mini-apps parse none of the runtime. Set before `initialize*`. */
    var web3ProvidersEnabled: Boolean = false

    /** T7 compat: when true, `tel/sms/mailto/geo` (already unconditional) plus
     *  `tg/fb/whatsapp/comgooglemaps`, Android `intent://` (with `browser_fallback_url`
     *  fallback), and any host in [compatExternalLinkHosts] are resolved directly to an
     *  external Intent/browser instead of the sandbox's user-facing warning dialog, and
     *  [onExternalNavigation] fires — fire-and-forget, no blocking Dart round-trip. Off by
     *  default; the bundled-mini-app sandbox's existing warning-dialog behavior is
     *  unaffected when this is false. */
    var compatExternalSchemeResolver: Boolean = false
    var incognito: Boolean = false

    /** Universal-link hosts to treat as external navigation when [compatExternalSchemeResolver]
     *  is on (e.g. `t.me`) — an https(s) URL to one of these opens externally instead of
     *  loading in the WebView. Consumer-configurable; not every host wants the same set. */
    var compatExternalLinkHosts: Set<String> = setOf("t.me")

    var onExternalNavigation: ((url: String) -> Unit)? = null

    /** T8 compat: each fires only when set (G7) — off by default, no native marshalling cost
     *  when the embedder didn't ask for that event. */
    var onReceivedErrorCompat: ((url: String, errorCode: Int, description: String) -> Unit)? = null
    var onReceivedHttpErrorCompat: ((url: String, statusCode: Int) -> Unit)? = null
    var onPageCommitVisibleCompat: ((url: String) -> Unit)? = null
    var onLoadResourceCompat: ((url: String) -> Unit)? = null
    var onUpdateVisitedHistoryCompat: ((url: String, isReload: Boolean) -> Unit)? = null
    var onConsoleMessageCompat: ((message: String, level: String) -> Unit)? = null

    /** T9 compat: off by default — no `SwipeRefreshLayout` exists in the view hierarchy at all
     *  unless this is true (verified by view-tree assert, not just an invisible/disabled one).
     *  Must be set before the first `initialize*`/`attachHot` call; changing it afterward has no
     *  effect on an already-mounted instance. */
    var pullToRefreshEnabled: Boolean = false
        set(value) {
            if (field != value) {
                field = value
                webView?.let {
                    (it.parent as? ViewGroup)?.removeView(it)
                    attachWebViewToHierarchy(it)
                }
            }
        }

    /** Fires on every pull-to-refresh gesture. Default (unset) behavior is a plain [reload] with
     *  no Dart round-trip; a compat consumer that wants custom refresh logic sets this instead. */
    var onPullToRefresh: (() -> Unit)? = null

    private var swipeRefreshLayout: SwipeRefreshLayout? = null

    /** Drives the refresh spinner programmatically (compat's `PullToRefreshController.begin/endRefreshing`). No-op when [pullToRefreshEnabled] is off. */
    fun setRefreshing(refreshing: Boolean) {
        swipeRefreshLayout?.isRefreshing = refreshing
    }

    /** Real, live state — not cached — for compat's `PullToRefreshController.isRefreshing()`. */
    val isRefreshing: Boolean get() = swipeRefreshLayout?.isRefreshing ?: false

    /**
     * T9 compat: replaces `removeAllViews(); addView(wv, ...)` at both attach sites. When
     * [pullToRefreshEnabled] is off, the hierarchy is byte-identical to before this feature
     * existed — no `SwipeRefreshLayout` node at all (verified by the acceptance criterion's
     * view-tree assert), not just a disabled/invisible one.
     */
    private fun attachWebViewToHierarchy(wv: WebView) {
        removeAllViews()
        if (pullToRefreshEnabled) {
            val srl = try {
                SwipeRefreshLayout(context ?: hostContext).apply {
                    setOnRefreshListener {
                        val custom = onPullToRefresh
                        if (custom != null) custom.invoke() else wv.reload()
                    }
                }
            } catch (_: Throwable) {
                null
            }
            if (srl != null) {
                srl.addView(wv, LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
                addView(srl, LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
                swipeRefreshLayout = srl
            } else {
                swipeRefreshLayout = null
                addView(wv, LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            }
        } else {
            swipeRefreshLayout = null
            addView(wv, LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        }
    }

    var onPopupRequest: ((GoatPopupRequest) -> GoatPopupRoutingPolicy?)? = null
    var popupListener: GoatPopupListener? = null

    var onBridgeAction: (suspend (action: String, payload: JsonObject) -> Result<JsonObject>)? = null
    var onPageStarted: (() -> Unit)? = null
    var onPageFinished: (() -> Unit)? = null
    var onError: ((description: String) -> Unit)? = null
    var onFileChooserRequested: ((callback: ValueCallback<Array<Uri>>?, acceptTypes: Array<String>?) -> Boolean)? = null
    /** Host-provided real OS runtime permission requester (Task 10198). Wire via
     *  `ActivityResultContracts.RequestMultiplePermissions()` registered on the host Activity. */
    var onRequestOsPermissions: (suspend (permissions: Array<String>) -> Map<String, Boolean>)? = null
    var onAppServiceReady: ((appId: String, details: JsonObject?) -> Unit)? = null
    var onAppServiceCrash: ((appId: String, error: String, details: JsonObject?) -> Unit)? = null
    var onAppServiceTerminate: ((appId: String, details: JsonObject?) -> Unit)? = null
    var onSetAdaptiveRefreshRate: ((elevate: Boolean) -> Boolean)? = null

    private var pendingTextZoom: Int = 100
    var onTextZoomApplied: ((zoom: Int) -> Unit)? = null

    fun setTextZoom(zoom: Int): Boolean {
        val clamped = com.goat.webview.accessibility.GoatTextZoomPolicy.clampTextZoom(zoom)
        pendingTextZoom = clamped
        saveSessionState()
        val wv = webView
        return if (wv != null) {
            try {
                wv.settings.textZoom = clamped
                onTextZoomApplied?.invoke(clamped)
                true
            } catch (e: Throwable) {
                false
            }
        } else {
            false
        }
    }

    fun getTextZoom(): Int = pendingTextZoom

    fun syncSystemFontScale(fontScale: Float) {
        val zoom = com.goat.webview.accessibility.GoatTextZoomPolicy.fontScaleToTextZoom(fontScale)
        setTextZoom(zoom)
    }

    fun getUnderlyingWebView(): WebView? = webView

    /**
     * Captures an explicit snapshot of the current browsing session.
     */
    fun saveSessionState(): GoatSessionSnapshot {
        val wv = webView
        val bundle = Bundle()
        try {
            wv?.saveState(bundle)
        } catch (_: Throwable) {
            // Safe fallback in headless / unit-test environments
        }

        val liveUrl = try { wv?.url } catch (_: Throwable) { null }
        val currentUrl = liveUrl?.takeIf { it.isNotBlank() && it != "about:blank" }
            ?: lastKnownUrl?.takeIf { it.isNotBlank() && it != "about:blank" }
            ?: initialEntryUrl

        val route = extractRouteHash(currentUrl) ?: lastKnownRouteHash
        val liveTitle = try { wv?.title } catch (_: Throwable) { null }
        val currentTitle = liveTitle ?: lastKnownTitle

        val snapshot = GoatSessionSnapshot(
            entryUrl = initialEntryUrl ?: currentUrl,
            confirmedUrl = currentUrl?.takeIf { it.isNotBlank() && it != "about:blank" },
            routeHash = route,
            title = currentTitle,
            textZoom = pendingTextZoom,
            navigationBundle = bundle.takeIf { !it.isEmpty },
            timestamp = System.currentTimeMillis(),
            appId = currentAppId
        )
        currentSessionSnapshot = snapshot
        return snapshot
    }

    fun getSessionSnapshot(): GoatSessionSnapshot = currentSessionSnapshot ?: saveSessionState()

    private fun extractRouteHash(url: String?): String? {
        if (url == null) return null
        val hashIdx = url.indexOf('#')
        return if (hashIdx >= 0) url.substring(hashIdx) else null
    }

    init {
        try {
            setBackgroundColor(Color.TRANSPARENT)
        } catch (e: Exception) {
            // Ignored in unit test environment
        }
    }

    /**
     * Builds the fully-wired internal bridge action handler for this view. Extracted so it can be
     * constructed off the main thread (see [initializeAsync]) — the ~35 manager dependencies and
     * the plugin/payment auto-registration in its constructor are the bulk of first-launch cost.
     */
    private fun buildInternalActionHandler(
        activeContext: Context,
        appId: String
    ): GoatBridgeActionHandler = GoatBridgeActionHandler(
        context = activeContext,
        appId = appId,
        manifestDomainAllowlist = currentDomainAllowlist.takeIf { it.isNotEmpty() },
        autoRegisterPlugins = true,
        autoRegisterPayments = true,
        onAppServiceReady = { id, details -> onAppServiceReady?.invoke(id, details) },
        onAppServiceCrash = { id, error, details -> onAppServiceCrash?.invoke(id, error, details) },
        onAppServiceTerminate = { id, details -> onAppServiceTerminate?.invoke(id, details) },
        onSetAdaptiveRefreshRate = { elevate -> onSetAdaptiveRefreshRate?.invoke(elevate) ?: false },
        onRequestOsPermissions = { perms -> onRequestOsPermissions?.invoke(perms) ?: emptyMap() },
        onFindInPage = { query -> handleFindInPage(query) },
        onFindNext = { forward -> handleFindNext(forward) },
        onFindClear = { handleFindClear() },
        onPrintPage = { jobName, mode -> handlePrintPage(jobName, mode) }
    )

    /**
     * Same as [initialize] but constructs the bridge action handler on [Dispatchers.Default] first,
     * so the expensive dependency graph and plugin/payment auto-registration stay off the main
     * thread. The WebView acquisition and configuration still run on the main thread.
     */
    suspend fun initializeAsync(
        assetDir: File,
        appId: String = GoatAssetManager.DEFAULT_APP_ID,
        entryUrl: String? = null
    ) {
        val activeContext = context ?: hostContext
        val clientDomain = GoatWebViewClient.resolveDomain(appId)
        val resolvedEntry = entryUrl
            ?: "https://$clientDomain/assets/${manifestEntrypoint(assetDir)}"
        val hotKey = "$appId|$resolvedEntry"
        val allowed = setOf("https://$clientDomain", "https://appassets.androidplatform.net")
        val didHot = hotReuseEnabled && withContext(Dispatchers.Main) {
            val hot = GoatFastPool.acquireHot(hotKey, activeContext) ?: return@withContext false
            currentAssetDir = assetDir; currentAppId = appId; currentHotKey = hotKey
            actionHandler = (hot.payload as? GoatBridgeActionHandler)
                ?: actionHandler
                ?: buildInternalActionHandler(activeContext, appId)
            attachHot(hot.webView, activeContext, appId, assetDir, allowed)
            true
        }
        if (didHot) return

        // Build the handler concurrently with the WebView work below rather than before it.
        startActionHandlerBuild(activeContext, appId)
        withContext(Dispatchers.Main) {
            initialize(assetDir, customActionHandler = null, appId = appId, entryUrl = entryUrl)
        }
    }

    /**
     * Switch the mini-app shown in this *already-mounted* view to [newUrl]/[newAppId]. The Flutter
     * platform view and this GoatView are untouched — no surface recreation — so when the target is
     * parked hot the swap is a `View` re-parent + `onResume`, typically 5–20 ms. The currently
     * shown WebView is parked hot under its own key so switching back is just as fast.
     */
    fun hotSwapTo(newUrl: String, newAppId: String) {
        val activeContext = context ?: hostContext
        val newKey = "$newAppId|$newUrl"
        val cur = webView
        if (cur != null && currentHotKey != newKey) {
            currentHotKey?.let { GoatFastPool.parkHot(cur, it, actionHandler) }
            removeAllViews()
            webView = null
        } else if (cur != null) {
            // Same target already shown — just re-signal + re-render.
            try {
                cur.evaluateJavascript(
                    "try{window.dispatchEvent(new Event('goat:reactivate'))}catch(e){}", null
                )
            } catch (_: Throwable) {}
            onPageStarted?.invoke()
            onPageFinished?.invoke()
            return
        }
        val hot = GoatFastPool.acquireHot(newKey, activeContext)
        currentHotKey = newKey
        currentAppId = newAppId
        currentAssetDir = null
        if (hot != null) {
            (hot.payload as? GoatBridgeActionHandler)?.let { actionHandler = it }
            attachHot(hot.webView, activeContext, newAppId, null, setOf("*"), immediateReady = true)
        } else {
            // Cold: no parked instance for this target yet — go through the normal URL path once.
            viewScope.launch { initializeUrlAsync(newUrl, newAppId) }
        }
    }

    /**
     * Fully-synchronous warm pool swap — no coroutine hops. Returns `true` if a parked warm
     * instance for [url]/[appId] was re-attached in place; the caller then does nothing else.
     * Must be called on the main thread (platform-view creation already is).
     */
    fun tryHotAttachSync(url: String, appId: String): Boolean {
        if (!hotReuseEnabled) return false
        val activeContext = context ?: hostContext
        val hotKey = "$appId|$url"
        val hot = GoatFastPool.acquireHot(hotKey, activeContext) ?: return false
        currentAssetDir = null
        currentAppId = appId
        currentHotKey = hotKey
        (hot.payload as? GoatBridgeActionHandler)?.let { actionHandler = it }
        attachHot(hot.webView, activeContext, appId, null, setOf("*"))
        return true
    }

    /**
     * Mini-app-by-URL fast path. Loads [url] directly with no bundle: no zip extraction, no
     * SHA/token check, no `filesDir` write, and no `WebViewAssetLoader` per-request interception.
     * The bridge, lifecycle and pooled-WebView reuse all still apply. This is the lower-overhead
     * way to run a mini-app that is hosted at a URL rather than shipped as a package.
     */
    suspend fun initializeUrlAsync(
        url: String,
        appId: String = GoatAssetManager.DEFAULT_APP_ID
    ) {
        val activeContext = context ?: hostContext
        val hotKey = "$appId|$url"
        // Warm pool swap on the main thread first — no handler build, no navigation.
        val didHot = hotReuseEnabled && withContext(Dispatchers.Main) {
            val hot = GoatFastPool.acquireHot(hotKey, activeContext) ?: return@withContext false
            currentAssetDir = null; currentAppId = appId; currentHotKey = hotKey
            actionHandler = (hot.payload as? GoatBridgeActionHandler)
                ?: actionHandler
                ?: buildInternalActionHandler(activeContext, appId)
            attachHot(hot.webView, activeContext, appId, null, WILDCARD_ORIGIN_SET)
            true
        }
        if (didHot) return

        // Build the handler concurrently with the WebView work below rather than before it.
        startActionHandlerBuild(activeContext, appId)
        withContext(Dispatchers.Main) {
            initialize(assetDir = null, customActionHandler = null, appId = appId, entryUrl = url)
        }
    }

    /**
     * Executes a native bridge action against this view's own handler. Used by embedders (Flutter
     * PlatformView, RN) so they no longer need to build a second [GoatBridgeActionHandler].
     */
    suspend fun executeAction(action: String, payload: JsonObject): Result<JsonObject> =
        requireActionHandler()?.executeAction(action, payload)
            ?: Result.failure(IllegalStateException("GoatView not initialized"))

    /**
     * Initializes and loads the WebView with the given extracted asset directory.
     */
    @JvmOverloads
    fun initialize(
        assetDir: File?,
        customActionHandler: GoatBridgeActionHandler? = null,
        appId: String = GoatAssetManager.DEFAULT_APP_ID,
        entryUrl: String? = null
    ) {
        val activeContext = context ?: hostContext
        currentAssetDir = assetDir
        currentAppId = appId
        
        loadBundleManifest(assetDir)?.window?.let { windowConfig ->
            com.goat.webview.manifest.GoatManifestWindowApplier.apply(activeContext, windowConfig)
        }
        // A concurrent build may already be in flight (see startActionHandlerBuild); building a
        // second one here would throw away that work and put it back on the critical path.
        if (customActionHandler != null) {
            actionHandler = customActionHandler
        } else if (pendingActionHandler == null && actionHandler == null) {
            actionHandler = buildInternalActionHandler(activeContext, appId)
        }
        // URL fast path: no packaged bundle, so no asset-loader origin and no virtual domain.
        val urlMode = assetDir == null
        val clientDomain = GoatWebViewClient.resolveDomain(appId)
        val allowedOrigins = if (urlMode) {
            WILDCARD_ORIGIN_SET
        } else {
            setOf("https://$clientDomain", "https://appassets.androidplatform.net")
        }
        val finalEntryUrl = entryUrl
            ?: if (urlMode) "about:blank" else "https://$clientDomain/assets/${manifestEntrypoint(assetDir)}"
        initialEntryUrl = finalEntryUrl
        lastKnownUrl = finalEntryUrl
        lastKnownRouteHash = extractRouteHash(finalEntryUrl)
        currentSessionSnapshot = GoatSessionSnapshot(
            entryUrl = finalEntryUrl,
            confirmedUrl = finalEntryUrl,
            routeHash = lastKnownRouteHash,
            title = null,
            textZoom = pendingTextZoom,
            timestamp = System.currentTimeMillis(),
            appId = appId
        )
        currentSenderOrigins = if (urlMode) {
            urlModeSenderOrigins(finalEntryUrl)
        } else {
            bridgeSenderOrigins(allowedOrigins)
        }
        currentDomainAllowlist = hostDomainAllowlist ?: manifestAllowedDomains(assetDir)
        actionHandler?.let { applyDomainPolicy(it) }
        val needsFileAccess = urlMode && finalEntryUrl.startsWith("file:")
        currentHotKey = "$appId|$finalEntryUrl"

        // Warm pool swap: a same-tenant instance for this exact entry is parked fully warm —
        // re-attach it and re-bind delegates instead of acquiring a cold WebView and navigating.
        val hot = if (hotReuseEnabled) GoatFastPool.acquireHot(currentHotKey!!, activeContext) else null
        if (hot != null) {
            (hot.payload as? GoatBridgeActionHandler)?.let { actionHandler = it }
            attachHot(hot.webView, activeContext, appId, assetDir, allowedOrigins)
            return
        }

        val wv = GoatFastPool.acquire(activeContext, appId).apply {
            // AndroidX MULTI_PROFILE tenant isolation: allocate or retrieve profile and attach
            // strictly before any navigation or script evaluation.
            try {
                if (WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE)) {
                    val profileName = GoatCookieManager.getProfileName(appId)
                    val profile = ProfileStore.getInstance().getOrCreateProfile(profileName)
                    if (profile != null) {
                        if (profileName != Profile.DEFAULT_PROFILE_NAME) {
                            try {
                                WebViewCompat.setProfile(this, profile.name)
                            } catch (e: Throwable) {
                                Log.w(TAG, "Failed setting profile '$profileName': ${e.message}")
                            }
                        }
                        tenantProfile = profile
                        tenantCookieManager = try { profile.cookieManager } catch (_: Throwable) { null }
                        tenantWebStorage = try { profile.webStorage } catch (_: Throwable) { null }
                        tenantGeolocationPermissions = try { profile.geolocationPermissions } catch (_: Throwable) { null }
                        tenantServiceWorkerController = try { profile.serviceWorkerController } catch (_: Throwable) { null }
                    }
                }
            } catch (e: Throwable) {
                Log.w(TAG, "MULTI_PROFILE initialization skipped: ${e.message}")
            }

            layoutParams = LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )

            // Transparent canvas to eliminate white flash
            setBackgroundColor(Color.TRANSPARENT)

            // Performance & Security Flags
            try {
                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    domStorageEnabled = !incognito
                    try {
                        setSupportMultipleWindows(true)
                    } catch (_: Throwable) {}
                    try {
                        javaScriptCanOpenWindowsAutomatically = true
                    } catch (_: Throwable) {}
                    cacheMode = WebSettings.LOAD_DEFAULT
                    cacheMode = if (incognito) WebSettings.LOAD_NO_CACHE else WebSettings.LOAD_DEFAULT
                    allowFileAccess = needsFileAccess
                    allowContentAccess = false
                    allowFileAccessFromFileURLs = needsFileAccess
                    allowUniversalAccessFromFileURLs = false
                    setSupportZoom(false)
                    builtInZoomControls = false
                    displayZoomControls = false
                    useWideViewPort = true
                    loadWithOverviewMode = true
                }
            } catch (e: Throwable) {
                // Handled for headless/mock unit test environments
            }

            // Algorithmic Darkening Sync
            try {
                if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
                    val isDark = isNightMode(activeContext.resources?.configuration?.uiMode ?: 0)
                    WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, isDark)
                }
            } catch (e: Throwable) {
                // Handled for headless/mock unit test environments
            }

            // Register the WebMessageListener ONCE per WebView. It dispatches through
            // GoatFastPool's per-WebView router so a warm re-attach only re-binds the route —
            // the injected window.nativeBridge stays valid (androidx re-injects only on load).
            val bridgeWebView = this
            GoatFastPool.bindRouter(bridgeWebView) { action, payload ->
                onBridgeAction?.invoke(action, payload)
                    ?: requireActionHandler()?.executeAction(action, payload)
                    ?: Result.failure(IllegalStateException("Action handler not initialized"))
            }
            try {
                if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
                    WebViewCompat.addWebMessageListener(
                        this,
                        BRIDGE_NAME,
                        allowedOrigins,
                        GoatWebMessageListener(viewScope, currentSenderOrigins) { action, payload ->
                            GoatFastPool.routeBridge(bridgeWebView, action, payload)
                        }
                    )
                } else {
                    Log.w(TAG, "WEB_MESSAGE_LISTENER is not supported on this device")
                }
            } catch (e: Throwable) {
                // Handled for headless/mock unit test environments
            }

            // Adapter-supplied shims (e.g. window.flutter_inappwebview) — document-start, after the
            // window.nativeBridge listener above. Added to this WebView once and persists across
            // loadUrl, so a warm re-attach does not re-inject.
            // Host theme + design tokens, before any adapter shim so a mini-app's own stylesheet
            // can already read the CSS custom properties on first paint.
            try {
                if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                    WebViewCompat.addDocumentStartJavaScript(
                        this,
                        com.goat.webview.design.GoatDesignBootstrap.buildScript(
                            com.goat.webview.design.GoatThemeManager.current,
                            com.goat.webview.design.GoatDesignManager.current
                        ),
                        allowedOrigins
                    )
                }
            } catch (e: Throwable) {
                // Handled for headless/mock unit test environments
            }

            // Web3 provider runtime, before adapter shims so a dApp's own bundle already sees
            // window.ethereum / window.solana / window.tonconnect on first evaluation.
            if (web3ProvidersEnabled) {
                try {
                    if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                        WebViewCompat.addDocumentStartJavaScript(
                            this,
                            com.goat.webview.web3.GoatWeb3Bootstrap.buildScript(),
                            allowedOrigins
                        )
                    } else {
                        Log.w(TAG, "DOCUMENT_START_SCRIPT not supported; Web3 providers unavailable")
                    }
                } catch (e: Throwable) {
                    // Handled for headless/mock unit test environments
                }
            }

            val scripts = initialUserScripts
            if (scripts.isNotEmpty()) {
                try {
                    if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                        for (source in scripts) {
                            if (source.isNotEmpty()) {
                                WebViewCompat.addDocumentStartJavaScript(this, source, allowedOrigins)
                            }
                        }
                    } else {
                        Log.w(TAG, "DOCUMENT_START_SCRIPT not supported; adapter shims unavailable")
                    }
                } catch (e: Throwable) {
                    // Handled for headless/mock unit test environments
                }
            }

            // Download Listener
            setDownloadListener { url, _, contentDisposition, mimetype, _ ->
                viewScope.launch {
                    val guessedName = URLUtil.guessFileName(url, contentDisposition, mimetype)
                    val payload = buildJsonObject {
                        put("url", url)
                        put("fileName", guessedName)
                        put("title", guessedName)
                    }
                    requireActionHandler()?.executeAction("DOWNLOAD_FILE", payload)
                }
            }

            webViewClient = GoatWebViewClient(
                context = activeContext,
                extractedDir = assetDir,
                appId = appId,
                manifestDomainAllowlist = currentDomainAllowlist.takeIf { it.isNotEmpty() },
                onPageStarted = {
                    // A new route must not inherit the previous one's closing behaviour, or a
                    // confirmation armed on a form screen would keep blocking dismissal after the
                    // user navigated away from it (Task 10173).
                    com.goat.webview.ui.GoatClosingBehaviorController.resetForNewRoute()
                    val curUrl = webView?.url
                    if (!curUrl.isNullOrBlank() && curUrl != "about:blank") {
                        lastKnownUrl = curUrl
                        extractRouteHash(curUrl)?.let { lastKnownRouteHash = it }
                    }
                    saveSessionState()
                    onPageStarted?.invoke()
                },
                onPageLoaded = {
                    swipeRefreshLayout?.isRefreshing = false
                    val curUrl = webView?.url
                    if (!curUrl.isNullOrBlank() && curUrl != "about:blank") {
                        lastKnownUrl = curUrl
                        extractRouteHash(curUrl)?.let { lastKnownRouteHash = it }
                    }
                    val curTitle = webView?.title
                    if (!curTitle.isNullOrBlank()) {
                        lastKnownTitle = curTitle
                    }
                    saveSessionState()
                    onPageFinished?.invoke()
                },
                onRenderCrashed = { didCrash ->
                    onError?.invoke("Render process crashed: didCrash=$didCrash")
                    onAppServiceCrash?.invoke(appId, "Render process crashed: didCrash=$didCrash", null)
                },
                compatExternalSchemeResolver = compatExternalSchemeResolver,
                compatExternalLinkHosts = compatExternalLinkHosts,
                onExternalNavigation = { url -> onExternalNavigation?.invoke(url) },
                onReceivedErrorCompat = { url, code, desc -> onReceivedErrorCompat?.invoke(url, code, desc) },
                onReceivedHttpErrorCompat = { url, status -> onReceivedHttpErrorCompat?.invoke(url, status) },
                onPageCommitVisibleCompat = { url -> onPageCommitVisibleCompat?.invoke(url) },
                onLoadResourceCompat = { url -> onLoadResourceCompat?.invoke(url) },
                onUpdateVisitedHistoryCompat = { url, isReload ->
                    if (url.isNotBlank() && url != "about:blank") {
                        lastKnownUrl = url
                        extractRouteHash(url)?.let { lastKnownRouteHash = it }
                        saveSessionState()
                    }
                    onUpdateVisitedHistoryCompat?.invoke(url, isReload)
                },
                onRehydrationHandler = { didCrash ->
                    rehydrateAfterCrash(didCrash)
                }
            )

            webChromeClient = createWebChromeClient(activeContext, appId)

            loadUrl(finalEntryUrl)
        }

        webView = wv
        try {
            wv.settings.textZoom = pendingTextZoom
        } catch (e: Throwable) {
        }
        attachWebViewToHierarchy(wv)
    }

    override fun dispatchTouchEvent(ev: android.view.MotionEvent?): Boolean {
        val action = ev?.actionMasked ?: ev?.action
        if (action == android.view.MotionEvent.ACTION_DOWN || action == android.view.MotionEvent.ACTION_UP) {
            val handler = actionHandler
            if (handler != null) {
                handler.recordUserGesture()
            } else {
                // The handler is built concurrently with the mount, so there is a brief window
                // where a touch can land before it exists. Dropping the gesture here would make a
                // privileged action taken moments later fail its freshness gate with
                // GESTURE_REQUIRED, so buffer it and replay on assignment.
                pendingGestureTimestampMs = System.currentTimeMillis()
            }
        }
        return super.dispatchTouchEvent(ev)
    }

    /**
     * Executes arbitrary JavaScript inside the loaded page.
     */
    fun evaluateJavascript(script: String, callback: ((String?) -> Unit)? = null) {
        webView?.evaluateJavascript(script) { result ->
            callback?.invoke(result)
        }
    }

    /**
     * Can the WebView navigate back in history?
     */
    fun canGoBack(): Boolean = webView?.canGoBack() == true

    /**
     * Navigates back in history.
     */
    fun goBack() {
        webView?.goBack()
    }

    /**
     * Reloads current page.
     */
    fun reload() {
        webView?.reload()
    }

    /** Current page URL, or null before any navigation. */
    fun getUrl(): String? = webView?.url

    /** Current page title, or null before any navigation. */
    fun getTitle(): String? = webView?.title

    /** Can the WebView navigate forward in history? */
    fun canGoForward(): Boolean = webView?.canGoForward() == true

    /** Navigates forward in history. */
    fun goForward() {
        webView?.goForward()
    }

    fun stopLoading() {
        webView?.stopLoading()
    }

    fun clearHistory() {
        webView?.clearHistory()
    }

    fun clearFormData() {
        webView?.clearFormData()
    }

    fun clearCache(includeDiskFiles: Boolean) {
        webView?.clearCache(includeDiskFiles)
    }

    /** Loads [url] directly on the live WebView — a raw navigation, not a mini-app switch. */
    fun loadUrl(url: String) {
        lastKnownUrl = url
        extractRouteHash(url)?.let { lastKnownRouteHash = it }
        saveSessionState()
        webView?.loadUrl(url)
    }

    /** Serializes the WebView's back-forward list: `{currentIndex, history:[{url,title}]}`. */
    fun getCopyBackForwardList(): Map<String, Any?> {
        val wv = webView ?: return mapOf("currentIndex" to -1, "history" to emptyList<Any>())
        val list = wv.copyBackForwardList()
        val history = (0 until list.size).map { i ->
            val item = list.getItemAtIndex(i)
            mapOf("url" to item.url, "title" to (item.title ?: ""))
        }
        return mapOf("currentIndex" to list.currentIndex, "history" to history)
    }

    /**
     * Pauses WebView V8 JavaScript execution and animation frames for background RAM trimming (Pillar 5).
     * Disables offscreen pre-rasterization to drop background memory consumption below 8MB.
     * Note: Does NOT call process-wide pauseTimers() to avoid freezing other WebViews.
     */
    fun onPause() {
        lifecycleManager.enterBackground()
        webView?.let { wv ->
            wv.onPause()
            try {
                wv.settings.offscreenPreRaster = false
            } catch (e: Exception) {
                // Handled in headless environments
            }
        }
    }

    /**
     * Resumes WebView V8 execution and restores pre-rasterization when the screen is foregrounded.
     */
    fun onResume() {
        lifecycleManager.enterForeground()
        webView?.let { wv ->
            wv.onResume()
            try {
                wv.settings.offscreenPreRaster = true
            } catch (e: Exception) {
                // Handled in headless environments
            }
        }
    }

    /**
     * Handles Android OS memory trimming alerts (ComponentCallbacks2).
     *
     * @param level Memory pressure level from [android.content.ComponentCallbacks2].
     */
    @Suppress("DEPRECATION")
    private val themeListener = com.goat.webview.design.GoatThemeManager.Listener { pushDesignTokens() }
    private val designListener = com.goat.webview.design.GoatDesignManager.Listener { pushDesignTokens() }

    /**
     * Re-applies host tokens to a page that is already loaded.
     *
     * The document-start script only runs on navigation, so a host that changes theme while a
     * mini-app is open would otherwise show stale colours until the next load.
     */
    private fun pushDesignTokens() {
        val js = com.goat.webview.design.GoatDesignBootstrap.buildUpdateScript(
            com.goat.webview.design.GoatThemeManager.current,
            com.goat.webview.design.GoatDesignManager.current
        )
        try {
            post { webView?.evaluateJavascript(js, null) }
        } catch (_: Throwable) {
        }
    }

    fun onTrimMemory(level: Int) {
        lifecycleManager.dispatchMemoryWarning(level)
        if (level >= android.content.ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW ||
            level == android.content.ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN
        ) {
            webView?.clearCache(false)
            webView?.freeMemory()
        }
    }

    /**
     * Re-attaches a fully-warm pooled WebView (page + JS heap intact) into this fresh GoatView.
     * Only the client delegates and the message-listener closure are re-bound — no settings pass,
     * no navigation. `onPageStarted`/`onPageFinished` fire on the next frame so an embedder waiting
     * for "ready" is signalled without a reload.
     */
    private fun attachHot(
        wv: WebView,
        activeContext: Context,
        appId: String,
        assetDir: File?,
        allowedOrigins: Set<String>,
        immediateReady: Boolean = false
    ) {
        // Bind dedicated multi-profile components on hot re-attach
        try {
            if (WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE)) {
                val profileName = GoatCookieManager.getProfileName(appId)
                val profile = ProfileStore.getInstance().getOrCreateProfile(profileName)
                if (profile != null) {
                    tenantProfile = profile
                    tenantCookieManager = try { profile.cookieManager } catch (_: Throwable) { null }
                    tenantWebStorage = try { profile.webStorage } catch (_: Throwable) { null }
                    tenantGeolocationPermissions = try { profile.geolocationPermissions } catch (_: Throwable) { null }
                    tenantServiceWorkerController = try { profile.serviceWorkerController } catch (_: Throwable) { null }
                }
            }
        } catch (e: Throwable) {
            Log.w(TAG, "Profile bind on hot attach failed: ${e.message}")
        }

        // Re-point the (already-registered) bridge listener at this fresh view — no listener churn,
        // so window.nativeBridge on the live page keeps working.
        GoatFastPool.bindRouter(wv) { action, payload ->
            onBridgeAction?.invoke(action, payload)
                ?: requireActionHandler()?.executeAction(action, payload)
                ?: Result.failure(IllegalStateException("Action handler not initialized"))
        }

        initialEntryUrl = wv.url ?: initialEntryUrl
        lastKnownUrl = wv.url ?: lastKnownUrl
        lastKnownTitle = wv.title ?: lastKnownTitle
        lastKnownRouteHash = extractRouteHash(lastKnownUrl) ?: lastKnownRouteHash
        saveSessionState()

        wv.webViewClient = GoatWebViewClient(
            context = activeContext,
            extractedDir = assetDir,
            appId = appId,
            onPageStarted = {
                // A new route must not inherit the previous one's closing behaviour, or a
                // confirmation armed on a form screen would keep blocking dismissal after the
                // user navigated away from it (Task 10173).
                com.goat.webview.ui.GoatClosingBehaviorController.resetForNewRoute()
                val curUrl = webView?.url
                if (!curUrl.isNullOrBlank() && curUrl != "about:blank") {
                    lastKnownUrl = curUrl
                    extractRouteHash(curUrl)?.let { lastKnownRouteHash = it }
                }
                saveSessionState()
                onPageStarted?.invoke()
            },
            onPageLoaded = {
                swipeRefreshLayout?.isRefreshing = false
                val curUrl = webView?.url
                if (!curUrl.isNullOrBlank() && curUrl != "about:blank") {
                    lastKnownUrl = curUrl
                    extractRouteHash(curUrl)?.let { lastKnownRouteHash = it }
                }
                val curTitle = webView?.title
                if (!curTitle.isNullOrBlank()) {
                    lastKnownTitle = curTitle
                }
                saveSessionState()
                onPageFinished?.invoke()
            },
            onRenderCrashed = { didCrash ->
                onError?.invoke("Render process crashed: didCrash=$didCrash")
                onAppServiceCrash?.invoke(appId, "Render process crashed: didCrash=$didCrash", null)
            },
            compatExternalSchemeResolver = compatExternalSchemeResolver,
            compatExternalLinkHosts = compatExternalLinkHosts,
            onExternalNavigation = { url -> onExternalNavigation?.invoke(url) },
            onReceivedErrorCompat = { url, code, desc -> onReceivedErrorCompat?.invoke(url, code, desc) },
            onReceivedHttpErrorCompat = { url, status -> onReceivedHttpErrorCompat?.invoke(url, status) },
            onPageCommitVisibleCompat = { url -> onPageCommitVisibleCompat?.invoke(url) },
            onLoadResourceCompat = { url -> onLoadResourceCompat?.invoke(url) },
            onUpdateVisitedHistoryCompat = { url, isReload ->
                if (url.isNotBlank() && url != "about:blank") {
                    lastKnownUrl = url
                    extractRouteHash(url)?.let { lastKnownRouteHash = it }
                    saveSessionState()
                }
                onUpdateVisitedHistoryCompat?.invoke(url, isReload)
            },
            onRehydrationHandler = { didCrash ->
                rehydrateAfterCrash(didCrash)
            }
        )
        if (wv.webChromeClient == null) {
            wv.webChromeClient = createWebChromeClient(activeContext, appId)
        }

        webView = wv
        com.goat.webview.design.GoatThemeManager.addListener(themeListener)
        com.goat.webview.design.GoatDesignManager.addListener(designListener)
        attachWebViewToHierarchy(wv)
        try { wv.onResume() } catch (_: Throwable) {}
        onPageStarted?.invoke()
        if (immediateReady) {
            // In-place swap: the embedder is already subscribed — signal now, no yield.
            onPageFinished?.invoke()
        } else {
            // Fresh mount: yield once so an embedder subscribing in its platform-view-created
            // callback is listening before "ready" fires (broadcast streams do not buffer).
            viewScope.launch { onPageFinished?.invoke() }
        }
        // Fire the app-level re-render hook off the ready path.
        try {
            wv.evaluateJavascript(
                "try{window.dispatchEvent(new Event('goat:reactivate'))}catch(e){}", null
            )
        } catch (_: Throwable) {}
    }

    private fun createWebChromeClient(activeContext: Context, appId: String): WebChromeClient {
        return object : WebChromeClient() {
            override fun onReceivedTitle(view: WebView?, title: String?) {
                super.onReceivedTitle(view, title)
                if (!title.isNullOrBlank()) {
                    lastKnownTitle = title
                    saveSessionState()
                }
            }

            override fun onConsoleMessage(message: ConsoleMessage?): Boolean {
                Log.d("GoatWebConsole", "[${message?.messageLevel()}] ${message?.message()}")
                onConsoleMessageCompat?.invoke(
                    message?.message() ?: "",
                    message?.messageLevel()?.name?.lowercase() ?: "log"
                )
                return true
            }

            override fun onCreateWindow(
                view: WebView?,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: android.os.Message?
            ): Boolean {
                val customListen = object : GoatPopupListener {
                    override fun onPopupRequest(request: GoatPopupRequest): GoatPopupRoutingPolicy? {
                        return onPopupRequest?.invoke(request) ?: popupListener?.onPopupRequest(request)
                    }
                    override fun onModalWindowCreated(modalView: GoatView, request: GoatPopupRequest) {
                        popupListener?.onModalWindowCreated(modalView, request)
                    }
                    override fun onModalWindowClosed(modalView: GoatView) {
                        popupListener?.onModalWindowClosed(modalView)
                    }
                }
                return GoatPopupManager.handleCreateWindow(
                    parentGoatView = this@GoatView,
                    isDialog = isDialog,
                    isUserGesture = isUserGesture,
                    resultMsg = resultMsg,
                    customListener = customListen,
                    routingPolicy = defaultPopupRoutingPolicy,
                    eventCoalescer = actionHandler?.coalescer
                )
            }

            override fun onCloseWindow(window: WebView?) {
                GoatPopupManager.handleCloseWindow(window)
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                val customChooser = onFileChooserRequested
                if (customChooser != null) {
                    return customChooser(filePathCallback, fileChooserParams?.acceptTypes)
                }
                return false
            }

            override fun onPermissionRequest(request: android.webkit.PermissionRequest?) {
                if (request == null) return
                val resources = request.resources ?: return
                val scope = when {
                    resources.contains(android.webkit.PermissionRequest.RESOURCE_VIDEO_CAPTURE) -> com.goat.webview.GoatPermissionManager.SCOPE_CAMERA
                    resources.contains(android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE) -> com.goat.webview.GoatPermissionManager.SCOPE_RECORD
                    else -> "web_resource"
                }

                val act = activeContext as? android.app.Activity
                val isPermanentlyDenied = if (act != null) {
                    val perm = when (scope) {
                        com.goat.webview.GoatPermissionManager.SCOPE_CAMERA -> android.Manifest.permission.CAMERA
                        com.goat.webview.GoatPermissionManager.SCOPE_RECORD -> android.Manifest.permission.RECORD_AUDIO
                        else -> null
                    }
                    if (perm != null) com.goat.webview.permission.GoatPermissionPrimingDialog.isPermanentlyDenied(act, perm) else false
                } else false

                com.goat.webview.permission.GoatPermissionPrimingDialog.show(
                    context = activeContext,
                    appId = appId,
                    scope = scope,
                    rationale = "Mini-App '$appId' is requesting access to $scope to enable interactive features.",
                    isPermanentlyDenied = isPermanentlyDenied,
                    onAccept = {
                        request.grant(resources)
                    },
                    onDenied = {
                        request.deny()
                    }
                )
            }
        }
    }

    /**
     * Transparently rehydrates a fresh WebView surface after a Chromium renderer crash or LMK termination,
     * restoring navigation state, route hash, and bridge routers without host app crash.
     */
    internal fun rehydrateAfterCrash(didCrash: Boolean) {
        onError?.invoke("Render process crashed: didCrash=$didCrash")
        onAppServiceCrash?.invoke(currentAppId, "Render process crashed: didCrash=$didCrash", null)

        val activeContext = context ?: hostContext
        val now = System.currentTimeMillis()

        // 1. Anti-crash-loop circuit breaker (max 3 crashes within 15 seconds)
        if (now - lastCrashTimestamp < CRASH_WINDOW_MS) {
            consecutiveCrashCount++
        } else {
            consecutiveCrashCount = 1
        }
        lastCrashTimestamp = now

        if (consecutiveCrashCount > MAX_CONSECUTIVE_CRASHES) {
            Log.e(TAG, "Renderer crash loop detected ($consecutiveCrashCount crashes in ${CRASH_WINDOW_MS}ms). Disarming auto-rehydration.")
            onError?.invoke("Renderer crash loop detected for mini-app '$currentAppId'")
            return
        }

        // 2. Snapshot current session state
        val snapshot = currentSessionSnapshot ?: saveSessionState()
        val restoreUrl = snapshot.resolveRestoreUrl()

        // 3. Clean teardown of dead reference
        val oldWv = webView
        if (oldWv != null) {
            try {
                (oldWv.parent as? ViewGroup)?.removeView(oldWv)
                oldWv.destroy()
            } catch (_: Throwable) {}
            webView = null
        }
        dismissFindOverlayIfPresent()
        cachedFindAdapter = null
        cachedFindAdapterWebView = null

        // 4. Acquire fresh surface from GoatFastPool
        val freshWv = GoatFastPool.acquire(activeContext, currentAppId).apply {
            // Multi-Profile tenant isolation
            try {
                if (WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE)) {
                    val profileName = GoatCookieManager.getProfileName(currentAppId)
                    val profile = ProfileStore.getInstance().getOrCreateProfile(profileName)
                    if (profile != null) {
                        if (profileName != Profile.DEFAULT_PROFILE_NAME) {
                            try {
                                WebViewCompat.setProfile(this, profile.name)
                            } catch (e: Throwable) {
                                Log.w(TAG, "Failed setting profile '$profileName': ${e.message}")
                            }
                        }
                        tenantProfile = profile
                        tenantCookieManager = try { profile.cookieManager } catch (_: Throwable) { null }
                        tenantWebStorage = try { profile.webStorage } catch (_: Throwable) { null }
                        tenantGeolocationPermissions = try { profile.geolocationPermissions } catch (_: Throwable) { null }
                        tenantServiceWorkerController = try { profile.serviceWorkerController } catch (_: Throwable) { null }
                    }
                }
            } catch (e: Throwable) {
                Log.w(TAG, "MULTI_PROFILE rehydration setup skipped: ${e.message}")
            }

            layoutParams = LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.TRANSPARENT)

            val urlMode = currentAssetDir == null
            val needsFileAccess = urlMode && restoreUrl.startsWith("file:")
            try {
                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = !incognito
                    try {
                        setSupportMultipleWindows(true)
                    } catch (_: Throwable) {}
                    try {
                        javaScriptCanOpenWindowsAutomatically = true
                    } catch (_: Throwable) {}
                    cacheMode = if (incognito) WebSettings.LOAD_NO_CACHE else WebSettings.LOAD_DEFAULT
                    allowFileAccess = needsFileAccess
                    allowContentAccess = false
                    allowFileAccessFromFileURLs = needsFileAccess
                    allowUniversalAccessFromFileURLs = false
                    setSupportZoom(false)
                    builtInZoomControls = false
                    displayZoomControls = false
                    useWideViewPort = true
                    loadWithOverviewMode = true
                    textZoom = snapshot.textZoom
                }
            } catch (_: Throwable) {}

            // Algorithmic Darkening Sync
            try {
                if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
                    val isDark = isNightMode(activeContext.resources?.configuration?.uiMode ?: 0)
                    WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, isDark)
                }
            } catch (_: Throwable) {}

            // Re-bind WebMessageListener & GoatFastPool router
            val bridgeWebView = this
            GoatFastPool.bindRouter(bridgeWebView) { action, payload ->
                onBridgeAction?.invoke(action, payload)
                    ?: requireActionHandler()?.executeAction(action, payload)
                    ?: Result.failure(IllegalStateException("Action handler not initialized"))
            }

            val clientDomain = GoatWebViewClient.resolveDomain(currentAppId)
            val allowedOrigins = if (urlMode) {
                WILDCARD_ORIGIN_SET
            } else {
                setOf("https://$clientDomain", "https://appassets.androidplatform.net")
            }

            try {
                if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
                    WebViewCompat.addWebMessageListener(
                        this,
                        BRIDGE_NAME,
                        allowedOrigins,
                        GoatWebMessageListener(viewScope, currentSenderOrigins) { action, payload ->
                            GoatFastPool.routeBridge(bridgeWebView, action, payload)
                        }
                    )
                }
            } catch (_: Throwable) {}

            // Re-inject Document Start Scripts
            try {
                if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                    WebViewCompat.addDocumentStartJavaScript(
                        this,
                        com.goat.webview.design.GoatDesignBootstrap.buildScript(
                            com.goat.webview.design.GoatThemeManager.current,
                            com.goat.webview.design.GoatDesignManager.current
                        ),
                        allowedOrigins
                    )
                    if (web3ProvidersEnabled) {
                        WebViewCompat.addDocumentStartJavaScript(
                            this,
                            com.goat.webview.web3.GoatWeb3Bootstrap.buildScript(),
                            allowedOrigins
                        )
                    }
                    val scripts = initialUserScripts
                    if (scripts.isNotEmpty()) {
                        for (source in scripts) {
                            if (source.isNotEmpty()) {
                                WebViewCompat.addDocumentStartJavaScript(this, source, allowedOrigins)
                            }
                        }
                    }
                }
            } catch (_: Throwable) {}

            // Download Listener
            setDownloadListener { url, _, contentDisposition, mimetype, _ ->
                viewScope.launch {
                    val guessedName = URLUtil.guessFileName(url, contentDisposition, mimetype)
                    val payload = buildJsonObject {
                        put("url", url)
                        put("fileName", guessedName)
                        put("title", guessedName)
                    }
                    requireActionHandler()?.executeAction("DOWNLOAD_FILE", payload)
                }
            }

            webViewClient = GoatWebViewClient(
                context = activeContext,
                extractedDir = currentAssetDir,
                appId = currentAppId,
                manifestDomainAllowlist = currentDomainAllowlist.takeIf { it.isNotEmpty() },
                onPageStarted = {
                    com.goat.webview.ui.GoatClosingBehaviorController.resetForNewRoute()
                    val curUrl = webView?.url
                    if (!curUrl.isNullOrBlank() && curUrl != "about:blank") {
                        lastKnownUrl = curUrl
                        extractRouteHash(curUrl)?.let { lastKnownRouteHash = it }
                    }
                    saveSessionState()
                    onPageStarted?.invoke()
                },
                onPageLoaded = {
                    swipeRefreshLayout?.isRefreshing = false
                    val curUrl = webView?.url
                    if (!curUrl.isNullOrBlank() && curUrl != "about:blank") {
                        lastKnownUrl = curUrl
                        extractRouteHash(curUrl)?.let { lastKnownRouteHash = it }
                    }
                    val curTitle = webView?.title
                    if (!curTitle.isNullOrBlank()) {
                        lastKnownTitle = curTitle
                    }
                    saveSessionState()
                    onPageFinished?.invoke()
                },
                onRenderCrashed = { crashed ->
                    // Handled in onRehydrationHandler
                },
                compatExternalSchemeResolver = compatExternalSchemeResolver,
                compatExternalLinkHosts = compatExternalLinkHosts,
                onExternalNavigation = { url -> onExternalNavigation?.invoke(url) },
                onReceivedErrorCompat = { url, code, desc -> onReceivedErrorCompat?.invoke(url, code, desc) },
                onReceivedHttpErrorCompat = { url, status -> onReceivedHttpErrorCompat?.invoke(url, status) },
                onPageCommitVisibleCompat = { url -> onPageCommitVisibleCompat?.invoke(url) },
                onLoadResourceCompat = { url -> onLoadResourceCompat?.invoke(url) },
                onUpdateVisitedHistoryCompat = { url, isReload ->
                    if (url.isNotBlank() && url != "about:blank") {
                        lastKnownUrl = url
                        extractRouteHash(url)?.let { lastKnownRouteHash = it }
                        saveSessionState()
                    }
                    onUpdateVisitedHistoryCompat?.invoke(url, isReload)
                },
                onRehydrationHandler = { crashed ->
                    rehydrateAfterCrash(crashed)
                }
            )

            webChromeClient = createWebChromeClient(activeContext, currentAppId)
        }

        // 5. Re-attach to View Hierarchy
        webView = freshWv
        attachWebViewToHierarchy(freshWv)

        // 6. Restore Navigation State
        val restored = snapshot.navigationBundle?.let { bundle ->
            try { freshWv.restoreState(bundle) != null } catch (_: Throwable) { false }
        } ?: false

        val freshUrl = try { freshWv.url } catch (_: Throwable) { null }
        if (!restored || freshUrl != restoreUrl) {
            if (restoreUrl.isNotBlank()) {
                freshWv.loadUrl(restoreUrl)
            }
        }

        Log.i(TAG, "Transparent renderer crash session recovery succeeded for '$currentAppId' -> $restoreUrl (didCrash=$didCrash)")
    }

    /**
     * Disposes the WebView and its associated resources to prevent leaks,
     * recycling clean instances into GoatFastPool.
     */
    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        val orientation = if (w > h) "landscape" else "portrait"
        lifecycleManager.dispatchWindowResize(w, h, w, h, orientation)
    }

    fun destroy() {
        com.goat.webview.design.GoatThemeManager.removeListener(themeListener)
        com.goat.webview.design.GoatDesignManager.removeListener(designListener)
        // Hand the host back its own orientation. A mini-app that locked to landscape must not
        // leave the host app -- or the next mini-app -- stuck there (Task 10175, rule 1).
        lifecycleManager.terminate()
        com.goat.webview.ui.GoatOrientationController.releaseToHost(
            (context ?: hostContext) as? android.app.Activity
        )
        viewScope.cancel()
        dismissFindOverlayIfPresent()
        cachedFindAdapter = null
        cachedFindAdapterWebView = null
        val wv = webView
        if (wv != null) {
            val hk = if (hotReuseEnabled) currentHotKey else null
            val parked = GoatFastPool.recycle(wv, hk, if (hk != null) actionHandler else null) && hk != null
            if (!parked) actionHandler?.cancelCoalescedEventsIfActive()
        }
        actionHandler = null
        webView = null
        tenantProfile = null
        tenantCookieManager = null
        tenantWebStorage = null
        tenantGeolocationPermissions = null
        tenantServiceWorkerController = null
        swipeRefreshLayout = null
        currentSessionSnapshot = null
        initialEntryUrl = null
        lastKnownUrl = null
        lastKnownTitle = null
        lastKnownRouteHash = null
        consecutiveCrashCount = 0
        lastCrashTimestamp = 0L
        removeAllViews()
    }
}
