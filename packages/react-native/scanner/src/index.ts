import type { GoatCapabilityPlugin } from 'react-native-goat-webview';
import { goatCapabilityRegistry } from 'react-native-goat-webview';

export const scannerCapabilityPlugin: GoatCapabilityPlugin = {
  namespace: 'scanner',
  supportedActions: ['SCAN_CODE', 'GENERATE_BARCODE', 'SCAN_DOCUMENTS'],
  handleAction: async (action: string, payload: any) => {
    switch (action) {
      case 'SCAN_CODE':
        return {
          result: 'https://goat.dev/scan',
          scanType: payload?.scanType ?? 'QR_CODE',
          charSet: 'UTF-8',
          path: 'file:///data/scanner/scan_01.jpg',
        };
      case 'GENERATE_BARCODE':
        return {
          barcodeUri: 'file:///data/scanner/gen_qr_01.png',
          width: payload?.width ?? 300,
          height: payload?.height ?? 300,
        };
      case 'SCAN_DOCUMENTS':
        return {
          pages: ['file:///data/scanner/doc_p1.jpg'],
          pageCount: 1,
        };
      default:
        return { success: true, action };
    }
  },
};

export function registerScannerCapability(): void {
  goatCapabilityRegistry.registerPlugin(scannerCapabilityPlugin);
}

export default scannerCapabilityPlugin;
