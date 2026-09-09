import biometricsCapabilityPlugin, { registerBiometricsCapability } from '@goat-webview/biometrics';
import bluetoothCapabilityPlugin, { registerBluetoothCapability } from '@goat-webview/bluetooth';
import locationCapabilityPlugin, { registerLocationCapability } from '@goat-webview/location';
import mediaCapabilityPlugin, { registerMediaCapability } from '@goat-webview/media';
import networkCapabilityPlugin, { registerNetworkCapability } from '@goat-webview/network';
import paymentsCapabilityPlugin, { registerPaymentsCapability } from '@goat-webview/payments';
import scannerCapabilityPlugin, { registerScannerCapability } from '@goat-webview/scanner';

export { default as biometricsCapabilityPlugin } from '@goat-webview/biometrics';
export { default as bluetoothCapabilityPlugin } from '@goat-webview/bluetooth';
export { default as locationCapabilityPlugin } from '@goat-webview/location';
export { default as mediaCapabilityPlugin } from '@goat-webview/media';
export { default as networkCapabilityPlugin } from '@goat-webview/network';
export { default as paymentsCapabilityPlugin } from '@goat-webview/payments';
export { default as scannerCapabilityPlugin } from '@goat-webview/scanner';

/**
 * Option B of the dual-distribution model in TASK_PORTABLE_MINIAPP_DSL_ADAPTERS.md §1: one
 * dependency that pulls every capability companion. Option A remains depending on the individual
 * `@goat-webview/*` packages.
 *
 * JS-side only — this does not change which native feature modules the host links.
 */

/** Every bundled capability plugin, in registration order. */
export const allCapabilityPlugins = [biometricsCapabilityPlugin, bluetoothCapabilityPlugin, locationCapabilityPlugin, mediaCapabilityPlugin, networkCapabilityPlugin, paymentsCapabilityPlugin, scannerCapabilityPlugin];

/** Registers every capability companion with the global goatCapabilityRegistry. */
export function registerAllGoatCapabilities(): void {
  registerBiometricsCapability();
  registerBluetoothCapability();
  registerLocationCapability();
  registerMediaCapability();
  registerNetworkCapability();
  registerPaymentsCapability();
  registerScannerCapability();
}

export default registerAllGoatCapabilities;
