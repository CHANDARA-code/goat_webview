import { GoatBridgeClient } from '../GoatBridge';

describe('GoatBridge Extended Suite (Task 10089)', () => {
  let bridge: GoatBridgeClient;

  beforeEach(() => {
    bridge = new GoatBridgeClient();
  });

  test('handles concurrent multiple asynchronous bridge requests without crosstalk', async () => {
    const p1 = bridge.registerRequest<{ val: number }>('req_1', 2000);
    const p2 = bridge.registerRequest<{ val: number }>('req_2', 2000);
    const p3 = bridge.registerRequest<{ val: number }>('req_3', 2000);

    bridge.handleBridgeResponse({ id: 'req_2', success: true, data: { val: 2 } });
    bridge.handleBridgeResponse({ id: 'req_1', success: true, data: { val: 1 } });
    bridge.handleBridgeResponse({ id: 'req_3', success: true, data: { val: 3 } });

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    expect(r1.val).toBe(1);
    expect(r2.val).toBe(2);
    expect(r3.val).toBe(3);
  });

  test('cleans up pending requests on resolution preventing memory leaks', async () => {
    const reqId = 'req_leak_test';
    const promise = bridge.registerRequest(reqId, 2000);
    bridge.handleBridgeResponse({ id: reqId, success: true, data: { ok: true } });
    await promise;

    // Responding to already resolved ID should be ignored safely
    expect(() => {
      bridge.handleBridgeResponse({ id: reqId, success: true, data: { ok: true } });
    }).not.toThrow();
  });
});
