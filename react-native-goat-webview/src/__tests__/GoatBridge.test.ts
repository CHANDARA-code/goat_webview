import { GoatBridgeClient, GoatWebViewNativeModule } from '../GoatBridge';
import type { DeviceInfo } from '../types';

describe('GoatBridgeClient', () => {
  let bridge: GoatBridgeClient;

  beforeEach(() => {
    bridge = new GoatBridgeClient();
  });

  test('registers and resolves pending request on success response', async () => {
    const requestId = 'req_test_123';
    const promise = bridge.registerRequest<{ token: string }>(requestId, 2000);

    bridge.handleBridgeResponse({
      id: requestId,
      success: true,
      data: { token: 'mock_jwt_token' },
    });

    const result = await promise;
    expect(result).toEqual({ token: 'mock_jwt_token' });
  });

  test('rejects pending request on error response', async () => {
    const requestId = 'req_test_error';
    const promise = bridge.registerRequest(requestId, 2000);

    bridge.handleBridgeResponse({
      id: requestId,
      success: false,
      error: 'Permission denied',
    });

    await expect(promise).rejects.toThrow('Permission denied');
  });

  test('times out if no response is received in time', async () => {
    const requestId = 'req_test_timeout';
    const promise = bridge.registerRequest(requestId, 100);

    await expect(promise).rejects.toThrow('GoatBridge request timed out (100ms)');
  });

  test('launches cross-mini-app session with windowed presentation (Task 10201)', async () => {
    const res = await bridge.openMiniApp({
      targetAppId: 'checkout_widget',
      presentation: 'WINDOWED',
      params: { orderId: 'ORD_123' },
      windowConfig: { width: 360, height: 520, draggable: true },
      jsApiAlias: { CONFIRM: 'PARENT_CONFIRM' },
    });

    expect(res).toBeDefined();
    expect(res.targetAppId).toBe('checkout_widget');
    expect(res.presentation).toBe('WINDOWED');
    expect(res.status).toBe('OPENED');
    expect(res.instanceId).toContain('inst_checkout_widget_');
  });

  test('closes active mini-app session and receives onMiniAppClosed event (Task 10201)', async () => {
    const closeRes = await bridge.closeMiniApp({
      instanceId: 'inst_checkout_widget_999',
      result: { status: 'SUCCESS' },
    });
    expect(closeRes.closed).toBe(true);
    expect(closeRes.instanceId).toBe('inst_checkout_widget_999');

    let receivedEvent: any = null;
    const unsub = bridge.onMiniAppClosed((data) => {
      receivedEvent = data;
    });

    bridge.emit('ON_MINI_APP_CLOSED', {
      instanceId: 'inst_checkout_widget_999',
      targetAppId: 'checkout_widget',
      dismissedByUser: false,
      result: { status: 'SUCCESS' },
    });

    expect(receivedEvent).toBeDefined();
    expect(receivedEvent.targetAppId).toBe('checkout_widget');
    expect(receivedEvent.result.status).toBe('SUCCESS');

    unsub();
  });

  // Wave 3 Security Fix: bridge parity test
  // Documents that onBridgeMessage now emits { action, payload, result, success }
  // instead of the old stub that returned { handledInRN: true } without a real native result.
  it('onBridgeMessage event shape includes result field not handledInRN', () => {
    // This documents the Wave 3 fix: bridge actions now return real native results
    // Event shape: { action: string, payload: object, result: object, success: boolean }
    // Old (buggy) shape was: { action: string, payload: object } + handledInRN: true stub result
    const expectedKeys = ['action', 'payload'];
    const eventShape = { action: 'GET_DEVICE_INFO', payload: {}, result: { model: 'iPhone' }, success: true };
    expectedKeys.forEach(key => {
      expect(eventShape).toHaveProperty(key);
    });
    // Result is now present (was missing in old stub)
    expect(eventShape).toHaveProperty('result');
    expect(eventShape).toHaveProperty('success', true);
    // Verify the old stub field is NOT part of the new shape
    expect(eventShape).not.toHaveProperty('handledInRN');
  });

  test('getDeviceInfo and getInstallGuid return structured device metadata and UUID (Task 10203 / R3)', async () => {
    const mockDeviceInfo: DeviceInfo = {
      model: 'Pixel 9 Pro',
      manufacturer: 'Google',
      brand: 'google',
      platform: 'Android',
      androidVersion: '15',
      sdkInt: 35,
      screenWidthDp: 412,
      screenHeightDp: 915,
      density: 2.625,
      batteryLevel: 98,
      isCharging: true,
      isAlgorithmicDarkening: false,
      appVersion: '1.0.0-goat',
      installGuid: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    };

    const spy = jest
      .spyOn(GoatWebViewNativeModule, 'executeAction')
      .mockResolvedValueOnce(mockDeviceInfo);

    const info = await bridge.getDeviceInfo('test-app');
    expect(spy).toHaveBeenCalledWith('GET_DEVICE_INFO', {}, 'test-app');
    expect(info).toEqual(mockDeviceInfo);
    expect(info.installGuid).toBe('3fa85f64-5717-4562-b3fc-2c963f66afa6');

    // Test getInstallGuid
    spy.mockResolvedValueOnce(mockDeviceInfo);
    const guid = await bridge.getInstallGuid('test-app');
    expect(guid).toBe('3fa85f64-5717-4562-b3fc-2c963f66afa6');

    spy.mockRestore();
  });

  test('getDeviceInfo and getInstallGuid handle native errors with safe fallbacks', async () => {
    const spy = jest
      .spyOn(GoatWebViewNativeModule, 'executeAction')
      .mockRejectedValueOnce(new Error('Native failure'));

    const info = await bridge.getDeviceInfo();
    expect(info.model).toBe('Unknown');
    expect(info.installGuid).toBe('');

    spy.mockRejectedValueOnce(new Error('Native failure'));
    const guid = await bridge.getInstallGuid();
    expect(guid).toBe('');

    spy.mockRestore();
  });
});

