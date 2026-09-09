/**
 * Document-start Web3 provider runtime.
 *
 * Installs the Web3 providers (EIP-6963 / Solana Wallet Standard / TonConnect v2), the
 * transparent WebAuthn polyfill, and the `window.goat.passkey` / `window.goat.vault` namespaces.
 *
 * Bundled to `dist/goat-web3-runtime.min.js` and embedded verbatim into the native
 * `GoatWeb3Bootstrap` constants by `scripts/generate-web3-runtime.mjs`, so Android, iOS and the
 * browser all evaluate one source of truth. `scripts/verify-web3-runtime-sync.mjs` fails the build
 * if the embedded copies drift from this source.
 */

import { GoatWeb3Transport } from './goat-web3-bridge.js';
import { installEip6963Provider } from './goat-eip6963-init.js';
import { installSolanaWallet } from './goat-solana-init.js';
import { installTonConnectBridge } from './goat-tonconnect-init.js';
import { installWebAuthnPolyfill } from './goat-webauthn-polyfill.js';
import { installPasskeyNamespace } from './goat-passkey-api.js';

export * from './goat-web3-bridge.js';
export * from './goat-eip6963-init.js';
export * from './goat-solana-init.js';
export * from './goat-tonconnect-init.js';
export * from './passkey-base64url.js';
export * from './passkey-dom.js';
export * from './goat-webauthn-polyfill.js';
export * from './goat-passkey-api.js';

export interface GoatWeb3RuntimeResult {
  evm: boolean;
  solana: boolean;
  ton: boolean;
  webauthn: boolean;
  passkeyApi: boolean;
}

export function installGoatWeb3Runtime(scope: any = typeof window !== 'undefined' ? window : undefined): GoatWeb3RuntimeResult {
  if (!scope) return { evm: false, solana: false, ton: false, webauthn: false, passkeyApi: false };

  let transport: GoatWeb3Transport = scope.__goat_web3_transport__;
  if (!transport) {
    transport = new GoatWeb3Transport();
    scope.__goat_web3_transport__ = transport;
  }

  return {
    evm: installEip6963Provider(scope, transport).installed,
    solana: installSolanaWallet(scope, transport).installed,
    ton: installTonConnectBridge(scope, transport).installed,
    webauthn: installWebAuthnPolyfill(scope, transport).installed,
    passkeyApi: installPasskeyNamespace(scope, transport).installed,
  };
}

if (typeof window !== 'undefined') {
  installGoatWeb3Runtime(window);
}
