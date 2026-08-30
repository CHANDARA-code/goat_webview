import type { GoatCapabilityPlugin } from 'react-native-goat-webview';
import { goatCapabilityRegistry } from 'react-native-goat-webview';

export const bluetoothCapabilityPlugin: GoatCapabilityPlugin = {
  namespace: 'bluetooth',
  supportedActions: [
    'OPEN_BLUETOOTH_ADAPTER',
    'CLOSE_BLUETOOTH_ADAPTER',
    'GET_BLUETOOTH_ADAPTER_STATE',
    'START_BLUETOOTH_DEVICES_DISCOVERY',
    'STOP_BLUETOOTH_DEVICES_DISCOVERY',
    'GET_BLUETOOTH_DEVICES',
    'CREATE_BLE_CONNECTION',
    'CLOSE_BLE_CONNECTION',
  ],
  handleAction: async (action: string, payload: any) => {
    switch (action) {
      case 'OPEN_BLUETOOTH_ADAPTER':
        return { state: 'available', discovering: false };
      case 'CLOSE_BLUETOOTH_ADAPTER':
        return { closed: true };
      case 'GET_BLUETOOTH_ADAPTER_STATE':
        return { available: true, discovering: false };
      case 'START_BLUETOOTH_DEVICES_DISCOVERY':
        return { discovering: true };
      case 'STOP_BLUETOOTH_DEVICES_DISCOVERY':
        return { discovering: false };
      case 'GET_BLUETOOTH_DEVICES':
        return {
          devices: [{ deviceId: '00:11:22:33:44:55', name: 'Goat_BLE_Device', RSSI: -70 }],
        };
      default:
        return { success: true, action };
    }
  },
};

export function registerBluetoothCapability(): void {
  goatCapabilityRegistry.registerPlugin(bluetoothCapabilityPlugin);
}

export default bluetoothCapabilityPlugin;
