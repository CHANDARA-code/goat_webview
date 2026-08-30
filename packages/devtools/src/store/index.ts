/**
 * @goat/devtools - Master Zustand Store
 * Central reactive store unifying Workspace, Simulator, Sensors, Debugger, and Packaging slices.
 */

import { create } from 'zustand';
import type { DevToolsStore } from '../types/index.ts';
import { createWorkspaceSlice } from './workspaceSlice.ts';
import { createSimulatorSlice } from './simulatorSlice.ts';
import { createSensorsSlice } from './sensorsSlice.ts';
import { createDebuggerSlice } from './debuggerSlice.ts';
import { createPackagingSlice } from './packagingSlice.ts';

export const useDevToolsStore = create<DevToolsStore>()((...a) => ({
  ...createWorkspaceSlice(...a),
  ...createSimulatorSlice(...a),
  ...createSensorsSlice(...a),
  ...createDebuggerSlice(...a),
  ...createPackagingSlice(...a),
}));

export type { DevToolsStore };
export * from './workspaceSlice.ts';
export * from './simulatorSlice.ts';
export * from './sensorsSlice.ts';
export * from './debuggerSlice.ts';
export * from './packagingSlice.ts';
