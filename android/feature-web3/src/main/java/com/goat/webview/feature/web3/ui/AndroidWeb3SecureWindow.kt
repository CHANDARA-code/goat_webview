package com.goat.webview.feature.web3.ui

import android.os.Build
import android.view.View
import android.view.Window
import android.view.WindowManager

/**
 * Binds [Web3SecureWindow] to a real dialog window and its root view.
 */
class AndroidWeb3SecureWindow(
    private val window: Window,
    private val rootView: View? = null,
    override val apiLevel: Int = Build.VERSION.SDK_INT
) : Web3SecureWindow {

    override fun setSecureFlag(enabled: Boolean) {
        if (enabled) {
            window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
    }

    override fun setFilterTouchesWhenObscured(enabled: Boolean) {
        rootView?.filterTouchesWhenObscured = enabled
    }

    override fun setHideOverlayWindows(enabled: Boolean) {
        if (apiLevel >= Web3ConfirmWindowGuard.MIN_SDK_HIDE_OVERLAYS) {
            window.setHideOverlayWindows(enabled)
        }
    }
}
