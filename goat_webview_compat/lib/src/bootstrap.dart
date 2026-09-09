/// Static (G9) document-start shim defining `window.flutter_inappwebview` in
/// terms of goat's existing `window.nativeBridge`. Injected once via
/// [GoatWebView.initialUserScripts] — no per-call rebuild, no re-injection on
/// SPA route changes (that guarantee comes from the engine's document-start
/// hook itself, verified in SPIKE_T0_compat_adapter.md).
///
/// `__compatRequestId` round-trips through the existing `onBridgeMessage`
/// stream as a plain payload field (native does not populate
/// `GoatBridgeMessage.id` from a remote page's own postMessage — see the T0
/// spike's design notes) and back via `window.__compatResolve`.
const String compatBootstrapScript = r'''
(function () {
  if (window.flutter_inappwebview) return;
  var _seq = 0;
  var _pending = {};
  window.__compatResolve = function (id, result) {
    var cb = _pending[id];
    if (!cb) return;
    delete _pending[id];
    cb(result);
  };
  window.flutter_inappwebview = {
    callHandler: function (handlerName) {
      var args = Array.prototype.slice.call(arguments, 1);
      var id = ++_seq;
      return new Promise(function (resolve) {
        _pending[id] = resolve;
        window.nativeBridge.postMessage(JSON.stringify({
          action: '__COMPAT_CALL__',
          payload: {
            handlerName: handlerName,
            args: args,
            __compatRequestId: id
          }
        }));
      });
    }
  };
})();
''';
