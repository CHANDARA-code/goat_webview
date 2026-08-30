import test from 'node:test';
import assert from 'node:assert/strict';
import { GoatBridgeMock, mockState, BridgeErrorCodes } from '../src/index.js';

test('Domain 5: UI Feedback, Navigation Bar, Bottom Sheet & Window Insets', async (t) => {
  const bridge = new GoatBridgeMock();

  await t.test('SHOW_TOAST and HIDE_TOAST', async () => {
    const toastRes = await bridge.callNative('SHOW_TOAST', { title: 'Order placed!', icon: 'success' });
    assert.equal(toastRes.shown, true);
    assert.equal(toastRes.title, 'Order placed!');

    const hideToast = await bridge.callNative('HIDE_TOAST');
    assert.equal(hideToast.hidden, true);
  });

  await t.test('SHOW_MODAL and SHOW_ACTION_SHEET', async () => {
    const modalRes = await bridge.callNative('SHOW_MODAL', { title: 'Confirm', content: 'Do you agree?' });
    assert.equal(modalRes.confirm, true);
    assert.equal(modalRes.title, 'Confirm');

    const sheetRes = await bridge.callNative('SHOW_ACTION_SHEET', { itemList: ['Option A', 'Option B'] });
    assert.equal(sheetRes.tapIndex, 0);
    assert.equal(sheetRes.itemCount, 2);
  });

  await t.test('SHOW_LOADING and HIDE_LOADING', async () => {
    const showLoad = await bridge.callNative('SHOW_LOADING', { title: 'Fetching data...' });
    assert.equal(showLoad.shown, true);

    const hideLoad = await bridge.callNative('HIDE_LOADING');
    assert.equal(hideLoad.hidden, true);
  });

  await t.test('GET_KEYBOARD_INSETS and SET_KEYBOARD_INSETS', async () => {
    await bridge.callNative('SET_KEYBOARD_INSETS', { heightPx: 320 });
    const insets = await bridge.callNative('GET_KEYBOARD_INSETS');
    assert.equal(insets.isVisible, true);
    assert.equal(insets.heightPx, 320);
    assert.equal(insets.adjustedViewportBottomInset, 320);
  });

  await t.test('SET_NAV_BAR_TITLE, COLOR, BUTTONS, PROGRESS', async () => {
    const titleRes = await bridge.callNative('SET_NAV_BAR_TITLE', { title: 'Checkout Page' });
    assert.equal(titleRes.title, 'Checkout Page');
    assert.equal(mockState.navBar.title, 'Checkout Page');

    const colorRes = await bridge.callNative('SET_NAV_BAR_COLOR', { backgroundColor: '#1e293b', isDark: true });
    assert.equal(colorRes.backgroundColor, '#1e293b');
    assert.equal(colorRes.isDark, true);

    const buttonsRes = await bridge.callNative('SET_NAV_BAR_BUTTONS', { left: 'BACK', right: ['MORE', 'CUSTOM'] });
    assert.equal(buttonsRes.left, 'BACK');
    assert.equal(buttonsRes.right.length, 2);

    const progressRes = await bridge.callNative('SET_NAV_BAR_PROGRESS', { visible: true, progress: 65 });
    assert.equal(progressRes.progress, 65);
  });

  await t.test('EXPAND_BOTTOM_SHEET, COLLAPSE_BOTTOM_SHEET, SET_SHEET_SNAP_POINTS', async () => {
    const expandRes = await bridge.callNative('EXPAND_BOTTOM_SHEET');
    assert.equal(expandRes.isExpanded, true);
    assert.equal(expandRes.sheetValue, 'EXPANDED');

    const collapseRes = await bridge.callNative('COLLAPSE_BOTTOM_SHEET');
    assert.equal(collapseRes.isCollapsed, true);
    assert.equal(collapseRes.sheetValue, 'COLLAPSED');

    const snapRes = await bridge.callNative('SET_SHEET_SNAP_POINTS', { snapPoints: [0.3, 0.6, 1.0] });
    assert.equal(snapRes.snapPoints.length, 3);
    assert.equal(snapRes.success, true);
  });

  await t.test('GET_SAFE_AREA_INSETS', async () => {
    const safeInsets = await bridge.callNative('GET_SAFE_AREA_INSETS');
    assert.equal(safeInsets.top, 47);
    assert.equal(safeInsets.bottom, 34);
  });

  await t.test('OPEN_EXTERNAL_LINK returns destinationHost', async () => {
    const res = await bridge.callNative('OPEN_EXTERNAL_LINK', { url: 'https://github.com/goat-webview' });
    assert.equal(res.opened, true);
    assert.equal(res.destinationHost, 'github.com');
  });

  await t.test('Multi-Tab Sheet Stack Management: TAB_OPEN / CLOSE / SWITCH / LIST / CLOSE_ALL', async () => {
    const tab1 = await bridge.callNative('TAB_OPEN', { title: 'Product Tab', initialRoute: '/products' });
    assert.equal(tab1.title, 'Product Tab');
    assert.equal(mockState.tabs.length >= 1, true);

    const tab2 = await bridge.callNative('TAB_OPEN', { title: 'Cart Tab', initialRoute: '/cart' });
    assert.equal(mockState.activeTabId, tab2.tabId);

    const listRes = await bridge.callNative('TAB_LIST');
    assert.equal(listRes.tabs.length >= 2, true);

    const switchRes = await bridge.callNative('TAB_SWITCH', { tabId: tab1.tabId });
    assert.equal(switchRes.switched, true);
    assert.equal(mockState.activeTabId, tab1.tabId);

    const closeRes = await bridge.callNative('TAB_CLOSE', { tabId: tab2.tabId });
    assert.equal(closeRes.closed, true);

    const closeAll = await bridge.callNative('TAB_CLOSE_ALL');
    assert.equal(closeAll.closedAll, true);
    assert.equal(mockState.tabs.length, 0);
  });

  await t.test('Cross-Mini-App Windows: OPEN_MINI_APP / CLOSE_MINI_APP / ON_MINI_APP_CLOSED', async () => {
    const openRes = await bridge.callNative('OPEN_MINI_APP', {
      targetAppId: 'com.goat.subapp.payment',
      presentation: 'MODAL',
    });
    assert.equal(openRes.targetAppId, 'com.goat.subapp.payment');
    assert.equal(openRes.presentation, 'MODAL');

    const closeRes = await bridge.callNative('CLOSE_MINI_APP', { instanceId: openRes.instanceId });
    assert.equal(closeRes.closed, true);

    const onClosedRes = await bridge.callNative('ON_MINI_APP_CLOSED');
    assert.equal(onClosedRes.registered, true);
  });
});
