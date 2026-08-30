package com.goat.webview.popup

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Message
import android.util.Log
import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import com.goat.webview.GoatAssetManager
import com.goat.webview.GoatFastPool
import com.goat.webview.GoatStorageManager
import com.goat.webview.GoatWebViewClient
import com.goat.webview.ipc.GoatEventCoalescer
import com.goat.webview.ui.GoatExternalLinkWarningDialog
import com.goat.webview.view.GoatView
import java.io.File
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Enterprise popup window and target="_blank" native routing orchestrator (Task 10183 / Pillar 1 & 2).
 *
 * Intercepts `window.open()` and `<a target="_blank">` navigation requests, applies origin-aware routing
 * policies, emits `ON_POPUP_REQUEST` bridge telemetry, manages secondary modal window presentation with
 * shared tenant storage sandboxes, and guarantees leak-free modal recycling.
 */
object GoatPopupManager {
    private const val TAG = "GoatPopupManager"

    // Active modal containers keyed by container ID
    private val activeModals = ConcurrentHashMap<String, GoatModalContainer>()

    // Global listener fallback
    var globalPopupListener: GoatPopupListener? = null

    // Default policy
    var defaultRoutingPolicy: GoatPopupRoutingPolicy = GoatPopupRoutingPolicy.AUTO

    /**
     * Classifies a target URL into a default [GoatPopupRoutingPolicy] based on origin, virtual domain, and scheme.
     *
     * @param targetUrl The destination URL string.
     * @param parentAppId The calling mini-app tenant identifier.
     * @param parentDomain The virtual domain of the calling tenant (defaults to resolved domain).
     * @return Calculated [GoatPopupRoutingPolicy].
     */
    fun classifyPopupOrigin(
        targetUrl: String?,
        parentAppId: String,
        parentDomain: String = GoatWebViewClient.resolveDomain(parentAppId)
    ): GoatPopupRoutingPolicy {
        if (targetUrl.isNullOrBlank() || targetUrl == "about:blank") {
            return GoatPopupRoutingPolicy.MODAL
        }

        val uri = try {
            Uri.parse(targetUrl)
        } catch (e: Exception) {
            return GoatPopupRoutingPolicy.BLOCK
        }

        val scheme = try { uri.scheme?.lowercase() ?: "" } catch (_: Throwable) { "" }
        val hostFromUri = try { uri.host?.lowercase() ?: "" } catch (_: Throwable) { "" }
        val host = if (hostFromUri.isNotEmpty()) {
            hostFromUri
        } else {
            // Fallback for URIs where Uri.host is null (e.g. host with underscores or non-RFC2396 in mock)
            val doubleSlash = targetUrl.indexOf("://")
            if (doubleSlash != -1) {
                val rest = targetUrl.substring(doubleSlash + 3)
                val slashIdx = rest.indexOfAny(charArrayOf('/', '?', '#', ':'))
                val hostPort = if (slashIdx != -1) rest.substring(0, slashIdx) else rest
                val atIdx = hostPort.lastIndexOf('@')
                val cleanHost = if (atIdx != -1) hostPort.substring(atIdx + 1) else hostPort
                cleanHost.lowercase()
            } else {
                ""
            }
        }

        // 1. Dangerous & forbidden schemes: unconditionally block
        if (scheme in setOf("file", "javascript", "data", "content")) {
            Log.w(TAG, "Blocked popup request with forbidden scheme: $scheme")
            return GoatPopupRoutingPolicy.BLOCK
        }

        // 2. Relative paths or hash routes -> Same Origin (MODAL)
        val isRelative = scheme.isEmpty() ||
            targetUrl.startsWith("/") ||
            targetUrl.startsWith("./") ||
            targetUrl.startsWith("../") ||
            targetUrl.startsWith("#") ||
            targetUrl.startsWith("?")

        if (isRelative) {
            return GoatPopupRoutingPolicy.MODAL
        }

        // 3. Virtual Goat custom schemes: goat://<appId>/... or goat://assets/...
        if (scheme == "goat") {
            val pathAppId = host.ifEmpty { try { uri.authority?.lowercase() ?: "" } catch (_: Throwable) { "" } }
            return if (pathAppId.equals(parentAppId, ignoreCase = true) || pathAppId == "assets" || pathAppId.isEmpty()) {
                GoatPopupRoutingPolicy.MODAL
            } else {
                GoatPopupRoutingPolicy.SYSTEM_BROWSER
            }
        }

        // 4. Virtual HTTPS Domain: https://<appId>.appassets.androidplatform.net or https://appassets.androidplatform.net
        if (scheme == "https" || scheme == "http") {
            // Anti-phishing check: host is already extracted by Uri.parse ignoring userinfo
            if (host.isNotEmpty()) {
                if (host == parentDomain || host == GoatWebViewClient.DEFAULT_DOMAIN) {
                    return GoatPopupRoutingPolicy.MODAL
                }

                // Subdomain matching for multi-tenant virtual domains
                if (host.endsWith(".appassets.androidplatform.net")) {
                    val tenantPrefix = host.removeSuffix(".appassets.androidplatform.net")
                    val sanitizedParent = try {
                        GoatStorageManager.sanitizeIdentifier(parentAppId)
                    } catch (e: Exception) {
                        ""
                    }
                    return if (tenantPrefix.equals(sanitizedParent, ignoreCase = true)) {
                        GoatPopupRoutingPolicy.MODAL
                    } else {
                        GoatPopupRoutingPolicy.SYSTEM_BROWSER
                    }
                }
            }

            return GoatPopupRoutingPolicy.SYSTEM_BROWSER
        }

        // 5. System URL Schemes (tel, mailto, sms, geo) -> SYSTEM_BROWSER
        if (scheme in setOf("tel", "mailto", "sms", "geo")) {
            return GoatPopupRoutingPolicy.SYSTEM_BROWSER
        }

        // Fallback to BLOCK for unknown schemes
        return GoatPopupRoutingPolicy.BLOCK
    }

    /**
     * Handles `WebChromeClient.onCreateWindow` invoked by Chromium when JavaScript executes `window.open()`
     * or a user taps a `target="_blank"` link.
     */
    fun handleCreateWindow(
        parentGoatView: GoatView,
        isDialog: Boolean,
        isUserGesture: Boolean,
        resultMsg: Message?,
        customListener: GoatPopupListener? = null,
        routingPolicy: GoatPopupRoutingPolicy = GoatPopupRoutingPolicy.AUTO,
        featuresString: String? = null,
        eventCoalescer: GoatEventCoalescer? = null
    ): Boolean {
        val activeContext = parentGoatView.context
        val underlyingWv = parentGoatView.getUnderlyingWebView()
        val targetUrl = try {
            underlyingWv?.hitTestResult?.extra ?: ""
        } catch (_: Throwable) {
            ""
        }

        return handleCreateWindow(
            parentWebView = underlyingWv,
            parentContainer = parentGoatView,
            context = activeContext,
            appId = parentGoatView.currentAppId,
            assetDir = parentGoatView.currentAssetDir ?: File(activeContext.filesDir, "assets"),
            isDialog = isDialog,
            isUserGesture = isUserGesture,
            resultMsg = resultMsg,
            customListener = customListener ?: parentGoatView.popupListener ?: globalPopupListener,
            routingPolicy = if (routingPolicy != GoatPopupRoutingPolicy.AUTO) routingPolicy else parentGoatView.defaultPopupRoutingPolicy,
            initialUrl = targetUrl,
            featuresString = featuresString,
            eventCoalescer = eventCoalescer,
            parentGoatView = parentGoatView
        )
    }

    /**
     * Overloaded `handleCreateWindow` allowing invocation from Compose or custom view containers.
     */
    fun handleCreateWindow(
        parentWebView: WebView?,
        parentContainer: ViewGroup?,
        context: Context,
        appId: String,
        assetDir: File,
        isDialog: Boolean,
        isUserGesture: Boolean,
        resultMsg: Message?,
        customListener: GoatPopupListener? = null,
        routingPolicy: GoatPopupRoutingPolicy = GoatPopupRoutingPolicy.AUTO,
        initialUrl: String = "",
        featuresString: String? = null,
        eventCoalescer: GoatEventCoalescer? = null,
        parentGoatView: GoatView? = null
    ): Boolean {
        if (resultMsg == null) return false
        val transport = resultMsg.obj as? WebView.WebViewTransport ?: return false

        val parentDomain = GoatWebViewClient.resolveDomain(appId)
        val features = GoatWindowFeatures.parse(featuresString)

        // 1. Calculate default origin-based routing policy
        val originPolicy = classifyPopupOrigin(initialUrl, appId, parentDomain)

        // 2. Resolve configured host policy (AUTO defers to originPolicy, others take precedence unless origin is BLOCK)
        val effectiveBasePolicy = if (originPolicy == GoatPopupRoutingPolicy.BLOCK) {
            GoatPopupRoutingPolicy.BLOCK
        } else if (routingPolicy != GoatPopupRoutingPolicy.AUTO) {
            routingPolicy
        } else {
            originPolicy
        }

        // 3. Build request event
        val request = GoatPopupRequest(
            url = initialUrl,
            target = "_blank",
            policy = effectiveBasePolicy,
            isUserGesture = isUserGesture,
            isDialog = isDialog,
            windowFeatures = features,
            parentAppId = appId
        )

        // 4. Allow listener to observe or override policy
        val listener = customListener ?: globalPopupListener
        val resolvedPolicy = listener?.onPopupRequest(request) ?: effectiveBasePolicy

        // 5. Emit ON_POPUP_REQUEST event telemetry
        emitPopupRequestEvent(request.copy(policy = resolvedPolicy), eventCoalescer, parentGoatView ?: (parentContainer as? GoatView))

        // 6. Execute routing action
        return when (resolvedPolicy) {
            GoatPopupRoutingPolicy.SYSTEM_BROWSER -> {
                handleSystemBrowserRouting(context, appId, transport, resultMsg, initialUrl)
            }
            GoatPopupRoutingPolicy.MODAL -> {
                handleModalRouting(
                    parentContainer = parentContainer,
                    context = context,
                    appId = appId,
                    assetDir = assetDir,
                    transport = transport,
                    resultMsg = resultMsg,
                    request = request.copy(policy = resolvedPolicy),
                    listener = listener,
                    parentGoatView = parentGoatView
                )
            }
            GoatPopupRoutingPolicy.SAME_FRAME -> {
                if (initialUrl.isNotBlank() && originPolicy != GoatPopupRoutingPolicy.BLOCK) {
                    parentWebView?.loadUrl(initialUrl)
                }
                false
            }
            GoatPopupRoutingPolicy.BLOCK -> {
                Log.w(TAG, "Popup creation request blocked by policy for URL: $initialUrl")
                false
            }
            GoatPopupRoutingPolicy.AUTO -> {
                // Should not occur as AUTO resolves to originPolicy, but fallback to MODAL or BROWSER safely
                if (originPolicy == GoatPopupRoutingPolicy.MODAL) {
                    handleModalRouting(parentContainer, context, appId, assetDir, transport, resultMsg, request, listener, parentGoatView)
                } else {
                    handleSystemBrowserRouting(context, appId, transport, resultMsg, initialUrl)
                }
            }
        }
    }

    private fun handleSystemBrowserRouting(
        context: Context,
        appId: String,
        transport: WebView.WebViewTransport,
        resultMsg: Message,
        initialUrl: String
    ): Boolean {
        // Create transient temporary WebView to capture dynamic URL from Chromium's transport handshake
        val tempWebView = WebView(context)
        tempWebView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val destUrl = request?.url?.toString() ?: initialUrl
                if (destUrl.isNotBlank()) {
                    val scheme = try { request?.url?.scheme?.lowercase() ?: "" } catch (_: Throwable) { "" }

                    // Direct OS Intent for system URI schemes (tel:, mailto:, sms:, geo:)
                    if (scheme in setOf("tel", "mailto", "sms", "geo")) {
                        try {
                            val intent = Intent(Intent.ACTION_VIEW, request?.url).apply {
                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            }
                            context.startActivity(intent)
                        } catch (e: Exception) {
                            Log.e(TAG, "Failed launching system intent for scheme $scheme", e)
                        }
                    } else {
                        // External web URL: present warning dialog before browser launch
                        GoatExternalLinkWarningDialog.show(
                            context = context,
                            appId = appId,
                            destinationUrl = destUrl,
                            onConfirm = {
                                GoatExternalLinkWarningDialog.openInSystemBrowser(context, destUrl)
                            },
                            onCancel = {
                                Log.d(TAG, "User cancelled external navigation to $destUrl")
                            }
                        )
                    }
                }

                try {
                    tempWebView.stopLoading()
                    tempWebView.destroy()
                } catch (_: Exception) {}
                return true
            }
        }

        transport.webView = tempWebView
        resultMsg.sendToTarget()
        return true
    }

    private fun handleModalRouting(
        parentContainer: ViewGroup?,
        context: Context,
        appId: String,
        assetDir: File,
        transport: WebView.WebViewTransport,
        resultMsg: Message,
        request: GoatPopupRequest,
        listener: GoatPopupListener?,
        parentGoatView: GoatView?
    ): Boolean {
        val containerId = "modal_${UUID.randomUUID().toString().replace("-", "").take(8)}"
        val modalView = GoatView(context)
        modalView.initialize(assetDir = assetDir, appId = appId)

        val modalContainer = GoatModalContainer(
            context = context,
            containerId = containerId,
            modalGoatView = modalView,
            features = request.windowFeatures,
            onDismiss = {
                activeModals.remove(containerId)
                listener?.onModalWindowClosed(modalView)
                try { parentGoatView?.requestFocus() } catch (_: Throwable) {}
                try { parentContainer?.requestFocus() } catch (_: Throwable) {}
            }
        )

        activeModals[containerId] = modalContainer

        // Attach modal container to the parent view hierarchy
        if (parentContainer != null) {
            modalContainer.attachToParent(parentContainer)
        }

        val childWebView = modalView.getUnderlyingWebView()
        if (childWebView != null) {
            transport.webView = childWebView
            resultMsg.sendToTarget()
            listener?.onModalWindowCreated(modalView, request)
            return true
        } else {
            activeModals.remove(containerId)
            modalContainer.dismiss()
            return false
        }
    }

    /**
     * Handles `WebChromeClient.onCloseWindow` when JavaScript executes `window.close()`.
     * Dismisses the matching modal container and recycles the child WebView.
     */
    fun handleCloseWindow(childWebView: WebView?): Boolean {
        if (childWebView == null) return false

        val matchingEntry = activeModals.entries.firstOrNull {
            it.value.modalGoatView.getUnderlyingWebView() == childWebView
        } ?: return false

        val container = matchingEntry.value
        activeModals.remove(matchingEntry.key)
        container.dismiss()
        return true
    }

    /**
     * Dispatches `ON_POPUP_REQUEST` event to coalescer and JavaScript bridge.
     */
    private fun emitPopupRequestEvent(
        request: GoatPopupRequest,
        eventCoalescer: GoatEventCoalescer?,
        parentGoatView: GoatView?
    ) {
        val payload = request.toJsonObject()

        // 1. Dispatch via event coalescer if configured
        eventCoalescer?.emit("ON_POPUP_REQUEST", payload) { _, _ -> }

        // 2. Broadcast event to parent frame JavaScript runtime
        try {
            val script = "window.dispatchEvent(new CustomEvent('ON_POPUP_REQUEST', { detail: ${payload} }));"
            parentGoatView?.evaluateJavascript(script)
        } catch (_: Throwable) {}
    }

    /**
     * Explicitly dismisses an active modal container by ID.
     */
    fun dismissModal(containerId: String): Boolean {
        val container = activeModals.remove(containerId) ?: return false
        container.dismiss()
        return true
    }

    /**
     * Dismisses all active modal windows and recycles their WebViews.
     */
    fun dismissAllModals() {
        val containers = activeModals.values.toList()
        activeModals.clear()
        containers.forEach { it.dismiss() }
    }

    /**
     * Returns the count of currently active modal containers.
     */
    fun getActiveModalCount(): Int = activeModals.size

    /**
     * Returns a snapshot map of currently active modal containers.
     */
    fun getActiveModals(): Map<String, GoatModalContainer> = HashMap(activeModals)
}
