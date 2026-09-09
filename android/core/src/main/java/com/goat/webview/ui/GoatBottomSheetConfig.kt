package com.goat.webview.ui

/**
 * Configuration model for Bottom Sheet.
 *
 * Deliberately Compose-free and kept in `:core`: the plain-View [GoatBottomSheetTabsOverlay] and
 * the bridge action handler both consume it, so it must not live in a file that would drag the
 * Compose runtime back into `:core`. The `@Composable GoatBottomSheet` that renders it lives in
 * `:core-compose`.
 */
data class GoatBottomSheetConfig(
    val snapPoints: List<Float> = listOf(0.25f, 0.5f, 0.9f),
    val initialSnap: Float = 0.5f,
    val isDismissible: Boolean = true,
    val showDragHandle: Boolean = true,
    val cornerRadiusDp: Float = 16f
) {
    val sanitizedSnapPoints: List<Float> = sanitizeSnapPoints(snapPoints)
    val sanitizedInitialSnap: Float = initialSnap.coerceIn(
        sanitizedSnapPoints.firstOrNull() ?: 0.25f,
        sanitizedSnapPoints.lastOrNull() ?: 0.9f
    )

    companion object {
        fun sanitizeSnapPoints(points: List<Float>): List<Float> {
            val valid = points
                .map { it.coerceIn(0.1f, 1.0f) }
                .distinct()
                .sorted()
            return if (valid.isEmpty()) listOf(0.25f, 0.5f, 0.9f) else valid
        }
    }
}
