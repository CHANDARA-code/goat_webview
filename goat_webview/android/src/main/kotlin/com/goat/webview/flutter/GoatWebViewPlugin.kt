package com.goat.webview.flutter

import android.content.Context
import com.goat.webview.GoatAssetManager
import com.goat.webview.GoatCookieManager
import com.goat.webview.GoatWarmupManager
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Main Flutter plugin registration for Goat WebView.
 */
class GoatWebViewPlugin : FlutterPlugin, MethodChannel.MethodCallHandler {

    private lateinit var globalChannel: MethodChannel
    private var context: Context? = null
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        context = binding.applicationContext
        globalChannel = MethodChannel(binding.binaryMessenger, "com.goat.webview/global")
        globalChannel.setMethodCallHandler(this)

        // Register platform view
        binding.platformViewRegistry.registerViewFactory(
            "com.goat.webview/platform_view",
            GoatPlatformViewFactory(binding.binaryMessenger)
        )
        // NOTE: no pool pre-warm here. WebView construction can only run on the main thread, so
        // doing it during Flutter startup competes with the first frame. The pool is filled after
        // the first GoatWebView mounts (post-first-frame, see GoatPlatformView) and via an explicit
        // GoatWebViewEngine.prewarm() when the host app wants it.
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        val ctx = context
        when (call.method) {
            "setTheme" -> {
                @Suppress("UNCHECKED_CAST")
                val map = call.arguments as? Map<String, Any?> ?: emptyMap()
                com.goat.webview.design.GoatThemeManager.updateTheme { t ->
                    t.copy(
                        colorScheme = map["colorScheme"] as? String ?: t.colorScheme,
                        bgColor = map["bg_color"] as? String ?: t.bgColor,
                        textColor = map["text_color"] as? String ?: t.textColor,
                        hintColor = map["hint_color"] as? String ?: t.hintColor,
                        linkColor = map["link_color"] as? String ?: t.linkColor,
                        buttonColor = map["button_color"] as? String ?: t.buttonColor,
                        buttonTextColor = map["button_text_color"] as? String ?: t.buttonTextColor,
                        secondaryBgColor = map["secondary_bg_color"] as? String ?: t.secondaryBgColor,
                        headerBgColor = map["header_bg_color"] as? String ?: t.headerBgColor,
                        accentTextColor = map["accent_text_color"] as? String ?: t.accentTextColor,
                        sectionBgColor = map["section_bg_color"] as? String ?: t.sectionBgColor,
                        sectionHeaderTextColor = map["section_header_text_color"] as? String ?: t.sectionHeaderTextColor,
                        subtitleTextColor = map["subtitle_text_color"] as? String ?: t.subtitleTextColor,
                        destructiveTextColor = map["destructive_text_color"] as? String ?: t.destructiveTextColor
                    )
                }
                result.success(true)
            }
            "setColorScheme" -> {
                val dark = call.argument<Boolean>("dark") ?: false
                com.goat.webview.design.GoatThemeManager.setColorScheme(dark)
                result.success(true)
            }
            "getTheme" -> {
                val t = com.goat.webview.design.GoatThemeManager.current
                result.success(t.toMap() + mapOf("colorScheme" to t.colorScheme))
            }
            "setDesign" -> {
                @Suppress("UNCHECKED_CAST")
                val map = call.arguments as? Map<String, Any?> ?: emptyMap()
                com.goat.webview.design.GoatDesignManager.updateDesign { d ->
                    d.copy(
                        fontFamily = map["font_family"] as? String ?: d.fontFamily,
                        fontSizeBase = map["font_size_base"] as? String ?: d.fontSizeBase,
                        fontSizeSmall = map["font_size_small"] as? String ?: d.fontSizeSmall,
                        fontSizeLarge = map["font_size_large"] as? String ?: d.fontSizeLarge,
                        lineHeight = map["line_height"] as? String ?: d.lineHeight,
                        spacingUnit = map["spacing_unit"] as? String ?: d.spacingUnit,
                        radiusSmall = map["radius_small"] as? String ?: d.radiusSmall,
                        radiusMedium = map["radius_medium"] as? String ?: d.radiusMedium,
                        radiusLarge = map["radius_large"] as? String ?: d.radiusLarge,
                        borderWidth = map["border_width"] as? String ?: d.borderWidth,
                        elevationLow = map["elevation_low"] as? String ?: d.elevationLow,
                        elevationHigh = map["elevation_high"] as? String ?: d.elevationHigh,
                        motionFast = map["motion_fast"] as? String ?: d.motionFast,
                        motionNormal = map["motion_normal"] as? String ?: d.motionNormal,
                        motionEasing = map["motion_easing"] as? String ?: d.motionEasing
                    )
                }
                result.success(true)
            }
            "getDesign" -> {
                result.success(com.goat.webview.design.GoatDesignManager.current.toMap())
            }
            "setDesignVerbose" -> {
                val v = call.argument<Boolean>("verbose") ?: false
                com.goat.webview.design.GoatThemeManager.verbose = v
                com.goat.webview.design.GoatDesignManager.verbose = v
                result.success(true)
            }
            "prewarm" -> {
                if (ctx != null) {
                    GoatWarmupManager.prewarm(ctx)
                    result.success(true)
                } else {
                    result.success(false)
                }
            }
            "clearCache" -> {
                if (ctx != null) {
                    GoatAssetManager(ctx).clearCache()
                    result.success(true)
                } else {
                    result.success(false)
                }
            }
            "getBundleVersion" -> {
                result.success("1.0.0-goat")
            }
            // Lazy: the system CookieManager is only touched when one of these is first called.
            // Android's CookieManager is process-global (no per-appId storage partition to crash
            // on, unlike iOS's WKWebsiteDataStore), so removeSessionCookies is global by platform
            // necessity; deleteAllCookies still scopes to the tenant's virtual domain.
            "removeSessionCookies" -> scope.launch {
                result.success(GoatCookieManager.removeSessionCookies())
            }
            "deleteAllCookies" -> {
                val appId = call.argument<String>("appId") ?: "default"
                scope.launch { result.success(GoatCookieManager.clearTenantCookies(appId)) }
            }
            "deleteCookies" -> {
                val url = call.argument<String>("url")
                val name = call.argument<String>("name")
                if (url.isNullOrBlank() || name.isNullOrBlank()) {
                    result.success(false)
                } else {
                    scope.launch { result.success(GoatCookieManager.deleteCookie(url, name)) }
                }
            }
            else -> result.notImplemented()
        }
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        globalChannel.setMethodCallHandler(null)
        scope.coroutineContext[kotlinx.coroutines.Job]?.cancel()
        context = null
    }
}
