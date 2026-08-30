package com.goat.webview.accessibility

object GoatTextZoomPolicy {

    const val MIN_ZOOM = 50
    const val MAX_ZOOM = 200

    fun clampTextZoom(zoom: Int): Int = zoom.coerceIn(MIN_ZOOM, MAX_ZOOM)

    fun fontScaleToTextZoom(fontScale: Float): Int {
        val clampedScale = fontScale.coerceIn(0.5f, 2.0f)
        val zoom = (100f * clampedScale).toInt()
        return clampTextZoom(zoom)
    }
}
