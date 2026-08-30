package com.goat.webview.flutter

import android.content.Context
import com.goat.webview.GoatAssetManager
import com.goat.webview.GoatWarmupManager
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * Main Flutter plugin registration for Goat WebView.
 */
class GoatWebViewPlugin : FlutterPlugin, MethodChannel.MethodCallHandler {

    private lateinit var globalChannel: MethodChannel
    private var context: Context? = null

    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        context = binding.applicationContext
        globalChannel = MethodChannel(binding.binaryMessenger, "com.goat.webview/global")
        globalChannel.setMethodCallHandler(this)

        // Register platform view
        binding.platformViewRegistry.registerViewFactory(
            "com.goat.webview/platform_view",
            GoatPlatformViewFactory(binding.binaryMessenger)
        )
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        val ctx = context
        when (call.method) {
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
            else -> result.notImplemented()
        }
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        globalChannel.setMethodCallHandler(null)
        context = null
    }
}
