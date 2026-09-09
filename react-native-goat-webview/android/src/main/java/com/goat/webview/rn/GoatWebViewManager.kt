package com.goat.webview.rn

import android.view.ViewGroup
import android.widget.FrameLayout
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReactContext
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.RCTEventEmitter
import com.goat.webview.GoatAssetManager
import com.goat.webview.GoatBridgeActionHandler
import com.goat.webview.popup.GoatPopupRequest
import com.goat.webview.popup.GoatPopupRoutingPolicy
import com.goat.webview.view.GoatView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Fabric / RCTViewManager for Goat WebView in React Native.
 * Mounts GoatView and dispatches bridge events to React Native props.
 */
class GoatWebViewManager : SimpleViewManager<GoatView>() {

    companion object {
        const val REACT_CLASS = "GoatWebView"
        const val EVENT_ON_BRIDGE_MESSAGE = "onBridgeMessage"
        const val EVENT_ON_PAGE_STARTED = "onPageStarted"
        const val EVENT_ON_PAGE_LOADED = "onPageLoaded"
        const val EVENT_ON_PROGRESS_CHANGED = "onProgressChanged"
        const val EVENT_ON_RECEIVED_TITLE = "onReceivedTitle"
        const val EVENT_ON_INSETS_CHANGE = "onInsetsChange"
        const val EVENT_ON_SHEET_STATE_CHANGE = "onSheetStateChange"
        const val EVENT_ON_ERROR = "onError"
        const val EVENT_ON_APP_SERVICE_READY = "onAppServiceReady"
        const val EVENT_ON_APP_SERVICE_CRASH = "onAppServiceCrash"
        const val EVENT_ON_APP_SERVICE_TERMINATE = "onAppServiceTerminate"
        const val EVENT_ON_POPUP_REQUEST = "onPopupRequest"
        const val EVENT_ON_HTTP_ERROR = "onHttpError"
        const val EVENT_ON_RENDER_PROCESS_GONE = "onRenderProcessGone"
        const val EVENT_ON_SCROLL = "onScroll"
        const val EVENT_ON_EXTERNAL_NAVIGATION = "onExternalNavigation"
    }

    private val actionHandlers = mutableMapOf<GoatView, GoatBridgeActionHandler>()
    private val initializedViews = mutableSetOf<GoatView>()
    private val pendingUiProps = mutableMapOf<GoatView, MutableMap<String, Any?>>()

    override fun getName(): String = REACT_CLASS

    override fun createViewInstance(reactContext: ThemedReactContext): GoatView {
        val goatView = GoatView(reactContext).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        // Handler that executes native bridge actions for all 141 mini-app APIs.
        val actionHandler = GoatBridgeActionHandler(reactContext, autoRegisterPlugins = true, autoRegisterPayments = true)
        actionHandlers[goatView] = actionHandler

        // Asynchronously initialize assets and mount
        val assetManager = GoatAssetManager(reactContext)
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val assetDir = assetManager.ensureAssetsReady()
                withContext(Dispatchers.Main) {
                    goatView.initialize(assetDir)
                    initializedViews.add(goatView)
                    applyPendingUiProps(goatView)

                    goatView.onBridgeAction = { action, payload ->
                        // Execute natively — this is a suspend call and runs on Dispatchers.Default
                        // inside executeAction. Never returns a fake success.
                        val nativeResult = (actionHandlers[goatView] ?: actionHandler).executeAction(action, payload)
                        // Emit result back to RN on the main thread
                        withContext(Dispatchers.Main) {
                            val event = Arguments.createMap().apply {
                                putString("action", action)
                                putMap("payload", payload.toWritableMap())
                                nativeResult.fold(
                                    onSuccess = { dataJson ->
                                        putBoolean("success", true)
                                        putMap("result", dataJson.toWritableMap())
                                    },
                                    onFailure = { err ->
                                        putBoolean("success", false)
                                        putString("error", err.message ?: "Native error")
                                    }
                                )
                            }
                            reactContext.getJSModule(RCTEventEmitter::class.java)
                                .receiveEvent(goatView.id, EVENT_ON_BRIDGE_MESSAGE, event)
                        }
                        nativeResult
                    }

                    goatView.onPageStarted = {
                        val currentUrl = goatView.getUrl() ?: GoatView.ENTRY_URL
                        val event = Arguments.createMap().apply {
                            putString("url", currentUrl)
                            putString("title", goatView.getTitle() ?: "")
                            putBoolean("loading", true)
                            putBoolean("canGoBack", goatView.canGoBack())
                            putBoolean("canGoForward", goatView.canGoForward())
                        }
                        reactContext.getJSModule(RCTEventEmitter::class.java)
                            .receiveEvent(goatView.id, EVENT_ON_PAGE_STARTED, event)
                    }

                    goatView.onPageFinished = {
                        val currentUrl = goatView.getUrl() ?: GoatView.ENTRY_URL
                        val event = Arguments.createMap().apply {
                            putString("url", GoatView.ENTRY_URL)
                            putString("url", currentUrl)
                            putString("title", goatView.getTitle() ?: "")
                            putBoolean("loading", false)
                            putBoolean("canGoBack", goatView.canGoBack())
                            putBoolean("canGoForward", goatView.canGoForward())
                        }
                        reactContext.getJSModule(RCTEventEmitter::class.java)
                            .receiveEvent(goatView.id, EVENT_ON_PAGE_LOADED, event)
                    }

                    goatView.onError = { desc ->
                        val event = Arguments.createMap().apply {
                            putString("description", desc)
                        }
                        reactContext.getJSModule(RCTEventEmitter::class.java)
                            .receiveEvent(goatView.id, EVENT_ON_ERROR, event)
                    }

                    goatView.onPopupRequest = { req ->
                        val event = Arguments.createMap().apply {
                            putString("url", req.url)
                            putString("target", req.target)
                            putString("policy", req.policy.name)
                            putBoolean("isUserGesture", req.isUserGesture)
                            putBoolean("isDialog", req.isDialog)
                            val wfMap = Arguments.createMap()
                            req.windowFeatures.width?.let { wfMap.putDouble("width", it) }
                            req.windowFeatures.height?.let { wfMap.putDouble("height", it) }
                            req.windowFeatures.x?.let { wfMap.putDouble("x", it) }
                            req.windowFeatures.y?.let { wfMap.putDouble("y", it) }
                            req.windowFeatures.menuBar?.let { wfMap.putBoolean("menuBar", it) }
                            req.windowFeatures.statusBar?.let { wfMap.putBoolean("statusBar", it) }
                            req.windowFeatures.toolbars?.let { wfMap.putBoolean("toolbars", it) }
                            req.windowFeatures.resizable?.let { wfMap.putBoolean("resizable", it) }
                            req.windowFeatures.scrollbars?.let { wfMap.putBoolean("scrollbars", it) }
                            putMap("windowFeatures", wfMap)
                            putString("windowFeaturesJson", req.windowFeatures.toJsonObject().toString())
                        }
                        reactContext.getJSModule(RCTEventEmitter::class.java)
                            .receiveEvent(goatView.id, EVENT_ON_POPUP_REQUEST, event)
                        null
                    }
                    goatView.onReceivedHttpErrorCompat = { url, statusCode ->
                        val event = Arguments.createMap().apply {
                            putString("url", url)
                            putDouble("statusCode", statusCode.toDouble())
                            putString("description", "HTTP $statusCode")
                        }
                        reactContext.getJSModule(RCTEventEmitter::class.java)
                            .receiveEvent(goatView.id, EVENT_ON_HTTP_ERROR, event)
                    }

                    goatView.onExternalNavigation = { url ->
                        val event = Arguments.createMap().apply {
                            putString("url", url)
                        }
                        reactContext.getJSModule(RCTEventEmitter::class.java)
                            .receiveEvent(goatView.id, EVENT_ON_EXTERNAL_NAVIGATION, event)
                    }

                    goatView.onAppServiceCrash = { _, _, _ ->
                        val event = Arguments.createMap().apply {
                            putBoolean("didCrash", true)
                        }
                        reactContext.getJSModule(RCTEventEmitter::class.java)
                            .receiveEvent(goatView.id, EVENT_ON_RENDER_PROCESS_GONE, event)
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    val event = Arguments.createMap().apply {
                        putString("description", e.message ?: "Failed to load assets")
                    }
                    reactContext.getJSModule(RCTEventEmitter::class.java)
                        .receiveEvent(goatView.id, EVENT_ON_ERROR, event)
                }
            }
        }

        goatView.setOnScrollChangeListener { _, scrollX, scrollY, _, _ ->
            val event = Arguments.createMap().apply {
                putDouble("x", scrollX.toDouble())
                putDouble("y", scrollY.toDouble())
            }
            reactContext.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(goatView.id, EVENT_ON_SCROLL, event)
        }

        return goatView
    }

    @ReactProp(name = "popupRoutingPolicy")
    fun setPopupRoutingPolicy(view: GoatView, policy: String?) {
        view.defaultPopupRoutingPolicy = GoatPopupRoutingPolicy.fromString(policy)
    }

    @ReactProp(name = "appId")
    fun setAppId(view: GoatView, appId: String?) {
        val targetAppId = if (!appId.isNullOrBlank()) appId else GoatAssetManager.DEFAULT_APP_ID
        val context = view.context
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val assetManager = GoatAssetManager(context)
                val assetDir = assetManager.ensureAssetsReady(appId = targetAppId)
                withContext(Dispatchers.Main) {
                    view.initialize(assetDir, appId = targetAppId)
                    actionHandlers[view] = GoatBridgeActionHandler(
                        context,
                        appId = targetAppId,
                        autoRegisterPlugins = true,
                        autoRegisterPayments = true
                    )
                    initializedViews.add(view)
                    applyPendingUiProps(view)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    view.onError?.invoke("Failed loading appId $targetAppId: ${e.message}")
                }
            }
        }
    }

    @ReactProp(name = "assetBundleName")
    fun setAssetBundleName(view: GoatView, assetBundleName: String?) {
        if (!assetBundleName.isNullOrBlank()) {
            val context = view.context
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val assetManager = GoatAssetManager(context)
                    val assetDir = assetManager.ensureAssetsReady(bundleAssetPath = assetBundleName)
                    withContext(Dispatchers.Main) {
                        view.initialize(assetDir)
                        initializedViews.add(view)
                        applyPendingUiProps(view)
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        view.onError?.invoke("Failed loading bundle $assetBundleName: ${e.message}")
                    }
                }
            }
        }
    }

    @ReactProp(name = "initialUrl")
    fun setInitialUrl(view: GoatView, initialUrl: String?) {
        if (!initialUrl.isNullOrBlank()) {
            CoroutineScope(Dispatchers.Main).launch {
                try {
                    view.initializeUrlAsync(initialUrl, appId = "default")
                    initializedViews.add(view)
                    applyPendingUiProps(view)
                } catch (e: Exception) {
                    view.onError?.invoke("Failed loading initialUrl $initialUrl: ${e.message}")
                }
            }
        }
    }

    @ReactProp(name = "hostDomainAllowlist")
    fun setHostDomainAllowlist(view: GoatView, hosts: ReadableArray?) {
        val parsed = LinkedHashSet<String>()
        if (hosts != null) {
            for (i in 0 until hosts.size()) {
                hosts.getString(i)?.trim()?.takeIf { it.isNotEmpty() }?.let { parsed.add(it) }
            }
        }
        view.hostDomainAllowlist = parsed.takeIf { it.isNotEmpty() }
    }

    @ReactProp(name = "initialUserScripts")
    fun setInitialUserScripts(view: GoatView, scripts: ReadableArray?) {
        if (scripts != null && scripts.size() > 0) {
            val list = ArrayList<String>(scripts.size())
            for (i in 0 until scripts.size()) {
                scripts.getString(i)?.let { list.add(it) }
            }
            view.initialUserScripts = list
        } else {
            view.initialUserScripts = emptyList()
        }
    }

    @ReactProp(name = "navBarTitle")
    fun setNavBarTitle(view: GoatView, title: String?) {
        recordUiProp(view, "navBarTitle", title)
        dispatchSetNavBarTitle(view)
    }

    @ReactProp(name = "navBarSubtitle")
    fun setNavBarSubtitle(view: GoatView, subtitle: String?) {
        recordUiProp(view, "navBarSubtitle", subtitle)
        dispatchSetNavBarTitle(view)
    }

    @ReactProp(name = "navBarBackgroundColor")
    fun setNavBarBackgroundColor(view: GoatView, backgroundColor: String?) {
        recordUiProp(view, "navBarBackgroundColor", backgroundColor)
        dispatchSetNavBarColor(view)
    }

    @ReactProp(name = "navBarTextColor")
    fun setNavBarTextColor(view: GoatView, textColor: String?) {
        recordUiProp(view, "navBarTextColor", textColor)
        dispatchSetNavBarColor(view)
    }

    @ReactProp(name = "navBarVisible")
    fun setNavBarVisible(view: GoatView, visible: Boolean) {
        recordUiProp(view, "navBarVisible", visible)
    }

    @ReactProp(name = "navBarProgress", defaultDouble = -1.0)
    fun setNavBarProgress(view: GoatView, progress: Double) {
        recordUiProp(view, "navBarProgress", progress)
        val visible = progress >= 0.0
        val payload = buildJsonObject {
            put("visible", visible)
            if (visible) put("progress", progress.toInt())
        }
        dispatchUiAction(view, "SET_NAV_BAR_PROGRESS", payload)
    }

    @ReactProp(name = "bottomSheetSnapPoints")
    fun setBottomSheetSnapPoints(view: GoatView, snapPoints: ReadableArray?) {
        val points = snapPoints?.toArrayList()?.mapNotNull { (it as? Number)?.toDouble() } ?: emptyList()
        recordUiProp(view, "bottomSheetSnapPoints", points)
        dispatchSetSheetSnapPoints(view)
    }

    @ReactProp(name = "bottomSheetInitialSnap", defaultDouble = 0.5)
    fun setBottomSheetInitialSnap(view: GoatView, initialSnap: Double) {
        recordUiProp(view, "bottomSheetInitialSnap", initialSnap)
        dispatchSetSheetSnapPoints(view)
    }

    @ReactProp(name = "bottomSheetDismissible", defaultBoolean = true)
    fun setBottomSheetDismissible(view: GoatView, dismissible: Boolean) {
        recordUiProp(view, "bottomSheetDismissible", dismissible)
        dispatchSetSheetSnapPoints(view)
    }

    @ReactProp(name = "bottomSheetShowDragHandle", defaultBoolean = true)
    fun setBottomSheetShowDragHandle(view: GoatView, showDragHandle: Boolean) {
        recordUiProp(view, "bottomSheetShowDragHandle", showDragHandle)
    }

    @ReactProp(name = "bottomSheetVisible", defaultBoolean = false)
    fun setBottomSheetVisible(view: GoatView, visible: Boolean) {
        recordUiProp(view, "bottomSheetVisible", visible)
        dispatchUiAction(
            view,
            if (visible) "EXPAND_BOTTOM_SHEET" else "COLLAPSE_BOTTOM_SHEET",
            buildJsonObject { }
        )
    }

    @ReactProp(name = "pullToRefreshEnabled", defaultBoolean = false)
    fun setPullToRefreshEnabled(view: GoatView, enabled: Boolean) {
        view.pullToRefreshEnabled = enabled
    }

    @ReactProp(name = "incognito", defaultBoolean = false)
    fun setIncognito(view: GoatView, incognito: Boolean) {
        view.incognito = incognito
    }

    @ReactProp(name = "compatExternalSchemeResolver", defaultBoolean = false)
    fun setCompatExternalSchemeResolver(view: GoatView, enabled: Boolean) {
        view.compatExternalSchemeResolver = enabled
    }

    @ReactProp(name = "originWhitelist")
    fun setOriginWhitelist(view: GoatView, whitelist: ReadableArray?) {
    }

    @ReactProp(name = "hasOnScroll", defaultBoolean = false)
    fun setHasOnScroll(view: GoatView, hasOnScroll: Boolean) {
    }

    @ReactProp(name = "hasOnHttpError", defaultBoolean = false)
    fun setHasOnHttpError(view: GoatView, hasOnHttpError: Boolean) {
    }

    override fun receiveCommand(root: GoatView, commandId: String, args: ReadableArray?) {
        when (commandId) {
            "goBack" -> root.goBack()
            "goForward" -> root.goForward()
            "reload" -> root.reload()
            "stopLoading" -> root.stopLoading()
            "injectJavaScript" -> {
                val script = args?.getString(0) ?: ""
                root.evaluateJavascript(script)
            }
            "requestFocus" -> root.requestFocus()
            "postMessage" -> {
                val data = args?.getString(0) ?: ""
                val escaped = org.json.JSONObject.quote(data)
                root.evaluateJavascript("window.__rnwReceive && window.__rnwReceive($escaped)")
            }
            "clearFormData" -> root.clearFormData()
            "clearCache" -> {
                val includeDiskFiles = args?.getBoolean(0) ?: false
                root.clearCache(includeDiskFiles)
            }
            "clearHistory" -> root.clearHistory()
        }
    }

    override fun receiveCommand(root: GoatView, commandId: Int, args: ReadableArray?) {
        when (commandId) {
            1 -> receiveCommand(root, "goBack", args)
            2 -> receiveCommand(root, "goForward", args)
            3 -> receiveCommand(root, "reload", args)
            4 -> receiveCommand(root, "stopLoading", args)
            5 -> receiveCommand(root, "injectJavaScript", args)
            6 -> receiveCommand(root, "requestFocus", args)
            7 -> receiveCommand(root, "postMessage", args)
            8 -> receiveCommand(root, "clearFormData", args)
            9 -> receiveCommand(root, "clearCache", args)
            10 -> receiveCommand(root, "clearHistory", args)
            else -> super.receiveCommand(root, commandId, args)
        }
    }

    override fun getCommandsMap(): Map<String, Int>? {
        return mapOf(
            "goBack" to 1,
            "goForward" to 2,
            "reload" to 3,
            "stopLoading" to 4,
            "injectJavaScript" to 5,
            "requestFocus" to 6,
            "postMessage" to 7,
            "clearFormData" to 8,
            "clearCache" to 9,
            "clearHistory" to 10
        )
    }

    private fun recordUiProp(view: GoatView, name: String, value: Any?) {
        pendingUiProps.getOrPut(view) { mutableMapOf() }[name] = value
    }

    private fun dispatchUiAction(view: GoatView, action: String, payload: JsonObject) {
        val handler = actionHandlers[view] ?: return
        if (view !in initializedViews) return
        CoroutineScope(Dispatchers.IO).launch {
            handler.executeAction(action, payload)
        }
    }

    private fun dispatchSetNavBarTitle(view: GoatView) {
        val props = pendingUiProps[view] ?: return
        val title = props["navBarTitle"] as? String ?: ""
        val subtitle = props["navBarSubtitle"] as? String
        val payload = buildJsonObject {
            put("title", title)
            if (subtitle != null) put("subtitle", subtitle)
        }
        dispatchUiAction(view, "SET_NAV_BAR_TITLE", payload)
    }

    private fun dispatchSetNavBarColor(view: GoatView) {
        val props = pendingUiProps[view] ?: return
        val backgroundColor = props["navBarBackgroundColor"] as? String ?: "#0F172A"
        val textColor = props["navBarTextColor"] as? String ?: "#F8FAFC"
        val payload = buildJsonObject {
            put("backgroundColor", backgroundColor)
            put("textColor", textColor)
        }
        dispatchUiAction(view, "SET_NAV_BAR_COLOR", payload)
    }

    private fun dispatchSetSheetSnapPoints(view: GoatView) {
        val props = pendingUiProps[view] ?: return
        val points = props["bottomSheetSnapPoints"] as? List<*> ?: listOf(0.25, 0.5, 0.9)
        val initialSnap = (props["bottomSheetInitialSnap"] as? Double) ?: 0.5
        val dismissible = props["bottomSheetDismissible"] as? Boolean ?: true
        val payload = buildJsonObject {
            put("snapPoints", buildJsonArray { points.forEach { add((it as Number).toFloat()) } })
            put("initialSnap", initialSnap.toFloat())
            put("isDismissible", dismissible)
        }
        dispatchUiAction(view, "SET_SHEET_SNAP_POINTS", payload)
    }

    private fun applyPendingUiProps(view: GoatView) {
        dispatchSetNavBarTitle(view)
        dispatchSetNavBarColor(view)
        dispatchSetSheetSnapPoints(view)
        val props = pendingUiProps[view] ?: return
        val progress = props["navBarProgress"] as? Double
        if (progress != null) {
            val visible = progress >= 0.0
            dispatchUiAction(view, "SET_NAV_BAR_PROGRESS", buildJsonObject {
                put("visible", visible)
                if (visible) put("progress", progress.toInt())
            })
        }
        val sheetVisible = props["bottomSheetVisible"] as? Boolean
        if (sheetVisible != null) {
            dispatchUiAction(
                view,
                if (sheetVisible) "EXPAND_BOTTOM_SHEET" else "COLLAPSE_BOTTOM_SHEET",
                buildJsonObject { }
            )
        }
    }

    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any>? {
        return MapBuilder.builder<String, Any>()
            .put(EVENT_ON_BRIDGE_MESSAGE, MapBuilder.of("registrationName", "onBridgeMessage"))
            .put(EVENT_ON_PAGE_STARTED, MapBuilder.of("registrationName", "onPageStarted"))
            .put(EVENT_ON_PAGE_LOADED, MapBuilder.of("registrationName", "onPageLoaded"))
            .put(EVENT_ON_PROGRESS_CHANGED, MapBuilder.of("registrationName", "onProgressChanged"))
            .put(EVENT_ON_RECEIVED_TITLE, MapBuilder.of("registrationName", "onReceivedTitle"))
            .put(EVENT_ON_INSETS_CHANGE, MapBuilder.of("registrationName", "onInsetsChange"))
            .put(EVENT_ON_SHEET_STATE_CHANGE, MapBuilder.of("registrationName", "onSheetStateChange"))
            .put(EVENT_ON_ERROR, MapBuilder.of("registrationName", "onError"))
            .put(EVENT_ON_APP_SERVICE_READY, MapBuilder.of("registrationName", "onAppServiceReady"))
            .put(EVENT_ON_APP_SERVICE_CRASH, MapBuilder.of("registrationName", "onAppServiceCrash"))
            .put(EVENT_ON_APP_SERVICE_TERMINATE, MapBuilder.of("registrationName", "onAppServiceTerminate"))
            .put(EVENT_ON_POPUP_REQUEST, MapBuilder.of("registrationName", "onPopupRequest"))
            .put("topPopupRequest", MapBuilder.of("registrationName", "onPopupRequest"))
            .put(EVENT_ON_HTTP_ERROR, MapBuilder.of("registrationName", "onHttpError"))
            .put(EVENT_ON_RENDER_PROCESS_GONE, MapBuilder.of("registrationName", "onRenderProcessGone"))
            .put(EVENT_ON_SCROLL, MapBuilder.of("registrationName", "onScroll"))
            .put(EVENT_ON_EXTERNAL_NAVIGATION, MapBuilder.of("registrationName", "onExternalNavigation"))
            .build()
    }

    override fun onDropViewInstance(view: GoatView) {
        super.onDropViewInstance(view)
        actionHandlers.remove(view)
        initializedViews.remove(view)
        pendingUiProps.remove(view)
        view.destroy()
    }
}
