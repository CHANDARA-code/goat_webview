/**
 * The `window.ReactNativeWebView` shim for react-native-webview compatibility.
 *
 * Per G9 this is a single `const string`, built once at module load — never rebuilt per call,
 * per handler, or per navigation.
 *
 * STATUS: the string itself and the native-side message relay it depends on (`window.nativeBridge`
 * -- the engine's own always-on mini-app bridge, unconditional, not compat-specific) both exist
 * today. What does NOT exist yet is T7 (N3)'s document-start injection hook: there is no
 * `compatBootstrap`-gated prop on `GoatWebViewNativeComponent` to feed this string into the page
 * automatically. Until T7 lands, this string is written and ready but nothing injects it — see
 * `useReactNativeWebViewMessaging.ts` for the native→JS half of this bridge, which *is* wired
 * today via the existing `onBridgeMessage` event.
 */
export const compatBootstrapScript = `(function () {
  if (window.ReactNativeWebView) return;
  window.ReactNativeWebView = {
    postMessage: function (data) {
      if (window.nativeBridge && window.nativeBridge.postMessage) {
        window.nativeBridge.postMessage(
          JSON.stringify({ action: '__RNW_MESSAGE__', payload: { data: String(data) } })
        );
      }
    },
    injectedObjectJson: function () {
      return window.__RNW_INJECTED_OBJECT_JSON__ || null;
    },
  };
  window.__rnwReceive = function (str) {
    var event = new MessageEvent('message', { data: str });
    window.dispatchEvent(event);
    document.dispatchEvent(event);
  };
})();`;
