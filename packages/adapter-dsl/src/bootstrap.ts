import { DSL_ACTION_MAP } from './actionMap';

/**
 * T2 — the document-start bootstrap.
 *
 * This runs before the mini-app's own bundle, so it cannot import anything: it is a single static
 * `const string` built once at module load, talking directly to `window.nativeBridge` (the
 * engine's always-on bridge). Per T1's criteria there is no `eval()` and no string concatenation
 * of caller-supplied values -- the action table is serialized once, here, at build time.
 *
 * Every generated method supports both mini-app calling conventions at once:
 *   - callback style: `wx.getStorage({ key: 'k', success(res) {}, fail(e) {}, complete() {} })`
 *   - promise style:  `await wx.getStorage({ key: 'k' })`
 * The returned value is always a Promise, so awaiting works even when callbacks are supplied.
 */
const ACTION_TABLE_JSON = JSON.stringify(DSL_ACTION_MAP);

export const dslBootstrapScript = `(function () {
  if (window.__goatDslInstalled) return;
  window.__goatDslInstalled = true;

  var ACTIONS = ${ACTION_TABLE_JSON};
  var pending = {};
  var seq = 0;

  function send(action, payload) {
    return new Promise(function (resolve, reject) {
      if (!window.nativeBridge || !window.nativeBridge.postMessage) {
        reject(new Error('CAPABILITY_NOT_INSTALLED: native bridge unavailable'));
        return;
      }
      var id = 'dsl_' + (++seq);
      pending[id] = { resolve: resolve, reject: reject };
      window.nativeBridge.postMessage(
        JSON.stringify({ id: id, action: action, payload: payload || {} })
      );
    });
  }

  // The engine replies through this hook; it is also what the promise/callback split hangs off.
  window.__goatDslResolve = function (raw) {
    var msg;
    try { msg = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return; }
    if (!msg || !msg.id) return;
    var entry = pending[msg.id];
    if (!entry) return;
    delete pending[msg.id];
    if (msg.success === false) {
      entry.reject(new Error(msg.error || 'BRIDGE_ERROR'));
    } else {
      entry.resolve(msg.data || {});
    }
  };

  function invoke(action, options) {
    var opts = options || {};
    var payload = {};
    for (var k in opts) {
      if (k !== 'success' && k !== 'fail' && k !== 'complete') payload[k] = opts[k];
    }
    var p = send(action, payload);
    // Callback style is layered on top of the promise, so a caller may use either or both.
    p.then(
      function (res) {
        if (typeof opts.success === 'function') opts.success(res);
        if (typeof opts.complete === 'function') opts.complete(res);
      },
      function (err) {
        var e = { errMsg: err && err.message ? err.message : String(err) };
        if (typeof opts.fail === 'function') opts.fail(e);
        if (typeof opts.complete === 'function') opts.complete(e);
      }
    );
    return p;
  }

  function buildDsl() {
    var dsl = {};
    for (var name in ACTIONS) {
      (function (methodName, actionName) {
        dsl[methodName] = function (options) { return invoke(actionName, options); };
      })(name, ACTIONS[name]);
    }
    dsl.canIUse = function (schema) {
      // Synchronous in the real DSLs. The authoritative answer is native, so the table is warmed
      // asynchronously below and this reads the cache; an unwarmed lookup falls back to the
      // locally known action map rather than blocking.
      var key = String(schema || '').split('.')[0];
      if (window.__goatCapabilities && key in window.__goatCapabilities) {
        return !!window.__goatCapabilities[key];
      }
      return Object.prototype.hasOwnProperty.call(ACTIONS, key);
    };
    dsl.canIUseAsync = function (schema) {
      var key = String(schema || '').split('.')[0];
      var mapped = ACTIONS[key] || key;
      return send('CAN_I_USE', { action: mapped }).then(function (res) {
        var ok = !!(res && (res.supported || res.available));
        window.__goatCapabilities = window.__goatCapabilities || {};
        window.__goatCapabilities[key] = ok;
        return ok;
      });
    };
    return dsl;
  }

  var api = buildDsl();
  window.wx = window.wx || api;
  window.my = window.my || api;
  window.uni = window.uni || api;

  // Legacy JSBridge shims some frameworks probe for before using the modern API.
  function legacyBridge() {
    return {
      invoke: function (name, params, cb) {
        invoke(ACTIONS[name] || name, params).then(
          function (res) { if (typeof cb === 'function') cb(res); },
          function (err) { if (typeof cb === 'function') cb({ errMsg: String(err && err.message) }); }
        );
      },
      on: function () {},
      call: function () {},
    };
  }
  window.WeixinJSBridge = window.WeixinJSBridge || legacyBridge();
  window.AlipayJSBridge = window.AlipayJSBridge || legacyBridge();

  document.dispatchEvent(new Event('goat:dsl-ready'));
})();`;
