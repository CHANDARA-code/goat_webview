package com.goat.webview.popup

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.util.AttributeSet
import android.util.DisplayMetrics
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import com.goat.webview.view.GoatView

/**
 * Native modal presentation container hosting a secondary [GoatView] popup window (Task 10183 / R2).
 * Supports window geometry propagation, top drag header, dim overlay, and leak-free lifecycle dismissal.
 */
@SuppressLint("ViewConstructor")
class GoatModalContainer @JvmOverloads constructor(
    context: Context,
    val containerId: String,
    val modalGoatView: GoatView,
    val features: GoatWindowFeatures = GoatWindowFeatures(),
    var onDismiss: (() -> Unit)? = null,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {

    private var isDismissed: Boolean = false

    val dimOverlay: View
    val windowCard: LinearLayout
    val headerBar: LinearLayout
    val titleView: TextView
    val closeButton: ImageView
    val contentFrame: FrameLayout

    private var dX = 0f
    private var dY = 0f

    init {
        layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)

        // 1. Dim background overlay
        dimOverlay = View(context).apply {
            layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
            setBackgroundColor(Color.argb(120, 0, 0, 0))
            try {
                setOnClickListener {
                    dismiss()
                }
            } catch (_: Throwable) {}
        }
        addView(dimOverlay)

        // 2. Window Card sizing and positioning
        val density = try {
            context.resources?.displayMetrics?.density ?: 1.0f
        } catch (e: Throwable) {
            1.0f
        }

        val rawWidthDp = features.width?.toFloat() ?: 360f
        val rawHeightDp = features.height?.toFloat() ?: 520f
        val widthDp = rawWidthDp.coerceAtLeast(200f)
        val heightDp = rawHeightDp.coerceAtLeast(200f)

        val cardWidthPx = (widthDp * density).toInt()
        val cardHeightPx = (heightDp * density).toInt()
        val cornerRadiusPx = 16f * density
        val elevationPx = 8f * density

        windowCard = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            val cardParams = LayoutParams(cardWidthPx, cardHeightPx)
            try {
                if (features.x != null || features.y != null) {
                    val lm = ((features.x ?: 20.0).toFloat() * density).toInt()
                    val tm = ((features.y ?: 60.0).toFloat() * density).toInt()
                    try { cardParams.javaClass.getField("leftMargin").set(cardParams, lm) } catch (_: Throwable) {}
                    try { cardParams.javaClass.getField("topMargin").set(cardParams, tm) } catch (_: Throwable) {}
                    try { cardParams.javaClass.getField("gravity").set(cardParams, Gravity.NO_GRAVITY) } catch (_: Throwable) {}
                } else {
                    try { cardParams.javaClass.getField("gravity").set(cardParams, Gravity.CENTER) } catch (_: Throwable) {}
                }
            } catch (_: Throwable) {}
            layoutParams = cardParams

            try {
                val cardBg = GradientDrawable().apply {
                    shape = GradientDrawable.RECTANGLE
                    cornerRadius = cornerRadiusPx
                    setColor(Color.WHITE)
                }
                background = cardBg
                clipToOutline = true
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    elevation = elevationPx
                }
            } catch (_: Throwable) {
                setBackgroundColor(Color.WHITE)
            }
        }

        // 3. Header bar
        headerBar = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            val headerHeight = (44 * density).toInt()
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, headerHeight)
            try {
                val headerBg = GradientDrawable().apply {
                    setColor(Color.parseColor("#F5F5F7"))
                }
                background = headerBg
            } catch (_: Throwable) {
                setBackgroundColor(Color.LTGRAY)
            }
            try {
                setPadding((12 * density).toInt(), 0, (12 * density).toInt(), 0)
            } catch (_: Throwable) {}
        }

        titleView = TextView(context).apply {
            try { text = "Modal Window" } catch (_: Throwable) {}
            try { textSize = 14f } catch (_: Throwable) {}
            try { setTextColor(Color.parseColor("#1C1C1E")) } catch (_: Throwable) {}
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT)
            try { isSingleLine = true } catch (_: Throwable) {}
        }
        headerBar.addView(titleView)

        closeButton = ImageView(context).apply {
            val btnSize = (24 * density).toInt()
            layoutParams = ViewGroup.LayoutParams(btnSize, btnSize)
            try { contentDescription = "Close" } catch (_: Throwable) {}
            try {
                val closeBg = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(Color.parseColor("#E5E5EA"))
                }
                background = closeBg
            } catch (_: Throwable) {
                setBackgroundColor(Color.DKGRAY)
            }
            try {
                setOnClickListener {
                    dismiss()
                }
            } catch (_: Throwable) {}
        }
        headerBar.addView(closeButton)
        windowCard.addView(headerBar)

        // 4. Content Frame for GoatView
        contentFrame = FrameLayout(context).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        if (modalGoatView.parent != null) {
            (modalGoatView.parent as? ViewGroup)?.removeView(modalGoatView)
        }
        contentFrame.addView(
            modalGoatView,
            LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        )
        windowCard.addView(contentFrame)
        addView(windowCard)

        // 5. Drag gesture support if resizable/draggable
        try {
            setupDragGesture()
        } catch (_: Throwable) {}
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun setupDragGesture() {
        headerBar.setOnTouchListener { _, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    dX = windowCard.x - event.rawX
                    dY = windowCard.y - event.rawY
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val metrics: DisplayMetrics? = context.resources?.displayMetrics
                    val maxX = if (metrics != null) (metrics.widthPixels - windowCard.width).toFloat().coerceAtLeast(0f) else 1000f
                    val maxY = if (metrics != null) (metrics.heightPixels - windowCard.height).toFloat().coerceAtLeast(0f) else 1000f

                    val newX = (event.rawX + dX).coerceIn(0f, maxX)
                    val newY = (event.rawY + dY).coerceIn(0f, maxY)

                    windowCard.animate()
                        .x(newX)
                        .y(newY)
                        .setDuration(0)
                        .start()
                    true
                }
                else -> false
            }
        }
    }

    /**
     * Attaches this modal container to the parent view hierarchy.
     */
    fun attachToParent(parent: ViewGroup) {
        if (this.parent != null) {
            (this.parent as? ViewGroup)?.removeView(this)
        }
        parent.addView(this)
    }

    /**
     * Dismantles the modal container, recycles the modal [GoatView], and triggers dismissal callbacks.
     */
    fun dismiss() {
        if (isDismissed) return
        isDismissed = true

        try {
            modalGoatView.onPause()
            modalGoatView.destroy()
        } catch (_: Throwable) {}

        if (this.parent != null) {
            (this.parent as? ViewGroup)?.removeView(this)
        }

        onDismiss?.invoke()
    }
}
