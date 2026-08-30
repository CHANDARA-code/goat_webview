package com.goat.webview

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Unit tests for [GoatPrintController]'s pagination math (Task 10185). The real PDF rasterization
 * path (`exportToPdf`) drives live `android.webkit.WebView`/`android.graphics.pdf.PdfDocument`
 * framework APIs and is exercised only in instrumented/manual testing, matching this codebase's
 * established convention for "Real*Adapter" production code (see `RealWebViewFindAdapter`).
 */
class GoatPrintControllerTest {

    @Test
    fun `content taller than the viewport tiles into consecutive full-viewport pages`() {
        val offsets = GoatPrintController.computePageOffsets(contentHeightPx = 2500, viewportHeightPx = 1000)

        assertEquals(listOf(0, 1000, 2000), offsets)
    }

    @Test
    fun `content shorter than the viewport is a single page starting at zero`() {
        val offsets = GoatPrintController.computePageOffsets(contentHeightPx = 800, viewportHeightPx = 1000)

        assertEquals(listOf(0), offsets)
    }

    @Test
    fun `content exactly matching the viewport height is a single page`() {
        val offsets = GoatPrintController.computePageOffsets(contentHeightPx = 1000, viewportHeightPx = 1000)

        assertEquals(listOf(0), offsets)
    }

    @Test
    fun `content one pixel taller than one viewport still gets a second page`() {
        val offsets = GoatPrintController.computePageOffsets(contentHeightPx = 1001, viewportHeightPx = 1000)

        assertEquals(listOf(0, 1000), offsets)
    }

    @Test
    fun `zero content height still yields one page instead of an empty document`() {
        val offsets = GoatPrintController.computePageOffsets(contentHeightPx = 0, viewportHeightPx = 1000)

        assertEquals(listOf(0), offsets)
    }

    @Test
    fun `a zero or negative viewport height degrades to a single safe page instead of looping forever`() {
        assertEquals(listOf(0), GoatPrintController.computePageOffsets(contentHeightPx = 5000, viewportHeightPx = 0))
        assertEquals(listOf(0), GoatPrintController.computePageOffsets(contentHeightPx = 5000, viewportHeightPx = -100))
    }
}
