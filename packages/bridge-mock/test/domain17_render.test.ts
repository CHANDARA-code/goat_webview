import test from 'node:test';
import assert from 'node:assert/strict';
import { GoatBridgeMock, mockState } from '../src/index.js';

test('Domain 17: Visual Rendering & Same-Layer', async (t) => {
  const bridge = new GoatBridgeMock();

  await t.test('CONFIGURE_TRANSPARENCY, SYNC_THEME_BACKGROUND, GET_RENDER_LAYER_CONFIG', async () => {
    const transRes = await bridge.callNative('CONFIGURE_TRANSPARENCY', { isTransparent: true, customBgHex: '#00000000' });
    assert.equal(transRes.isTransparent, true);
    assert.equal(transRes.backgroundColorHex, '#00000000');

    const themeRes = await bridge.callNative('SYNC_THEME_BACKGROUND', { isDark: true });
    assert.equal(themeRes.backgroundColorHex, '#121212');

    const configRes = await bridge.callNative('GET_RENDER_LAYER_CONFIG');
    assert.equal(configRes.isHardwareAccelerated, true);
    assert.equal(configRes.isWhiteFlashPrevented, true);
  });

  await t.test('Gesture coordination: GESTURE_SCROLL_UPDATE, SHOULD_PARENT_INTERCEPT, RESET_GESTURE_COORDINATOR', async () => {
    const scrollRes1 = await bridge.callNative('GESTURE_SCROLL_UPDATE', { scrollY: 0, maxScrollY: 500 });
    assert.equal(scrollRes1.isScrollBoundaryReached, true);
    assert.equal(scrollRes1.canParentIntercept, true);

    const shouldIntercept = await bridge.callNative('SHOULD_PARENT_INTERCEPT', { deltaY: 25 });
    assert.equal(shouldIntercept.shouldIntercept, true);

    const resetRes = await bridge.callNative('RESET_GESTURE_COORDINATOR');
    assert.equal(resetRes.reset, true);
  });

  await t.test('Same-Layer Native Component embedding: EMBED, UPDATE_BOUNDS, GET_ACTIVE, REMOVE', async () => {
    const embedRes = await bridge.callNative('EMBED_NATIVE_VIEW', {
      componentId: 'native_map_view_1',
      componentType: 'map',
      x: 0,
      y: 100,
      width: 400,
      height: 300,
      zIndex: 2,
    });
    assert.equal(embedRes.componentId, 'native_map_view_1');
    assert.equal(embedRes.width, 400);

    const updateRes = await bridge.callNative('UPDATE_NATIVE_VIEW_BOUNDS', {
      componentId: 'native_map_view_1',
      width: 420,
      height: 350,
    });
    assert.equal(updateRes.updated, true);

    const listRes = await bridge.callNative('GET_ACTIVE_NATIVE_VIEWS');
    assert.equal(listRes.totalActive >= 1, true);
    assert.equal(listRes.views.some((v: any) => v.componentId === 'native_map_view_1' && v.width === 420), true);

    const removeRes = await bridge.callNative('REMOVE_NATIVE_VIEW', { componentId: 'native_map_view_1' });
    assert.equal(removeRes.removed, true);
  });
});
