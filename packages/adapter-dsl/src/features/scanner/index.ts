import { defineFeature } from '../types';

/**
 * T6 — Camera & scanner (Domain 9a). `wx.scanCode` and `my.scan` are the same call.
 *
 * Releasing the camera session on completion is a native-side guarantee of the scanner manager.
 */
export const scannerFeature = defineFeature('scanner', {
  scanCode: 'SCAN_CODE',
  scan: 'SCAN_CODE',
});
export default scannerFeature;
