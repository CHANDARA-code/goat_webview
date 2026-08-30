import test from 'node:test';
import assert from 'node:assert/strict';
import { GoatBridgeMock, mockState } from '../src/index.js';

test('Domain 11: Push Notifications', async (t) => {
  const bridge = new GoatBridgeMock();

  await t.test('PUSH_GET_TOKEN returns FCM/APNs token', async () => {
    const tokenRes = await bridge.callNative('PUSH_GET_TOKEN');
    assert.equal(typeof tokenRes.token, 'string');
    assert.equal(tokenRes.token.length > 0, true);
  });

  await t.test('PUSH_REQUEST_PERMISSION requests notification grant', async () => {
    const permRes = await bridge.callNative('PUSH_REQUEST_PERMISSION');
    assert.equal(permRes.granted, true);
    assert.equal(mockState.permissions.get('NOTIFICATION'), true);
  });

  await t.test('PUSH_SET_BADGE updates app icon badge count', async () => {
    const badgeRes = await bridge.callNative('PUSH_SET_BADGE', { count: 5 });
    assert.equal(badgeRes.updated, true);
    assert.equal(badgeRes.count, 5);
    assert.equal(mockState.badgeCount, 5);
  });

  await t.test('PUSH_SHOW_NOTIFICATION, GET_PENDING_NOTIFICATIONS, CLEAR_NOTIFICATIONS', async () => {
    const showRes = await bridge.callNative('PUSH_SHOW_NOTIFICATION', {
      title: 'Flash Sale Alert',
      content: '50% off on all subscriptions today!',
    });
    assert.equal(showRes.shown, true);

    const pending = await bridge.callNative('GET_PENDING_NOTIFICATIONS');
    assert.equal(pending.count >= 1, true);

    const clearRes = await bridge.callNative('CLEAR_NOTIFICATIONS');
    assert.equal(clearRes.cleared, true);

    const afterClear = await bridge.callNative('GET_PENDING_NOTIFICATIONS');
    assert.equal(afterClear.count, 0);
  });

  await t.test('SUBSCRIBE_PUSH_TOPIC and UNSUBSCRIBE_PUSH_TOPIC', async () => {
    const subRes = await bridge.callNative('SUBSCRIBE_PUSH_TOPIC', { topic: 'news_updates' });
    assert.equal(subRes.subscribed, true);
    assert.equal(mockState.pushTopics.has('news_updates'), true);

    const unsubRes = await bridge.callNative('UNSUBSCRIBE_PUSH_TOPIC', { topic: 'news_updates' });
    assert.equal(unsubRes.unsubscribed, true);
    assert.equal(mockState.pushTopics.has('news_updates'), false);
  });
});
