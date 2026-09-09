package com.goat.webview.manifest

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.graphics.Color
import android.util.Log

object GoatManifestWindowApplier {

    private const val TAG = "GoatManifestWindow"

    data class AppliedWindowState(
        val titleText: String,
        val backgroundColor: Int,
        val lightStatusBarIcons: Boolean,
        val screenOrientation: Int
    )

    fun resolveWindowState(config: MiniAppWindowConfig): AppliedWindowState =
        AppliedWindowState(
            titleText = config.navigationBarTitleText,
            backgroundColor = parseColor(config.navigationBarBackgroundColor),
            lightStatusBarIcons = !config.navigationBarTextStyle.equals("white", ignoreCase = true),
            screenOrientation = config.screenOrientation
        )

    fun parseColor(value: String): Int =
        try {
            Color.parseColor(value)
        } catch (_: Exception) {
            Color.parseColor(MiniAppWindowConfig.DEFAULT_BACKGROUND_COLOR)
        }

    fun apply(context: Context, config: MiniAppWindowConfig): AppliedWindowState {
        val state = resolveWindowState(config)
        val activity = context.findActivity()
        if (activity == null) {
            Log.d(TAG, "No host Activity available; manifest window config resolved but not applied")
            return state
        }
        try {
            // Record the host's own orientation before touching it, and the manifest default this
            // mini-app should fall back to. Without the baseline a runtime lock (Task 10175) has
            // nothing to restore and would leak into the host app.
            com.goat.webview.ui.GoatOrientationController.rememberManifestDefault(
                activity,
                state.screenOrientation
            )
            if (config.orientation != MiniAppOrientation.AUTO) {
                activity.requestedOrientation = state.screenOrientation
            }
            @Suppress("DEPRECATION")
            activity.window?.statusBarColor = state.backgroundColor
        } catch (e: Throwable) {
            Log.w(TAG, "Failed applying manifest window config: ${e.message}")
        }
        return state
    }

    private fun Context.findActivity(): Activity? {
        var current: Context? = this
        while (current is ContextWrapper) {
            if (current is Activity) return current
            current = current.baseContext
        }
        return null
    }
}
