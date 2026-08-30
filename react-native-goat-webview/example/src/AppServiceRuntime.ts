import { goatBridge } from 'react-native-goat-webview';
import { AppServiceState, AppServiceStatus, IpcMessageEntry, ThreadLane } from './types';

type AppServiceListener = (state: AppServiceState) => void;
type MessageListener = (entry: IpcMessageEntry) => void;

export class AppServiceRuntimeManager {
  private state: AppServiceState = {
    enabled: true,
    status: 'READY',
    appId: 'com.goat.ecommerce',
    workerId: 'worker_rn_01',
    vdomPatchCount: 0,
    messageCount: 0,
    lastWorkerAction: null,
    lastError: null,
    laneCounts: {
      host: 0,
      appService: 0,
      appView: 0,
    },
  };

  private stateListeners: Set<AppServiceListener> = new Set();
  private messageListeners: Set<MessageListener> = new Set();
  private workerIntervalTimer: any = null;

  constructor() {
    this.init();
  }

  private async init() {
    await goatBridge.notifyAppServiceReady(this.state.appId, {
      workerId: this.state.workerId,
      threadLane: 'AppService',
      runtime: 'ReactNative_V8_DualThread',
    });
  }

  public getState(): AppServiceState {
    return { ...this.state, laneCounts: { ...this.state.laneCounts } };
  }

  public subscribeState(listener: AppServiceListener): () => void {
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  public subscribeMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  private notifyState() {
    const s = this.getState();
    this.stateListeners.forEach((fn) => fn(s));
  }

  private emitMessage(entry: IpcMessageEntry) {
    this.state.messageCount++;
    if (entry.lane === 'AppService') this.state.laneCounts.appService++;
    if (entry.lane === 'AppView') this.state.laneCounts.appView++;
    if (entry.lane === 'Host') this.state.laneCounts.host++;
    this.notifyState();
    this.messageListeners.forEach((fn) => fn(entry));
  }

  public setAppId(appId: string) {
    this.state.appId = appId;
    this.state.workerId = `worker_${appId.split('.').pop()}_${Date.now().toString().slice(-4)}`;
    this.notifyState();
  }

  public setEnabled(enabled: boolean) {
    this.state.enabled = enabled;
    if (!enabled) {
      this.stopBackgroundSimulation();
      this.state.status = 'IDLE';
    } else {
      this.state.status = 'READY';
      this.startBackgroundSimulation();
    }
    this.notifyState();
  }

  /**
   * Starts periodic worker-thread heartbeat & VDOM patch simulations.
   */
  public startBackgroundSimulation() {
    if (this.workerIntervalTimer) return;
    this.workerIntervalTimer = setInterval(() => {
      if (this.state.status === 'READY' || this.state.status === 'RUNNING') {
        this.runSimulatedWorkerTask('VDOM_DIFF_SYNC', {
          batchSize: Math.floor(Math.random() * 5) + 1,
          targetLane: 'AppView',
        });
      }
    }, 4000);
  }

  public stopBackgroundSimulation() {
    if (this.workerIntervalTimer) {
      clearInterval(this.workerIntervalTimer);
      this.workerIntervalTimer = null;
    }
  }

  /**
   * Executes a simulated background business-logic task inside the AppService Worker thread.
   */
  public async runSimulatedWorkerTask(action: string, payload: any = {}): Promise<any> {
    if (this.state.status === 'CRASHED' || this.state.status === 'TERMINATED') {
      const err = `Cannot execute task '${action}': Worker thread is in ${this.state.status} state.`;
      this.emitMessage({
        id: `err_${Date.now()}`,
        timestamp: Date.now(),
        action,
        status: 'ERROR',
        durationMs: 0.5,
        isWarmPath: true,
        request: payload,
        error: err,
        lane: 'AppService',
        appId: this.state.appId,
      });
      return null;
    }

    this.state.status = 'RUNNING';
    this.state.lastWorkerAction = action;
    this.notifyState();

    const startTime = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const reqId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // AppService Worker Lane frame
    this.emitMessage({
      id: reqId,
      timestamp: Date.now(),
      action: `WORKER_${action}`,
      status: 'PENDING',
      durationMs: 0.1,
      isWarmPath: true,
      request: payload,
      lane: 'AppService',
      appId: this.state.appId,
    });

    // Simulated computation
    await new Promise((r) => setTimeout(r, Math.random() * 4 + 1));

    let resultData: any = {};
    if (action === 'VDOM_DIFF_SYNC') {
      this.state.vdomPatchCount += payload.batchSize || 1;
      resultData = {
        patchesApplied: payload.batchSize || 1,
        rootNode: 'div#mini-app-container',
        checksum: `0x${Date.now().toString(16)}`,
      };
    } else if (action === 'CALCULATE_CART_TOTALS') {
      resultData = {
        subtotal: 129.99,
        tax: 10.4,
        shipping: 0.0,
        total: 140.39,
        currency: 'USD',
      };
    } else if (action === 'PROCESS_SENSOR_FUSION') {
      resultData = {
        pitch: (Math.random() * 30 - 15).toFixed(2),
        roll: (Math.random() * 30 - 15).toFixed(2),
        azimuth: (Math.random() * 360).toFixed(1),
        confidence: 0.98,
      };
    } else if (action === 'CIPHER_ENCRYPT_BLOCK') {
      resultData = {
        cipherAlgorithm: 'AES-256-GCM',
        iv: '0x1f92e8a7bc',
        tag: '0x99281a',
        cipherBytes: 256,
      };
    } else {
      resultData = { success: true, processedBy: this.state.workerId };
    }

    const endTime = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const duration = parseFloat((endTime - startTime).toFixed(2));

    // AppView UI Lane frame
    this.emitMessage({
      id: reqId,
      timestamp: Date.now(),
      action: `APPREPLY_${action}`,
      status: 'SUCCESS',
      durationMs: duration,
      isWarmPath: duration < 5.0,
      request: payload,
      response: resultData,
      lane: 'AppView',
      appId: this.state.appId,
    });

    this.state.status = 'READY';
    this.notifyState();
    return resultData;
  }

  /**
   * Simulates an unexpected worker crash and triggers crash notifications.
   */
  public async simulateWorkerCrash(reason: string = 'Simulated V8 Isolate Heap Exhaustion') {
    this.state.status = 'CRASHED';
    this.state.lastError = reason;
    this.notifyState();

    await goatBridge.notifyAppServiceCrash(this.state.appId, reason);

    this.emitMessage({
      id: `crash_${Date.now()}`,
      timestamp: Date.now(),
      action: 'ON_APP_SERVICE_CRASH',
      status: 'ERROR',
      durationMs: 1.2,
      isWarmPath: true,
      error: reason,
      lane: 'AppService',
      appId: this.state.appId,
    });
  }

  /**
   * Restarts the worker thread after crash or termination.
   */
  public async restartWorker() {
    this.state.status = 'READY';
    this.state.lastError = null;
    this.state.workerId = `worker_${this.state.appId.split('.').pop()}_${Date.now().toString().slice(-4)}`;
    this.notifyState();

    await goatBridge.notifyAppServiceReady(this.state.appId, {
      workerId: this.state.workerId,
      recovered: true,
      timestamp: Date.now(),
    });

    this.emitMessage({
      id: `ready_${Date.now()}`,
      timestamp: Date.now(),
      action: 'ON_APP_SERVICE_READY',
      status: 'SUCCESS',
      durationMs: 0.8,
      isWarmPath: true,
      response: { workerId: this.state.workerId, status: 'RESTORED' },
      lane: 'AppService',
      appId: this.state.appId,
    });
  }

  /**
   * Terminates the worker thread container.
   */
  public async terminateWorker() {
    this.stopBackgroundSimulation();
    this.state.status = 'TERMINATED';
    this.notifyState();

    await goatBridge.notifyAppServiceTerminate(this.state.appId);

    this.emitMessage({
      id: `term_${Date.now()}`,
      timestamp: Date.now(),
      action: 'ON_APP_SERVICE_TERMINATE',
      status: 'SUCCESS',
      durationMs: 0.5,
      isWarmPath: true,
      lane: 'AppService',
      appId: this.state.appId,
    });
  }
}

export const appServiceRuntime = new AppServiceRuntimeManager();
