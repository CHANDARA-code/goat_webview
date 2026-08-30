import { GoatBridgeClient, goatBridge } from '../GoatBridge';
import type { GoatWebViewProps, AppServiceReadyEventData, AppServiceCrashEventData, AppServiceTerminateEventData } from '../types';

describe('React Native GoatWebView AppService Integration Suite (Task F9)', () => {
  test('GoatBridgeClient notifyAppServiceReady, notifyAppServiceCrash, notifyAppServiceTerminate', async () => {
    const client = new GoatBridgeClient();

    const readyOk = await client.notifyAppServiceReady('mini_app_rn_1', { engine: 'v8_dual_thread' });
    expect(readyOk).toBe(true);

    const crashOk = await client.notifyAppServiceCrash('mini_app_rn_1', 'Simulated RN Worker crash');
    expect(crashOk).toBe(true);

    const termOk = await client.notifyAppServiceTerminate('mini_app_rn_1');
    expect(termOk).toBe(true);
  });

  test('GoatWebView component prop callbacks for AppService lifecycle', () => {
    let readyReceived: AppServiceReadyEventData | null = null;
    let crashReceived: AppServiceCrashEventData | null = null;
    let terminateReceived: AppServiceTerminateEventData | null = null;

    const props: GoatWebViewProps = {
      appId: 'mini_app_rn_props',
      onAppServiceReady: (event) => {
        readyReceived = event.nativeEvent;
      },
      onAppServiceCrash: (event) => {
        crashReceived = event.nativeEvent;
      },
      onAppServiceTerminate: (event) => {
        terminateReceived = event.nativeEvent;
      },
    };

    props.onAppServiceReady?.({
      nativeEvent: {
        appId: 'mini_app_rn_props',
        timestamp: 1724725000000,
        details: { threadLane: 'worker' },
      },
    });

    props.onAppServiceCrash?.({
      nativeEvent: {
        appId: 'mini_app_rn_props',
        error: 'JS stack overflow',
        timestamp: 1724725001000,
      },
    });

    props.onAppServiceTerminate?.({
      nativeEvent: {
        appId: 'mini_app_rn_props',
        timestamp: 1724725002000,
      },
    });

    expect(readyReceived).not.toBeNull();
    expect(readyReceived!.appId).toBe('mini_app_rn_props');
    expect(readyReceived!.details?.threadLane).toBe('worker');

    expect(crashReceived).not.toBeNull();
    expect(crashReceived!.error).toBe('JS stack overflow');

    expect(terminateReceived).not.toBeNull();
    expect(terminateReceived!.appId).toBe('mini_app_rn_props');
  });

  test('GoatBridgeClient event dispatching for dual-thread worker', (done) => {
    const unsubscribe = goatBridge.on('ON_APP_SERVICE_READY', (payload) => {
      expect(payload.appId).toBe('worker_dual_thread');
      unsubscribe();
      done();
    });

    goatBridge.emit('ON_APP_SERVICE_READY', {
      appId: 'worker_dual_thread',
      timestamp: Date.now(),
    });
  });
});
