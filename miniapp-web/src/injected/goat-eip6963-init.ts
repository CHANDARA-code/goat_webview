/**
 * EIP-1193 provider + EIP-6963 multi-injected discovery, with EIP-5749 coexistence.
 */

import {
  GoatEventEmitter,
  GoatWeb3Transport,
  ProviderRpcError,
  deepFreeze,
} from './goat-web3-bridge.js';

export const EIP6963_PROVIDER_INFO = {
  uuid: 'a8b3f1e9-4d2c-80a5-f9b1-84c8a2ef013b',
  name: 'Goat SuperApp Wallet',
  icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiI+PHBhdGggZD0iTTQgNGgyNHYyNEg0eiIgZmlsbD0iIzQ2ODJCNCIvPjwvc3ZnPg==',
  rdns: 'com.goat.webview.wallet',
} as const;

function toHexChainId(chainId: string): string {
  const bare = String(chainId).replace('eip155:', '');
  const parsed = Number.parseInt(bare, 10);
  return Number.isFinite(parsed) ? `0x${parsed.toString(16)}` : '0x1';
}

export function createEvmProvider(transport: GoatWeb3Transport) {
  const emitter = new GoatEventEmitter();
  let chainId = '0x1';
  let accounts: string[] = [];

  async function connect(silent: boolean): Promise<string[]> {
    if (silent) {
      const account = await transport.call<{ connected?: boolean; address?: string; chainId?: string }>(
        'WEB3_GET_ACCOUNT',
        { chainFamily: 'EVM' }
      );
      if (!account?.connected || !account.address) return [];
      accounts = [account.address];
      if (account.chainId) chainId = toHexChainId(account.chainId);
      return accounts;
    }

    const res = await transport.call<{ address: string; chainId: string }>('WEB3_CONNECT_WALLET', {
      chainFamily: 'EVM',
      network: 'ethereum',
      chains: ['eip155:1'],
    });
    const previous = accounts;
    accounts = res?.address ? [res.address] : [];
    if (res?.chainId) {
      const next = toHexChainId(res.chainId);
      if (next !== chainId) {
        chainId = next;
        emitter.emit('chainChanged', chainId);
      }
    }
    if (previous.join() !== accounts.join()) emitter.emit('accountsChanged', accounts);
    return accounts;
  }

  const provider = {
    isGoat: true,
    isMetaMask: false,

    async request(args: { method: string; params?: any[] | Record<string, any> }): Promise<any> {
      if (!args || typeof args.method !== 'string') {
        throw new ProviderRpcError(-32602, 'Invalid request: method must be a string');
      }
      const params = (Array.isArray(args.params) ? args.params : []) as any[];

      switch (args.method) {
        case 'eth_requestAccounts':
          return connect(false);

        case 'eth_accounts':
          return accounts.length ? accounts : connect(true);

        case 'eth_chainId':
          return chainId;

        case 'net_version':
          return String(Number.parseInt(chainId, 16));

        case 'eth_sendTransaction': {
          const tx = params[0] ?? {};
          const res = await transport.call<{ txHash?: string; signature: string }>('WEB3_SIGN_TRANSACTION', {
            chainFamily: 'EVM',
            chainId: String(Number.parseInt(chainId, 16)),
            txData: {
              to: tx.to,
              value: tx.value,
              data: tx.data,
              nonce: tx.nonce,
              gasLimit: tx.gas ?? tx.gasLimit,
              maxFeePerGas: tx.maxFeePerGas,
              maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
            },
          });
          return res.txHash ?? res.signature;
        }

        case 'personal_sign': {
          const res = await transport.call<{ signature: string }>('WEB3_SIGN_MESSAGE', {
            chainFamily: 'EVM',
            address: params[1],
            message: params[0],
            messageType: 'personal_sign',
          });
          return res.signature;
        }

        case 'eth_sign': {
          const res = await transport.call<{ signature: string }>('WEB3_SIGN_MESSAGE', {
            chainFamily: 'EVM',
            address: params[0],
            message: params[1],
            messageType: 'personal_sign',
          });
          return res.signature;
        }

        case 'eth_signTypedData':
        case 'eth_signTypedData_v3':
        case 'eth_signTypedData_v4': {
          const payload = params[1];
          const res = await transport.call<{ signature: string }>('WEB3_SIGN_MESSAGE', {
            chainFamily: 'EVM',
            address: params[0],
            message: typeof payload === 'string' ? payload : JSON.stringify(payload),
            messageType: 'eth_signTypedData_v4',
          });
          return res.signature;
        }

        case 'wallet_switchEthereumChain': {
          const target = params[0]?.chainId;
          if (!target) throw new ProviderRpcError(-32602, 'wallet_switchEthereumChain requires a chainId');
          const decimal = String(Number.parseInt(String(target), 16));
          await transport.call('WEB3_SWITCH_CHAIN', { chainFamily: 'EVM', chainId: decimal });
          chainId = toHexChainId(decimal);
          emitter.emit('chainChanged', chainId);
          return null;
        }

        case 'wallet_addEthereumChain': {
          const target = params[0]?.chainId;
          if (!target) throw new ProviderRpcError(-32602, 'wallet_addEthereumChain requires a chainId');
          const decimal = String(Number.parseInt(String(target), 16));
          await transport.call('WEB3_SWITCH_CHAIN', {
            chainFamily: 'EVM',
            chainId: decimal,
            addChainParams: params[0],
          });
          chainId = toHexChainId(decimal);
          emitter.emit('chainChanged', chainId);
          return null;
        }

        case 'wallet_revokePermissions':
        case 'wallet_disconnect': {
          await transport.call('WEB3_DISCONNECT', { chainFamily: 'EVM' });
          accounts = [];
          emitter.emit('accountsChanged', accounts);
          emitter.emit('disconnect', new ProviderRpcError(4900, 'Wallet disconnected'));
          return null;
        }

        default:
          throw new ProviderRpcError(4200, `Unsupported method: ${args.method}`);
      }
    },

    on(event: string, listener: (...args: any[]) => void) {
      emitter.on(event, listener);
      return provider;
    },
    once(event: string, listener: (...args: any[]) => void) {
      emitter.once(event, listener);
      return provider;
    },
    removeListener(event: string, listener: (...args: any[]) => void) {
      emitter.removeListener(event, listener);
      return provider;
    },
    removeAllListeners(event?: string) {
      emitter.removeAllListeners(event);
      return provider;
    },
    isConnected() {
      return transport.isAvailable();
    },
  };

  return provider;
}

export interface Eip6963InstallResult {
  installed: boolean;
  reason?: string;
  announce?: () => void;
}

export function installEip6963Provider(
  scope: any,
  transport: GoatWeb3Transport
): Eip6963InstallResult {
  if (!scope) return { installed: false, reason: 'no-window' };
  if (scope.__goat_eip6963_initialized__) return { installed: false, reason: 'already-initialized' };
  scope.__goat_eip6963_initialized__ = true;

  const provider = createEvmProvider(transport);
  const info = deepFreeze({ ...EIP6963_PROVIDER_INFO });
  const frozenProvider = Object.freeze(provider);

  const announce = () => {
    const detail = Object.freeze({ info, provider: frozenProvider });
    const event =
      typeof scope.CustomEvent === 'function'
        ? new scope.CustomEvent('eip6963:announceProvider', { detail })
        : { type: 'eip6963:announceProvider', detail };
    scope.dispatchEvent(event);
  };

  scope.addEventListener('eip6963:requestProvider', announce);
  announce();

  // EIP-5749 coexistence: never destructively replace another wallet's window.ethereum.
  if (typeof scope.ethereum === 'undefined') {
    scope.ethereum = frozenProvider;
  } else {
    const existing = scope.ethereum;
    if (!Array.isArray(existing.providers)) {
      try {
        existing.providers = [existing];
      } catch {
        // A frozen foreign provider cannot host the list; EIP-6963 discovery still finds us.
      }
    }
    if (Array.isArray(existing.providers) && !existing.providers.includes(frozenProvider)) {
      existing.providers.push(frozenProvider);
    }
  }

  return { installed: true, announce };
}
