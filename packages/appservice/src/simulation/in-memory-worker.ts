import { MessageTransport } from '../ipc/types.js';

export class InMemoryMessagePortPair {
  public readonly port1: MessageTransport;
  public readonly port2: MessageTransport;

  constructor() {
    let port1Listener: ((event: { data: unknown }) => void) | null = null;
    let port2Listener: ((event: { data: unknown }) => void) | null = null;
    let isClosed = false;

    this.port1 = {
      postMessage: (message: unknown) => {
        if (isClosed) return;
        queueMicrotask(() => {
          if (!isClosed && port2Listener) {
            port2Listener({ data: message });
          }
        });
      },
      onMessage: (listener: (event: { data: unknown }) => void) => {
        port1Listener = listener;
      },
      close: () => {
        isClosed = true;
      },
    };

    this.port2 = {
      postMessage: (message: unknown) => {
        if (isClosed) return;
        queueMicrotask(() => {
          if (!isClosed && port1Listener) {
            port1Listener({ data: message });
          }
        });
      },
      onMessage: (listener: (event: { data: unknown }) => void) => {
        port2Listener = listener;
      },
      close: () => {
        isClosed = true;
      },
    };
  }
}
