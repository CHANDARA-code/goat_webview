import { MiniAppLifecycleFSM } from '../lifecycle/fsm.js';
import { IpcChannel } from '../ipc/channel.js';
import { UnhandledErrorDetails } from './types.js';

export class WorkerErrorBoundary {
  private readonly lifecycle: MiniAppLifecycleFSM;
  private readonly ipc: IpcChannel;
  private isDisposed: boolean = false;

  constructor(lifecycle: MiniAppLifecycleFSM, ipc: IpcChannel) {
    this.lifecycle = lifecycle;
    this.ipc = ipc;
    this.installGlobalHandlers();
  }

  private installGlobalHandlers(): void {
    if (typeof self !== 'undefined' && typeof (self as any).addEventListener === 'function') {
      try {
        (self as any).addEventListener('error', (event: any) => {
          this.handleError({
            message: event.message || 'Worker runtime script error',
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: event.error?.stack,
            timestamp: Date.now(),
          });
        });

        (self as any).addEventListener('unhandledrejection', (event: any) => {
          const reason = event.reason;
          this.handleError({
            message: reason instanceof Error ? reason.message : String(reason),
            stack: reason instanceof Error ? reason.stack : undefined,
            timestamp: Date.now(),
          });
        });
      } catch {
        // Non-browser or restricted environment
      }
    }
  }

  public handleError(error: UnhandledErrorDetails): void {
    if (this.isDisposed) return;

    console.error('[WorkerErrorBoundary] Unhandled error captured:', error);

    // Transition state machine to CRASHED if not already terminated
    if (this.lifecycle.canTransition('FATAL_ERROR')) {
      try {
        this.lifecycle.transition('FATAL_ERROR', { error: error.message, stack: error.stack });
      } catch {
        // Ignore transition error if already crashed
      }
    }

    // Send high-priority lifecycle notification to AppView
    this.ipc.sendImmediate('LIFECYCLE', {
      appId: this.lifecycle.appId,
      state: 'CRASHED',
      event: 'onAppServiceCrash',
      error,
      timestamp: Date.now(),
      details: { error: error.message, stack: error.stack },
    });
  }

  public dispose(): void {
    this.isDisposed = true;
  }
}
