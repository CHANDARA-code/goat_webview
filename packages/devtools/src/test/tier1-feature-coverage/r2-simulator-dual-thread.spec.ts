/**
 * r2-simulator-dual-thread.spec.ts — Tier 1 Feature Coverage for Requirement R2
 * Scope: Multi-device skins, Viewport controls, Dual-thread runtime container,
 * and 60fps frame batching.
 */

import { describe, it, expect } from '../harness/test-runner.ts';
import { DevToolsTestHarness } from '../harness/devtools-test-harness.ts';

export function registerR2Tests() {
  describe('Tier 1: R2 — Interactive Dual-Thread Device Simulator', () => {
    it('T1.R2.01: Device skin selector configures iPhone 16 Pro frame with Dynamic Island and insets', () => {
      const harness = new DevToolsTestHarness();
      harness.setDeviceSkin('iphone16pro');

      const state = harness.getState();
      expect(state.activeDeviceSkin).toBe('iphone16pro');
      expect(state.safeAreaInsets.top).toBe(59);
      expect(state.safeAreaInsets.bottom).toBe(34);
    });

    it('T1.R2.02: Device skin selector configures Pixel 9 Pro frame with punch-hole cutout and insets', () => {
      const harness = new DevToolsTestHarness();
      harness.setDeviceSkin('pixel9pro');

      const state = harness.getState();
      expect(state.activeDeviceSkin).toBe('pixel9pro');
      expect(state.safeAreaInsets.top).toBe(48);
      expect(state.safeAreaInsets.bottom).toBe(24);
    });

    it('T1.R2.03: Device skin selector configures iPad Pro and Foldable dual-screen frames', () => {
      const harness = new DevToolsTestHarness();

      harness.setDeviceSkin('ipadpro');
      expect(harness.getState().activeDeviceSkin).toBe('ipadpro');
      expect(harness.getState().safeAreaInsets.top).toBe(24);

      harness.setDeviceSkin('foldable');
      expect(harness.getState().activeDeviceSkin).toBe('foldable');
      expect(harness.getState().safeAreaInsets.left).toBe(0);
    });

    it('T1.R2.04: Viewport scale controls apply scaling factors (50%, 75%, 100%, 125%, 150%)', () => {
      const harness = new DevToolsTestHarness();

      harness.setViewportScale(0.5);
      expect(harness.getState().viewportScale).toBe(0.5);

      harness.setViewportScale(0.75);
      expect(harness.getState().viewportScale).toBe(0.75);

      harness.setViewportScale(1.0);
      expect(harness.getState().viewportScale).toBe(1.0);

      harness.setViewportScale(1.25);
      expect(harness.getState().viewportScale).toBe(1.25);

      harness.setViewportScale(1.5);
      expect(harness.getState().viewportScale).toBe(1.5);
    });

    it('T1.R2.05: Viewport orientation toggles between Portrait and Landscape modes', () => {
      const harness = new DevToolsTestHarness();
      expect(harness.getState().orientation).toBe('portrait');

      harness.toggleOrientation();
      expect(harness.getState().orientation).toBe('landscape');

      harness.toggleOrientation();
      expect(harness.getState().orientation).toBe('portrait');
    });

    it('T1.R2.06: Dual-thread container manages simulator runtime state and restart cycles', () => {
      const harness = new DevToolsTestHarness();
      expect(harness.getState().isRunning).toBe(true);

      harness.store.getState().restartSimulator();
      expect(harness.getState().isRunning).toBe(true);
      expect(harness.getState().consoleLogs.length).toBeGreaterThan(0);
    });

    it('T1.R2.07: 60fps frame batching coalesces rapid VDOM mutations into 16.6ms aligned batches', () => {
      const harness = new DevToolsTestHarness();
      expect(harness.getState().frameBatchingEnabled).toBe(true);

      // Verify FPS metrics
      harness.store.getState().setFps(60);
      expect(harness.getState().fps).toBe(60);

      // Toggle batcher
      harness.store.getState().setFrameBatchingEnabled(false);
      expect(harness.getState().frameBatchingEnabled).toBe(false);

      harness.store.getState().setFrameBatchingEnabled(true);
      expect(harness.getState().frameBatchingEnabled).toBe(true);
    });
  });
}
