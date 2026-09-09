import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { dslBootstrapScript } from '../bootstrap';
import { DSL_ACTION_MAP } from '../actionMap';
import {
  CapabilityRegistry,
  CAPABILITY_NOT_INSTALLED,
  resolveAction,
  isMappedLocally,
} from '../capabilities';

/**
 * The bootstrap is a string that runs in the page before any bundle loads, so the only honest way
 * to test it is to execute it against a fake window/document and drive the bridge.
 */
function installBootstrap() {
  const sent: Array<{ id: string; action: string; payload: Record<string, unknown> }> = [];
  const win: Record<string, any> = {
    nativeBridge: {
      postMessage(raw: string) {
        sent.push(JSON.parse(raw));
      },
    },
  };
  const doc = { dispatchEvent: () => true };
  const fn = new Function('window', 'document', 'Event', dslBootstrapScript);
  fn(win, doc, class { constructor(public type: string) {} });
  return { win, sent };
}

describe('T2 — document-start bootstrap', () => {
  test('installs every documented global', () => {
    const { win } = installBootstrap();
    for (const g of ['wx', 'my', 'uni', 'WeixinJSBridge', 'AlipayJSBridge']) {
      assert.ok(win[g], `missing global: ${g}`);
    }
  });

  test('is idempotent — a second run must not replace live globals', () => {
    const { win } = installBootstrap();
    const firstWx = win.wx;
    const fn = new Function('window', 'document', 'Event', dslBootstrapScript);
    fn(win, { dispatchEvent: () => true }, class { constructor(public type: string) {} });
    assert.equal(win.wx, firstWx, 're-injection must not swap the object out from under the page');
  });

  test('maps a DSL method onto its engine action and strips callbacks from the payload', async () => {
    const { win, sent } = installBootstrap();
    win.wx.getStorage({ key: 'token', success: () => {}, fail: () => {}, complete: () => {} });
    assert.equal(sent.length, 1);
    assert.equal(sent[0]!.action, 'STORAGE_GET');
    // success/fail/complete are calling convention, not data -- they must not cross the bridge.
    assert.deepEqual(sent[0]!.payload, { key: 'token' });
  });

  test('resolves the promise form', async () => {
    const { win, sent } = installBootstrap();
    const p = win.wx.getStorage({ key: 'k' });
    win.__goatDslResolve(JSON.stringify({ id: sent[0]!.id, success: true, data: { value: 'v' } }));
    assert.deepEqual(await p, { value: 'v' });
  });

  test('fires the callback form with the same result', async () => {
    const { win, sent } = installBootstrap();
    let got: any = null;
    const p = win.wx.getStorage({ key: 'k', success: (r: any) => { got = r; } });
    win.__goatDslResolve(JSON.stringify({ id: sent[0]!.id, success: true, data: { value: 'v' } }));
    await p;
    assert.deepEqual(got, { value: 'v' });
  });

  test('routes a failure to fail() and rejects the promise', async () => {
    const { win, sent } = installBootstrap();
    let failed: any = null;
    const p = win.wx.getStorage({ key: 'k', fail: (e: any) => { failed = e; } });
    win.__goatDslResolve(JSON.stringify({ id: sent[0]!.id, success: false, error: 'NOPE' }));
    await assert.rejects(p);
    assert.equal(failed.errMsg, 'NOPE');
  });

  test('wx, my and uni share one implementation', () => {
    const { win } = installBootstrap();
    assert.equal(win.wx, win.my);
    assert.equal(win.my, win.uni);
  });

  test('contains no eval and no dynamic Function construction (T1 criterion)', () => {
    assert.ok(!/\beval\s*\(/.test(dslBootstrapScript), 'bootstrap must not use eval');
    assert.ok(!/new\s+Function\s*\(/.test(dslBootstrapScript), 'bootstrap must not build Functions');
  });

  test('rejects when the native bridge is absent rather than throwing synchronously', async () => {
    const win: Record<string, any> = {};
    const fn = new Function('window', 'document', 'Event', dslBootstrapScript);
    fn(win, { dispatchEvent: () => true }, class { constructor(public type: string) {} });
    await assert.rejects(win.wx.getStorage({ key: 'k' }), /CAPABILITY_NOT_INSTALLED/);
  });
});

describe('T3 — capability discovery', () => {
  test('resolveAction maps DSL names and passes unknown ones through', () => {
    assert.equal(resolveAction('scanCode'), 'SCAN_CODE');
    assert.equal(resolveAction('getStorage.object'), 'STORAGE_GET');
    assert.equal(resolveAction('SOME_RAW_ACTION'), 'SOME_RAW_ACTION');
  });

  test('isMappedLocally distinguishes known DSL methods', () => {
    assert.equal(isMappedLocally('scanCode'), true);
    assert.equal(isMappedLocally('openBluetoothAdapter'), false);
  });

  test('canIUse consults the engine and caches the answer', async () => {
    let calls = 0;
    const reg = new CapabilityRegistry(async () => { calls++; return { supported: true }; });
    assert.equal(await reg.canIUse('scanCode'), true);
    assert.equal(await reg.canIUse('scanCode'), true);
    assert.equal(calls, 1, 'repeat lookups must not cross the bridge again');
  });

  test('explain reports CAPABILITY_NOT_INSTALLED for an unlinked module', async () => {
    const reg = new CapabilityRegistry(async () => ({ supported: false }));
    assert.equal(await reg.explain('openBluetoothAdapter'), CAPABILITY_NOT_INSTALLED);
  });

  test('a bridge error is not cached as a negative answer', async () => {
    let calls = 0;
    const reg = new CapabilityRegistry(async () => {
      calls++;
      if (calls === 1) throw new Error('bridge down');
      return { supported: true };
    });
    assert.equal(await reg.canIUse('scanCode'), false);
    // A transient failure must not permanently mark the capability missing.
    assert.equal(await reg.canIUse('scanCode'), true);
  });

  test('action map has no duplicate engine actions for distinct semantics', () => {
    assert.equal(DSL_ACTION_MAP['getStorage'], 'STORAGE_GET');
    assert.equal(DSL_ACTION_MAP['setStorage'], 'STORAGE_SET');
  });
});

describe('T12 — navigation adapter (all 5 core methods backed)', () => {
  test('all five backed methods map to real engine actions', async () => {
    const { navigationActionFor } = await import('../navigation');
    assert.equal(navigationActionFor('navigateTo'), 'PUSH_HISTORY_STATE');
    assert.equal(navigationActionFor('navigateBack'), 'NAVIGATE_BACK');
    assert.equal(navigationActionFor('redirectTo'), 'NAV_REPLACE');
    assert.equal(navigationActionFor('reLaunch'), 'NAV_POP_TO_ROOT');
    assert.equal(navigationActionFor('switchTab'), 'TAB_SWITCH');
  });

  test('unbacked methods are declared, not silently missing', async () => {
    const { isUnbackedNavigation, requiredEngineAction, navigationActionFor, UNBACKED_NAVIGATION } =
      await import('../navigation');
    assert.deepEqual(Object.keys(UNBACKED_NAVIGATION), ['preloadPage']);
    for (const m of Object.keys(UNBACKED_NAVIGATION)) {
      assert.equal(isUnbackedNavigation(m), true, `${m} must be declared as unbacked`);
      assert.ok(requiredEngineAction(m), `${m} must name the engine action it needs`);
      // An unbacked method must not resolve to a real action -- that would route it somewhere wrong.
      assert.equal(navigationActionFor(m), null, `${m} must not resolve to an action`);
    }
    assert.equal(requiredEngineAction('preloadPage'), 'PRELOAD_PAGE');
  });

  test('navigation is kept out of the generic action map except shared back navigation', async () => {
    const { navigationIsNotInGenericMap } = await import('../navigation');
    assert.equal(navigationIsNotInGenericMap(), true);
  });
});
