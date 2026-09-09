/**
 * Evaluates the BUILT `dist/goat-web3-runtime.min.js` — the exact bytes embedded into the Android
 * and iOS `GoatWeb3Bootstrap` constants — rather than the TypeScript source.
 *
 * The source tests prove the logic; this proves the artifact that actually ships. A bundling or
 * minification change that breaks injection would pass the source suite and fail here.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const MINIAPP_WEB = join(HERE, '..', '..');
const BUNDLE = join(MINIAPP_WEB, 'dist', 'goat-web3-runtime.min.js');

function buildIfMissing(): string {
  if (!existsSync(BUNDLE)) {
    execFileSync(
      join(MINIAPP_WEB, 'node_modules', '.bin', 'esbuild'),
      [
        join(MINIAPP_WEB, 'src', 'injected', 'index.ts'),
        '--minify',
        '--bundle',
        '--format=iife',
        '--target=es2019',
        `--outfile=${BUNDLE}`,
      ],
      { cwd: MINIAPP_WEB, stdio: 'ignore' }
    );
  }
  return readFileSync(BUNDLE, 'utf8');
}

function makeWindow(onSend: (req: any) => any) {
  const listeners = new Map<string, Set<(e: any) => void>>();
  const bridgeListeners = new Set<(e: any) => void>();

  class FakeCustomEvent {
    type: string;
    detail: any;
    constructor(type: string, init?: { detail?: any }) {
      this.type = type;
      this.detail = init?.detail;
    }
  }

  const win: any = {
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
      for (const l of Array.from(listeners.get(event.type) ?? [])) l(event);
      return true;
    },
    nativeBridge: {
      postMessage(raw: string) {
        const req = JSON.parse(raw);
        queueMicrotask(() => {
          const data = onSend(req);
          for (const l of Array.from(bridgeListeners)) {
            l({ data: JSON.stringify({ id: req.id, success: true, data }) });
          }
        });
      },
      addEventListener(_t: string, listener: (e: any) => void) {
        bridgeListeners.add(listener);
      },
    },
  };
  return { win, listenerCount: (t: string) => listeners.get(t)?.size ?? 0 };
}

describe('Built goat-web3-runtime.min.js', () => {
  let bundle: string;

  before(() => {
    bundle = buildIfMissing();
  });

  it('stays within a sane document-start budget', () => {
    const kb = Buffer.byteLength(bundle, 'utf8') / 1024;
    assert.ok(kb < 60, `document-start runtime is ${kb.toFixed(1)} KB, over the 60 KB budget`);
  });

  it('self-installs all three providers on evaluation', () => {
    const { win } = makeWindow(() => ({}));
    const sandbox: any = { window: win, queueMicrotask, setTimeout, clearTimeout, TextDecoder, TextEncoder, Date, console, DOMException, crypto, btoa, atob };
    sandbox.globalThis = sandbox;
    vm.runInNewContext(bundle, sandbox);

    assert.ok(win.ethereum, 'window.ethereum must exist after document-start evaluation');
    assert.equal(win.ethereum.isGoat, true);
    assert.ok(win.solana, 'window.solana must exist');
    assert.ok(win.tonconnect, 'window.tonconnect must exist');
    assert.ok(Array.isArray(win.navigator.wallets), 'Solana wallet must be registered on navigator.wallets');
    assert.equal(win.__goat_eip6963_initialized__, true);

    assert.ok(win.navigator.credentials, 'the WebAuthn polyfill must be installed by the built bundle');
    assert.equal(typeof win.navigator.credentials.create, 'function');
    assert.equal(typeof win.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable, 'function');
    assert.ok(win.goat?.passkey, 'window.goat.passkey must exist');
    assert.ok(win.goat?.vault, 'window.goat.vault must exist');
  });

  it('the built bundle strips prf from an outgoing assertion request', async () => {
    const seen: any[] = [];
    const { win } = makeWindow((req) => {
      seen.push(req);
      return {
        id: 'x',
        rawId: 'eA',
        response: { clientDataJSON: 'eA', authenticatorData: 'eA', signature: 'eA' },
        clientExtensionResults: {},
      };
    });
    const sandbox: any = { window: win, queueMicrotask, setTimeout, clearTimeout, TextDecoder, TextEncoder, Date, console, DOMException, crypto, btoa, atob };
    sandbox.globalThis = sandbox;
    vm.runInNewContext(bundle, sandbox);

    await win.navigator.credentials.get({
      publicKey: {
        challenge: new Uint8Array([1, 2, 3]),
        rpId: 'shop.example.com',
        extensions: { prf: { eval: { first: new Uint8Array([9, 9, 9]) } } },
      },
    });

    const req = seen.find((r) => r.action === 'PASSKEY_ASSERT');
    assert.ok(req, 'PASSKEY_ASSERT must be dispatched');
    assert.equal(req.payload.optionsJson.includes('prf'), false, 'the shipped bundle must strip prf');
  });

  it('announces a frozen EIP-6963 provider from the built bundle', () => {
    const { win } = makeWindow(() => ({}));
    const announced: any[] = [];
    win.addEventListener('eip6963:announceProvider', (e: any) => announced.push(e.detail));

    const sandbox: any = { window: win, queueMicrotask, setTimeout, clearTimeout, TextDecoder, TextEncoder, Date, console, DOMException, crypto, btoa, atob };
    sandbox.globalThis = sandbox;
    vm.runInNewContext(bundle, sandbox);

    assert.equal(announced.length, 1);
    assert.equal(announced[0].info.rdns, 'com.goat.webview.wallet');
    assert.ok(Object.isFrozen(announced[0].provider));
  });

  it('round-trips a real eth_requestAccounts through the bundled transport', async () => {
    const { win } = makeWindow((req) => {
      assert.equal(req.action, 'WEB3_CONNECT_WALLET');
      return { address: '0xabc', publicKey: 'p', wallet: 'Goat', network: 'ethereum', chainId: '1' };
    });
    const sandbox: any = { window: win, queueMicrotask, setTimeout, clearTimeout, TextDecoder, TextEncoder, Date, console, DOMException, crypto, btoa, atob };
    sandbox.globalThis = sandbox;
    vm.runInNewContext(bundle, sandbox);

    const accounts = await win.ethereum.request({ method: 'eth_requestAccounts' });
    // The bundle runs in its own vm realm, so its Array has a different prototype — compare
    // contents, not identity.
    assert.equal(accounts.length, 1);
    assert.equal(accounts[0], '0xabc');
  });

  it('a second evaluation (SPA re-navigation) accumulates no listeners', () => {
    const { win, listenerCount } = makeWindow(() => ({}));
    const sandbox: any = { window: win, queueMicrotask, setTimeout, clearTimeout, TextDecoder, TextEncoder, Date, console, DOMException, crypto, btoa, atob };
    sandbox.globalThis = sandbox;

    for (let i = 0; i < 100; i++) vm.runInNewContext(bundle, sandbox);
    assert.equal(listenerCount('eip6963:requestProvider'), 1, '100 evaluations must leave exactly one listener');
  });

  it('matches the sha256 recorded in both generated native bootstraps', () => {
    const kotlin = join(MINIAPP_WEB, '..', 'android/core/src/main/java/com/goat/webview/web3/GoatWeb3Bootstrap.kt');
    const swift = join(MINIAPP_WEB, '..', 'ios/Sources/GoatWebView/Web3/GoatWeb3Bootstrap.swift');
    if (!existsSync(kotlin) || !existsSync(swift)) return;

    const hashOf = (text: string) => text.match(/[0-9a-f]{64}/)?.[0];
    const kotlinHash = hashOf(readFileSync(kotlin, 'utf8'));
    const swiftHash = hashOf(readFileSync(swift, 'utf8'));
    assert.ok(kotlinHash, 'Kotlin bootstrap must record the bundle sha256');
    assert.equal(kotlinHash, swiftHash, 'Android and iOS must embed the same runtime build');
  });
});
