import test from 'node:test';
import assert from 'node:assert/strict';
import { GoatBridgeMock, mockState } from '../src/index.js';

test('Domain 15: Navigation & Predictive Back', async (t) => {
  const bridge = new GoatBridgeMock();

  await t.test('Page stack manipulation: NAV_PUSH, NAV_POP, NAV_POP_TO_ROOT, NAV_REPLACE, GET_PAGE_STACK', async () => {
    // Reset page stack to root
    mockState.pageStack = [{ pageId: 'p0', route: '/home', title: 'Home', isSuspended: false }];

    // 1. Push Detail Page
    const push1 = await bridge.callNative('NAV_PUSH', { route: '/item/42', title: 'Item 42' });
    assert.equal(push1.action, 'PUSH');
    assert.equal(push1.stackDepth, 2);
    assert.equal(push1.canPop, true);

    // 2. Push Checkout Page
    const push2 = await bridge.callNative('NAV_PUSH', { route: '/checkout', title: 'Checkout' });
    assert.equal(push2.stackDepth, 3);

    // 3. Get Stack
    const stackRes = await bridge.callNative('GET_PAGE_STACK');
    assert.equal(stackRes.totalCount, 3);

    // 4. Replace Checkout with Confirmation
    const replaceRes = await bridge.callNative('NAV_REPLACE', { route: '/confirm', title: 'Order Confirmed' });
    assert.equal(replaceRes.action, 'REPLACE');
    assert.equal(replaceRes.stackDepth, 3);
    assert.equal(replaceRes.activePage?.route, '/confirm');

    // 5. Pop
    const popRes = await bridge.callNative('NAV_POP');
    assert.equal(popRes.action, 'POP');
    assert.equal(popRes.stackDepth, 2);

    // 6. Pop to root
    const popRootRes = await bridge.callNative('NAV_POP_TO_ROOT');
    assert.equal(popRootRes.stackDepth, 1);
    assert.equal(popRootRes.canPop, false);
  });

  await t.test('History state & routes: CAN_GO_BACK, HANDLE_BACK_PRESS, PUSH_HISTORY_STATE, GET_CURRENT_ROUTE', async () => {
    const routeRes = await bridge.callNative('GET_CURRENT_ROUTE');
    assert.equal(typeof routeRes.currentRoute, 'string');

    const histRes = await bridge.callNative('PUSH_HISTORY_STATE', { route: '/profile' });
    assert.equal(histRes.route, '/profile');

    const canBack = await bridge.callNative('CAN_GO_BACK');
    assert.equal(typeof canBack.canGoBack, 'boolean');

    const backRes = await bridge.callNative('HANDLE_BACK_PRESS');
    assert.equal(backRes.action, 'POP');
  });

  await t.test('Predictive back gesture physics: PREDICTIVE_BACK_PROGRESS, INVOKE, CANCEL', async () => {
    const progRes = await bridge.callNative('PREDICTIVE_BACK_PROGRESS', { progress: 0.5 });
    assert.equal(progRes.action, 'PROGRESS');
    assert.equal(progRes.progress, 0.5);
    assert.equal(progRes.interpolatedScale < 1.0, true);
    assert.equal(progRes.interpolatedAlpha < 1.0, true);
    assert.equal(progRes.interpolatedTranslationX > 0, true);

    const cancelRes = await bridge.callNative('PREDICTIVE_BACK_CANCEL');
    assert.equal(cancelRes.action, 'CANCEL');

    const invokeRes = await bridge.callNative('PREDICTIVE_BACK_INVOKE');
    assert.equal(invokeRes.action, 'INVOKE');
  });
});
