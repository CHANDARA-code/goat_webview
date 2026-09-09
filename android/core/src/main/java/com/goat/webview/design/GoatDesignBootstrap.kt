package com.goat.webview.design

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.Json

/**
 * Builds the document-start script that hands the host's theme and design down to a mini-app.
 *
 * Two delivery paths, deliberately:
 *
 *  1. **CSS custom properties on `:root`.** A mini-app that writes
 *     `background: var(--goat-theme-bg-color)` inherits the host's look with no JS, no bridge call
 *     and no knowledge of goat. This is what makes participation optional -- the requirement that
 *     the mini-app side "is not a must to adapt".
 *  2. **`window.GoatWebApp`**, with `themeParams` / `designParams` and `themeChanged` /
 *     `designChanged` events, for pages that want to react in JS.
 *
 * Telegram's `--tg-theme-*` names are emitted as aliases, so a mini-app already written against
 * telegram-web-app.js renders correctly here without edits.
 */
object GoatDesignBootstrap {

    private fun toJsonObject(map: Map<String, String>): JsonObject =
        JsonObject(map.mapValues { JsonPrimitive(it.value) })

    private fun jsonOf(map: Map<String, String>): String = toJsonObject(map).toString()

    /** JSON-escapes a value so a host-supplied token cannot terminate the script literal. */
    private fun quote(value: String): String = Json.encodeToString(JsonPrimitive.serializer(), JsonPrimitive(value))

    fun cssVariableName(key: String, prefix: String): String =
        "--$prefix-" + key.replace('_', '-')

    fun buildStyleText(theme: GoatThemeTokens, design: GoatDesignTokens): String {
        val sb = StringBuilder(":root{")
        for ((k, v) in theme.toMap()) {
            sb.append(cssVariableName(k, "goat-theme")).append(':').append(v).append(';')
            sb.append(cssVariableName(k, "tg-theme")).append(':').append(v).append(';')
        }
        for ((k, v) in design.toMap()) {
            sb.append(cssVariableName(k, "goat-design")).append(':').append(v).append(';')
        }
        sb.append("color-scheme:").append(theme.colorScheme).append(';')
        sb.append('}')
        return sb.toString()
    }

    /**
     * The script injected at document-start.
     *
     * Values are embedded via JSONObject rather than string-concatenated, so a host that sets a
     * token containing a quote or `</script>` cannot break out of the literal.
     */
    fun buildScript(theme: GoatThemeTokens, design: GoatDesignTokens): String {
        val themeJson = jsonOf(theme.toMap())
        val designJson = jsonOf(design.toMap())
        val schemeJson = quote(theme.colorScheme)
        val styleJson = quote(buildStyleText(theme, design))

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
  app.colorScheme = $schemeJson;
  app.themeParams = $themeJson;
  app.designParams = $designJson;
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
  // Called from native when the host changes its theme or design.
  app.__applyTokens = function (next) {
    if (!next) return;
    if (next.style) applyStyle(next.style);
    if (next.colorScheme) app.colorScheme = next.colorScheme;
    if (next.themeParams) { app.themeParams = next.themeParams; emit('themeChanged', app.themeParams); }
    if (next.designParams) { app.designParams = next.designParams; emit('designChanged', app.designParams); }
  };
  window.GoatWebApp = app;

  applyStyle($styleJson);
})();
""".trimIndent()
    }

    /** The call pushed into a live page when the host changes tokens mid-session. */
    fun buildUpdateScript(theme: GoatThemeTokens, design: GoatDesignTokens): String {
        val payload = JsonObject(
            mapOf(
                "colorScheme" to JsonPrimitive(theme.colorScheme),
                "themeParams" to toJsonObject(theme.toMap()),
                "designParams" to toJsonObject(design.toMap()),
                "style" to JsonPrimitive(buildStyleText(theme, design))
            )
        ).toString()
        return "window.GoatWebApp && window.GoatWebApp.__applyTokens($payload);"
    }
}
