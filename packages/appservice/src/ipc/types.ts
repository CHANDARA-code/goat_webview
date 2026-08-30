import { IpcMessageFrame, IpcMessageType, IpcSource } from '../types.js';

export type { IpcMessageFrame, IpcMessageType, IpcSource };

export interface MessageTransport {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onMessage(listener: (event: { data: unknown }) => void): void;
  close?(): void;
}

export interface IpcChannelOptions {
  batchIntervalMs?: number;
  maxBatchSize?: number;
}
