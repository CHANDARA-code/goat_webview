package com.example.miniappwebview.core

import android.content.Context
import android.graphics.Bitmap
import android.util.Log
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import java.io.File

/**
 * Custom WebViewClient using AndroidX WebViewAssetLoader to map internal storage files
 * to virtual domain `https://appassets.androidplatform.net/assets/`.
 */
class MiniAppWebViewClient(
    private val context: Context,
    private val extractedDir: File,
    private val onPageStarted: (() -> Unit)? = null,
    private val onPageLoaded: (() -> Unit)? = null
) : WebViewClient() {

    companion object {
        private const val TAG = "MiniAppWebViewClient"
        const val VIRTUAL_DOMAIN = "appassets.androidplatform.net"
        const val ASSETS_PATH = "/assets/"
    }

    private val assetLoader: WebViewAssetLoader by lazy {
        WebViewAssetLoader.Builder()
            .setDomain(VIRTUAL_DOMAIN)
            .setHttpAllowed(false)
            .addPathHandler(ASSETS_PATH, WebViewAssetLoader.InternalStoragePathHandler(context, extractedDir))
            .build()
    }

    override fun shouldInterceptRequest(
        view: WebView,
        request: WebResourceRequest
    ): WebResourceResponse? {
        val url = request.url
        val response = assetLoader.shouldInterceptRequest(url)
        if (response != null) {
            return response
        }
        return super.shouldInterceptRequest(view, request)
    }

    override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
        super.onPageStarted(view, url, favicon)
        Log.d(TAG, "onPageStarted: $url")
        onPageStarted?.invoke()
    }

    override fun onPageFinished(view: WebView?, url: String?) {
        super.onPageFinished(view, url)
        Log.d(TAG, "onPageFinished: $url")
        onPageLoaded?.invoke()
    }

    override fun onRenderProcessGone(view: WebView?, detail: RenderProcessGoneDetail?): Boolean {
        val didCrash = detail?.didCrash() ?: false
        val priority = detail?.rendererPriorityAtExit() ?: -1
        Log.e(TAG, "WebView render process gone! didCrash=$didCrash, priority=$priority")
        // Return true to prevent app crash and allow host UI to recover/recreate view
        return true
    }
}
