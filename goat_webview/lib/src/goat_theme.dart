import 'package:flutter/services.dart';

const MethodChannel _globalChannel = MethodChannel('com.goat.webview/global');

/// Host-owned theme handed down to every mini-app.
///
/// Field names match Telegram's `themeParams`, so a web team that has shipped a Telegram mini-app
/// can reuse its stylesheet unchanged.
class GoatThemeTokens {
  final String colorScheme;
  final String? bgColor;
  final String? textColor;
  final String? hintColor;
  final String? linkColor;
  final String? buttonColor;
  final String? buttonTextColor;
  final String? secondaryBgColor;
  final String? headerBgColor;
  final String? accentTextColor;
  final String? sectionBgColor;
  final String? sectionHeaderTextColor;
  final String? subtitleTextColor;
  final String? destructiveTextColor;

  const GoatThemeTokens({
    this.colorScheme = 'light',
    this.bgColor,
    this.textColor,
    this.hintColor,
    this.linkColor,
    this.buttonColor,
    this.buttonTextColor,
    this.secondaryBgColor,
    this.headerBgColor,
    this.accentTextColor,
    this.sectionBgColor,
    this.sectionHeaderTextColor,
    this.subtitleTextColor,
    this.destructiveTextColor,
  });

  /// Only non-null fields are sent, so a host that cares about one colour does not have to restate
  /// the other twelve and silently pin them against future default changes.
  Map<String, String> toMap() {
    final m = <String, String>{'colorScheme': colorScheme};
    void put(String k, String? v) {
      if (v != null) m[k] = v;
    }

    put('bg_color', bgColor);
    put('text_color', textColor);
    put('hint_color', hintColor);
    put('link_color', linkColor);
    put('button_color', buttonColor);
    put('button_text_color', buttonTextColor);
    put('secondary_bg_color', secondaryBgColor);
    put('header_bg_color', headerBgColor);
    put('accent_text_color', accentTextColor);
    put('section_bg_color', sectionBgColor);
    put('section_header_text_color', sectionHeaderTextColor);
    put('subtitle_text_color', subtitleTextColor);
    put('destructive_text_color', destructiveTextColor);
    return m;
  }
}

/// Host-owned non-colour design values: typography, spacing, radii, motion.
class GoatDesignTokens {
  final String? fontFamily;
  final String? fontSizeBase;
  final String? fontSizeSmall;
  final String? fontSizeLarge;
  final String? lineHeight;
  final String? spacingUnit;
  final String? radiusSmall;
  final String? radiusMedium;
  final String? radiusLarge;
  final String? borderWidth;
  final String? elevationLow;
  final String? elevationHigh;
  final String? motionFast;
  final String? motionNormal;
  final String? motionEasing;

  const GoatDesignTokens({
    this.fontFamily,
    this.fontSizeBase,
    this.fontSizeSmall,
    this.fontSizeLarge,
    this.lineHeight,
    this.spacingUnit,
    this.radiusSmall,
    this.radiusMedium,
    this.radiusLarge,
    this.borderWidth,
    this.elevationLow,
    this.elevationHigh,
    this.motionFast,
    this.motionNormal,
    this.motionEasing,
  });

  Map<String, String> toMap() {
    final m = <String, String>{};
    void put(String k, String? v) {
      if (v != null) m[k] = v;
    }

    put('font_family', fontFamily);
    put('font_size_base', fontSizeBase);
    put('font_size_small', fontSizeSmall);
    put('font_size_large', fontSizeLarge);
    put('line_height', lineHeight);
    put('spacing_unit', spacingUnit);
    put('radius_small', radiusSmall);
    put('radius_medium', radiusMedium);
    put('radius_large', radiusLarge);
    put('border_width', borderWidth);
    put('elevation_low', elevationLow);
    put('elevation_high', elevationHigh);
    put('motion_fast', motionFast);
    put('motion_normal', motionNormal);
    put('motion_easing', motionEasing);
    return m;
  }
}

/// Sets the design a mini-app inherits from its Flutter host.
///
/// Call from the host's startup, and again whenever its own theme changes. A mini-app that is
/// already open is updated in place; it does not need a reload.
///
/// The mini-app is not required to participate: the engine injects these as CSS custom properties
/// (`--goat-theme-*`, plus Telegram's `--tg-theme-*` aliases), so a page whose stylesheet reads
/// `var(--goat-theme-bg-color)` matches the host without calling anything.
class GoatDesign {
  const GoatDesign._();

  static Future<void> setTheme(GoatThemeTokens theme) async {
    await _globalChannel.invokeMethod<bool>('setTheme', theme.toMap());
  }

  /// The common case: follow the host's light/dark state using goat's default palettes.
  static Future<void> setColorScheme({required bool dark}) async {
    await _globalChannel.invokeMethod<bool>('setColorScheme', {'dark': dark});
  }

  static Future<Map<String, String>> getTheme() async {
    final res = await _globalChannel.invokeMethod<Map<Object?, Object?>>('getTheme');
    return res?.map((k, v) => MapEntry(k.toString(), v.toString())) ?? {};
  }

  static Future<void> setDesign(GoatDesignTokens design) async {
    await _globalChannel.invokeMethod<bool>('setDesign', design.toMap());
  }

  static Future<Map<String, String>> getDesign() async {
    final res = await _globalChannel.invokeMethod<Map<Object?, Object?>>('getDesign');
    return res?.map((k, v) => MapEntry(k.toString(), v.toString())) ?? {};
  }

  /// Logs theme and design transitions natively. Off by default.
  static Future<void> setVerbose(bool verbose) async {
    await _globalChannel.invokeMethod<bool>('setDesignVerbose', {'verbose': verbose});
  }
}
