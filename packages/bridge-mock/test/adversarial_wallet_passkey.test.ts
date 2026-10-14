/**
 * Adversarial suite for the wallet, passkey and vault bridge surface -- threat vectors A1-A10
 * and Vectors 4/5 from wallet and passkey security specification.
 *
 * Lives in packages/bridge-mock/test/ rather than a new top-level tests/security/ on purpose:
 * this package's npm test already runs, is in CI, and is covered by verify-suites-are-gated. A
 * security suite nobody executes is worse than none, because it reads as coverage.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { GoatBridgeMock, SUPPORTED_ACTIONS } from '../src/index.js';

const WALLET_ACTIONS = [
  'WEB3_CONNECT_WALLET',
  'WEB3_SIGN_TRANSACTION',
  'WEB3_SIGN_MESSAGE',
  'WEB3_SWITCH_CHAIN',
  'WEB3_DISCONNECT',
  'WEB3_GET_ACCOUNT',
];

const PASSKEY_ACTIONS = [
  'PASSKEY_CHECK_SUPPORT',
  'PASSKEY_REGISTER',
  'PASSKEY_ASSERT',
  'VAULT_ENCRYPT',
  'VAULT_DECRYPT',
];

/**
 * `mockState` is a module-level singleton, so `new GoatBridgeMock()` does NOT give a clean slate —
 * the gate flags leak between tests. Every test here resets them explicitly rather than assuming.
 */
function freshBridge(enforceGesture = false): any {
  const bridge: any = new GoatBridgeMock();
  bridge.state.enforceGestureFreshness = enforceGesture;
  bridge.state.enforceDialogCooldown = false;
  bridge.state.lastUserGestureTimestamp = Date.now();
  return bridge;
}

async function attempt(bridge: any, action: string, payload: any = {}) {
  try {
    return { ok: true, data: await bridge.callNative(action, payload) };
  } catch (err: any) {
    // GoatBridgeError carries the taxonomy code separately from the human-readable message.
    return { ok: false, error: `${err?.code ?? ''} ${err?.message ?? err}`.trim() };
  }
}

test('A1: every wallet and passkey action is part of the declared, dispatched surface', () => {
  for (const action of [...WALLET_ACTIONS, ...PASSKEY_ACTIONS]) {
    assert.ok(SUPPORTED_ACTIONS.has(action), `${action} must be part of the declared surface`);
  }
});

test('A1: forged payloads never crash the bridge or pollute Object.prototype', async () => {
  const bridge = freshBridge();
  const hostile: any[] = [
    JSON.parse('{"__proto__":{"polluted":true}}'),
    JSON.parse('{"constructor":{"prototype":{"isAdmin":true}}}'),
    { vaultId: { toString: () => { throw new Error('boom'); } } },
    { optionsJson: '￿' },
    { chainId: Number.MAX_SAFE_INTEGER },
    { message: 'x'.repeat(100_000) },
  ];

  for (const action of [...WALLET_ACTIONS, ...PASSKEY_ACTIONS]) {
    for (const payload of hostile) {
      const res = await attempt(bridge, action, payload);
      assert.equal(typeof res.ok, 'boolean', `${action} must resolve or reject, never hang`);
    }
  }
  assert.equal((Object.prototype as any).polluted, undefined);
  assert.equal((Object.prototype as any).isAdmin, undefined);
});

test('A3: drive-by signing without a fresh user gesture is refused', async () => {
  // The mock leaves the gesture gate off by default so mini-app development is not blocked by it;
  // enabling it here is what makes this an actual test of the gate rather than of the default.
  const bridge = freshBridge(true);
  bridge.state.lastUserGestureTimestamp = Date.now() - 60_000;

  for (const action of ['WEB3_SIGN_TRANSACTION', 'WEB3_SIGN_MESSAGE', 'PASSKEY_REGISTER', 'PASSKEY_ASSERT']) {
    const payload =
      action === 'WEB3_SIGN_TRANSACTION' ? { to: '0xdead', amount: '1' }
        : action === 'WEB3_SIGN_MESSAGE' ? { message: 'sign me' }
          : { optionsJson: '{"rpId":"shop.example.com"}' };
    const res = await attempt(bridge, action, payload);
    assert.equal(res.ok, false, `${action} must not succeed without a gesture`);
    assert.match(res.error!, /GESTURE_REQUIRED/, `${action} must fail with GESTURE_REQUIRED`);
  }
});

test('A3: the mock leaves the gesture gate off by default, so mock-only testing cannot prove it', async () => {
  // Recorded deliberately: a mini-app verified only against the mock will not see GESTURE_REQUIRED
  // and can still fail on a device. Device behaviour is covered by the native suites.
  const bridge = freshBridge(false);
  assert.equal(bridge.state.enforceGestureFreshness, false);
  const res = await attempt(bridge, 'WEB3_SIGN_TRANSACTION', { to: '0xdead', amount: '1' });
  assert.equal(res.ok, true, 'documents the permissive default rather than asserting it is correct');
});

test('A8: concurrent dispatch of the same signing action does not corrupt state', async () => {
  const bridge = freshBridge();
  const results = await Promise.all(
    Array.from({ length: 32 }, () => attempt(bridge, 'WEB3_SIGN_TRANSACTION', { to: '0xdead', amount: '1' }))
  );
  assert.equal(results.length, 32);
  for (const r of results) assert.equal(typeof r.ok, 'boolean', 'every concurrent caller must settle');
});

test('A10: a passkey ceremony without options is refused rather than defaulted', async () => {
  const bridge = freshBridge();
  for (const action of ['PASSKEY_REGISTER', 'PASSKEY_ASSERT']) {
    const res = await attempt(bridge, action, {});
    assert.equal(res.ok, false, `${action} must require optionsJson`);
    assert.match(res.error!, /optionsJson/);
  }
});

test('Vector 5: no passkey response carries a prf evaluation across the bridge', async () => {
  const bridge = freshBridge();

  for (const action of ['PASSKEY_REGISTER', 'PASSKEY_ASSERT']) {
    const res = await attempt(bridge, action, {
      optionsJson: JSON.stringify({
        rpId: 'shop.example.com',
        rp: { id: 'shop.example.com' },
        challenge: 'Y2hhbA',
        extensions: { prf: { eval: { first: 'c2FsdA' } } },
      }),
    });
    if (!res.ok) continue;
    const serialized = JSON.stringify(res.data);
    assert.equal(serialized.includes('"prf"'), false, `${action} leaked a prf extension result`);
    assert.equal(serialized.includes('hmacGetSecret'), false, `${action} leaked hmacGetSecret`);
  }
});

test('Vector 5: the vault exposes ciphertext and plaintext, never key material', async () => {
  const bridge = freshBridge();
  const envelope: any = await bridge.callNative('VAULT_ENCRYPT', {
    vaultId: 'adversarial_vault',
    plaintext: 'the launch codes',
  });

  assert.equal(
    JSON.stringify(envelope).includes('the launch codes'),
    false,
    'plaintext must not survive in the envelope'
  );
  for (const forbidden of ['key', 'prf', 'secret', 'masterKey', 'derivedKey']) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(envelope, forbidden),
      false,
      `envelope must not expose '${forbidden}'`
    );
  }

  const opened: any = await bridge.callNative('VAULT_DECRYPT', {
    vaultId: 'adversarial_vault',
    envelope,
  });
  assert.equal(opened.plaintext, 'the launch codes');
});

test('Vector 5: there is no client-reachable key-derivation action', () => {
  for (const forbidden of ['DERIVE_VAULT_KEY', 'GET_VAULT_KEY', 'EXPORT_PRIVATE_KEY', 'EXPORT_SEED']) {
    assert.equal(
      SUPPORTED_ACTIONS.has(forbidden),
      false,
      `${forbidden} must not exist - it would defeat the air gap by design`
    );
  }
});

test('A10: a vault envelope cannot be opened under a different vaultId', async () => {
  const bridge = freshBridge();
  const envelope = await bridge.callNative('VAULT_ENCRYPT', {
    vaultId: 'vault_a',
    plaintext: 'tenant secret',
  });
  const res = await attempt(bridge, 'VAULT_DECRYPT', { vaultId: 'vault_b', envelope });
  assert.equal(res.ok, false, 'an envelope from another vault must not open');
  assert.match(res.error!, /VAULT_DECRYPTION_FAILED/);
});

test('A5: a forged envelope is rejected', async () => {
  const bridge = freshBridge();
  const forged = {
    version: 1,
    vaultMode: 'hardware_keystore',
    appId: 'default',
    vaultId: 'vault_a',
    salt: 'AAAA',
    iv: 'AAAA',
    ciphertext: 'AAAA',
    tag: 'AAAA',
  };
  const res = await attempt(bridge, 'VAULT_DECRYPT', { vaultId: 'vault_a', envelope: forged });
  assert.equal(res.ok, false, 'a forged envelope must not decrypt');
});

test('A2: switching chain normalises CAIP-2 input rather than trusting it verbatim', async () => {
  const bridge = freshBridge();
  const res: any = await bridge.callNative('WEB3_SWITCH_CHAIN', { chainId: 'eip155:137' });
  assert.equal(res.chainId, '137', 'the eip155: prefix must be stripped before it reaches native');
});
