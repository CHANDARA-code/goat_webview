package com.goat.webview.accessibility

import org.junit.Assert.assertEquals
import org.junit.Test

class GoatTextZoomPolicyTest {

    @Test
    fun clampsZoomToSupportedRange() {
        assertEquals(50, GoatTextZoomPolicy.clampTextZoom(0))
        assertEquals(50, GoatTextZoomPolicy.clampTextZoom(-10))
        assertEquals(200, GoatTextZoomPolicy.clampTextZoom(500))
        assertEquals(100, GoatTextZoomPolicy.clampTextZoom(100))
    }

    @Test
    fun mapsFontScaleToTextZoom() {
        assertEquals(100, GoatTextZoomPolicy.fontScaleToTextZoom(1.0f))
        assertEquals(50, GoatTextZoomPolicy.fontScaleToTextZoom(0.4f))
        assertEquals(200, GoatTextZoomPolicy.fontScaleToTextZoom(2.5f))
        assertEquals(150, GoatTextZoomPolicy.fontScaleToTextZoom(1.5f))
        assertEquals(85, GoatTextZoomPolicy.fontScaleToTextZoom(0.85f))
    }

    @Test
    fun defaultScaleIsZeroDelta() {
        assertEquals(100, GoatTextZoomPolicy.fontScaleToTextZoom(1.0f))
    }
}
