package com.goat.webview

import android.content.Context
import android.graphics.pdf.PdfDocument
import android.print.PrintAttributes
import android.print.PrintManager
import android.webkit.WebView
import kotlinx.coroutines.suspendCancellableCoroutine
import java.io.ByteArrayOutputStream
import kotlin.coroutines.resume

/**
 * Native print-to-PDF & system print sheet controller (Task 10185).
 *
 * `SYSTEM_SHEET` mode presents the real Android `PrintManager` dialog, driven by the WebView's own
 * `PrintDocumentAdapter` (Chromium's real print pipeline, so `@media print` CSS and pagination are
 * handled natively by the engine). Android's print framework has no headless entry point —
 * `PrintManager.print()` always launches the system Print Spooler activity, and the
 * `LayoutResultCallback`/`WriteResultCallback` types it hands an adapter cannot be constructed by
 * app code (package-private constructors) — so a dialog-free path through that framework does not
 * exist on this platform.
 *
 * `EXPORT_PDF` mode therefore rasterizes the WebView's full scrollable content directly into a
 * real multi-page `PdfDocument`, tiling by viewport height and awaiting each scroll's visual
 * commit via `postVisualStateCallback` before capturing it, so no system UI ever appears.
 */
class GoatPrintController {
    companion object {
        fun defaultAttributes(): PrintAttributes = PrintAttributes.Builder()
            .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
            .setResolution(PrintAttributes.Resolution("pdf", "pdf", 300, 300))
            .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
            .build()

        /**
         * Computes the top-of-page pixel offsets a full-content export must capture, tiling
         * [contentHeightPx] into consecutive [viewportHeightPx]-tall pages. Pure pagination math,
         * independent of any live WebView, so it is directly unit-testable.
         */
        fun computePageOffsets(contentHeightPx: Int, viewportHeightPx: Int): List<Int> {
            if (viewportHeightPx <= 0) return listOf(0)
            val effectiveHeight = contentHeightPx.coerceAtLeast(viewportHeightPx)
            val offsets = mutableListOf<Int>()
            var y = 0
            while (y < effectiveHeight) {
                offsets.add(y)
                y += viewportHeightPx
            }
            return offsets
        }
    }

    /**
     * Awaits WebView's next visual state commit so a scroll change is guaranteed to be reflected
     * before the caller captures a frame — Chromium composites asynchronously relative to
     * `scrollTo`, so capturing immediately after it can race a stale frame.
     */
    private suspend fun awaitVisualStateCommit(webView: WebView) = suspendCancellableCoroutine<Unit> { cont ->
        val requestId = System.nanoTime()
        webView.postVisualStateCallback(requestId, object : WebView.VisualStateCallback() {
            override fun onComplete(id: Long) {
                if (id == requestId && cont.isActive) cont.resume(Unit)
            }
        })
    }

    /**
     * Rasterizes [webView]'s full scrollable content into a real multi-page PDF, restoring the
     * WebView's original scroll position afterward. Returns the raw PDF bytes.
     */
    suspend fun exportToPdf(webView: WebView): ByteArray {
        val density = webView.resources.displayMetrics.density
        val viewportWidthPx = webView.width
        val viewportHeightPx = webView.height
        require(viewportWidthPx > 0 && viewportHeightPx > 0) { "WebView has zero size; cannot export PDF" }

        val contentHeightPx = (webView.contentHeight * density).toInt()
        val pointsPerPx = 72f / (density * 160f)
        val pageWidthPt = (viewportWidthPx * pointsPerPx).toInt().coerceAtLeast(1)
        val pageHeightPt = (viewportHeightPx * pointsPerPx).toInt().coerceAtLeast(1)
        val offsets = computePageOffsets(contentHeightPx, viewportHeightPx)

        val originalScrollY = webView.scrollY
        val document = PdfDocument()
        try {
            offsets.forEachIndexed { index, yOffset ->
                webView.scrollTo(0, yOffset)
                awaitVisualStateCommit(webView)
                val pageInfo = PdfDocument.PageInfo.Builder(pageWidthPt, pageHeightPt, index + 1).create()
                val page = document.startPage(pageInfo)
                page.canvas.scale(pointsPerPx, pointsPerPx)
                webView.draw(page.canvas)
                document.finishPage(page)
            }
            val output = ByteArrayOutputStream()
            document.writeTo(output)
            return output.toByteArray()
        } finally {
            document.close()
            webView.scrollTo(0, originalScrollY)
        }
    }

    /** Presents the real OS system print sheet for [webView] (`SYSTEM_SHEET` mode). */
    fun showSystemPrintSheet(context: Context, webView: WebView, jobName: String): Boolean {
        return try {
            val printManager = context.getSystemService(Context.PRINT_SERVICE) as? PrintManager ?: return false
            val adapter = webView.createPrintDocumentAdapter(jobName)
            printManager.print(jobName, adapter, defaultAttributes())
            true
        } catch (_: Exception) {
            false
        }
    }
}
