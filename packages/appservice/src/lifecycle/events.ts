import { LifecyclePayload, LifecycleSignal, LifecycleEventName, LifecycleState } from '../types.js';

export function mapEventToSignal(event: LifecycleEventName, state: LifecycleState): LifecycleSignal | undefined {
  if (event === 'LAUNCH_SUCCESS' || event === 'onAppServiceReady' || state === 'RUNNING') {
    return 'onAppServiceReady';
  }
  if (event === 'SUSPEND' || event === 'onAppServiceSuspend' || state === 'SUSPENDED') {
    return 'onAppServiceSuspend';
  }
  if (event === 'RESUME' || event === 'onAppServiceResume') {
    return 'onAppServiceResume';
  }
  if (event === 'TERMINATE' || event === 'onAppServiceTerminate' || state === 'TERMINATED') {
    return 'onAppServiceTerminate';
  }
  if (event === 'FATAL_ERROR' || event === 'LAUNCH_FAILURE' || event === 'onAppServiceCrash' || state === 'CRASHED') {
    return 'onAppServiceCrash';
  }
  return undefined;
}

export class LifecycleEventEmitter {
  private readonly listeners = new Set<(payload: LifecyclePayload) => void>();

  public on(listener: (payload: LifecyclePayload) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public emit(payload: LifecyclePayload): void {
    this.listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.error('[LifecycleEventEmitter] Error in listener:', err);
      }
    });
  }

  public clear(): void {
    this.listeners.clear();
  }
}
