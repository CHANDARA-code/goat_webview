import test from 'node:test';
import assert from 'node:assert/strict';
import { GoatBridgeMock, mockState, BridgeErrorCodes } from '../src/index.js';

test('Domain 10: Contacts & Social Sharing', async (t) => {
  const bridge = new GoatBridgeMock();

  await t.test('CHOOSE_CONTACT and GET_CONTACTS_COUNT', async () => {
    const contact = await bridge.callNative('CHOOSE_CONTACT');
    assert.equal(typeof contact.name, 'string');
    assert.equal(typeof contact.phoneNumber, 'string');

    const countRes = await bridge.callNative('GET_CONTACTS_COUNT');
    assert.equal(countRes.count >= 1, true);
  });

  await t.test('SHARE_SHEET and SHARE_TO_STORY', async () => {
    const shareRes = await bridge.callNative('SHARE_SHEET', {
      title: 'Check this out',
      text: 'Goat WebView mini-apps are blazing fast!',
      url: 'https://goat.dev',
    });
    assert.equal(shareRes.shared, true);

    const storyRes = await bridge.callNative('SHARE_TO_STORY', {
      mediaPath: 'goat://cache/photos/IMG_20260826_001.jpg',
    });
    assert.equal(storyRes.shared, true);
  });

  await t.test('CHOOSE_CONTACT rejects if contact permission denied', async () => {
    mockState.permissions.set('CONTACTS', false);
    await assert.rejects(
      () => bridge.callNative('CHOOSE_CONTACT'),
      (err: any) => err.code === BridgeErrorCodes.PERMISSION_DENIED
    );
    mockState.permissions.set('CONTACTS', true);
  });
});
