/**
 * TonConnect v2 in-page JavaScript bridge (`window.tonconnect`).
 */

import { GoatEventEmitter, GoatWeb3Transport, deepFreeze } from './goat-web3-bridge.js';

export const TONCONNECT_DEVICE_INFO = {
  platform: 'android',
  appName: 'GoatSuperApp',
  appVersion: '1.0.0',
  maxProtocolVersion: 2,
  features: ['SendTransaction', { name: 'SendTransaction', maxMessages: 4 }],
} as const;

const CHAIN_MAINNET = '-239';

export function createTonConnectBridge(transport: GoatWeb3Transport) {
  const emitter = new GoatEventEmitter();
  let connectedAddress: string | null = null;
  let connectedPublicKey: string | null = null;
  let eventId = 0;

  function connectEvent(address: string, publicKey: string | null) {
    return {
      event: 'connect',
      id: ++eventId,
      payload: {
        items: [
          {
            name: 'ton_addr',
            address,
            network: CHAIN_MAINNET,
            publicKey: publicKey ?? undefined,
          },
        ],
        device: TONCONNECT_DEVICE_INFO,
      },
    };
  }

  function errorEvent(code: number, message: string) {
    return { event: 'connect_error', id: ++eventId, payload: { code, message } };
  }

  async function connect(protocolVersion: number, message: { manifestUrl?: string }) {
    // TonConnect v2 requires the bridge to refuse a protocol version it cannot speak, rather than
    // negotiating down silently — a dApp that asked for v3 must not be told it got v3.
    if (typeof protocolVersion === 'number' && protocolVersion > TONCONNECT_DEVICE_INFO.maxProtocolVersion) {
      return errorEvent(
        1,
        `Unsupported TonConnect protocol version ${protocolVersion}; this bridge speaks up to ${TONCONNECT_DEVICE_INFO.maxProtocolVersion}`
      );
    }
    try {
      const res = await transport.call<{ address: string; publicKey?: string }>('WEB3_CONNECT_WALLET', {
        chainFamily: 'TON',
        network: 'ton-mainnet',
        manifestUrl: message?.manifestUrl,
        chains: [CHAIN_MAINNET],
      });
      connectedAddress = res?.address ?? null;
      connectedPublicKey = res?.publicKey ?? null;
      if (!connectedAddress) return errorEvent(0, 'Wallet returned no address');
      const event = connectEvent(connectedAddress, connectedPublicKey);
      emitter.emit('event', event);
      return event;
    } catch (err: any) {
      const event = errorEvent(err?.code === 4001 ? 300 : 0, err?.message ?? 'Connection failed');
      emitter.emit('event', event);
      return event;
    }
  }

  async function restoreConnection() {
    const account = await transport
      .call<{ connected?: boolean; address?: string; publicKey?: string }>('WEB3_GET_ACCOUNT', { chainFamily: 'TON' })
      .catch(() => null);
    if (!account?.connected || !account.address) return errorEvent(100, 'No active TON session');
    connectedAddress = account.address;
    connectedPublicKey = account.publicKey ?? null;
    return connectEvent(connectedAddress, connectedPublicKey);
  }

  async function disconnect() {
    await transport.call('WEB3_DISCONNECT', { chainFamily: 'TON' }).catch(() => undefined);
    connectedAddress = null;
    connectedPublicKey = null;
    const event = { event: 'disconnect', id: ++eventId, payload: {} };
    emitter.emit('event', event);
    return event;
  }

  async function sendTransaction(request: { id?: string | number; params?: any[] }) {
    const id = request?.id ?? ++eventId;
    const raw = request?.params?.[0];
    let parsed: any = raw;
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw);
      } catch {
        return { id, error: { code: 1, message: 'Bad request: params[0] is not valid JSON' } };
      }
    }
    const first = parsed?.messages?.[0];
    if (!first?.address) {
      return { id, error: { code: 1, message: 'Bad request: messages[0].address is required' } };
    }
    try {
      const res = await transport.call<{ signature: string; txHash?: string }>('WEB3_SIGN_TRANSACTION', {
        chainFamily: 'TON',
        network: 'ton-mainnet',
        txData: {
          to: first.address,
          value: first.amount,
          amount: first.amount,
          data: first.payload,
          valid_until: parsed?.valid_until,
          messages: parsed?.messages,
        },
      });
      return { id, result: res.txHash ?? res.signature };
    } catch (err: any) {
      return { id, error: { code: err?.code === 4001 ? 300 : 0, message: err?.message ?? 'Send failed' } };
    }
  }

  const bridge = {
    deviceInfo: TONCONNECT_DEVICE_INFO,
    protocolVersion: 2,
    isWalletBrowser: true,

    connect,
    restoreConnection,
    disconnect,

    async send(request: { method: string; id?: string | number; params?: any[] }) {
      switch (request?.method) {
        case 'sendTransaction':
          return sendTransaction(request);
        case 'disconnect':
          return disconnect();
        default:
          return {
            id: request?.id ?? ++eventId,
            error: { code: 400, message: `Method not supported: ${request?.method}` },
          };
      }
    },

    listen(callback: (event: any) => void) {
      emitter.on('event', callback);
      return () => emitter.removeListener('event', callback);
    },
  };

  return { bridge, emitter };
}

export function installTonConnectBridge(
  scope: any,
  transport: GoatWeb3Transport
): { installed: boolean; reason?: string } {
  if (!scope) return { installed: false, reason: 'no-window' };
  if (scope.__goat_tonconnect_initialized__) return { installed: false, reason: 'already-initialized' };
  scope.__goat_tonconnect_initialized__ = true;

  const { bridge } = createTonConnectBridge(transport);
  const frozen = deepFreeze(bridge);

  if (typeof scope.tonconnect === 'undefined') scope.tonconnect = frozen;
  scope.goatwallet = Object.freeze({ tonconnect: frozen });

  return { installed: true };
}
