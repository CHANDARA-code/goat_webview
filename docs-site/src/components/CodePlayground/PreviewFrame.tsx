import React, { useEffect, useRef, useState } from 'react';
import { useSimulator } from '../../context/SimulatorContext';
import { buildSrcDoc } from './buildSrcDoc';

interface PreviewFrameProps {
  code: string;
}

/**
 * Renders the developer's mini-app code in a sandboxed iframe and wires its injected
 * `goatBridge.callNative` shim to the real `SimulatorContext.callBridge`, so calls from
 * inside the iframe drive the same nav bar / bottom sheet / permission / biometrics state
 * that `DeviceScreenContent` renders as native chrome around this frame.
 *
 * The parent remounts this component (via a changing `key`) on every "Run" — so `srcDoc`
 * is captured once per mount via a lazy initializer and deliberately ignores later `code`
 * prop changes from continued typing. That remount is also the only way to stop a hung or
 * looping script, since there is no execution-timeout mechanism.
 */
export const PreviewFrame: React.FC<PreviewFrameProps> = ({ code }) => {
  const { callBridge } = useSimulator();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const callBridgeRef = useRef(callBridge);
  callBridgeRef.current = callBridge;

  const [srcDoc] = useState(() => buildSrcDoc(code));

  useEffect(() => {
    function handleMessage(evt: MessageEvent) {
      const data = evt.data;
      if (!data || data.__goatBridge !== true || data.type !== 'CALL') return;
      // A srcDoc iframe's origin is the opaque string "null", shared by every sandboxed
      // frame — event.origin can't authenticate the sender. event.source is the actual
      // WindowProxy of the frame that posted this, which can't be forged.
      if (evt.source !== iframeRef.current?.contentWindow) return;

      const { id, action, payload } = data;
      callBridgeRef.current(action, payload).then((trace) => {
        iframeRef.current?.contentWindow?.postMessage(
          { __goatBridge: true, type: 'RESPONSE', id, response: trace.response },
          '*'
        );
      });
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <iframe
      ref={iframeRef}
      title="Goat Mini-App Preview"
      // Deliberately no "allow-same-origin" — combined with "allow-scripts" that pairing
      // lets a sandboxed frame re-derive its parent's origin and escape the sandbox.
      // Omitting it keeps this frame's origin an opaque, unique "null".
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        background: '#ffffff',
        borderRadius: '8px',
      }}
    />
  );
};

export default PreviewFrame;
