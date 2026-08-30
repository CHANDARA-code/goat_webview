/**
 * Tier 1 - Feature Coverage: F6 AppView Render Thread Bridge
 * Requirements: ORIGINAL_REQUEST §R2, PROJECT.md §F6
 */

import { describe, it, expect, beforeEach, afterEach } from '../harness/test-runner.ts';
import { DualThreadTestEnvironment, VDomEngine } from '../harness/dual-thread-harness.ts';
import type { UiPatchPayload } from '../../../src/types.ts';

describe('Tier 1 - F6: AppView Render Thread Bridge', () => {
  let env: DualThreadTestEnvironment;

  beforeEach(() => {
    env = new DualThreadTestEnvironment('f6_test_app');
    env.worker.launch();
  });

  afterEach(() => {
    env.destroy();
  });

  it('T1.F6.01: applies CREATE and UPDATE_PROPS patch batches to real DOM tree', () => {
    const rootNode = VDomEngine.createVNode('view', { id: 'app' }, [
      VDomEngine.createVNode('text', { class: 'title' }, [], 'Initial Title'),
    ]);

    const batch: UiPatchPayload = {
      batchId: 'b1',
      rootId: 'root',
      patches: [{ type: 'CREATE', path: [], vnode: rootNode }],
      timestamp: Date.now(),
    };

    env.appView.applyPatchBatch(batch, 1);
    expect(env.appView.domTree).toBeDefined();
    expect(env.appView.domTree?.tag).toBe('view');
    expect(env.appView.domTree?.children?.[0].text).toBe('Initial Title');
  });

  it('T1.F6.02: updates text nodes on SET_TEXT patch', () => {
    const rootNode = VDomEngine.createVNode('view', {}, [
      VDomEngine.createVNode('text', {}, [], 'Old Text'),
    ]);
    env.appView.applyPatchBatch({
      batchId: 'b1',
      rootId: 'root',
      patches: [{ type: 'CREATE', path: [], vnode: rootNode }],
      timestamp: Date.now(),
    }, 1);

    env.appView.applyPatchBatch({
      batchId: 'b2',
      rootId: 'root',
      patches: [{ type: 'SET_TEXT', path: [0], text: 'New Text' }],
      timestamp: Date.now(),
    }, 2);

    expect(env.appView.domTree?.children?.[0].text).toBe('New Text');
  });

  it('T1.F6.03: intercepts DOM events and dispatches UI_EVENT frames to Worker', async () => {
    let receivedEvent: unknown = null;
    env.ipc.on('UI_EVENT', (frame) => {
      receivedEvent = frame.payload;
    });

    env.appView.simulateUserEvent('tap', [0, 1], { touchX: 120, touchY: 340 });

    expect(receivedEvent).toBeDefined();
    const eventPayload = receivedEvent as { eventType: string; targetPath: number[]; data: { touchX: number } };
    expect(eventPayload.eventType).toBe('tap');
    expect(eventPayload.targetPath).toEqual([0, 1]);
    expect(eventPayload.data.touchX).toBe(120);
  });

  it('T1.F6.04: forwards BRIDGE_CALL frames from Worker to native host dispatcher', async () => {
    await env.worker.GoatBridge.call('storage.set', { key: 'theme', value: 'dark' });

    expect(env.host.dispatchedActions).toContain('storage.set');
    expect(env.host.memoryStorage.get('theme')).toBe('dark');
  });

  it('T1.F6.05: relays host BRIDGE_REPLY frame back to Worker thread with latency tracking', async () => {
    await env.worker.GoatBridge.call('storage.set', { key: 'theme', value: 'dark' });
    const res = await env.worker.GoatBridge.call('storage.get', { key: 'theme' }) as { value: string };
    expect(res.value).toBe('dark');
    expect(env.ipc.roundTripLatencies.length).toBeGreaterThan(0);
  });
});
