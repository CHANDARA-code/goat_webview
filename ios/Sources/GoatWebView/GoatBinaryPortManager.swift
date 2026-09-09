import Foundation

/**
 * iOS binary message-port channel — the counterpart of Android's `GoatBinaryChannelManager`
 * (Task 10130), which is backed by `WebView.createWebMessageChannel()`.
 *
 * WKWebView exposes no native `MessagePort`-transfer API, so this uses the page's own
 * `MessageChannel` (the approach `flutter_inappwebview` also takes for its iOS
 * `WebMessageChannel`): on `CREATE_BINARY_PORT` a real `MessageChannel` is created in JS at
 * `window.__goatPorts["<id>"]`; the mini-app keeps `port1`, native holds `port2` via injected
 * script. Bytes cross the bridge base64-encoded — not zero-copy like the Android path, but a
 * true bidirectional binary channel rather than the previous "unsupported" stub.
 */
final class GoatBinaryPortManager {

    static let jsNamespace = "window.__goatPorts"

    private final class PortState {
        var inbox: [Data] = []       // app -> native, drained by READ_BINARY_MESSAGE
        var open = true
    }

    private var ports: [String: PortState] = [:]
    private let lock = NSLock()

    // MARK: - CREATE_BINARY_PORT

    /// - Returns: the new `portId` plus the JS to inject into the page.
    func createPort() -> (portId: String, injectJS: String) {
        let id = "gport_" + UUID().uuidString.replacingOccurrences(of: "-", with: "")
        lock.lock(); ports[id] = PortState(); lock.unlock()

        let js = """
        (function () {
          try {
            var ns = (\(Self.jsNamespace) = \(Self.jsNamespace) || {});
            if (ns["\(id)"]) { return; }
            var ch = new MessageChannel();
            ns["\(id)"] = ch;
            // native <- app : forward everything the app posts on port1
            ch.port2.onmessage = function (e) {
              var d = e.data;
              var b64;
              if (d instanceof ArrayBuffer) {
                b64 = btoa(String.fromCharCode.apply(null, new Uint8Array(d)));
              } else if (ArrayBuffer.isView(d)) {
                b64 = btoa(String.fromCharCode.apply(null, new Uint8Array(d.buffer)));
              } else {
                b64 = btoa(unescape(encodeURIComponent(typeof d === 'string' ? d : JSON.stringify(d))));
              }
              window.nativeBridge.postMessage(JSON.stringify({
                id: 'gport_rx_' + Date.now(),
                action: '__GOAT_PORT_RX',
                payload: { portId: "\(id)", data: b64 }
              }));
            };
            ch.port2.start && ch.port2.start();
          } catch (err) {}
        })();
        """
        return (id, js)
    }

    // MARK: - app -> native  (__GOAT_PORT_RX, internal)

    func enqueueFromJS(portId: String, base64: String) {
        guard let data = Data(base64Encoded: base64) else { return }
        lock.lock(); ports[portId]?.inbox.append(data); lock.unlock()
    }

    // MARK: - READ_BINARY_MESSAGE

    func read(portId: String) -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }
        guard let state = ports[portId] else {
            return ["portId": portId, "data": NSNull(), "error": "UNKNOWN_PORT"]
        }
        guard !state.inbox.isEmpty else {
            return ["portId": portId, "data": NSNull(), "type": 1]
        }
        let next = state.inbox.removeFirst()
        return ["portId": portId, "data": next.base64EncodedString(), "type": 1,
                "remaining": state.inbox.count]
    }

    // MARK: - POST_BINARY_MESSAGE  (native -> app)

    /// - Returns: the JS to inject that delivers `base64` to the app's `port1.onmessage`, or `nil`
    ///   if the port is unknown / closed.
    func postToApp(portId: String, base64: String) -> String? {
        lock.lock()
        let ok = ports[portId]?.open == true
        lock.unlock()
        guard ok else { return nil }
        return """
        (function () {
          try {
            var ch = \(Self.jsNamespace) && \(Self.jsNamespace)["\(portId)"];
            if (!ch) { return; }
            var bin = atob("\(base64)");
            var u8 = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) { u8[i] = bin.charCodeAt(i); }
            ch.port2.postMessage(u8.buffer, [u8.buffer]);
          } catch (err) {}
        })();
        """
    }

    // MARK: - CLOSE_BINARY_PORT

    func close(portId: String) -> String? {
        lock.lock()
        let existed = ports[portId] != nil
        ports[portId]?.open = false
        ports.removeValue(forKey: portId)
        lock.unlock()
        guard existed else { return nil }
        return """
        (function () {
          try {
            var ch = \(Self.jsNamespace) && \(Self.jsNamespace)["\(portId)"];
            if (ch) { ch.port1.close(); ch.port2.close(); delete \(Self.jsNamespace)["\(portId)"]; }
          } catch (err) {}
        })();
        """
    }

    func disposeAll() {
        lock.lock(); ports.removeAll(); lock.unlock()
    }
}
