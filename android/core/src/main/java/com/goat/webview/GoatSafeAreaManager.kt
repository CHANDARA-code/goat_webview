package com.goat.webview

import android.content.Context
import android.graphics.Rect
import android.os.Build
import android.view.View
import android.webkit.WebView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

/**
 * Safe-Area & Viewport Insets Synchronizer (Milestone 2 / Task 10068 & R2 Insets Subsystem).
 *
 * Tracks window safe-area insets (status bar, display cutout, gesture navigation bars),
 * synchronizes soft keyboard (IME) insets, and generates/injects CSS custom properties
 * (`--safe-area-inset-*` and `--keyboard-inset-bottom`) into the Mini-App DOM.
 */
class GoatSafeAreaManager(
    private val context: Context? = null,
    private val eventCoalescer: com.goat.webview.ipc.GoatEventCoalescer? = null
) {
    data class Insets(
        val top: Int = 0,
        val bottom: Int = 0,
        val left: Int = 0,
        val right: Int = 0,
        val keyboardHeight: Int = 0
    ) {
        val totalBottom: Int get() = bottom + keyboardHeight
    }

    private val currentInsets = AtomicReference(Insets())
    private val defaultDensity: Float by lazy {
        context?.resources?.displayMetrics?.density ?: 1.0f
    }

    /**
     * Updates the safe-area insets state.
     */
    fun updateSafeArea(top: Int, bottom: Int, left: Int, right: Int, keyboardHeight: Int? = null): Insets {
        val prev = currentInsets.get()
        val next = Insets(
            top = top,
            bottom = bottom,
            left = left,
            right = right,
            keyboardHeight = keyboardHeight ?: prev.keyboardHeight
        )
        currentInsets.set(next)
        eventCoalescer?.emit(
            "ON_SAFE_AREA_CHANGED",
            formatSafeAreaEvent(next),
            minIntervalMs = 50L
        ) { _, _ -> }
        return next
    }

    /**
     * Updates the soft keyboard (IME) inset height.
     */
    fun updateKeyboardHeight(keyboardHeightPx: Int): Insets {
        val prev = currentInsets.get()
        val next = prev.copy(keyboardHeight = keyboardHeightPx)
        currentInsets.set(next)
        eventCoalescer?.emit(
            "ON_KEYBOARD_HEIGHT_CHANGE",
            formatKeyboardInsetsEvent(keyboardHeightPx),
            minIntervalMs = 50L
        ) { _, _ -> }
        return next
    }

    /**
     * Gets the current insets state.
     */
    fun getInsets(): Insets = currentInsets.get()

    /**
     * Formats the current insets as a bridge response JsonObject.
     */
    fun toJsonObject(): JsonObject {
        val insets = currentInsets.get()
        return buildJsonObject {
            put("top", insets.top)
            put("bottom", insets.bottom)
            put("left", insets.left)
            put("right", insets.right)
            put("keyboardHeight", insets.keyboardHeight)
            put("totalBottom", insets.totalBottom)
        }
    }

    /**
     * Generates a JavaScript snippet that sets CSS custom properties on document.documentElement.
     */
    fun generateCssInjectionScript(insets: Insets = currentInsets.get()): String {
        return """
            (function() {
                var root = document.documentElement;
                if (!root) return;
                root.style.setProperty('--safe-area-inset-top', '${insets.top}px');
                root.style.setProperty('--safe-area-inset-bottom', '${insets.bottom}px');
                root.style.setProperty('--safe-area-inset-left', '${insets.left}px');
                root.style.setProperty('--safe-area-inset-right', '${insets.right}px');
                root.style.setProperty('--keyboard-inset-bottom', '${insets.keyboardHeight}px');
                root.style.setProperty('--goat-safe-area-top', '${insets.top}px');
                root.style.setProperty('--goat-safe-area-bottom', '${insets.bottom}px');
                root.style.setProperty('--goat-safe-area-left', '${insets.left}px');
                root.style.setProperty('--goat-safe-area-right', '${insets.right}px');
                root.style.setProperty('--goat-keyboard-height', '${insets.keyboardHeight}px');
            })();
        """.trimIndent()
    }

    /**
     * Injects the safe-area and keyboard CSS custom properties into the target WebView.
     */
    fun injectCssVariables(webView: WebView, insets: Insets = currentInsets.get(), callback: ((String?) -> Unit)? = null) {
        val script = generateCssInjectionScript(insets)
        webView.post {
            webView.evaluateJavascript(script) { result ->
                callback?.invoke(result)
            }
        }
    }

    /**
     * Attaches an OnApplyWindowInsetsListener to the given view to automatically capture insets.
     */
    fun attachToView(targetView: View, onInsetsChanged: ((Insets) -> Unit)? = null) {
        ViewCompat.setOnApplyWindowInsetsListener(targetView) { _, insetsCompat ->
            val systemBars = insetsCompat.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            val ime = insetsCompat.getInsets(WindowInsetsCompat.Type.ime())

            val updated = updateSafeArea(
                top = systemBars.top,
                bottom = systemBars.bottom,
                left = systemBars.left,
                right = systemBars.right,
                keyboardHeight = ime.bottom
            )
            onInsetsChanged?.invoke(updated)
            insetsCompat
        }
    }

    /**
     * Formats an onSafeAreaChanged event payload.
     */
    fun formatSafeAreaEvent(insets: Insets = currentInsets.get()): JsonObject {
        return buildJsonObject {
            put("top", insets.top)
            put("bottom", insets.bottom)
            put("left", insets.left)
            put("right", insets.right)
        }
    }

    /**
     * Formats an onKeyboardInsetsChanged event payload.
     */
    fun formatKeyboardInsetsEvent(keyboardHeight: Int, durationMs: Long = 250L): JsonObject {
        return buildJsonObject {
            put("keyboardHeight", keyboardHeight)
            put("durationMs", durationMs)
            put("isVisible", keyboardHeight > 0)
        }
    }
}
