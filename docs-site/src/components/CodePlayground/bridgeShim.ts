/**
 * Injected verbatim (plain ES, no TS/JSX) into the sandboxed preview iframe. Defines
 * `window.goatBridge.callNative(action, payload)` exactly matching the convention used
 * throughout the API catalog's code snippets, so code copy-pasted from any `/api` doc page
 * runs here unmodified. Implemented as a postMessage round-trip to the parent window, which
 * routes it through the real `SimulatorContext.callBridge` (see PreviewFrame.tsx).
 */
export const BRIDGE_SHIM_SCRIPT = `
(function () {
  var pending = new Map();
  var seq = 0;

  window.goatBridge = {
    callNative: function (action, payload) {
      return new Promise(function (resolve) {
        var id = 'call_' + (++seq);
        pending.set(id, resolve);
        window.parent.postMessage(
          { __goatBridge: true, type: 'CALL', id: id, action: action, payload: payload || {} },
          '*'
        );
      });
    },
  };

  window.addEventListener('message', function (evt) {
    var data = evt.data;
    if (!data || data.__goatBridge !== true || data.type !== 'RESPONSE') return;
    var resolve = pending.get(data.id);
    if (!resolve) return;
    pending.delete(data.id);
    resolve(data.response);
  });
})();
`;
