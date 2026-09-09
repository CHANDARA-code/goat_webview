/**
 * Solana Wallet Standard registration on `window.navigator.wallets`, plus the legacy
 * `window.solana` object older dApps still probe for.
 */

import { GoatEventEmitter, GoatWeb3Transport, deepFreeze } from './goat-web3-bridge.js';

export const SOLANA_WALLET_NAME = 'Goat SuperApp Wallet';
export const SOLANA_CHAINS = ['solana:mainnet', 'solana:devnet'] as const;

function base58ToBytes(address: string): Uint8Array {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const bytes: number[] = [];
  for (const char of address) {
    let carry = ALPHABET.indexOf(char);
    if (carry < 0) return new Uint8Array(0);
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const char of address) {
    if (char !== ALPHABET[0]) break;
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

export function createSolanaWallet(transport: GoatWeb3Transport) {
  const emitter = new GoatEventEmitter();
  let accounts: any[] = [];

  function toAccount(address: string) {
    return Object.freeze({
      address,
      publicKey: base58ToBytes(address),
      chains: SOLANA_CHAINS,
      features: ['solana:signAndSendTransaction', 'solana:signTransaction', 'solana:signMessage'],
      label: SOLANA_WALLET_NAME,
      icon: undefined,
    });
  }

  async function connect() {
    const res = await transport.call<{ address: string }>('WEB3_CONNECT_WALLET', {
      chainFamily: 'SOLANA',
      network: 'solana',
      chains: ['solana:mainnet'],
    });
    accounts = res?.address ? [toAccount(res.address)] : [];
    emitter.emit('change', { accounts });
    return { accounts };
  }

  async function disconnect() {
    await transport.call('WEB3_DISCONNECT', { chainFamily: 'SOLANA' });
    accounts = [];
    emitter.emit('change', { accounts });
  }

  async function signAndSendTransaction(...inputs: any[]) {
    const results = [];
    for (const input of inputs) {
      const res = await transport.call<{ signature: string; txHash?: string }>('WEB3_SIGN_TRANSACTION', {
        chainFamily: 'SOLANA',
        network: 'solana',
        txData: {
          transaction: input?.transaction,
          recentBlockhash: input?.recentBlockhash,
          address: input?.account?.address,
          to: input?.account?.address,
        },
      });
      results.push({ signature: res.txHash ?? res.signature });
    }
    return results;
  }

  async function signTransaction(...inputs: any[]) {
    const results = [];
    for (const input of inputs) {
      const res = await transport.call<{ signature: string }>('WEB3_SIGN_TRANSACTION', {
        chainFamily: 'SOLANA',
        network: 'solana',
        txData: {
          transaction: input?.transaction,
          recentBlockhash: input?.recentBlockhash,
          address: input?.account?.address,
          to: input?.account?.address,
        },
      });
      results.push({ signedTransaction: res.signature });
    }
    return results;
  }

  async function signMessage(...inputs: any[]) {
    const results = [];
    for (const input of inputs) {
      const message =
        typeof input?.message === 'string'
          ? input.message
          : new TextDecoder().decode(input?.message ?? new Uint8Array());
      const res = await transport.call<{ signature: string }>('WEB3_SIGN_MESSAGE', {
        chainFamily: 'SOLANA',
        network: 'solana',
        message,
        messageType: 'solana_signMessage',
      });
      results.push({ signedMessage: input?.message, signature: res.signature });
    }
    return results;
  }

  const wallet = {
    version: '1.0.0' as const,
    name: SOLANA_WALLET_NAME,
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiI+PHBhdGggZD0iTTQgNGgyNHYyNEg0eiIgZmlsbD0iIzQ2ODJCNCIvPjwvc3ZnPg==',
    chains: SOLANA_CHAINS,
    get accounts() {
      return accounts;
    },
    features: {
      'standard:connect': { version: '1.0.0', connect },
      'standard:disconnect': { version: '1.0.0', disconnect },
      'standard:events': {
        version: '1.0.0',
        on(event: string, listener: (...args: any[]) => void) {
          emitter.on(event, listener);
          return () => emitter.removeListener(event, listener);
        },
      },
      'solana:signAndSendTransaction': {
        version: '1.0.0',
        supportedTransactionVersions: ['legacy', 0],
        signAndSendTransaction,
      },
      'solana:signTransaction': {
        version: '1.0.0',
        supportedTransactionVersions: ['legacy', 0],
        signTransaction,
      },
      'solana:signMessage': { version: '1.0.0', signMessage },
    },
  };

  return { wallet, connect, disconnect, signMessage, signTransaction, signAndSendTransaction };
}

export function installSolanaWallet(scope: any, transport: GoatWeb3Transport): { installed: boolean; reason?: string } {
  if (!scope) return { installed: false, reason: 'no-window' };
  if (scope.__goat_solana_initialized__) return { installed: false, reason: 'already-initialized' };
  scope.__goat_solana_initialized__ = true;

  const { wallet, connect, disconnect, signMessage } = createSolanaWallet(transport);
  const frozenWallet = deepFreeze(wallet);

  const navigatorRef = scope.navigator ?? (scope.navigator = {});
  const register = (callback: (api: any) => void) => {
    try {
      callback({ register: () => () => undefined });
    } catch {
      // A malformed app-side registrar must not abort injection.
    }
  };

  if (!Array.isArray(navigatorRef.wallets)) navigatorRef.wallets = [];
  navigatorRef.wallets.push({
    register: (api: any) => {
      if (api && typeof api.register === 'function') api.register(frozenWallet);
      return () => undefined;
    },
  });

  scope.dispatchEvent?.(
    typeof scope.CustomEvent === 'function'
      ? new scope.CustomEvent('wallet-standard:register-wallet', {
          detail: (api: any) => api?.register?.(frozenWallet),
        })
      : { type: 'wallet-standard:register-wallet', detail: register }
  );

  scope.addEventListener?.('wallet-standard:app-ready', (event: any) => {
    event?.detail?.register?.(frozenWallet);
  });

  // Legacy `window.solana` probe surface.
  if (typeof scope.solana === 'undefined') {
    scope.solana = Object.freeze({
      isGoat: true,
      isPhantom: false,
      get publicKey() {
        return frozenWallet.accounts[0]?.publicKey ?? null;
      },
      get isConnected() {
        return frozenWallet.accounts.length > 0;
      },
      connect: async () => {
        const res = await connect();
        return { publicKey: res.accounts[0]?.publicKey ?? null };
      },
      disconnect,
      signMessage: async (message: Uint8Array) => (await signMessage({ message }))[0],
    });
  }

  return { installed: true };
}
