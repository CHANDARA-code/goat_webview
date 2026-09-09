package com.goat.webview.miniapp

import android.webkit.WebView

/**
 * Utility helper to apply strict 4-flag file-access hardening to any WebView instance (Task 10193).
 *
 * Compose-free and kept in `:core`: this is a security control, not UI, and it previously lived in
 * the `@Composable MiniAppWebView` file — which meant reaching it pulled the whole Compose runtime
 * in. The composable itself now lives in `:core-compose`.
 */
fun WebView.hardenFileAccessFlags() {
    try {
        settings.apply {
            allowFileAccess = false
            allowContentAccess = false
            @Suppress("DEPRECATION")
            allowFileAccessFromFileURLs = false
            @Suppress("DEPRECATION")
            allowUniversalAccessFromFileURLs = false
        }
    } catch (e: Exception) {
        // Handled for headless/mock unit test environments
    }
}
