import Foundation

/**
 * Builds the document-start script that hands the host's theme and design down to a mini-app.
 *
 * Two delivery paths, deliberately:
 *
 *  1. CSS custom properties on `:root`. A mini-app that writes
 *     `background: var(--goat-theme-bg-color)` inherits the host's look with no JS, no bridge call
 *     and no knowledge of goat. This is what makes participation optional.
 *  2. `window.GoatWebApp`, with `themeParams` / `designParams` and `themeChanged` /
 *     `designChanged` events, for pages that want to react in JS.
 *
 * Telegram's `--tg-theme-*` names are emitted as aliases, so a mini-app already written against
 * telegram-web-app.js renders correctly here without edits.
 *
 * Mirrors the Android GoatDesignBootstrap exactly; the two are expected to produce the same CSS
 * and the same JS surface for the same tokens.
 */
public enum GoatDesignBootstrap {

    public static func cssVariableName(_ key: String, prefix: String) -> String {
        "--\(prefix)-" + key.replacingOccurrences(of: "_", with: "-")
    }

    public static func buildStyleText(theme: GoatThemeTokens, design: GoatDesignTokens) -> String {
        var out = ":root{"
        for (k, v) in theme.toPairs() {
            out += cssVariableName(k, prefix: "goat-theme") + ":" + v + ";"
            out += cssVariableName(k, prefix: "tg-theme") + ":" + v + ";"
        }
        for (k, v) in design.toPairs() {
            out += cssVariableName(k, prefix: "goat-design") + ":" + v + ";"
        }
        out += "color-scheme:" + theme.colorScheme + ";"
        out += "}"
        return out
    }

    /// JSON-escapes a value so a host-supplied token cannot terminate the script literal.
    static func jsonString(_ value: String) -> String {
        if let data = try? JSONSerialization.data(withJSONObject: [value], options: []),
           let s = String(data: data, encoding: .utf8) {
            return String(s.dropFirst().dropLast())
        }
        return "\"\""
    }

    static func jsonObject(_ pairs: [(String, String)]) -> String {
        "{" + pairs.map { "\(jsonString($0.0)):\(jsonString($0.1))" }.joined(separator: ",") + "}"
    }

    public static func buildScript(theme: GoatThemeTokens, design: GoatDesignTokens) -> String {
        let themeJson = jsonObject(theme.toPairs())
        let designJson = jsonObject(design.toPairs())
        let schemeJson = jsonString(theme.colorScheme)
        let styleJson = jsonString(buildStyleText(theme: theme, design: design))

        return """
(function () {
  var STYLE_ID = '__goat_design_tokens__';
  function applyStyle(cssText) {
    var el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(el);
    }
    el.textContent = cssText;
  }

  var listeners = {};
  function emit(type, payload) {
    var arr = listeners[type];
    if (arr) {
      for (var i = 0; i < arr.length; i++) {
        try { arr[i](payload); } catch (e) {}
      }
    }
    try {
      document.dispatchEvent(new CustomEvent('goat:' + type, { detail: payload }));
    } catch (e) {}
  }

  var app = window.GoatWebApp || {};
  app.colorScheme = \(schemeJson);
  app.themeParams = \(themeJson);
  app.designParams = \(designJson);
  app.onEvent = function (type, cb) {
    if (typeof cb !== 'function') return;
    (listeners[type] = listeners[type] || []).push(cb);
  };
  app.offEvent = function (type, cb) {
    var arr = listeners[type];
    if (!arr) return;
    var i = arr.indexOf(cb);
    if (i >= 0) arr.splice(i, 1);
  };
  app.__applyTokens = function (next) {
    if (!next) return;
    if (next.style) applyStyle(next.style);
    if (next.colorScheme) app.colorScheme = next.colorScheme;
    if (next.themeParams) { app.themeParams = next.themeParams; emit('themeChanged', app.themeParams); }
    if (next.designParams) { app.designParams = next.designParams; emit('designChanged', app.designParams); }
  };
  window.GoatWebApp = app;

  applyStyle(\(styleJson));
})();
"""
    }

    /// The call pushed into a live page when the host changes tokens mid-session.
    public static func buildUpdateScript(theme: GoatThemeTokens, design: GoatDesignTokens) -> String {
        let payload = "{"
            + "\"colorScheme\":\(jsonString(theme.colorScheme)),"
            + "\"themeParams\":\(jsonObject(theme.toPairs())),"
            + "\"designParams\":\(jsonObject(design.toPairs())),"
            + "\"style\":\(jsonString(buildStyleText(theme: theme, design: design)))"
            + "}"
        return "window.GoatWebApp && window.GoatWebApp.__applyTokens(\(payload));"
    }
}
