package com.goat.webview.popup

/**
 * Host-configurable routing policy for popup window creation and target="_blank" navigations (Task 10183).
 */
enum class GoatPopupRoutingPolicy {
    /**
     * Automatic origin-based decision:
     * - Same-Origin (`goat://<appId>/...`, relative paths, `https://<appId>.appassets.androidplatform.net/...`) -> [MODAL]
     * - Cross-Origin (external domains) -> [SYSTEM_BROWSER]
     */
    AUTO,

    /**
     * Delegates navigation to the OS system browser via [android.content.Intent.ACTION_VIEW]
     * guarded by [com.goat.webview.ui.GoatExternalLinkWarningDialog].
     */
    SYSTEM_BROWSER,

    /**
     * Opens in a secondary modal [com.goat.webview.view.GoatView] sharing the mini-app tenant's storage sandbox and cookie jar.
     */
    MODAL,

    /**
     * Forces target URL navigation within the current parent [com.goat.webview.view.GoatView] frame.
     */
    SAME_FRAME,

    /**
     * Silently blocks and drops the popup creation request.
     */
    BLOCK;

    companion object {
        /**
         * Parses a string representation of the policy (case-insensitive) defaulting to [AUTO].
         */
        fun fromString(value: String?): GoatPopupRoutingPolicy {
            if (value.isNullOrBlank()) return AUTO
            val clean = value.trim()
            return entries.firstOrNull { it.name.equals(clean, ignoreCase = true) } ?: AUTO
        }
    }
}
