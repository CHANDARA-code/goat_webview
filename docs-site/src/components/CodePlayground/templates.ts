import { DEFAULT_PLAYGROUND_CODE } from '../../context/SimulatorContext';

export interface PlaygroundTemplate {
  id: string;
  label: string;
  code: string;
}

export const PLAYGROUND_TEMPLATES: PlaygroundTemplate[] = [
  {
    id: 'hello-bridge',
    label: 'Hello Bridge',
    code: DEFAULT_PLAYGROUND_CODE,
  },
  {
    id: 'bottom-sheet-cart',
    label: 'Bottom Sheet Cart',
    code: `<!DOCTYPE html>
<html>
  <head>
    <style>
      body { font-family: -apple-system, sans-serif; padding: 16px; color: #f1f5f9; }
      button { padding: 10px 14px; margin-right: 8px; border-radius: 8px; border: none; background: #6366f1; color: #fff; font-weight: 600; }
    </style>
  </head>
  <body>
    <h3>Cart Demo</h3>
    <p>These buttons drive the <strong>real native bottom sheet</strong> rendered above this iframe.</p>
    <button id="open">Open Cart</button>
    <button id="close">Close</button>
    <script>
      document.getElementById('open').addEventListener('click', () => {
        goatBridge.callNative('BOTTOM_SHEET_OPEN', { height: 380, snapIndex: 1 });
      });
      document.getElementById('close').addEventListener('click', () => {
        goatBridge.callNative('BOTTOM_SHEET_CLOSE', {});
      });
    </script>
  </body>
</html>
`,
  },
  {
    id: 'biometric-checkout',
    label: 'Biometric Checkout',
    code: `<!DOCTYPE html>
<html>
  <head>
    <style>
      body { font-family: -apple-system, sans-serif; padding: 16px; color: #f1f5f9; }
      button { padding: 10px 14px; border-radius: 8px; border: none; background: #6366f1; color: #fff; font-weight: 600; }
      #out { margin-top: 12px; font-weight: 700; }
    </style>
  </head>
  <body>
    <h3>Checkout</h3>
    <p>Total: <strong>$49.99</strong></p>
    <button id="pay">Pay Now</button>
    <div id="out"></div>
    <script>
      document.getElementById('pay').addEventListener('click', async () => {
        document.getElementById('out').textContent = 'Authenticating…';
        const result = await goatBridge.callNative('BIOMETRIC_AUTH', {
          reason: 'Authorize $49.99 payment',
        });
        document.getElementById('out').textContent = result.authenticated
          ? 'Payment authorized (' + result.biometryType + ')'
          : 'Authentication failed — try again';
      });
    </script>
  </body>
</html>
`,
  },
  {
    id: 'permission-haptics',
    label: 'Permission + Haptics',
    code: `<!DOCTYPE html>
<html>
  <head>
    <style>
      body { font-family: -apple-system, sans-serif; padding: 16px; color: #f1f5f9; }
      button { padding: 10px 14px; border-radius: 8px; border: none; background: #6366f1; color: #fff; font-weight: 600; }
      #out { margin-top: 12px; font-size: 12px; color: #94a3b8; }
    </style>
  </head>
  <body>
    <h3>Camera Access</h3>
    <button id="ask">Request Camera</button>
    <div id="out"></div>
    <script>
      document.getElementById('ask').addEventListener('click', async () => {
        const result = await goatBridge.callNative('REQUEST_PERMISSION', {
          scope: 'scope.camera',
          rationale: 'Camera access is required to scan QR tickets.',
        });
        document.getElementById('out').textContent = JSON.stringify(result, null, 2);
        await goatBridge.callNative('HAPTIC_FEEDBACK', {
          type: 'notification',
          notificationType: result.granted ? 'success' : 'error',
        });
      });
    </script>
  </body>
</html>
`,
  },
];
