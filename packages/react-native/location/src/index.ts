import type { GoatCapabilityPlugin } from 'react-native-goat-webview';
import { goatCapabilityRegistry } from 'react-native-goat-webview';

export const locationCapabilityPlugin: GoatCapabilityPlugin = {
  namespace: 'location',
  supportedActions: [
    'GET_LOCATION',
    'CHOOSE_LOCATION',
    'OPEN_LOCATION',
    'START_LOCATION_UPDATE',
    'STOP_LOCATION_UPDATE',
  ],
  handleAction: async (action: string, payload: any) => {
    switch (action) {
      case 'GET_LOCATION':
        return {
          latitude: 37.7749,
          longitude: -122.4194,
          speed: 0.0,
          accuracy: 5.0,
          altitude: 10.0,
        };
      case 'CHOOSE_LOCATION':
        return {
          name: 'Market Street Hub',
          address: '799 Market St, San Francisco, CA',
          latitude: 37.7865,
          longitude: -122.4058,
        };
      case 'OPEN_LOCATION':
        return { opened: true, latitude: payload?.latitude, longitude: payload?.longitude };
      default:
        return { success: true, action };
    }
  },
};

export function registerLocationCapability(): void {
  goatCapabilityRegistry.registerPlugin(locationCapabilityPlugin);
}

export default locationCapabilityPlugin;
