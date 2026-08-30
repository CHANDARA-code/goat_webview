import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import uni, {
  callBridgeAction,
  clearStorage,
  clearStorageSync,
  getClipboardData,
  getDeviceInfo,
  getLocation,
  getPageStack,
  getStorage,
  getStorageInfo,
  getStorageInfoSync,
  getStorageSync,
  getSystemInfo,
  getSystemInfoSync,
  getWindowInfo,
  hideLoading,
  hideToast,
  makePhoneCall,
  navigateBack,
  navigateTo,
  openLocation,
  previewImage,
  px2rpx,
  redirectTo,
  registerTabPages,
  reLaunch,
  removeStorage,
  removeStorageSync,
  request,
  requestPayment,
  resetPageStack,
  rpx2px,
  scanCode,
  setBridgeTransport,
  setClipboardData,
  setNavigationBarColor,
  setNavigationBarTitle,
  setStorage,
  setStorageSync,
  showActionSheet,
  showLoading,
  showModal,
  showToast,
  switchTab,
  transformRpxInCss,
  vibrateLong,
  vibrateShort,
} from '../dist/runtime/index.js';

describe('Uni-app Runtime JSAPI Bridge Shims', () => {
  let bridgeCalls: Array<{ action: string; payload: Record<string, unknown> }> = [];

  beforeEach(() => {
    bridgeCalls = [];
    resetPageStack('pages/index/index');
    registerTabPages(['pages/index/index', 'pages/user/profile']);
    clearStorageSync();

    // Register test bridge transport
    setBridgeTransport(async (action, payload) => {
      bridgeCalls.push({ action, payload });

      if (action === 'API_REQUEST') {
        return {
          statusCode: 200,
          data: { success: true, message: 'hello from test server' },
          headers: { 'content-type': 'application/json' },
          cookies: ['session=abc123xyz'],
        };
      }

      if (action === 'STORAGE_GET') {
        if (payload.key === 'mock_key') {
          return { value: JSON.stringify({ userId: 42, username: 'Alice' }) };
        }
        return { value: null };
      }

      if (action === 'SCAN_CODE') {
        return { result: 'https://goat-engine.dev/test', scanType: 'QR_CODE', charSet: 'UTF-8' };
      }

      if (action === 'GET_DEVICE_INFO') {
        return {
          brand: 'Apple',
          model: 'iPhone 15 Pro',
          system: 'iOS 17.4',
          platform: 'ios',
          screenWidthDp: 393,
          screenHeightDp: 852,
          density: 3,
        };
      }

      if (action === 'GET_SAFE_AREA_INSETS') {
        return { top: 59, bottom: 34, left: 0, right: 0 };
      }

      if (action === 'SHOW_MODAL') {
        return { confirm: true, cancel: false };
      }

      if (action === 'SHOW_ACTION_SHEET') {
        return { tapIndex: 1 };
      }

      if (action === 'OPEN_INVOICE' || action === 'REQUEST_PAYMENT') {
        return { status: 'SUCCESS', transactionId: 'tx_test_999' };
      }

      if (action === 'CLIPBOARD_GET') {
        return { text: 'copied test text' };
      }

      return { success: true };
    });
  });

  afterEach(() => {
    setBridgeTransport(null);
  });

  describe('Storage JSAPIs', () => {
    it('handles uni.setStorage and uni.getStorage with Promise and callbacks', async () => {
      let callbackSuccess = false;
      let callbackComplete = false;

      // 1. setStorage
      const setRes = await uni.setStorage({
        key: 'user_profile',
        data: { name: 'Bob', age: 30 },
        success: (res) => {
          assert.equal(res.errMsg, 'setStorage:ok');
          callbackSuccess = true;
        },
        complete: () => {
          callbackComplete = true;
        },
      });

      assert.equal(setRes.errMsg, 'setStorage:ok');
      assert.equal(callbackSuccess, true);
      assert.equal(callbackComplete, true);

      // Verify bridge invocation
      const setCall = bridgeCalls.find((c) => c.action === 'STORAGE_SET');
      assert.ok(setCall);
      assert.equal(setCall.payload.key, 'user_profile');

      // 2. getStorage from memory cache
      const getRes = await uni.getStorage({ key: 'user_profile' });
      assert.equal(getRes.errMsg, 'getStorage:ok');
      assert.deepEqual(getRes.data, { name: 'Bob', age: 30 });
    });

    it('handles synchronous storage operations (setStorageSync, getStorageSync, removeStorageSync, clearStorageSync)', () => {
      uni.setStorageSync('token', 'Bearer abc.def.ghi');
      assert.equal(uni.getStorageSync('token'), 'Bearer abc.def.ghi');

      const info = uni.getStorageInfoSync();
      assert.ok(info.keys.includes('token'));

      uni.removeStorageSync('token');
      assert.equal(uni.getStorageSync('token'), '');

      uni.setStorageSync('k1', 'v1');
      uni.setStorageSync('k2', 'v2');
      uni.clearStorageSync();
      assert.equal(uni.getStorageSync('k1'), '');
    });

    it('fails when getting a non-existent key from native storage', async () => {
      let failCalled = false;
      try {
        await uni.getStorage({
          key: 'non_existent_key',
          fail: (err) => {
            assert.ok(err.errMsg.includes('getStorage:fail'));
            failCalled = true;
          },
        });
        assert.fail('Should have rejected');
      } catch (err: any) {
        assert.ok(err.errMsg.includes('getStorage:fail'));
        assert.equal(failCalled, true);
      }
    });

    it('safely calculates storage info with undefined values without throwing', async () => {
      uni.setStorageSync('k_undef', undefined as any);
      const syncInfo = uni.getStorageInfoSync();
      assert.ok(syncInfo.keys.includes('k_undef'));

      const asyncInfo = await uni.getStorageInfo();
      assert.ok(asyncInfo.keys.includes('k_undef'));
      assert.equal(asyncInfo.errMsg, 'getStorageInfo:ok');
    });
  });

  describe('Navigation JSAPIs', () => {
    it('manages page stack on navigateTo, redirectTo, and navigateBack', async () => {
      // Navigate to detail page
      await uni.navigateTo({ url: 'pages/detail/index?id=101' });
      assert.equal(getPageStack().length, 2);
      assert.equal(getPageStack()[1].url, 'pages/detail/index');

      // Navigate to another sub-page
      await uni.navigateTo({ url: 'pages/order/index' });
      assert.equal(getPageStack().length, 3);

      // Navigate back by 1
      await uni.navigateBack({ delta: 1 });
      assert.equal(getPageStack().length, 2);

      // Navigate back below root clamps at root
      await uni.navigateBack({ delta: 10 });
      assert.equal(getPageStack().length, 1);
      assert.equal(getPageStack()[0].url, 'pages/index/index');
    });

    it('rejects navigating to tabBar page via navigateTo', async () => {
      try {
        await uni.navigateTo({ url: 'pages/user/profile' });
        assert.fail('Should have rejected navigateTo to tab page');
      } catch (err: any) {
        assert.ok(err.errMsg.includes('can not navigate to a tab bar page'));
      }
    });

    it('handles switchTab and reLaunch correctly', async () => {
      await uni.switchTab({ url: 'pages/user/profile' });
      assert.equal(getPageStack().length, 1);
      assert.equal(getPageStack()[0].url, 'pages/user/profile');

      await uni.reLaunch({ url: 'pages/index/index' });
      assert.equal(getPageStack().length, 1);
      assert.equal(getPageStack()[0].url, 'pages/index/index');
    });
  });

  describe('UI JSAPIs', () => {
    it('displays and hides toasts and loading overlays', async () => {
      const toastRes = await uni.showToast({ title: 'Success!' });
      assert.equal(toastRes.errMsg, 'showToast:ok');

      const hideToastRes = await uni.hideToast();
      assert.equal(hideToastRes.errMsg, 'hideToast:ok');

      const loadRes = await uni.showLoading({ title: 'Loading data...' });
      assert.equal(loadRes.errMsg, 'showLoading:ok');

      const hideLoadRes = await uni.hideLoading();
      assert.equal(hideLoadRes.errMsg, 'hideLoading:ok');
    });

    it('shows modal and validates non-blank content', async () => {
      const modalRes = await uni.showModal({
        title: 'Confirm',
        content: 'Are you sure you want to proceed?',
      });
      assert.equal(modalRes.confirm, true);
      assert.equal(modalRes.cancel, false);

      // Validation check for empty content
      try {
        await uni.showModal({ content: '   ' });
        assert.fail('Should reject empty content');
      } catch (err: any) {
        assert.ok(err.errMsg.includes('content must not be blank'));
      }
    });

    it('shows action sheet and sets navigation bar appearance', async () => {
      const sheetRes = await uni.showActionSheet({
        itemList: ['Option 1', 'Option 2', 'Option 3'],
      });
      assert.equal(sheetRes.tapIndex, 1);

      const navTitleRes = await uni.setNavigationBarTitle({ title: 'New Title' });
      assert.equal(navTitleRes.errMsg, 'setNavigationBarTitle:ok');

      const navColorRes = await uni.setNavigationBarColor({
        frontColor: '#ffffff',
        backgroundColor: '#007AFF',
      });
      assert.equal(navColorRes.errMsg, 'setNavigationBarColor:ok');
    });
  });

  describe('Network JSAPIs', () => {
    it('performs uni.request and auto-parses JSON response', async () => {
      const res = await uni.request({
        url: 'https://api.example.com/data',
        method: 'POST',
        data: { query: 'search' },
      });

      assert.equal(res.statusCode, 200);
      assert.equal((res.data as any).success, true);
      assert.equal(res.errMsg, 'request:ok');
    });

    it('downloads and uploads files via native bridge', async () => {
      const dlRes = await uni.downloadFile({ url: 'https://cdn.example.com/asset.png' });
      assert.equal(dlRes.statusCode, 200);
      assert.ok(dlRes.tempFilePath);

      const upRes = await uni.uploadFile({
        url: 'https://api.example.com/upload',
        filePath: '/tmp/test.png',
        name: 'file',
      });
      assert.equal(upRes.statusCode, 200);
    });
  });

  describe('System, Hardware & Media JSAPIs', () => {
    it('fetches system and device telemetry', async () => {
      const sys = await uni.getSystemInfo();
      assert.equal(sys.brand, 'Apple');
      assert.equal(sys.model, 'iPhone 15 Pro');
      assert.equal(sys.platform, 'ios');
      assert.equal(sys.statusBarHeight, 59);

      const sysSync = uni.getSystemInfoSync();
      assert.equal(sysSync.brand, 'Apple');

      const dev = await uni.getDeviceInfo();
      assert.equal(dev.brand, 'Apple');

      const win = uni.getWindowInfo();
      assert.equal(win.statusBarHeight, 59);

      const base = uni.getAppBaseInfo();
      assert.equal(base.appId, 'com.goat.uniapp');
    });

    it('invokes haptic feedback, clipboard, and phone calls', async () => {
      const v1 = await uni.vibrateShort();
      assert.equal(v1.errMsg, 'vibrateShort:ok');

      const v2 = await uni.vibrateLong();
      assert.equal(v2.errMsg, 'vibrateLong:ok');

      const clipSet = await uni.setClipboardData({ data: 'hello clipboard' });
      assert.equal(clipSet.errMsg, 'setClipboardData:ok');

      const clipGet = await uni.getClipboardData();
      assert.equal(clipGet.data, 'copied test text');

      const callRes = await uni.makePhoneCall({ phoneNumber: '1-800-555-0199' });
      assert.equal(callRes.errMsg, 'makePhoneCall:ok');
    });

    it('handles payments and media scanning', async () => {
      const payRes = await uni.requestPayment({
        orderInfo: 'inv_12345',
        amount: 1999,
        currency: 'USD',
      });
      assert.equal(payRes.errMsg, 'requestPayment:ok');
      assert.equal(payRes.transactionId, 'tx_test_999');

      const scanRes = await uni.scanCode();
      assert.equal(scanRes.result, 'https://goat-engine.dev/test');
      assert.equal(scanRes.scanType, 'QR_CODE');

      const imgRes = await uni.chooseImage({ count: 3 });
      assert.ok(imgRes.tempFilePaths.length > 0);

      const locRes = await uni.getLocation();
      assert.ok(typeof locRes.latitude === 'number');
    });

    it('maps legacy WeChat payment fields into the 5-layer payment schema (BLK-P1-11)', async () => {
      await uni.requestPayment({
        timeStamp: '1720000000',
        nonceStr: 'legacy_nonce_abc',
        package: 'prepay_id=wx_legacy_prepay',
        signType: 'RSA',
        paySign: 'legacy_pay_sign_base64',
        provider: 'alipay',
        amount: 2500,
        currency: 'USD',
        orderInfo: { orderId: 'order_legacy_77', amount: 2500 },
      });

      const payCall = bridgeCalls.find((c) => c.action === 'OPEN_INVOICE');
      assert.ok(payCall, 'OPEN_INVOICE should be dispatched');
      const payload = payCall.payload as Record<string, unknown>;

      assert.equal(payload.intentId, 'prepay_id=wx_legacy_prepay');
      assert.equal(payload.orderId, 'order_legacy_77');
      assert.equal(payload.nonce, 'legacy_nonce_abc');
      assert.equal(payload.signedPayload, 'legacy_pay_sign_base64');
      assert.equal(payload.signature, 'legacy_pay_sign_base64');
      assert.equal(payload.provider, 'alipay');
      assert.equal(payload.amount, 2500);
      assert.equal(payload.currency, 'USD');
      assert.equal(payload.timeStamp, '1720000000');
      assert.equal(payload.nonceStr, 'legacy_nonce_abc');
      assert.equal(payload.paySign, 'legacy_pay_sign_base64');
    });

    it('canIUse checks supported APIs', () => {
      assert.equal(uni.canIUse('request'), true);
      assert.equal(uni.canIUse('uni.getStorage'), true);
      assert.equal(uni.canIUse('nonExistentApi'), false);
    });
  });

  describe('Responsive Unit Transforms (rpx)', () => {
    it('calculates rpx to px and px to rpx accurately', () => {
      assert.equal(rpx2px(750, 375), 375);
      assert.equal(rpx2px(375, 375), 187.5);
      assert.equal(px2rpx(375, 375), 750);
    });

    it('transforms rpx units in CSS stylesheets', () => {
      const css = '.box { width: 750rpx; font-size: 28rpx; }';
      const transformed = transformRpxInCss(css);
      assert.ok(transformed.includes('min(calc(750 * 100vw / 750), calc(750 * 960px / 750))'));
      assert.ok(transformed.includes('min(calc(28 * 100vw / 750), calc(28 * 960px / 750))'));
    });
  });
});
