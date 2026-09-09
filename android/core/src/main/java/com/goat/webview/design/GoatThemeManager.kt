package com.goat.webview.design

import android.util.Log

/**
 * Host-owned theme, pushed down to mini-apps (Telegram `themeParams` parity).
 *
 * The direction matters. The engine already had SET_STATUS_BAR_THEME and SYNC_THEME_BACKGROUND,
 * which let a mini-app tell the host what to look like. This is the reverse: the host decides, and
 * every mini-app it opens inherits that decision.
 *
 * A mini-app is not required to participate. The injected bootstrap writes CSS custom properties
 * onto the document root, so a page that only ever writes `color: var(--goat-theme-text-color)`
 * stays consistent with the host without calling a bridge method or knowing goat exists. The JS
 * object and its events are there for pages that want to react.
 */
object GoatThemeManager {

    private const val TAG = "GoatThemeManager"

    fun interface Listener {
        fun onThemeChanged(tokens: GoatThemeTokens)
    }

    private val lock = Any()
    private val listeners = mutableListOf<Listener>()

    @Volatile
    private var tokens: GoatThemeTokens = GoatThemeTokens.DEFAULT_LIGHT

    @Volatile
    var verbose: Boolean = false

    val current: GoatThemeTokens
        get() = tokens

    /**
     * Replaces the whole theme. The host is expected to call this from `Application.onCreate`, or
     * whenever its own theme changes, before or after a mini-app is mounted -- a live mini-app is
     * updated in place rather than needing a reload.
     */
    fun setTheme(next: GoatThemeTokens) {
        val changed = synchronized(lock) {
            if (tokens == next) return@synchronized false
            tokens = next
            true
        }
        if (!changed) {
            if (verbose) Log.d(TAG, "setTheme ignored; tokens identical")
            return
        }
        if (verbose) Log.d(TAG, "Theme -> ${next.colorScheme} bg=${next.bgColor} text=${next.textColor}")
        notifyListeners(next)
    }

    /** Convenience for the common case of following the host's light/dark state. */
    fun setColorScheme(dark: Boolean) {
        setTheme(if (dark) GoatThemeTokens.DEFAULT_DARK else GoatThemeTokens.DEFAULT_LIGHT)
    }

    /**
     * Applies only the fields a host cares about, leaving the rest.
     *
     * Hosts rarely have opinions about all thirteen colours; forcing them to restate defaults would
     * mean their theme silently drifts from ours whenever a default changes.
     */
    fun updateTheme(transform: (GoatThemeTokens) -> GoatThemeTokens) {
        setTheme(transform(tokens))
    }

    fun addListener(listener: Listener) {
        synchronized(lock) { if (!listeners.contains(listener)) listeners.add(listener) }
    }

    fun removeListener(listener: Listener) {
        synchronized(lock) { listeners.remove(listener) }
    }

    private fun notifyListeners(next: GoatThemeTokens) {
        val snapshot = synchronized(lock) { listeners.toList() }
        for (l in snapshot) {
            try {
                l.onThemeChanged(next)
            } catch (e: Throwable) {
                Log.w(TAG, "Theme listener threw; continuing: ${e.message}")
            }
        }
    }

    internal fun resetForTesting() {
        synchronized(lock) {
            tokens = GoatThemeTokens.DEFAULT_LIGHT
            listeners.clear()
            verbose = false
        }
    }
}

/**
 * Host-owned design tokens (typography, spacing, radii, motion), pushed down the same way as
 * [GoatThemeManager] and injected as the same kind of CSS custom properties.
 */
object GoatDesignManager {

    private const val TAG = "GoatDesignManager"

    fun interface Listener {
        fun onDesignChanged(tokens: GoatDesignTokens)
    }

    private val lock = Any()
    private val listeners = mutableListOf<Listener>()

    @Volatile
    private var tokens: GoatDesignTokens = GoatDesignTokens.DEFAULT

    @Volatile
    var verbose: Boolean = false

    val current: GoatDesignTokens
        get() = tokens

    fun setDesign(next: GoatDesignTokens) {
        val changed = synchronized(lock) {
            if (tokens == next) return@synchronized false
            tokens = next
            true
        }
        if (!changed) {
            if (verbose) Log.d(TAG, "setDesign ignored; tokens identical")
            return
        }
        if (verbose) Log.d(TAG, "Design -> font=${next.fontFamily} spacing=${next.spacingUnit}")
        val snapshot = synchronized(lock) { listeners.toList() }
        for (l in snapshot) {
            try {
                l.onDesignChanged(next)
            } catch (e: Throwable) {
                Log.w(TAG, "Design listener threw; continuing: ${e.message}")
            }
        }
    }

    fun updateDesign(transform: (GoatDesignTokens) -> GoatDesignTokens) {
        setDesign(transform(tokens))
    }

    fun addListener(listener: Listener) {
        synchronized(lock) { if (!listeners.contains(listener)) listeners.add(listener) }
    }

    fun removeListener(listener: Listener) {
        synchronized(lock) { listeners.remove(listener) }
    }

    internal fun resetForTesting() {
        synchronized(lock) {
            tokens = GoatDesignTokens.DEFAULT
            listeners.clear()
            verbose = false
        }
    }
}
