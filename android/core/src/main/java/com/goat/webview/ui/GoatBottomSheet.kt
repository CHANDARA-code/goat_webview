package com.goat.webview.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.ViewConfiguration
import android.widget.FrameLayout
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * Bottom Sheet State Value enumeration.
 */
@Serializable
enum class GoatSheetValue {
    COLLAPSED,
    HALF,
    EXPANDED,
    HIDDEN;

    companion object {
        fun fromSnapFraction(fraction: Float, snapPoints: List<Float>): GoatSheetValue {
            if (fraction <= 0.05f) return HIDDEN
            val minSnap = snapPoints.firstOrNull() ?: 0.25f
            val maxSnap = snapPoints.lastOrNull() ?: 0.9f
            return when {
                fraction <= minSnap + 0.05f -> COLLAPSED
                fraction >= maxSnap - 0.05f -> EXPANDED
                else -> HALF
            }
        }
    }
}

/**
 * Configuration model for Bottom Sheet.
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

/**
 * State container for Bottom Sheet.
 */
data class GoatBottomSheetState(
    val snapPoints: List<Float> = listOf(0.25f, 0.5f, 0.9f),
    val currentSnap: Float = 0.5f,
    val isDismissible: Boolean = true,
    val sheetValue: GoatSheetValue = GoatSheetValue.HALF
) {
    /**
     * Calculates the next higher snap point, or stays at the maximum snap point.
     */
    fun expand(): Float {
        val next = snapPoints.firstOrNull { it > currentSnap + 0.02f } ?: snapPoints.last()
        return next
    }

    /**
     * Calculates the next lower snap point or dismisses if already at the minimum snap point.
     * Returns Pair(targetSnapFraction, isDismissed).
     */
    fun collapse(): Pair<Float, Boolean> {
        val prev = snapPoints.reversed().firstOrNull { it < currentSnap - 0.02f }
        return if (prev != null) {
            Pair(prev, false)
        } else {
            if (isDismissible) {
                Pair(0.0f, true)
            } else {
                Pair(snapPoints.first(), false)
            }
        }
    }
}

/**
 * Modern Jetpack Compose Bottom Sheet modal container.
 */
@Composable
fun GoatBottomSheet(
    config: GoatBottomSheetConfig = GoatBottomSheetConfig(),
    modifier: Modifier = Modifier,
    onDismissRequest: (() -> Unit)? = null,
    onSnapChanged: ((Float, GoatSheetValue) -> Unit)? = null,
    content: @Composable () -> Unit
) {
    val snapPoints = config.sanitizedSnapPoints
    var currentSnap by remember { mutableFloatStateOf(config.sanitizedInitialSnap) }
    val coroutineScope = rememberCoroutineScope()

    BoxWithConstraints(
        modifier = modifier.fillMaxSize()
    ) {
        val maxHeightPx = constraints.maxHeight.toFloat()
        val sheetHeightPx = maxHeightPx * currentSnap
        val offsetY = remember { Animatable(maxHeightPx - sheetHeightPx) }

        LaunchedEffect(currentSnap, maxHeightPx) {
            val target = maxHeightPx * (1f - currentSnap)
            offsetY.animateTo(
                targetValue = target,
                animationSpec = spring(
                    dampingRatio = Spring.DampingRatioLowBouncy,
                    stiffness = Spring.StiffnessMediumLow
                )
            )
            val sheetVal = GoatSheetValue.fromSnapFraction(currentSnap, snapPoints)
            onSnapChanged?.invoke(currentSnap, sheetVal)
        }

        // Scrim background
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(androidx.compose.ui.graphics.Color.Black.copy(alpha = 0.5f * currentSnap))
                .clickable {
                    if (config.isDismissible) {
                        onDismissRequest?.invoke()
                    }
                }
        )

        // Sheet Content Container
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height((maxHeightPx * (snapPoints.lastOrNull() ?: 0.9f)).dp)
                .offset { IntOffset(0, offsetY.value.roundToInt()) }
                .shadow(16.dp, RoundedCornerShape(topStart = config.cornerRadiusDp.dp, topEnd = config.cornerRadiusDp.dp))
                .clip(RoundedCornerShape(topStart = config.cornerRadiusDp.dp, topEnd = config.cornerRadiusDp.dp))
                .background(androidx.compose.ui.graphics.Color(0xFF0F172A))
                .draggable(
                    state = rememberDraggableState { delta ->
                        coroutineScope.launch {
                            val newOffset = (offsetY.value + delta).coerceIn(
                                maxHeightPx * (1f - snapPoints.last()),
                                if (config.isDismissible) maxHeightPx else maxHeightPx * (1f - snapPoints.first())
                            )
                            offsetY.snapTo(newOffset)
                        }
                    },
                    orientation = Orientation.Vertical,
                    onDragStopped = { velocity ->
                        coroutineScope.launch {
                            val currentFraction = 1f - (offsetY.value / maxHeightPx)
                            if (config.isDismissible && (currentFraction < snapPoints.first() * 0.7f || velocity > 1000f)) {
                                offsetY.animateTo(maxHeightPx)
                                onDismissRequest?.invoke()
                            } else {
                                // Snap to closest snap point
                                val closest = snapPoints.minByOrNull { abs(it - currentFraction) } ?: snapPoints.first()
                                currentSnap = closest
                            }
                        }
                    }
                )
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                if (config.showDragHandle) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Box(
                            modifier = Modifier
                                .width(36.dp)
                                .height(4.dp)
                                .clip(RoundedCornerShape(2.dp))
                                .background(androidx.compose.ui.graphics.Color.White.copy(alpha = 0.3f))
                        )
                    }
                }
                Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                    content()
                }
            }
        }
    }
}

/**
 * Classical Android ViewGroup container for Expandable Bottom Sheet.
 */
class GoatBottomSheetContainer @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {

    private var config = GoatBottomSheetConfig()
    private var state = GoatBottomSheetState()
    private var onSnapListener: ((Float, GoatSheetValue) -> Unit)? = null
    private var onDismissListener: (() -> Unit)? = null

    private val dragHandlePaint by lazy {
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#4B5563")
        }
    }
    private val dragHandleRect = RectF()

    private var lastTouchY = 0f
    private var isDragging = false
    private val touchSlop: Int by lazy {
        try {
            ViewConfiguration.get(context).scaledTouchSlop
        } catch (e: Throwable) {
            16
        }
    }

    init {
        try {
            setWillNotDraw(false)
        } catch (e: Throwable) {}
    }

    fun setConfig(newConfig: GoatBottomSheetConfig) {
        this.config = newConfig
        this.state = GoatBottomSheetState(
            snapPoints = newConfig.sanitizedSnapPoints,
            currentSnap = newConfig.sanitizedInitialSnap,
            isDismissible = newConfig.isDismissible,
            sheetValue = GoatSheetValue.fromSnapFraction(newConfig.sanitizedInitialSnap, newConfig.sanitizedSnapPoints)
        )
        try {
            requestLayout()
            invalidate()
        } catch (e: Throwable) {}
    }

    fun getState(): GoatBottomSheetState = state

    fun setOnSnapListener(listener: (Float, GoatSheetValue) -> Unit) {
        this.onSnapListener = listener
    }

    fun setOnDismissListener(listener: () -> Unit) {
        this.onDismissListener = listener
    }

    fun expand(): Float {
        val nextSnap = state.expand()
        updateSnap(nextSnap)
        return nextSnap
    }

    fun collapse(): Pair<Float, Boolean> {
        val (nextSnap, dismissed) = state.collapse()
        if (dismissed) {
            state = state.copy(currentSnap = 0.0f, sheetValue = GoatSheetValue.HIDDEN)
            onDismissListener?.invoke()
        } else {
            updateSnap(nextSnap)
        }
        return Pair(nextSnap, dismissed)
    }

    fun setSnapPoints(points: List<Float>, initialSnap: Float? = null, isDismissible: Boolean = true) {
        val sanitized = GoatBottomSheetConfig.sanitizeSnapPoints(points)
        val initial = (initialSnap ?: sanitized.first()).coerceIn(sanitized.first(), sanitized.last())
        this.config = config.copy(snapPoints = sanitized, initialSnap = initial, isDismissible = isDismissible)
        this.state = GoatBottomSheetState(
            snapPoints = sanitized,
            currentSnap = initial,
            isDismissible = isDismissible,
            sheetValue = GoatSheetValue.fromSnapFraction(initial, sanitized)
        )
        try {
            requestLayout()
            invalidate()
        } catch (e: Throwable) {}
    }

    private fun updateSnap(snap: Float) {
        val sheetVal = GoatSheetValue.fromSnapFraction(snap, state.snapPoints)
        this.state = state.copy(currentSnap = snap, sheetValue = sheetVal)
        onSnapListener?.invoke(snap, sheetVal)
        try {
            requestLayout()
            invalidate()
        } catch (e: Throwable) {}
    }

    override fun onInterceptTouchEvent(ev: MotionEvent): Boolean {
        when (ev.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                lastTouchY = ev.rawY
                isDragging = false
            }
            MotionEvent.ACTION_MOVE -> {
                val dy = ev.rawY - lastTouchY
                if (abs(dy) > touchSlop) {
                    // Check if inner child view (e.g. WebView) is scrolled to top
                    val child = getChildAt(0)
                    val childScrollY = child?.scrollY ?: 0
                    if (childScrollY <= 0 && dy > 0) {
                        // Dragging down at top of webview -> intercept
                        isDragging = true
                        return true
                    }
                }
            }
        }
        return super.onInterceptTouchEvent(ev)
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                lastTouchY = event.rawY
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                val dy = event.rawY - lastTouchY
                lastTouchY = event.rawY
                val height = height.toFloat()
                if (height > 0) {
                    val deltaFraction = -dy / height
                    val newFraction = (state.currentSnap + deltaFraction).coerceIn(
                        if (state.isDismissible) 0.0f else state.snapPoints.first(),
                        state.snapPoints.last()
                    )
                    this.state = state.copy(currentSnap = newFraction)
                    try {
                        invalidate()
                    } catch (e: Throwable) {}
                }
                return true
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                if (state.isDismissible && state.currentSnap < state.snapPoints.first() * 0.7f) {
                    state = state.copy(currentSnap = 0.0f, sheetValue = GoatSheetValue.HIDDEN)
                    onDismissListener?.invoke()
                } else {
                    // Snap to closest snap point
                    val closest = state.snapPoints.minByOrNull { abs(it - state.currentSnap) } ?: state.snapPoints.first()
                    updateSnap(closest)
                }
                isDragging = false
                return true
            }
        }
        return super.onTouchEvent(event)
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (config.showDragHandle) {
            val density = context.resources?.displayMetrics?.density ?: 1.0f
            val handleW = 36 * density
            val handleH = 4 * density
            val cx = width / 2f
            val top = 10 * density
            dragHandleRect.set(cx - handleW / 2, top, cx + handleW / 2, top + handleH)
            canvas.drawRoundRect(dragHandleRect, handleH / 2, handleH / 2, dragHandlePaint)
        }
    }
}
