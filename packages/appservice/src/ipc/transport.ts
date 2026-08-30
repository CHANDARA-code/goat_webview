import { MessageTransport } from './types.js';

export class MessagePortTransport implements MessageTransport {
  private readonly port: MessagePort;

  constructor(port: MessagePort) {
    this.port = port;
  }

  public postMessage(message: unknown, transfer?: Transferable[]): void {
    if (transfer && transfer.length > 0) {
      this.port.postMessage(message, transfer);
    } else {
      this.port.postMessage(message);
    }
  }

  public onMessage(listener: (event: { data: unknown }) => void): void {
    this.port.onmessage = (event: MessageEvent) => {
      listener({ data: event.data });
    };
  }

  public close(): void {
    this.port.close();
  }
}

export class WorkerTransport implements MessageTransport {
  private readonly worker: Worker | { postMessage(msg: unknown): void; addEventListener?(type: string, fn: (e: any) => void): void; onmessage?: ((e: any) => void) | null };

  constructor(worker: Worker | { postMessage(msg: unknown): void }) {
    this.worker = worker;
  }

  public postMessage(message: unknown, transfer?: Transferable[]): void {
    if (transfer && transfer.length > 0 && typeof (this.worker as any).postMessage === 'function') {
      (this.worker as any).postMessage(message, transfer);
    } else {
      this.worker.postMessage(message);
    }
  }

  public onMessage(listener: (event: { data: unknown }) => void): void {
    if (typeof (this.worker as any).addEventListener === 'function') {
      (this.worker as any).addEventListener('message', (event: MessageEvent) => {
        listener({ data: event.data });
      });
    } else {
      (this.worker as any).onmessage = (event: MessageEvent) => {
        listener({ data: event.data });
      };
    }
  }
}
