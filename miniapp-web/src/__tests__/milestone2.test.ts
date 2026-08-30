import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GoatBridge } from '../miniapp-bridge.js';

describe('Milestone 2 Web Bridge Suite — Cross-Mini-App Launch & Windowed Presentation (Task 10201)', () => {
  let bridge: GoatBridge;

  beforeEach(() => {
    bridge = new GoatBridge();
  });
  it('should launch a cross-mini-app session with WINDOWED presentation', async () => {
    const res = await bridge.openMiniApp({
      targetAppId: 'checkout_widget',
      presentation: 'WINDOWED',
      params: { orderId: 'ORD_1001', amount: 5000 },
      windowConfig: {
        width: 360,
        height: 520,
        x: 20,
        y: 60,
        draggable: true,
        cornerRadius: 16,
        elevation: 8,
        title: 'Secure Checkout'
      },
      jsApiAlias: {
        CONFIRM_ORDER: 'PARENT_CONFIRM_ORDER',
        CANCEL_ORDER: 'PARENT_CANCEL_ORDER'
      }
    });

    assert.ok(res);
    assert.strictEqual(res.targetAppId, 'checkout_widget');
    assert.strictEqual(res.presentation, 'WINDOWED');
    assert.strictEqual(res.status, 'OPENED');
    assert.ok(res.instanceId.startsWith('inst_checkout_widget_'));
  });

  it('should close an active mini-app session and return result', async () => {
    const res = await bridge.closeMiniApp({
      instanceId: 'inst_checkout_widget_123',
      result: { transactionId: 'TXN_9988', status: 'SUCCESS' }
    });

    assert.ok(res);
    assert.strictEqual(res.closed, true);
    assert.strictEqual(res.instanceId, 'inst_checkout_widget_123');
  });

  it('should register and cleanup ON_MINI_APP_CLOSED listener', async () => {
    let receivedEvent: any = null;
    const unsub = bridge.onMiniAppClosed((data) => {
      receivedEvent = data;
    });

    assert.strictEqual(typeof unsub, 'function');
    // Trigger simulated bridge event
    bridge.emit('ON_MINI_APP_CLOSED', {
      instanceId: 'inst_checkout_widget_123',
      targetAppId: 'checkout_widget',
      dismissedByUser: false,
      result: { status: 'SUCCESS' }
    });

    assert.ok(receivedEvent);
    assert.strictEqual(receivedEvent.targetAppId, 'checkout_widget');
    assert.strictEqual(receivedEvent.result?.status, 'SUCCESS');

    unsub();
  });
});
