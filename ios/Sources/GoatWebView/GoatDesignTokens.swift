import Foundation

/**
 * Host-owned design values handed down to a mini-app.
 *
 * Key names mirror Telegram's `themeParams` so a web team that has shipped a Telegram mini-app can
 * reuse its stylesheet unchanged. Values are CSS colour strings rather than UIColor because the
 * consumer is a web page, and converting once here beats converting on every read.
 */
public struct GoatThemeTokens: Equatable, Sendable {
    public static let light = "light"
    public static let dark = "dark"

    public var colorScheme: String
    public var bgColor: String
    public var textColor: String
    public var hintColor: String
    public var linkColor: String
    public var buttonColor: String
    public var buttonTextColor: String
    public var secondaryBgColor: String
    public var headerBgColor: String
    public var accentTextColor: String
    public var sectionBgColor: String
    public var sectionHeaderTextColor: String
    public var subtitleTextColor: String
    public var destructiveTextColor: String

    public init(
        colorScheme: String = GoatThemeTokens.light,
        bgColor: String = "#ffffff",
        textColor: String = "#000000",
        hintColor: String = "#707579",
        linkColor: String = "#3390ec",
        buttonColor: String = "#3390ec",
        buttonTextColor: String = "#ffffff",
        secondaryBgColor: String = "#f4f4f5",
        headerBgColor: String = "#ffffff",
        accentTextColor: String = "#3390ec",
        sectionBgColor: String = "#ffffff",
        sectionHeaderTextColor: String = "#707579",
        subtitleTextColor: String = "#707579",
        destructiveTextColor: String = "#e53935"
    ) {
        self.colorScheme = colorScheme
        self.bgColor = bgColor
        self.textColor = textColor
        self.hintColor = hintColor
        self.linkColor = linkColor
        self.buttonColor = buttonColor
        self.buttonTextColor = buttonTextColor
        self.secondaryBgColor = secondaryBgColor
        self.headerBgColor = headerBgColor
        self.accentTextColor = accentTextColor
        self.sectionBgColor = sectionBgColor
        self.sectionHeaderTextColor = sectionHeaderTextColor
        self.subtitleTextColor = subtitleTextColor
        self.destructiveTextColor = destructiveTextColor
    }

    public static let defaultLight = GoatThemeTokens()

    public static let defaultDark = GoatThemeTokens(
        colorScheme: GoatThemeTokens.dark,
        bgColor: "#1c1c1d",
        textColor: "#ffffff",
        hintColor: "#8b8b8f",
        linkColor: "#6ab7ff",
        buttonColor: "#3390ec",
        buttonTextColor: "#ffffff",
        secondaryBgColor: "#131415",
        headerBgColor: "#1c1c1d",
        accentTextColor: "#6ab7ff",
        sectionBgColor: "#1c1c1d",
        sectionHeaderTextColor: "#8b8b8f",
        subtitleTextColor: "#8b8b8f",
        destructiveTextColor: "#ef5350"
    )

    /// Telegram-compatible snake_case keys, which is what a ported mini-app will look for.
    /// Ordered so the generated CSS is stable across runs and diffable.
    public func toPairs() -> [(String, String)] {
        [
            ("bg_color", bgColor),
            ("text_color", textColor),
            ("hint_color", hintColor),
            ("link_color", linkColor),
            ("button_color", buttonColor),
            ("button_text_color", buttonTextColor),
            ("secondary_bg_color", secondaryBgColor),
            ("header_bg_color", headerBgColor),
            ("accent_text_color", accentTextColor),
            ("section_bg_color", sectionBgColor),
            ("section_header_text_color", sectionHeaderTextColor),
            ("subtitle_text_color", subtitleTextColor),
            ("destructive_text_color", destructiveTextColor)
        ]
    }
}

/**
 * Non-colour design values. Separate from `GoatThemeTokens` because a host flips colour scheme
 * often and changes its spacing scale almost never.
 */
public struct GoatDesignTokens: Equatable, Sendable {
    public var fontFamily: String
    public var fontSizeBase: String
    public var fontSizeSmall: String
    public var fontSizeLarge: String
    public var lineHeight: String
    public var spacingUnit: String
    public var radiusSmall: String
    public var radiusMedium: String
    public var radiusLarge: String
    public var borderWidth: String
    public var elevationLow: String
    public var elevationHigh: String
    public var motionFast: String
    public var motionNormal: String
    public var motionEasing: String

    public init(
        fontFamily: String = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSizeBase: String = "16px",
        fontSizeSmall: String = "13px",
        fontSizeLarge: String = "20px",
        lineHeight: String = "1.5",
        spacingUnit: String = "8px",
        radiusSmall: String = "6px",
        radiusMedium: String = "10px",
        radiusLarge: String = "16px",
        borderWidth: String = "1px",
        elevationLow: String = "0 1px 2px rgba(0,0,0,0.08)",
        elevationHigh: String = "0 8px 24px rgba(0,0,0,0.16)",
        motionFast: String = "120ms",
        motionNormal: String = "240ms",
        motionEasing: String = "cubic-bezier(0.4, 0.0, 0.2, 1)"
    ) {
        self.fontFamily = fontFamily
        self.fontSizeBase = fontSizeBase
        self.fontSizeSmall = fontSizeSmall
        self.fontSizeLarge = fontSizeLarge
        self.lineHeight = lineHeight
        self.spacingUnit = spacingUnit
        self.radiusSmall = radiusSmall
        self.radiusMedium = radiusMedium
        self.radiusLarge = radiusLarge
        self.borderWidth = borderWidth
        self.elevationLow = elevationLow
        self.elevationHigh = elevationHigh
        self.motionFast = motionFast
        self.motionNormal = motionNormal
        self.motionEasing = motionEasing
    }

    public static let defaultTokens = GoatDesignTokens()

    public func toPairs() -> [(String, String)] {
        [
            ("font_family", fontFamily),
            ("font_size_base", fontSizeBase),
            ("font_size_small", fontSizeSmall),
            ("font_size_large", fontSizeLarge),
            ("line_height", lineHeight),
            ("spacing_unit", spacingUnit),
            ("radius_small", radiusSmall),
            ("radius_medium", radiusMedium),
            ("radius_large", radiusLarge),
            ("border_width", borderWidth),
            ("elevation_low", elevationLow),
            ("elevation_high", elevationHigh),
            ("motion_fast", motionFast),
            ("motion_normal", motionNormal),
            ("motion_easing", motionEasing)
        ]
    }
}
