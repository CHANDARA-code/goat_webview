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
 */
export const PreviewFrame: React.FC<PreviewFrameProps> = ({ code }) => {
  const { callBridge, addConsoleLog } = useSimulator();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const callBridgeRef = useRef(callBridge);
  callBridgeRef.current = callBridge;
  const addConsoleLogRef = useRef(addConsoleLog);
  addConsoleLogRef.current = addConsoleLog;

  const [srcDoc] = useState(() => buildSrcDoc(code));

  useEffect(() => {
    function handleMessage(evt: MessageEvent) {
      const data = evt.data;
      if (!data || data.__goatBridge !== true) return;
      if (evt.source !== iframeRef.current?.contentWindow) return;

      if (data.type === 'CONSOLE') {
        addConsoleLogRef.current({
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          level: data.level || 'log',
          messages: data.messages || [],
          timestamp: data.timestamp || Date.now(),
        });
        return;
      }

      if (data.type === 'CALL') {
        const { id, action, payload } = data;
        callBridgeRef.current(action, payload).then((trace) => {
          iframeRef.current?.contentWindow?.postMessage(
            { __goatBridge: true, type: 'RESPONSE', id, response: trace.response },
            '*'
          );
        });
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <iframe
      ref={iframeRef}
      title="Goat Mini-App Preview"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        background: 'var(--goat-bg-container)',
        borderRadius: '8px',
      }}
    />
  );
};

export default PreviewFrame;
