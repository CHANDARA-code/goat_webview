/**
 * @goat/compiler-taro - JSAPI Runtime Bridge Shims Test Suite
 * Tests all 44 Taro JSAPI bridge shims for Promise/Callback duality,
 * IPC action mapping, synchronous storage cache, and edge-case error recovery.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Taro, bridge, syncStorage } from '../src/runtime/index.js';

describe('Taro JSAPI Runtime Bridge Shims (All 44 APIs)', () => {
  beforeEach(() => {
    // Reset custom caller and storage
    bridge.setBridgeCaller(undefined);
    syncStorage.clear();
    Taro.__resetPageStack('pages/index/index');
  });

  describe('1. Network APIs (request, downloadFile, uploadFile, connectSocket)', () => {
    it('Taro.request: dispatches API_REQUEST with Promise and Callbacks', async () => {
      let successCalled = false;
      let completeCalled = false;

      const res = await Taro.request({
        url: 'https://api.example.com/data',
        method: 'POST',
        data: { message: 'hello' },
        header: { Authorization: 'Bearer test' },
        success: (result) => {
          successCalled = true;
          assert.strictEqual(result.statusCode, 200);
          assert.strictEqual(result.errMsg, 'request:ok');
        },
        complete: (result) => {
          completeCalled = true;
        },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.errMsg, 'request:ok');
      assert.strictEqual(successCalled, true);
      assert.strictEqual(completeCalled, true);
    });

    it('Taro.request: rejects on missing URL or SSRF blocked IP', async () => {
      let failCalled = false;
      await assert.rejects(
        async () => {
          await Taro.request({
            url: '',
            fail: () => {
              failCalled = true;
            },
          } as any);
        },
        (err: any) => err.errMsg.includes('request:fail')
      );
      assert.strictEqual(failCalled, true);

      // SSRF Block
      await assert.rejects(
        async () => {
          await Taro.request({ url: 'http://127.0.0.1:8080/secret' });
        },
        (err: any) => err.errMsg.includes('request:fail')
      );
    });

    it('Taro.downloadFile: dispatches DOWNLOAD_FILE and returns tempFilePath', async () => {
      const res = await Taro.downloadFile({
        url: 'https://cdn.example.com/file.zip',
        filePath: 'goat://tmp/custom.zip',
      });
      assert.strictEqual(res.statusCode, 200);
      assert.ok(res.tempFilePath);
      assert.strictEqual(res.errMsg, 'downloadFile:ok');
    });

    it('Taro.uploadFile: dispatches UPLOAD_FILE and returns server response', async () => {
      const res = await Taro.uploadFile({
        url: 'https://api.example.com/upload',
        filePath: 'goat://tmp/avatar.png',
        name: 'file',
        formData: { user: 'test' },
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.errMsg, 'uploadFile:ok');
    });

    it('Taro.connectSocket: establishes WebSocket task with event emitters', (t, done) => {
      const socket = Taro.connectSocket({
        url: 'wss://echo.websocket.org',
        success: () => {
          socket.onOpen(() => {
            socket.send({
              data: 'hello socket',
              success: () => {
                socket.close({
                  code: 1000,
                  reason: 'done',
                  success: () => {
                    done();
                  },
                });
              },
            });
          });
        },
      });
    });
  });

  describe('2. Storage APIs (Async & Sync with 10MB Quota)', () => {
    it('Taro.setStorage & Taro.getStorage: asynchronous CRUD lifecycle', async () => {
      await Taro.setStorage({ key: 'user_profile', data: { name: 'Alice', role: 'admin' } });

      const res = await Taro.getStorage({ key: 'user_profile' });
      assert.deepStrictEqual(res.data, { name: 'Alice', role: 'admin' });
      assert.strictEqual(res.errMsg, 'getStorage:ok');

      await Taro.removeStorage({ key: 'user_profile' });
      const info = await Taro.getStorageInfo();
      assert.strictEqual(info.keys.includes('user_profile'), false);
    });

    it('Taro.setStorageSync & Taro.getStorageSync: synchronous in-memory access', () => {
      Taro.setStorageSync('session_id', 'sess_12345');
      assert.strictEqual(Taro.getStorageSync('session_id'), 'sess_12345');

      Taro.removeStorageSync('session_id');
      assert.strictEqual(Taro.getStorageSync('session_id'), '');

      Taro.setStorageSync('num', 42);
      Taro.setStorageSync('arr', [1, 2, 3]);
      assert.strictEqual(Taro.getStorageSync('num'), 42);
      assert.deepStrictEqual(Taro.getStorageSync('arr'), [1, 2, 3]);

      const info = Taro.getStorageInfoSync();
      assert.strictEqual(info.keys.length, 2);
      assert.strictEqual(info.limitSize, 10240);

      Taro.clearStorageSync();
      assert.strictEqual(Taro.getStorageInfoSync().keys.length, 0);
    });

    it('Taro.setStorageSync: enforces 10MB quota limit', () => {
      // Create ~11MB payload
      const hugeString = 'x'.repeat(11 * 1024 * 1024);
      assert.throws(
        () => {
          Taro.setStorageSync('huge_data', hugeString);
        },
        /quota of 10MB exceeded/
      );
    });
  });

  describe('3. Router APIs (navigateTo, redirectTo, navigateBack, switchTab, reLaunch)', () => {
    it('Taro.navigateTo & eventChannel: pushes pages up to max depth 10', async () => {
      let eventReceived = false;
      const res = await Taro.navigateTo({
        url: 'pages/detail/index?id=100',
        events: {
          acceptDataFromOpenedPage(data: any) {
            if (data.status === 'ok') eventReceived = true;
          },
        },
      });

      assert.strictEqual(res.errMsg, 'navigateTo:ok');
      assert.ok(res.eventChannel);
      res.eventChannel.emit('acceptDataFromOpenedPage', { status: 'ok' });
      assert.strictEqual(eventReceived, true);

      // Stack depth is now 2
      assert.strictEqual(Taro.getCurrentPages().length, 2);
    });

    it('Taro.navigateTo: rejects when page stack exceeds 10', async () => {
      // Fill stack to 10
      for (let i = 2; i <= 10; i++) {
        await Taro.navigateTo({ url: `pages/p${i}/index` });
      }
      assert.strictEqual(Taro.getCurrentPages().length, 10);

      // 11th push must reject with STACK_OVERFLOW
      await assert.rejects(
        async () => {
          await Taro.navigateTo({ url: 'pages/p11/index' });
        },
        (err: any) => err.errMsg.includes('page stack depth limit exceeded')
      );
    });

    it('Taro.navigateBack: pops pages and prevents popping root page', async () => {
      await Taro.navigateTo({ url: 'pages/detail/index' });
      assert.strictEqual(Taro.getCurrentPages().length, 2);

      await Taro.navigateBack();
      assert.strictEqual(Taro.getCurrentPages().length, 1);

      // Attempt to pop root page must reject
      await assert.rejects(
        async () => {
          await Taro.navigateBack();
        },
        (err: any) => err.errMsg.includes('cannot pop root page')
      );
    });

    it('Taro.redirectTo, switchTab & reLaunch: replaces and resets stack', async () => {
      await Taro.redirectTo({ url: 'pages/login/index' });
      assert.strictEqual(Taro.getCurrentPages()[0].route, 'pages/login/index');

      await Taro.switchTab({ url: 'pages/tab/index' });
      assert.strictEqual(Taro.getCurrentPages().length, 1);
      assert.strictEqual(Taro.getCurrentPages()[0].route, 'pages/tab/index');

      await Taro.reLaunch({ url: 'pages/home/index' });
      assert.strictEqual(Taro.getCurrentPages().length, 1);
      assert.strictEqual(Taro.getCurrentPages()[0].route, 'pages/home/index');
    });
  });

  describe('4. UI Feedback APIs (showModal, showToast, showLoading, showActionSheet)', () => {
    it('Taro.showModal: enforces 500ms cooldown window', async () => {
      const res1 = await Taro.showModal({
        title: 'Confirm Action',
        content: 'Do you want to proceed?',
      });
      assert.strictEqual(res1.confirm, true);
      assert.strictEqual(res1.errMsg, 'showModal:ok');

      // Immediate second call should reject with DIALOG_COOLDOWN_ACTIVE
      await assert.rejects(
        async () => {
          await Taro.showModal({ title: 'Spam Modal' });
        },
        (err: any) => err.errMsg.includes('dialog cooldown active')
      );
    });

    it('Taro.showToast & hideToast: validates title requirement', async () => {
      const res = await Taro.showToast({ title: 'Success!', icon: 'success' });
      assert.strictEqual(res.errMsg, 'showToast:ok');

      const hideRes = await Taro.hideToast();
      assert.strictEqual(hideRes.errMsg, 'hideToast:ok');

      await assert.rejects(
        async () => {
          await Taro.showToast({} as any);
        },
        (err: any) => err.errMsg.includes('title is required')
      );
    });

    it('Taro.showLoading & hideLoading: shows indeterminate HUD', async () => {
      const showRes = await Taro.showLoading({ title: 'Fetching...' });
      assert.strictEqual(showRes.errMsg, 'showLoading:ok');

      const hideRes = await Taro.hideLoading();
      assert.strictEqual(hideRes.errMsg, 'hideLoading:ok');
    });

    it('Taro.showActionSheet: selects item index and rejects on empty list', async () => {
      const res = await Taro.showActionSheet({ itemList: ['Option A', 'Option B'] });
      assert.strictEqual(typeof res.tapIndex, 'number');
      assert.strictEqual(res.errMsg, 'showActionSheet:ok');

      await assert.rejects(
        async () => {
          await Taro.showActionSheet({ itemList: [] });
        },
        (err: any) => err.errMsg.includes('itemList must contain at least 1 item')
      );
    });
  });

  describe('5. Payment & Location APIs (requestPayment, getLocation, chooseLocation, openLocation)', () => {
    it('Taro.requestPayment: dispatches REQUEST_PAYMENT', async () => {
      const res = await Taro.requestPayment({
        package: 'inv_998877',
        signType: 'RSA',
        paySign: 'sig_abc123',
      });
      assert.strictEqual(res.errMsg, 'requestPayment:ok');
    });

    it('Taro.requestPayment: maps legacy WeChat fields into the 5-layer payment schema (BLK-P1-11)', async () => {
      let capturedAction = '';
      let capturedPayload: Record<string, unknown> = {};

      bridge.setBridgeCaller(async (action, payload) => {
        capturedAction = action;
        capturedPayload = payload;
        return { status: 'SUCCESS', transactionId: 'tx_schema_1' };
      });

      const res = await Taro.requestPayment({
        timeStamp: '1720000000',
        nonceStr: 'nonce_legacy_42',
        package: 'prepay_id=taro_legacy_prepay',
        signType: 'RSA',
        paySign: 'taro_legacy_sig',
        provider: 'stripe',
      });
      assert.strictEqual(res.errMsg, 'requestPayment:ok');

      assert.strictEqual(capturedAction, 'REQUEST_PAYMENT');
      assert.strictEqual(capturedPayload.intentId, 'prepay_id=taro_legacy_prepay');
      assert.strictEqual(capturedPayload.orderId, 'prepay_id=taro_legacy_prepay');
      assert.strictEqual(capturedPayload.nonce, 'nonce_legacy_42');
      assert.strictEqual(capturedPayload.signedPayload, 'taro_legacy_sig');
      assert.strictEqual(capturedPayload.signature, 'taro_legacy_sig');
      assert.strictEqual(capturedPayload.provider, 'stripe');
      assert.strictEqual(capturedPayload.timeStamp, '1720000000');
      assert.strictEqual(capturedPayload.paySign, 'taro_legacy_sig');

      bridge.setBridgeCaller(undefined);
    });

    it('Taro.getLocation & chooseLocation: retrieves coordinates', async () => {
      const loc = await Taro.getLocation({ type: 'gcj02' });
      assert.strictEqual(typeof loc.latitude, 'number');
      assert.strictEqual(typeof loc.longitude, 'number');
      assert.strictEqual(loc.errMsg, 'getLocation:ok');

      const chosen = await Taro.chooseLocation();
      assert.strictEqual(typeof chosen.latitude, 'number');
      assert.strictEqual(chosen.errMsg, 'chooseLocation:ok');

      const openRes = await Taro.openLocation({ latitude: 37.7749, longitude: -122.4194 });
      assert.strictEqual(openRes.errMsg, 'openLocation:ok');
    });
  });

  describe('6. System & Device Telemetry APIs', () => {
    it('Taro.getSystemInfo & getSystemInfoSync: returns comprehensive device attributes', async () => {
      const info = await Taro.getSystemInfo();
      assert.strictEqual(info.platform, 'goat');
      assert.strictEqual(info.errMsg, 'getSystemInfo:ok');
      assert.ok(info.safeArea);

      const syncInfo = Taro.getSystemInfoSync();
      assert.strictEqual(syncInfo.platform, 'goat');
      assert.strictEqual(syncInfo.screenWidth, 393);
    });

    it('Taro.getDeviceInfo, getWindowInfo & getAppBaseInfo: granular metadata', async () => {
      const device = await Taro.getDeviceInfo();
      assert.strictEqual(device.platform, 'goat');
      assert.strictEqual(device.errMsg, 'getDeviceInfo:ok');

      const win = await Taro.getWindowInfo();
      assert.strictEqual(win.screenWidth, 393);
      assert.strictEqual(win.statusBarHeight, 44);

      const appBase = Taro.getAppBaseInfo();
      assert.strictEqual(appBase.SDKVersion, '2.4.0');
      assert.strictEqual(appBase.platform, 'goat');
    });

    it('Taro.canIUse: probes supported API capabilities', () => {
      assert.strictEqual(Taro.canIUse('request'), true);
      assert.strictEqual(Taro.canIUse('Taro.getStorage'), true);
      assert.strictEqual(Taro.canIUse('showModal'), true);
      assert.strictEqual(Taro.canIUse('requestPayment'), true);
      assert.strictEqual(Taro.canIUse('API_REQUEST'), true);
      assert.strictEqual(Taro.canIUse('nonExistentApi'), false);
    });
  });

  describe('7. Media, Haptics, Clipboard, Screen & Scanner APIs', () => {
    it('Taro.vibrateShort & vibrateLong: tactile haptic motors', async () => {
      const s = await Taro.vibrateShort({ type: 'medium' });
      assert.strictEqual(s.errMsg, 'vibrateShort:ok');

      const l = await Taro.vibrateLong();
      assert.strictEqual(l.errMsg, 'vibrateLong:ok');
    });

    it('Taro.setClipboardData & getClipboardData: sandboxed clipboard', async () => {
      await Taro.setClipboardData({ data: 'Secret Token' });
      const res = await Taro.getClipboardData();
      assert.strictEqual(res.data, 'Secret Token');
      assert.strictEqual(res.errMsg, 'getClipboardData:ok');
    });

    it('Taro.setKeepScreenOn & setScreenBrightness: hardware controls', async () => {
      const keep = await Taro.setKeepScreenOn({ keepScreenOn: true });
      assert.strictEqual(keep.errMsg, 'setKeepScreenOn:ok');

      const bright = await Taro.setScreenBrightness({ value: 0.75 });
      assert.strictEqual(bright.errMsg, 'setScreenBrightness:ok');

      const getBright = await Taro.getScreenBrightness();
      assert.strictEqual(typeof getBright.value, 'number');
      assert.strictEqual(getBright.errMsg, 'getScreenBrightness:ok');
    });

    it('Taro.scanCode: QR/Barcode scanner', async () => {
      const scan = await Taro.scanCode({ onlyFromCamera: true });
      assert.ok(scan.result);
      assert.strictEqual(scan.scanType, 'QR_CODE');
      assert.strictEqual(scan.errMsg, 'scanCode:ok');
    });
  });

  describe('8. Custom Bridge Caller Injection', () => {
    it('supports custom bridge handlers for mocking host environments', async () => {
      const calls: string[] = [];
      bridge.setBridgeCaller(async (action, payload) => {
        calls.push(action);
        if (action === 'API_REQUEST') {
          return { data: { custom: true }, statusCode: 200 };
        }
        return { success: true };
      });

      const res = await Taro.request({ url: 'https://custom.api' });
      assert.deepStrictEqual(res.data, { custom: true });
      assert.strictEqual(calls[0], 'API_REQUEST');
    });
  });
});
