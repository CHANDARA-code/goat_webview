import { IpcMessageFrame, IpcMessageType, IpcSource } from '../types.js';

let frameCounter = 0;

export function createFrame<T = unknown>(
  type: IpcMessageType,
  payload: T,
  seq: number,
  source?: IpcSource
): IpcMessageFrame<T> {
  const timestamp = Date.now();
  const id = `frame_${source || 'ipc'}_${timestamp}_${++frameCounter}_${Math.random().toString(36).substring(2, 7)}`;

  return {
    id,
    type,
    seq,
    timestamp,
    source,
    payload,
  };
}

export function isValidFrame(frame: unknown): frame is IpcMessageFrame {
  if (typeof frame !== 'object' || frame === null) return false;
  const f = frame as Partial<IpcMessageFrame>;
  return (
    typeof f.id === 'string' &&
    typeof f.type === 'string' &&
    typeof f.seq === 'number' &&
    typeof f.timestamp === 'number' &&
    'payload' in f
  );
}
