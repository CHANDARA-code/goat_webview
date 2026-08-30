import {
  LifecycleState,
  MiniAppLifecycleState,
  LifecycleEventName,
  LifecyclePayload,
  LifecycleSignal,
} from '../types.js';
import { IpcChannel } from '../ipc/channel.js';
import { StateChangeObserver } from './types.js';

export class MiniAppLifecycleFSM {
  public readonly appId: string;
  private state: LifecycleState = 'UNINITIALIZED';
  private readonly ipc?: IpcChannel;
  private readonly observers = new Set<StateChangeObserver>();

  private static readonly VALID_TRANSITIONS: Record<
    LifecycleState,
    Partial<Record<LifecycleEventName, LifecycleState>>
  > = {
    UNINITIALIZED: {
      INIT: 'LAUNCHING',
      LAUNCH_SUCCESS: 'RUNNING',
      onAppServiceReady: 'RUNNING',
      FATAL_ERROR: 'CRASHED',
      LAUNCH_FAILURE: 'CRASHED',
      onAppServiceCrash: 'CRASHED',
      TERMINATE: 'TERMINATED',
      onAppServiceTerminate: 'TERMINATED',
    },
    LAUNCHING: {
      LAUNCH_SUCCESS: 'RUNNING',
      onAppServiceReady: 'RUNNING',
      LAUNCH_FAILURE: 'CRASHED',
      FATAL_ERROR: 'CRASHED',
      onAppServiceCrash: 'CRASHED',
      TERMINATE: 'TERMINATED',
      onAppServiceTerminate: 'TERMINATED',
    },
    RUNNING: {
      SUSPEND: 'SUSPENDED',
      onAppServiceSuspend: 'SUSPENDED',
      TERMINATE: 'TERMINATED',
      onAppServiceTerminate: 'TERMINATED',
      FATAL_ERROR: 'CRASHED',
      LAUNCH_FAILURE: 'CRASHED',
      onAppServiceCrash: 'CRASHED',
    },
    SUSPENDED: {
      RESUME: 'RUNNING',
      onAppServiceResume: 'RUNNING',
      TERMINATE: 'TERMINATED',
      onAppServiceTerminate: 'TERMINATED',
      FATAL_ERROR: 'CRASHED',
      onAppServiceCrash: 'CRASHED',
    },
    CRASHED: {
      TERMINATE: 'TERMINATED',
      onAppServiceTerminate: 'TERMINATED',
    },
    TERMINATED: {},
  };

  constructor(appId: string, ipc?: IpcChannel) {
    this.appId = appId;
    this.ipc = ipc;
  }

  public getState(): MiniAppLifecycleState {
    return this.state;
  }

  public canTransition(event: LifecycleEventName): boolean {
    const nextState = MiniAppLifecycleFSM.VALID_TRANSITIONS[this.state]?.[event];
    return nextState !== undefined;
  }

  public transition(
    event: LifecycleEventName,
    details?: Record<string, unknown>
  ): MiniAppLifecycleState {
    const fromState = this.state;
    const toState = MiniAppLifecycleFSM.VALID_TRANSITIONS[fromState]?.[event];

    if (!toState) {
      const errorMsg = `[LifecycleFSM] Invalid state transition: cannot handle event '${event}' while in state '${fromState}'`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    this.state = toState;

    const mappedSignal: LifecycleSignal =
      toState === 'RUNNING'
        ? 'onAppServiceReady'
        : toState === 'SUSPENDED'
        ? 'onAppServiceSuspend'
        : toState === 'TERMINATED'
        ? 'onAppServiceTerminate'
        : 'onAppServiceCrash';

    const payload: LifecyclePayload = {
      appId: this.appId,
      state: this.state,
      fromState,
      toState,
      event: mappedSignal,
      timestamp: Date.now(),
      details,
    };

    // Notify local observers
    this.observers.forEach((obs) => {
      try {
        obs(payload);
      } catch (err) {
        console.error('[LifecycleFSM] Error in observer:', err);
      }
    });

    // Broadcast over IPC if channel is attached
    if (this.ipc) {
      this.ipc.sendImmediate('LIFECYCLE', payload);
    }

    return this.state;
  }

  public onStateChange(observer: StateChangeObserver): () => void {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  public reset(): void {
    this.state = 'UNINITIALIZED';
    this.observers.clear();
  }
}
