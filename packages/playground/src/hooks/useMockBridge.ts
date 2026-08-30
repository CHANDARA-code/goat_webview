import { useState, useCallback } from 'react';
import type { MockState, BridgeTrace } from '../types.js';

const DEFAULT_MOCK_STATE: MockState = {
  platform: 'ios',
  biometric: 'success',
  gps: { lat: 13.7563, lng: 100.5018, accuracy: 10 },
  network: 'wifi',
  battery: 87,
  theme: 'light',
};

let traceCounter = 0;

function generateId(): string {
  return `trace-${Date.now()}-${++traceCounter}`;
}

function syntheticLatency(): number {
  return Math.floor(Math.random() * 140) + 10; // 10–150ms
}

function simulateResponse(
  action: string,
  payload: Record<string, unknown>,
  state: MockState
): Record<string, unknown> {
  switch (action) {
    case 'GET_DEVICE_INFO':
      return {
        platform: state.platform,
        os_version: state.platform === 'ios' ? '17.4' : '14',
        model: state.platform === 'ios' ? 'iPhone 16 Pro' : 'Pixel 9 Pro',
        battery: state.battery,
        network: state.network,
      };
    case 'BIOMETRIC_AUTH':
      if (state.biometric === 'locked') return { success: false, error: 'BIOMETRIC_LOCKED' };
      if (state.biometric === 'fail') return { success: false, error: 'BIOMETRIC_FAILED' };
      return { success: true, token: 'mock-bio-token-xyz' };
    case 'NAV_BAR_SET_TITLE':
      return { success: true, title: payload['title'] ?? 'Untitled' };
    case 'NAV_BAR_SET_COLOR':
      return { success: true, color: payload['color'] ?? '#000000' };
    case 'BOTTOM_SHEET_OPEN':
      return { success: true, height: payload['height'] ?? 300 };
    case 'BOTTOM_SHEET_CLOSE':
      return { success: true };
    case 'HAPTIC_FEEDBACK':
      return { success: true, type: payload['type'] ?? 'light' };
    case 'REQUEST_PERMISSION':
      if (state.network === 'offline') return { granted: false, reason: 'offline' };
      return { granted: true, permission: payload['permission'] ?? 'unknown' };
    case 'STORAGE_SET':
      return { success: true, key: payload['key'] };
    case 'STORAGE_GET':
      return { success: true, key: payload['key'], value: `mock-value-for-${payload['key']}` };
    default:
      return { success: true, action, echo: payload };
  }
}

export interface UseMockBridgeReturn {
  mockState: MockState;
  setMockState: React.Dispatch<React.SetStateAction<MockState>>;
  bridgeTraces: BridgeTrace[];
  callBridge: (action: string, payload: Record<string, unknown>) => Promise<BridgeTrace>;
  clearTraces: () => void;
}

export function useMockBridge(): UseMockBridgeReturn {
  const [mockState, setMockState] = useState<MockState>(DEFAULT_MOCK_STATE);
  const [bridgeTraces, setBridgeTraces] = useState<BridgeTrace[]>([]);

  const callBridge = useCallback(
    async (action: string, payload: Record<string, unknown>): Promise<BridgeTrace> => {
      const id = generateId();
      const timestamp = Date.now();

      // Insert pending trace
      const pendingTrace: BridgeTrace = {
        id,
        action,
        payload,
        response: null,
        latency: 0,
        timestamp,
        status: 'pending',
      };

      setBridgeTraces((prev) => [pendingTrace, ...prev]);

      // Simulate async latency
      const latency = syntheticLatency();
      await new Promise<void>((resolve) => setTimeout(resolve, latency));

      const response = simulateResponse(action, payload, mockState);
      const completedTrace: BridgeTrace = {
        ...pendingTrace,
        response,
        latency,
        status: 'success',
      };

      setBridgeTraces((prev) =>
        prev.map((t) => (t.id === id ? completedTrace : t))
      );

      return completedTrace;
    },
    [mockState]
  );

  const clearTraces = useCallback(() => {
    setBridgeTraces([]);
  }, []);

  return { mockState, setMockState, bridgeTraces, callBridge, clearTraces };
}
