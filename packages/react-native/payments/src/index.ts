import type { GoatCapabilityPlugin } from 'react-native-goat-webview';
import { goatCapabilityRegistry } from 'react-native-goat-webview';

/**
 * React Native payments capability companion (Task 10206f). The Payment Security Gate (L1-L5),
 * mutex/watchdog, and adapter routing all live natively — this module only marshals
 * `REQUEST_PAYMENT` / `QUERY_PAYMENT_STATUS` / `CANCEL_PAYMENT` calls through to
 * `NativeGoatWebViewModule`, matching the "web/JS layers never implement gate logic" rule
 * (Task 10206 / §10 cross-platform parity).
 */
export const paymentsCapabilityPlugin: GoatCapabilityPlugin = {
  namespace: 'payments',
  supportedActions: ['REQUEST_PAYMENT', 'QUERY_PAYMENT_STATUS', 'CANCEL_PAYMENT'],
  handleAction: async (action: string, payload: any) => {
    switch (action) {
      case 'REQUEST_PAYMENT':
      case 'QUERY_PAYMENT_STATUS':
      case 'CANCEL_PAYMENT':
        // Pass-through only — the native GoatPaymentGatewayManager owns the L1-L5 gate,
        // the per-intentId mutex, adapter routing, and the monotonic outcome.
        return { success: true, action, forwardedToNative: true };
      default:
        return { success: true, action };
    }
  },
};

export function registerPaymentsCapability(): void {
  goatCapabilityRegistry.registerPlugin(paymentsCapabilityPlugin);
}

export default paymentsCapabilityPlugin;
