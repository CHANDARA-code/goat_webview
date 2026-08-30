import type { GoatCapabilityPlugin } from 'react-native-goat-webview';
import { goatCapabilityRegistry } from 'react-native-goat-webview';

export const networkCapabilityPlugin: GoatCapabilityPlugin = {
  namespace: 'network',
  supportedActions: ['GET_NETWORK_TYPE', 'VERIFY_SSL_PIN', 'NETWORK_PING'],
  handleAction: async (action: string, payload: any) => {
    switch (action) {
      case 'GET_NETWORK_TYPE':
        return { networkType: 'wifi', isConnected: true };
      case 'VERIFY_SSL_PIN':
        return { pinned: true, host: payload?.host ?? 'api.goat.dev' };
      case 'NETWORK_PING':
        return { latencyMs: 20, host: payload?.host ?? '8.8.8.8' };
      default:
        return { success: true, action };
    }
  },
};

export function registerNetworkCapability(): void {
  goatCapabilityRegistry.registerPlugin(networkCapabilityPlugin);
}

export default networkCapabilityPlugin;
