export const BRIDGE_SHIM_SCRIPT = `
(function () {
  var pending = new Map();
  var seq = 0;

  // 1. Console instrumentation
  var levels = ['log', 'info', 'warn', 'error', 'debug'];
  levels.forEach(function (level) {
    var original = console[level];
    console[level] = function () {
      var args = Array.prototype.slice.call(arguments);
      try {
        var formatted = args.map(function (arg) {
          if (arg === null) return 'null';
          if (arg === undefined) return 'undefined';
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg, null, 2);
            } catch (e) {
              return String(arg);
            }
          }
          return String(arg);
        });
        window.parent.postMessage(
          {
            __goatBridge: true,
            type: 'CONSOLE',
            level: level,
            messages: formatted,
            timestamp: Date.now(),
          },
          '*'
        );
      } catch (e) {}
      if (original) original.apply(console, arguments);
    };
  });

  // 2. Uncaught errors and unhandled rejections
  window.addEventListener('error', function (evt) {
    try {
      window.parent.postMessage(
        {
          __goatBridge: true,
          type: 'CONSOLE',
          level: 'error',
          messages: [evt.message || 'Uncaught Error'],
          error: {
            message: evt.message,
            filename: evt.filename,
            lineno: evt.lineno,
            colno: evt.colno,
          },
          timestamp: Date.now(),
        },
        '*'
      );
    } catch (e) {}
  });

  window.addEventListener('unhandledrejection', function (evt) {
    try {
      var reason = evt.reason;
      var msg = reason instanceof Error ? reason.message : String(reason);
      window.parent.postMessage(
        {
          __goatBridge: true,
          type: 'CONSOLE',
          level: 'error',
          messages: ['Unhandled Promise Rejection: ' + msg],
          error: {
            message: msg,
            stack: reason instanceof Error ? reason.stack : undefined,
          },
          timestamp: Date.now(),
        },
        '*'
      );
    } catch (e) {}
  });

  // 3. Goat Bridge callNative implementation
  window.goatBridge = {
    callNative: function (action, payload) {
      return new Promise(function (resolve) {
        var id = 'call_' + (++seq);
        pending.set(id, resolve);
        window.parent.postMessage(
          {
            __goatBridge: true,
            type: 'CALL',
            id: id,
            action: action,
            payload: payload || {},
          },
          '*'
        );
      });
    },
  };

  // 4. Response listener
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
