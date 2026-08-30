import { IpcMessageFrame } from '../types.js';
import { isValidFrame } from './frame.js';

export class MessageSerializer {
  public static serialize<T>(frame: IpcMessageFrame<T>): string {
    return JSON.stringify(frame);
  }

  public static deserialize<T = unknown>(data: unknown): IpcMessageFrame<T> | null {
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        if (isValidFrame(parsed)) {
          return parsed as IpcMessageFrame<T>;
        }
      } catch {
        return null;
      }
    } else if (isValidFrame(data)) {
      return data as IpcMessageFrame<T>;
    }
    return null;
  }
}
