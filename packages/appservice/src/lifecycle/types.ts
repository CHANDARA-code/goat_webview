import {
  LifecycleState,
  MiniAppLifecycleState,
  LifecycleSignal,
  LifecycleEventName,
  LifecyclePayload,
  HostSignalEvent,
} from '../types.js';

export type {
  LifecycleState,
  MiniAppLifecycleState,
  LifecycleSignal,
  LifecycleEventName,
  LifecyclePayload,
  HostSignalEvent,
};

export type StateChangeObserver = (payload: LifecyclePayload) => void;
