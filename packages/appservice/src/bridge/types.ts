import {
  BridgeCallPayload,
  BridgeReplyPayload,
  BridgeError,
  BridgeErrorPayload,
} from '../types.js';

export type {
  BridgeCallPayload,
  BridgeReplyPayload,
  BridgeError,
  BridgeErrorPayload,
};

export interface PendingRpcEntry<T = unknown> {
  callId: string;
  action: string;
  startTime: number;
  timeoutMs: number;
  timer: NodeJS.Timeout;
  resolve: (value: T) => void;
  reject: (reason: Error | BridgeError) => void;
}
