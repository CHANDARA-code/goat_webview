/**
 * Document-start Web3 provider runtime: EIP-6963 discovery, EIP-5749 coexistence, Solana Wallet
 * Standard registration, TonConnect v2 bridge, and the shared transport's id namespacing.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  GoatWeb3Transport,
  GOAT_WEB3_REQUEST_PREFIX,
  ProviderRpcError,
  toProviderRpcError,
  deepFreeze,
} from '../injected/goat-web3-bridge.js';
import { installEip6963Provider, createEvmProvider, EIP6963_PROVIDER_INFO } from '../injected/goat-eip6963-init.js';
import { installSolanaWallet } from '../injected/goat-solana-init.js';
import { installTonConnectBridge, createTonConnectBridge } from '../injected/goat-tonconnect-init.js';
import { installGoatWeb3Runtime } from '../injected/index.js';

/** Minimal `window` stand-in with the event surface and nativeBridge the runtime speaks to. */
function makeScope(handler?: (action: string, payload: any) => any) {
  const listeners = new Map<string, Set<(e: any) => void>>();
  const bridgeListeners = new Set<(e: any) => void>();
  const sent: Array<{ id: string; action: string; payload: any }> = [];

  class FakeCustomEvent {
    type: string;
    detail: any;
    constructor(type: string, init?: { detail?: any }) {
      this.type = type;
      this.detail = init?.detail;
    }
  }

  const scope: any = {
    CustomEvent: FakeCustomEvent,
    navigator: {},
    addEventListener(type: string, listener: (e: any) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type: string, listener: (e: any) => void) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(event: any) {
      for (const listener of Array.from(listeners.get(event.type) ?? [])) listener(event);
      return true;
    },
    nativeBridge: {
      postMessage(raw: string) {
        const request = JSON.parse(raw);
        sent.push(request);
        if (!handler) return;
        queueMicrotask(() => {
          let response: any;
          try {
            response = { id: request.id, success: true, data: handler(request.action, request.payload) };
          } catch (err: any) {
            response = { id: request.id, success: false, error: err.message };
          }
          for (const listener of Array.from(bridgeListeners)) listener({ data: JSON.stringify(response) });
        });
      },
      addEventListener(_type: string, listener: (e: any) => void) {
        bridgeListeners.add(listener);
      },
    },
  };

  return {
    scope,
    sent,
    listenerCount: (type: string) => listeners.get(type)?.size ?? 0,
    emitToBridge: (response: any) => {
      for (const listener of Array.from(bridgeListeners)) listener({ data: JSON.stringify(response) });
    },
  };
}

const ACCOUNT = {
  address: '0x71C8366420A0926793fe1b0e3D0b01c7B5b5424D',
  publicKey: 'pub',
  wallet: 'Goat',
  network: 'ethereum',
  chainId: '1',
};

function defaultHandler(action: string, payload: any) {
  switch (action) {
    case 'WEB3_CONNECT_WALLET':
      return payload.chainFamily === 'TON'
        ? { ...ACCOUNT, address: 'EQBvW8Z5huRRJ1S0', chainId: '-239' }
        : payload.chainFamily === 'SOLANA'
          ? { ...ACCOUNT, address: '11111111111111111111111111111111', chainId: 'solana:mainnet' }
          : ACCOUNT;
    case 'WEB3_GET_ACCOUNT':
      return { connected: false };
    case 'WEB3_SIGN_TRANSACTION':
      return { signature: '0xsig', txHash: '0xhash', network: 'ethereum', from: ACCOUNT.address };
    case 'WEB3_SIGN_MESSAGE':
      return { signature: '0xmsgsig', address: ACCOUNT.address, messageType: payload.messageType };
    case 'WEB3_SWITCH_CHAIN':
      return { switched: true, chainId: String(payload.chainId) };
    case 'WEB3_DISCONNECT':
      return { disconnected: true };
    default:
      throw new Error(`NOT_SUPPORTED: ${action}`);
  }
}

describe('Injected runtime — transport', () => {
  it('namespaces request ids so it never resolves the page GoatBridge replies', async () => {
    const { scope, sent, emitToBridge } = makeScope(defaultHandler);
    const transport = new GoatWeb3Transport();
    (globalThis as any).window = scope;

    const promise = transport.call('WEB3_CONNECT_WALLET', { chainFamily: 'EVM' });
    assert.ok(sent[0].id.startsWith(GOAT_WEB3_REQUEST_PREFIX));

    // A reply addressed to the mini-app's own bridge must be ignored, not mis-resolved.
    emitToBridge({ id: 'app-bridge-42', success: true, data: { hijacked: true } });
    const res: any = await promise;
    assert.equal(res.address, ACCOUNT.address);
    delete (globalThis as any).window;
  });

  it('maps native rejection codes onto EIP-1193 error codes', () => {
    assert.equal(toProviderRpcError(new Error('USER_CANCELLED: dismissed')).code, 4001);
    assert.equal(toProviderRpcError(new Error('GESTURE_REQUIRED: stale')).code, 4001);
    assert.equal(toProviderRpcError(new Error('CHAIN_UNSUPPORTED: 999')).code, 4902);
    assert.equal(toProviderRpcError(new Error('INVALID_PARAMETERS: bad')).code, -32602);
    assert.equal(toProviderRpcError(new Error('something unmapped')).code, -32603);
  });

  it('rejects with 4900 when no native bridge is present', async () => {
    const transport = new GoatWeb3Transport();
    (globalThis as any).window = { };
    await assert.rejects(() => transport.call('WEB3_GET_ACCOUNT'), (err: ProviderRpcError) => err.code === 4900);
    delete (globalThis as any).window;
  });
});

describe('Injected runtime — EIP-6963 discovery', () => {
  it('announces a deeply frozen provider detail', () => {
    const { scope } = makeScope(defaultHandler);
    const announced: any[] = [];
    scope.addEventListener('eip6963:announceProvider', (e: any) => announced.push(e.detail));

    installEip6963Provider(scope, new GoatWeb3Transport());
    assert.equal(announced.length, 1);
    assert.equal(announced[0].info.rdns, EIP6963_PROVIDER_INFO.rdns);
    assert.ok(Object.isFrozen(announced[0]), 'detail must be frozen');
    assert.ok(Object.isFrozen(announced[0].info), 'detail.info must be frozen');
    assert.ok(Object.isFrozen(announced[0].provider), 'detail.provider must be frozen');

    assert.throws(() => {
      'use strict';
      announced[0].info.name = 'Evil Wallet';
    });
  });

  it('re-announces on eip6963:requestProvider', () => {
    const { scope } = makeScope(defaultHandler);
    const announced: any[] = [];
    scope.addEventListener('eip6963:announceProvider', (e: any) => announced.push(e.detail));

    installEip6963Provider(scope, new GoatWeb3Transport());
    assert.equal(announced.length, 1);
    scope.dispatchEvent(new scope.CustomEvent('eip6963:requestProvider', {}));
    assert.equal(announced.length, 2);
  });

  it('is idempotent and accumulates no listeners across repeated navigations', () => {
    const { scope, listenerCount } = makeScope(defaultHandler);
    const transport = new GoatWeb3Transport();

    const first = installEip6963Provider(scope, transport);
    assert.equal(first.installed, true);

    for (let i = 0; i < 100; i++) {
      const again = installEip6963Provider(scope, transport);
      assert.equal(again.installed, false);
      assert.equal(again.reason, 'already-initialized');
    }
    assert.equal(listenerCount('eip6963:requestProvider'), 1, '100 re-injections must leave exactly one listener');
  });

  it('sets window.ethereum when the slot is free', () => {
    const { scope } = makeScope(defaultHandler);
    installEip6963Provider(scope, new GoatWeb3Transport());
    assert.equal(scope.ethereum.isGoat, true);
  });

  it('EIP-5749 coexistence: never destructively overwrites another wallet', () => {
    const { scope } = makeScope(defaultHandler);
    const foreign: any = { isMetaMask: true };
    scope.ethereum = foreign;

    installEip6963Provider(scope, new GoatWeb3Transport());

    assert.equal(scope.ethereum, foreign, 'existing window.ethereum must be preserved');
    assert.ok(Array.isArray(scope.ethereum.providers));
    assert.equal(scope.ethereum.providers[0], foreign);
    assert.ok(scope.ethereum.providers.some((p: any) => p.isGoat === true), 'goat must be listed under providers');
  });

  it('survives a frozen foreign window.ethereum without throwing', () => {
    const { scope } = makeScope(defaultHandler);
    scope.ethereum = Object.freeze({ isMetaMask: true });
    assert.doesNotThrow(() => installEip6963Provider(scope, new GoatWeb3Transport()));
  });
});

describe('Injected runtime — EIP-1193 method routing', () => {
  let scope: any;
  let sent: Array<{ action: string; payload: any }>;
  let provider: any;

  beforeEach(() => {
    const made = makeScope(defaultHandler);
    scope = made.scope;
    sent = made.sent;
    (globalThis as any).window = scope;
    provider = createEvmProvider(new GoatWeb3Transport());
  });

  it('eth_requestAccounts connects and returns the address', async () => {
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    assert.deepEqual(accounts, [ACCOUNT.address]);
    assert.equal(sent[0].action, 'WEB3_CONNECT_WALLET');
    assert.equal(sent[0].payload.chainFamily, 'EVM');
  });

  it('eth_accounts stays silent — it must not open a connect prompt', async () => {
    const accounts = await provider.request({ method: 'eth_accounts' });
    assert.deepEqual(accounts, []);
    assert.equal(sent[0].action, 'WEB3_GET_ACCOUNT', 'eth_accounts must use the ungated query action');
  });

  it('eth_signTypedData_v4 routes to WEB3_SIGN_MESSAGE with the typed-data messageType', async () => {
    const typedData = { primaryType: 'PermitSingle', message: { amount: '2^160-1' } };
    const sig = await provider.request({
      method: 'eth_signTypedData_v4',
      params: [ACCOUNT.address, typedData],
    });
    assert.equal(sig, '0xmsgsig');
    const req = sent.find((s) => s.action === 'WEB3_SIGN_MESSAGE')!;
    assert.equal(req.payload.messageType, 'eth_signTypedData_v4');
    assert.equal(req.payload.message, JSON.stringify(typedData));
  });

  it('personal_sign routes params in the WalletConnect order (message, address)', async () => {
    await provider.request({ method: 'personal_sign', params: ['hello', ACCOUNT.address] });
    const req = sent.find((s) => s.action === 'WEB3_SIGN_MESSAGE')!;
    assert.equal(req.payload.message, 'hello');
    assert.equal(req.payload.address, ACCOUNT.address);
    assert.equal(req.payload.messageType, 'personal_sign');
  });

  it('eth_sendTransaction returns the tx hash and forwards EIP-1559 fields', async () => {
    const hash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{ to: '0xdead', value: '0x1', gas: '0x5208', maxFeePerGas: '0x2' }],
    });
    assert.equal(hash, '0xhash');
    const req = sent.find((s) => s.action === 'WEB3_SIGN_TRANSACTION')!;
    assert.equal(req.payload.txData.to, '0xdead');
    assert.equal(req.payload.txData.gasLimit, '0x5208');
    assert.equal(req.payload.txData.maxFeePerGas, '0x2');
  });

  it('wallet_switchEthereumChain converts hex to decimal and emits chainChanged', async () => {
    const seen: string[] = [];
    provider.on('chainChanged', (id: string) => seen.push(id));

    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x89' }] });
    const req = sent.find((s) => s.action === 'WEB3_SWITCH_CHAIN')!;
    assert.equal(req.payload.chainId, '137', 'chainId must reach native as decimal');
    assert.deepEqual(seen, ['0x89']);
    assert.equal(await provider.request({ method: 'eth_chainId' }), '0x89');
  });

  it('rejects an unsupported method with EIP-1193 code 4200', async () => {
    await assert.rejects(
      () => provider.request({ method: 'eth_sendRawTransaction' }),
      (err: ProviderRpcError) => err.code === 4200
    );
  });

  it('rejects a malformed request with -32602', async () => {
    await assert.rejects(
      () => provider.request({} as any),
      (err: ProviderRpcError) => err.code === -32602
    );
  });

  it('a throwing dApp listener cannot break the provider', async () => {
    provider.on('chainChanged', () => {
      throw new Error('dApp listener blew up');
    });
    let second = false;
    provider.on('chainChanged', () => {
      second = true;
    });
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] });
    assert.equal(second, true, 'a throwing listener must not stop later listeners');
  });
});

describe('Injected runtime — Solana Wallet Standard', () => {
  it('registers on window.navigator.wallets and exposes the standard features', () => {
    const { scope } = makeScope(defaultHandler);
    (globalThis as any).window = scope;
    installSolanaWallet(scope, new GoatWeb3Transport());

    assert.ok(Array.isArray(scope.navigator.wallets));
    let registered: any;
    scope.navigator.wallets[0].register({ register: (w: any) => (registered = w) });

    assert.equal(registered.name, 'Goat SuperApp Wallet');
    assert.ok(registered.features['standard:connect']);
    assert.ok(registered.features['solana:signAndSendTransaction']);
    assert.ok(registered.features['solana:signTransaction']);
    assert.ok(registered.features['solana:signMessage']);
    assert.deepEqual(
      registered.features['solana:signAndSendTransaction'].supportedTransactionVersions,
      ['legacy', 0],
      'both legacy and v0 transactions must be advertised'
    );
    delete (globalThis as any).window;
  });

  it('installs the legacy window.solana probe surface and is idempotent', () => {
    const { scope } = makeScope(defaultHandler);
    const transport = new GoatWeb3Transport();
    assert.equal(installSolanaWallet(scope, transport).installed, true);
    assert.equal(scope.solana.isGoat, true);

    const before = scope.navigator.wallets.length;
    assert.equal(installSolanaWallet(scope, transport).installed, false);
    assert.equal(scope.navigator.wallets.length, before, 'a second install must not re-register');
  });
});

describe('Injected runtime — TonConnect v2', () => {
  it('connect returns a ton_addr connect event', async () => {
    const { scope } = makeScope(defaultHandler);
    (globalThis as any).window = scope;
    const { bridge } = createTonConnectBridge(new GoatWeb3Transport());

    const event: any = await bridge.connect(2, { manifestUrl: 'https://example.com/manifest.json' });
    assert.equal(event.event, 'connect');
    assert.equal(event.payload.items[0].name, 'ton_addr');
    assert.equal(event.payload.items[0].address, 'EQBvW8Z5huRRJ1S0');
    assert.equal(event.payload.items[0].network, '-239');
    delete (globalThis as any).window;
  });

  it('sendTransaction forwards the first message and returns its hash', async () => {
    const made = makeScope(defaultHandler);
    (globalThis as any).window = made.scope;
    const { bridge } = createTonConnectBridge(new GoatWeb3Transport());

    const res: any = await bridge.send({
      method: 'sendTransaction',
      id: 7,
      params: [
        JSON.stringify({
          valid_until: 1757235500,
          messages: [{ address: 'EQBvW8Z5', amount: '1500000000', payload: 'te6cckEBAQEAAgAAAEyscueA' }],
        }),
      ],
    });
    assert.equal(res.id, 7);
    assert.equal(res.result, '0xhash');
    const req = made.sent.find((s) => s.action === 'WEB3_SIGN_TRANSACTION')!;
    assert.equal(req.payload.txData.to, 'EQBvW8Z5');
    assert.equal(req.payload.txData.valid_until, 1757235500);
    delete (globalThis as any).window;
  });

  it('rejects malformed params without throwing', async () => {
    const { scope } = makeScope(defaultHandler);
    (globalThis as any).window = scope;
    const { bridge } = createTonConnectBridge(new GoatWeb3Transport());

    const badJson: any = await bridge.send({ method: 'sendTransaction', id: 1, params: ['not json'] });
    assert.equal(badJson.error.code, 1);

    const noAddress: any = await bridge.send({ method: 'sendTransaction', id: 2, params: [{ messages: [{}] }] });
    assert.equal(noAddress.error.code, 1);

    const unknown: any = await bridge.send({ method: 'ton_nonsense', id: 3 });
    assert.equal(unknown.error.code, 400);
    delete (globalThis as any).window;
  });

  it('installs window.tonconnect and is idempotent', () => {
    const { scope } = makeScope(defaultHandler);
    const transport = new GoatWeb3Transport();
    assert.equal(installTonConnectBridge(scope, transport).installed, true);
    assert.equal(scope.tonconnect.protocolVersion, 2);
    assert.ok(Object.isFrozen(scope.tonconnect));
    assert.equal(installTonConnectBridge(scope, transport).installed, false);
  });

  it('refuses a protocol version it cannot speak instead of negotiating down silently', async () => {
    const { scope, sent } = makeScope(defaultHandler);
    (globalThis as any).window = scope;
    const { bridge } = createTonConnectBridge(new GoatWeb3Transport());

    const res: any = await bridge.connect(3, { manifestUrl: 'https://example.com/manifest.json' });
    assert.equal(res.event, 'connect_error');
    assert.equal(res.payload.code, 1, 'TonConnect BAD_REQUEST_ERROR');
    assert.match(res.payload.message, /Unsupported TonConnect protocol version 3/);
    assert.equal(
      sent.some((s) => s.action === 'WEB3_CONNECT_WALLET'),
      false,
      'no wallet connection may be attempted for an unsupported protocol version'
    );

    const ok: any = await bridge.connect(2, { manifestUrl: 'https://example.com/manifest.json' });
    assert.equal(ok.event, 'connect');
    delete (globalThis as any).window;
  });
});

describe('Injected runtime — composition', () => {
  it('installs every provider and the passkey layer before any page script runs', () => {
    const { scope } = makeScope(defaultHandler);
    const res = installGoatWeb3Runtime(scope);
    assert.deepEqual(res, { evm: true, solana: true, ton: true, webauthn: true, passkeyApi: true });
    assert.ok(scope.ethereum);
    assert.ok(scope.solana);
    assert.ok(scope.tonconnect);
    assert.ok(scope.navigator.credentials, 'the WebAuthn polyfill must be installed');
    assert.ok(scope.goat.passkey);
    assert.ok(scope.goat.vault);
  });

  it('a second evaluation installs nothing again and shares one transport', () => {
    const { scope } = makeScope(defaultHandler);
    installGoatWeb3Runtime(scope);
    const transport = scope.__goat_web3_transport__;
    const second = installGoatWeb3Runtime(scope);
    assert.deepEqual(second, { evm: false, solana: false, ton: false, webauthn: false, passkeyApi: false });
    assert.equal(scope.__goat_web3_transport__, transport);
  });

  it('deepFreeze freezes nested objects', () => {
    const frozen = deepFreeze({ a: { b: { c: 1 } } });
    assert.ok(Object.isFrozen(frozen.a.b));
  });
});
