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

  test('subscribes and receives unified lifecycle events', () => {
    let showData: any = null;
    let hideData: any = null;
    let scrollData: any = null;
    let memData: any = null;
    let resizeData: any = null;

    const unsubs = [
      bridge.onAppShow((data) => { showData = data; }),
      bridge.onAppHide((data) => { hideData = data; }),
      bridge.onPageScroll((data) => { scrollData = data; }),
      bridge.onMemoryWarning((data) => { memData = data; }),
      bridge.onWindowResize((data) => { resizeData = data; }),
    ];

    bridge.emit('ON_APP_SHOW', { entryRoute: '/pages/index', scene: 1001 });
    bridge.emit('ON_APP_HIDE', { timestamp: 123456789 });
    bridge.emit('ON_PAGE_SCROLL', { scrollTop: 250, scrollLeft: 0, scrollHeight: 1200, scrollWidth: 400 });
    bridge.emit('ON_MEMORY_WARNING', { level: 80, memoryPressure: 'critical' });
    bridge.emit('ON_WINDOW_RESIZE', { width: 390, height: 844, windowWidth: 390, windowHeight: 844, orientation: 'portrait' });

    expect(showData?.entryRoute).toBe('/pages/index');
    expect(showData?.scene).toBe(1001);
    expect(hideData?.timestamp).toBe(123456789);
    expect(scrollData?.scrollTop).toBe(250);
    expect(memData?.level).toBe(80);
    expect(memData?.memoryPressure).toBe('critical');
    expect(resizeData?.orientation).toBe('portrait');

    unsubs.forEach((fn) => fn());
    bridge.emit('ON_APP_SHOW', { entryRoute: '/detached' });
    expect(showData?.entryRoute).toBe('/pages/index');
  });
});
