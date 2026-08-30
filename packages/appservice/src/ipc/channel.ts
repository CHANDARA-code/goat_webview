import { IpcMessageFrame, IpcMessageType, IpcSource, VDomPatch, UiPatchPayload } from '../types.js';
import { MessageTransport, IpcChannelOptions } from './types.js';
import { createFrame } from './frame.js';
import { MessageSerializer } from './serializer.js';
import { FrameBatcher } from './batcher.js';

export class IpcChannel {
  public readonly source: IpcSource;
  private readonly transport?: MessageTransport;
  private outgoingSeq: number = 0;
  private expectedIncomingSeq: number = 1;
  private readonly messageListeners = new Set<(frame: IpcMessageFrame) => void>();
  private readonly typeListeners = new Map<IpcMessageType, Set<(frame: IpcMessageFrame) => void>>();
  public messageLog: IpcMessageFrame[] = [];
  public roundTripLatencies: number[] = [];
  public batcher: FrameBatcher;

  constructor(source: IpcSource = 'appservice', transport?: MessageTransport, options: IpcChannelOptions = {}) {
    this.source = source;
    this.transport = transport;
    this.batcher = new FrameBatcher('root', this, {
      batchIntervalMs: options.batchIntervalMs ?? 16.6,
      maxBatchSize: options.maxBatchSize ?? 100,
    });

    if (this.transport) {
      this.transport.onMessage((event) => {
        this.handleIncoming(event.data);
      });
    }
  }

  public nextSeq(): number {
    return ++this.outgoingSeq;
  }

  public send<T = unknown>(type: IpcMessageType, payload: T): IpcMessageFrame<T> {
    const seq = this.nextSeq();
    const frame = createFrame(type, payload, seq, this.source);

    this.messageLog.push(frame as IpcMessageFrame);

    if (this.transport) {
      this.transport.postMessage(frame);
    } else {
      // In-memory loopback or direct subscription dispatch
      queueMicrotask(() => {
        this.notifyListeners(frame as IpcMessageFrame);
      });
    }

    return frame;
  }

  public sendImmediate<T = unknown>(type: IpcMessageType, payload: T): IpcMessageFrame<T> {
    return this.send<T>(type, payload);
  }

  public queueUiPatch(patch: VDomPatch, onFlush?: (batch: UiPatchPayload) => void): void {
    this.batcher.queueUiPatch(patch, onFlush);
  }

  public flushUiPatches(onFlush?: (batch: UiPatchPayload) => void): UiPatchPayload | null {
    return this.batcher.flush(onFlush);
  }

  public handleIncoming(data: unknown): void {
    const frame = MessageSerializer.deserialize(data);
    if (!frame || !frame.type || frame.seq === undefined) {
      return;
    }

    // Monotonic sequence verification
    if (frame.seq !== this.expectedIncomingSeq) {
      // Record or warn about gap/duplication
    }
    this.expectedIncomingSeq = frame.seq + 1;

    this.messageLog.push(frame);
    this.notifyListeners(frame);
  }

  private notifyListeners(frame: IpcMessageFrame): void {
    this.messageListeners.forEach((listener) => {
      try {
        listener(frame);
      } catch (err) {
        console.error('[IpcChannel] Error in general message listener:', err);
      }
    });

    const typeSet = this.typeListeners.get(frame.type);
    if (typeSet) {
      typeSet.forEach((listener) => {
        try {
          listener(frame);
        } catch (err) {
          console.error(`[IpcChannel] Error in ${frame.type} listener:`, err);
        }
      });
    }
  }

  public onMessage(listener: (frame: IpcMessageFrame) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public on(type: IpcMessageType, listener: (frame: IpcMessageFrame) => void): () => void {
    if (!this.typeListeners.has(type)) {
      this.typeListeners.set(type, new Set());
    }
    this.typeListeners.get(type)!.add(listener);
    return () => {
      this.typeListeners.get(type)?.delete(listener);
    };
  }

  public clear(): void {
    this.batcher.dispose();
    this.messageLog = [];
    this.roundTripLatencies = [];
    this.messageListeners.clear();
    this.typeListeners.clear();
    this.outgoingSeq = 0;
    this.expectedIncomingSeq = 1;
  }

  public dispose(): void {
    this.clear();
    if (this.transport && typeof this.transport.close === 'function') {
      this.transport.close();
    }
  }
}
