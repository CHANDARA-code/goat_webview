package com.goat.webview.design

/**
 * Host-owned design values handed down to a mini-app.
 *
 * Key names mirror Telegram's `themeParams` so a web team that has shipped a Telegram mini-app can
 * reuse its stylesheet unchanged. Values are CSS colour strings rather than platform ints because
 * the consumer is a web page, and converting once here beats converting on every read.
 */
data class GoatThemeTokens(
    val colorScheme: String = LIGHT,
    val bgColor: String = "#ffffff",
    val textColor: String = "#000000",
    val hintColor: String = "#707579",
    val linkColor: String = "#3390ec",
    val buttonColor: String = "#3390ec",
    val buttonTextColor: String = "#ffffff",
    val secondaryBgColor: String = "#f4f4f5",
    val headerBgColor: String = "#ffffff",
    val accentTextColor: String = "#3390ec",
    val sectionBgColor: String = "#ffffff",
    val sectionHeaderTextColor: String = "#707579",
    val subtitleTextColor: String = "#707579",
    val destructiveTextColor: String = "#e53935"
) {
    companion object {
        const val LIGHT = "light"
        const val DARK = "dark"

        val DEFAULT_LIGHT = GoatThemeTokens()

        val DEFAULT_DARK = GoatThemeTokens(
            colorScheme = DARK,
            bgColor = "#1c1c1d",
            textColor = "#ffffff",
            hintColor = "#8b8b8f",
            linkColor = "#6ab7ff",
            buttonColor = "#3390ec",
            buttonTextColor = "#ffffff",
            secondaryBgColor = "#131415",
            headerBgColor = "#1c1c1d",
            accentTextColor = "#6ab7ff",
            sectionBgColor = "#1c1c1d",
            sectionHeaderTextColor = "#8b8b8f",
            subtitleTextColor = "#8b8b8f",
            destructiveTextColor = "#ef5350"
        )
    }

    /** Telegram-compatible snake_case keys, which is what a ported mini-app will look for. */
    fun toMap(): Map<String, String> = linkedMapOf(
        "bg_color" to bgColor,
        "text_color" to textColor,
        "hint_color" to hintColor,
        "link_color" to linkColor,
        "button_color" to buttonColor,
        "button_text_color" to buttonTextColor,
        "secondary_bg_color" to secondaryBgColor,
        "header_bg_color" to headerBgColor,
        "accent_text_color" to accentTextColor,
        "section_bg_color" to sectionBgColor,
        "section_header_text_color" to sectionHeaderTextColor,
        "subtitle_text_color" to subtitleTextColor,
        "destructive_text_color" to destructiveTextColor
    )
}

/**
 * Non-colour design values: the parts of a design system a mini-app needs to match a host beyond
 * palette. Kept separate from [GoatThemeTokens] because a host typically flips colour scheme often
 * and its spacing scale almost never.
 */
data class GoatDesignTokens(
    val fontFamily: String = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    val fontSizeBase: String = "16px",
    val fontSizeSmall: String = "13px",
    val fontSizeLarge: String = "20px",
    val lineHeight: String = "1.5",
    val spacingUnit: String = "8px",
    val radiusSmall: String = "6px",
    val radiusMedium: String = "10px",
    val radiusLarge: String = "16px",
    val borderWidth: String = "1px",
    val elevationLow: String = "0 1px 2px rgba(0,0,0,0.08)",
    val elevationHigh: String = "0 8px 24px rgba(0,0,0,0.16)",
    val motionFast: String = "120ms",
    val motionNormal: String = "240ms",
    val motionEasing: String = "cubic-bezier(0.4, 0.0, 0.2, 1)"
) {
    fun toMap(): Map<String, String> = linkedMapOf(
        "font_family" to fontFamily,
        "font_size_base" to fontSizeBase,
        "font_size_small" to fontSizeSmall,
        "font_size_large" to fontSizeLarge,
        "line_height" to lineHeight,
        "spacing_unit" to spacingUnit,
        "radius_small" to radiusSmall,
        "radius_medium" to radiusMedium,
        "radius_large" to radiusLarge,
        "border_width" to borderWidth,
        "elevation_low" to elevationLow,
        "elevation_high" to elevationHigh,
        "motion_fast" to motionFast,
        "motion_normal" to motionNormal,
        "motion_easing" to motionEasing
    )

    companion object {
        val DEFAULT = GoatDesignTokens()
    }
}
