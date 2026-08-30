package com.goat.webview.ui

import android.content.Context
import android.graphics.Color
import android.util.TypedValue
import android.view.Gravity
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Native match-count overlay UI for Find-in-Page (Task 10184). A minimal, dependency-free
 * floating bar showing "activeIndex/matchCount" with previous/next/close controls, built
 * programmatically to match this codebase's dialog/overlay convention (no XML layout resources).
 */
class GoatFindInPageOverlay(private val context: Context) {
    private var container: LinearLayout? = null
    var onNext: (() -> Unit)? = null
    var onPrevious: (() -> Unit)? = null
    var onClose: (() -> Unit)? = null

    private fun dp(value: Int): Int =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value.toFloat(), context.resources.displayMetrics).toInt()

    /** Shows (or updates, if already shown) the overlay bar attached to [parent]. */
    fun show(parent: ViewGroup, matchCount: Int, activeMatchIndex: Int) {
        var bar = container
        if (bar == null) {
            bar = buildBar()
            container = bar
            val params = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.TOP or Gravity.END
                topMargin = dp(12)
                rightMargin = dp(12)
            }
            try {
                parent.addView(bar, params)
            } catch (_: Throwable) {
                // Headless/mock environments without a real ViewGroup — state still tracked.
            }
        }
        updateCountLabel(matchCount, activeMatchIndex)
    }

    private fun updateCountLabel(matchCount: Int, activeMatchIndex: Int) {
        val label = container?.getChildAt(0) as? TextView ?: return
        label.text = if (matchCount == 0) "0/0" else "$activeMatchIndex/$matchCount"
    }

    /** Removes the overlay from its parent, if attached. */
    fun dismiss() {
        val bar = container ?: return
        try {
            (bar.parent as? ViewGroup)?.removeView(bar)
        } catch (_: Throwable) {
        }
        container = null
    }

    fun isShowing(): Boolean = container != null

    private fun buildBar(): LinearLayout {
        val bar = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundColor(Color.parseColor("#E6222222"))
            setPadding(dp(12), dp(6), dp(6), dp(6))
        }

        val countLabel = TextView(context).apply {
            setTextColor(Color.WHITE)
            text = "0/0"
        }
        bar.addView(countLabel)

        val prevButton = TextView(context).apply {
            text = "↑"
            setTextColor(Color.WHITE)
            setPadding(dp(12), 0, dp(12), 0)
            setOnClickListener { onPrevious?.invoke() }
        }
        bar.addView(prevButton)

        val nextButton = TextView(context).apply {
            text = "↓"
            setTextColor(Color.WHITE)
            setPadding(dp(12), 0, dp(12), 0)
            setOnClickListener { onNext?.invoke() }
        }
        bar.addView(nextButton)

        val closeButton = TextView(context).apply {
            text = "✕"
            setTextColor(Color.WHITE)
            setPadding(dp(12), 0, 0, 0)
            setOnClickListener { onClose?.invoke() }
        }
        bar.addView(closeButton)

        return bar
    }
}
