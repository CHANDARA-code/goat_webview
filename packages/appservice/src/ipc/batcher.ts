import { VDomPatch, UiPatchPayload } from '../types.js';
import { IpcChannel } from './channel.js';

export interface FrameBatcherOptions {
  batchIntervalMs?: number; // default 16.6ms (~60fps)
  maxBatchSize?: number;     // max patches before forced immediate flush
}

export class FrameBatcher {
  private readonly rootId: string;
  private readonly ipc: IpcChannel;
  private readonly batchIntervalMs: number;
  private readonly maxBatchSize: number;

  private pendingPatches: VDomPatch[] = [];
  private timer: NodeJS.Timeout | null = null;
  private batchCounter: number = 0;
  private flushCallbacks: Array<(batch: UiPatchPayload) => void> = [];

  constructor(rootId: string, ipc: IpcChannel, options: FrameBatcherOptions = {}) {
    this.rootId = rootId;
    this.ipc = ipc;
    this.batchIntervalMs = options.batchIntervalMs ?? 16.6;
    this.maxBatchSize = options.maxBatchSize ?? 100;
  }

  public enqueuePatches(patches: VDomPatch[], onFlush?: (batch: UiPatchPayload) => void): void {
    if (patches.length === 0) return;

    this.pendingPatches.push(...patches);
    if (onFlush) {
      this.flushCallbacks.push(onFlush);
    }

    if (this.pendingPatches.length >= this.maxBatchSize) {
      this.flush();
      return;
    }

    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.flush();
      }, this.batchIntervalMs);
    }
  }

  public queueUiPatch(patch: VDomPatch, onFlush?: (batch: UiPatchPayload) => void): void {
    this.enqueuePatches([patch], onFlush);
  }

  public flush(directOnFlush?: (batch: UiPatchPayload) => void): UiPatchPayload | null {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.pendingPatches.length === 0) return null;

    const patchesToSend = [...this.pendingPatches];
    this.pendingPatches = [];

    const callbacks = [...this.flushCallbacks];
    this.flushCallbacks = [];
    if (directOnFlush) {
      callbacks.push(directOnFlush);
    }

    const payload: UiPatchPayload = {
      batchId: `batch_${Date.now()}_${++this.batchCounter}`,
      rootId: this.rootId,
      seq: this.batchCounter,
      timestamp: Date.now(),
      patches: patchesToSend,
    };

    this.ipc.send('UI_PATCH', payload);

    for (const cb of callbacks) {
      try {
        cb(payload);
      } catch (err) {
        console.error('[FrameBatcher] Error in flush callback:', err);
      }
    }

    return payload;
  }

  public get pendingCount(): number {
    return this.pendingPatches.length;
  }

  public dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingPatches = [];
    this.flushCallbacks = [];
  }
}
