import type { GoatCapabilityPlugin } from 'react-native-goat-webview';
import { goatCapabilityRegistry } from 'react-native-goat-webview';

export const biometricsCapabilityPlugin: GoatCapabilityPlugin = {
  namespace: 'biometrics',
  supportedActions: [
    'CHECK_BIOMETRICS',
    'AUTHENTICATE_BIOMETRICS',
    'CHECK_BIOMETRIC_SUPPORT',
    'BIOMETRIC_AUTH',
  ],
  handleAction: async (action: string, payload: any) => {
    switch (action) {
      case 'CHECK_BIOMETRICS':
      case 'CHECK_BIOMETRIC_SUPPORT':
        return {
          isSupported: true,
          supportMode: ['fingerPrint', 'facial'],
          biometryType: 'FACE_ID',
        };
      case 'AUTHENTICATE_BIOMETRICS':
      case 'BIOMETRIC_AUTH':
        return {
          success: true,
          authenticated: true,
          timestamp: Date.now(),
        };
      default:
        return { success: true, action };
    }
  },
};

export function registerBiometricsCapability(): void {
  goatCapabilityRegistry.registerPlugin(biometricsCapabilityPlugin);
}

export default biometricsCapabilityPlugin;
