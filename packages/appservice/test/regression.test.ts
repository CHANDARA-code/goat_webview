import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  h,
  diff,
  resetNodeIdCounter,
} from '../src/vdom/index.js';
import { AppViewDomRenderer } from '../src/renderer/dom-renderer.js';
import { AppServiceWorkerContainer } from '../src/worker/container.js';
import { ScriptEvaluator } from '../src/worker/evaluator.js';
import { GoatBridgeClient } from '../src/bridge/proxy.js';
import { MiniAppLifecycleFSM } from '../src/lifecycle/fsm.js';
import { IpcChannel } from '../src/ipc/channel.js';
import { InMemoryMessagePortPair } from '../src/simulation/in-memory-worker.js';
import { DomNodeStub } from './harness/dom-stub.js';
import { VNode } from '../src/types.js';

describe('Milestone 1 Remediation Regression Tests', () => {

  // =========================================================================
  // 1. KEYED LIST REVERSING & ELEMENT PRESERVATION WITHOUT DUPLICATION
  // =========================================================================
  describe('1. Keyed List Reversing Scale Verification', () => {
    let container: DomNodeStub;
    let renderer: AppViewDomRenderer;

    beforeEach(() => {
      resetNodeIdCounter();
      container = new DomNodeStub('DIV');
      renderer = new AppViewDomRenderer(container);
    });

    it('1.1: Reversing 5 keyed elements preserves exact count (5) and inverted order without duplication', () => {
      const count = 5;
      const oldNodes = Array.from({ length: count }, (_, i) =>
        h('div', { id: `item_${i}`, key: `k_${i}`, class: 'card' }, `Card #${i}`)
      );
      const tree1 = h('div', { id: 'list_5' }, oldNodes);

      renderer.executePatches(diff(null, tree1));
      const renderedRoot = container.childNodes[0];
      assert.strictEqual(renderedRoot.childNodes.length, 5, 'Initial render must have 5 child nodes');
      assert.deepStrictEqual(
        renderedRoot.childNodes.map((c: any) => c.id),
        ['item_0', 'item_1', 'item_2', 'item_3', 'item_4']
      );

      // Reverse list
      const newNodes = Array.from({ length: count }, (_, i) => {
        const revIdx = count - 1 - i;
        return h('div', { id: `item_${revIdx}`, key: `k_${revIdx}`, class: 'card updated' }, `Updated Card #${revIdx}`);
      });
      const tree2 = h('div', { id: 'list_5' }, newNodes);

      const patches = diff(tree1, tree2);
      renderer.executePatches(patches);

      assert.strictEqual(renderedRoot.childNodes.length, 5, 'Reversed render MUST have exactly 5 child nodes (no duplication)');
      assert.deepStrictEqual(
        renderedRoot.childNodes.map((c: any) => c.id),
        ['item_4', 'item_3', 'item_2', 'item_1', 'item_0']
      );
      assert.deepStrictEqual(
        renderer.domTree?.children?.map((c) => c.props?.id || c.nodeId),
        ['item_4', 'item_3', 'item_2', 'item_1', 'item_0']
      );
    });

    it('1.2: Reversing 100 keyed elements preserves exact count (100) and inverted order without duplication', () => {
      const count = 100;
      const oldNodes = Array.from({ length: count }, (_, i) =>
        h('li', { id: `row_${i}`, key: `key_${i}` }, `Row ${i}`)
      );
      const tree1 = h('ul', { id: 'list_100' }, oldNodes);

      renderer.executePatches(diff(null, tree1));
      const renderedRoot = container.childNodes[0];
      assert.strictEqual(renderedRoot.childNodes.length, 100);

      const newNodes = Array.from({ length: count }, (_, i) => {
        const revIdx = count - 1 - i;
        return h('li', { id: `row_${revIdx}`, key: `key_${revIdx}` }, `Row ${revIdx} New`);
      });
      const tree2 = h('ul', { id: 'list_100' }, newNodes);

      const patches = diff(tree1, tree2);
      renderer.executePatches(patches);

      assert.strictEqual(renderedRoot.childNodes.length, 100, 'Reversed render MUST maintain exactly 100 children');
      const expectedIds = Array.from({ length: count }, (_, i) => `row_${count - 1 - i}`);
      assert.deepStrictEqual(renderedRoot.childNodes.map((c: any) => c.id), expectedIds);
      assert.deepStrictEqual(renderer.domTree?.children?.map((c) => c.props?.id || c.nodeId), expectedIds);
    });

    it('1.3: Reversing 1,200 keyed elements preserves exact count (1,200) without memory overflow or node duplication', () => {
      const count = 1200;
      const oldNodes = Array.from({ length: count }, (_, i) =>
        h('div', { id: `el_${i}`, key: `k_${i}`, 'data-idx': String(i) }, `Element ${i}`)
      );
      const tree1 = h('div', { id: 'list_1200' }, oldNodes);

      renderer.executePatches(diff(null, tree1));
      const renderedRoot = container.childNodes[0];
      assert.strictEqual(renderedRoot.childNodes.length, 1200);

      const newNodes = Array.from({ length: count }, (_, i) => {
        const revIdx = count - 1 - i;
        return h('div', { id: `el_${revIdx}`, key: `k_${revIdx}`, 'data-idx': String(revIdx) }, `Element ${revIdx} Modified`);
      });
      const tree2 = h('div', { id: 'list_1200' }, newNodes);

      const patches = diff(tree1, tree2);
      renderer.executePatches(patches);

      assert.strictEqual(renderedRoot.childNodes.length, 1200, 'Reversed render MUST maintain strictly 1,200 child nodes');
      assert.strictEqual(renderer.domTree?.children?.length, 1200);
      assert.strictEqual(renderedRoot.childNodes[0].id, 'el_1199');
      assert.strictEqual(renderedRoot.childNodes[1199].id, 'el_0');
      assert.strictEqual(renderedRoot.childNodes[600].id, 'el_599');
    });

    it('1.4: Synthetic DOM insertBefore removes existing child before inserting at target index', () => {
      const parent = new DomNodeStub('DIV');
      const child1 = new DomNodeStub('SPAN');
      child1.id = 'child1';
      const child2 = new DomNodeStub('SPAN');
      child2.id = 'child2';
      const child3 = new DomNodeStub('SPAN');
      child3.id = 'child3';

      parent.appendChild(child1);
      parent.appendChild(child2);
      parent.appendChild(child3);
      assert.strictEqual(parent.childNodes.length, 3);
      assert.deepStrictEqual(parent.childNodes.map((c) => c.id), ['child1', 'child2', 'child3']);

      // Move child3 before child1
      parent.insertBefore(child3, child1);
      assert.strictEqual(parent.childNodes.length, 3, 'Moving existing child must NOT duplicate it');
      assert.deepStrictEqual(parent.childNodes.map((c) => c.id), ['child3', 'child1', 'child2']);

      // Move child1 to end (insertBefore null)
      parent.insertBefore(child1, null);
      assert.strictEqual(parent.childNodes.length, 3);
      assert.deepStrictEqual(parent.childNodes.map((c) => c.id), ['child3', 'child2', 'child1']);
    });
  });

  // =========================================================================
  // 2. STRICT MODE ENFORCEMENT & "this === undefined" VERIFICATION
  // =========================================================================
  describe('2. Strict Mode Enforcement & "this" Isolation', () => {
    let container: AppServiceWorkerContainer;
    let pair: InMemoryMessagePortPair;
    let ipc: IpcChannel;

    beforeEach(() => {
      pair = new InMemoryMessagePortPair();
      ipc = new IpcChannel('appservice', pair.port1);
      container = new AppServiceWorkerContainer('strict-mode-app', ipc);
      container.launch();
    });

    it('2.1: evaluateScript executes in strict mode with this === undefined', () => {
      const script = `
        const arrowThis = (() => this)();
        function standardFunc() {
          return this;
        }
        return {
          topThis: this,
          topThisType: typeof this,
          arrowThis: arrowThis,
          arrowThisType: typeof arrowThis,
          funcThis: standardFunc(),
          funcThisType: typeof standardFunc(),
        };
      `;

      const result = container.evaluateScript(script) as Record<string, unknown>;

      assert.strictEqual(result.topThis, undefined, 'Top-level "this" must be undefined in strict mode');
      assert.strictEqual(result.topThisType, 'undefined');
      assert.strictEqual(result.arrowThis, undefined, 'Arrow function "this" must be undefined');
      assert.strictEqual(result.arrowThisType, 'undefined');
      assert.strictEqual(result.funcThis, undefined, 'Standard function call "this" must be undefined');
      assert.strictEqual(result.funcThisType, 'undefined');
    });

    it('2.2: evaluateBundle executes in strict mode preventing global assignment leakage', () => {
      const freshContainer = new AppServiceWorkerContainer('fresh-bundle-app', ipc);
      const bundleCode = `
        App({
          onLaunch() {
            // In strict mode, assigning to undeclared variable throws ReferenceError
            try {
              undeclaredGlobalLeak = 12345;
            } catch (e) {
              setData({ strictModeActive: true, errorName: e.name });
            }
          }
        });
      `;

      freshContainer.loadBundle(bundleCode);
      const data = freshContainer.data;
      assert.strictEqual(data.strictModeActive, true, 'Strict mode must prevent undeclared variable assignments');
      assert.strictEqual(data.errorName, 'ReferenceError');
    });

    it('2.3: Cannot access Function or Object constructor to escape sandbox', () => {
      const script = `
        let escapeAttempted = false;
        try {
          const fn = (function() { return this; })().constructor('return globalThis')();
          escapeAttempted = !!fn;
        } catch (e) {
          escapeAttempted = false;
        }
        return escapeAttempted;
      `;

      const escaped = container.evaluateScript(script);
      assert.strictEqual(escaped, false, 'Sandbox escape via this.constructor must fail');
    });
  });

  // =========================================================================
  // 3. GOATBRIDGE PROXY ENCAPSULATION & PRIVATE TRANSPORT ISOLATION
  // =========================================================================
  describe('3. GoatBridge Proxy Encapsulation', () => {
    let container: AppServiceWorkerContainer;
    let pair: InMemoryMessagePortPair;
    let ipc: IpcChannel;

    beforeEach(() => {
      pair = new InMemoryMessagePortPair();
      ipc = new IpcChannel('appservice', pair.port1);
      container = new AppServiceWorkerContainer('bridge-encap-app', ipc);
      container.launch();
    });

    it('3.1: GoatBridge exposes only { call, callNative, on, emit, off } and hides ipc & rpcTable', () => {
      const script = `
        return {
          hasCall: typeof GoatBridge.call === 'function',
          hasCallNative: typeof GoatBridge.callNative === 'function',
          hasOn: typeof GoatBridge.on === 'function',
          hasEmit: typeof GoatBridge.emit === 'function',
          hasOff: typeof GoatBridge.off === 'function',
          hasIpc: typeof GoatBridge.ipc !== 'undefined',
          hasRpcTable: typeof GoatBridge.rpcTable !== 'undefined',
          hasCallCounter: typeof GoatBridge.callCounter !== 'undefined',
          hasEventListeners: typeof GoatBridge.eventListeners !== 'undefined',
          bridgeKeys: Object.keys(GoatBridge).sort(),
        };
      `;

      const result = container.evaluateScript(script) as Record<string, unknown>;

      assert.strictEqual(result.hasCall, true, 'GoatBridge.call must be accessible');
      assert.strictEqual(result.hasCallNative, true, 'GoatBridge.callNative must be accessible');
      assert.strictEqual(result.hasOn, true, 'GoatBridge.on must be accessible');
      assert.strictEqual(result.hasEmit, true, 'GoatBridge.emit must be accessible');
      assert.strictEqual(result.hasOff, true, 'GoatBridge.off must be accessible');
      assert.strictEqual(result.hasIpc, false, 'GoatBridge.ipc MUST be undefined (inaccessible)');
      assert.strictEqual(result.hasRpcTable, false, 'GoatBridge.rpcTable MUST be undefined (inaccessible)');
      assert.strictEqual(result.hasCallCounter, false, 'Internal callCounter must be inaccessible');
      assert.strictEqual(result.hasEventListeners, false, 'Internal eventListeners map must be inaccessible');
      assert.deepStrictEqual(result.bridgeKeys, ['call', 'callNative', 'emit', 'off', 'on']);
    });

    it('3.2: GoatBridge proxy functions route to underlying client without exposing internals', async () => {
      let dispatchedAction: string | null = null;
      let dispatchedPayload: any = null;

      pair.port2.onMessage((e: any) => {
        const frame = e.data;
        if (frame.type === 'BRIDGE_CALL') {
          dispatchedAction = frame.payload.action;
          dispatchedPayload = frame.payload.payload;
          pair.port2.postMessage({
            id: 'rep_1',
            type: 'BRIDGE_REPLY',
            seq: 1,
            timestamp: Date.now(),
            payload: {
              callId: frame.payload.callId,
              action: frame.payload.action,
              success: true,
              data: { result: 'encapsulated_success' },
              durationMs: 0.1,
            },
          });
        }
      });

      const script = `
        return GoatBridge.call('user.getProfile', { userId: 'u_123' });
      `;

      const promise = container.evaluateScript(script) as Promise<any>;
      const result = await promise;

      assert.strictEqual(dispatchedAction, 'user.getProfile');
      assert.deepStrictEqual(dispatchedPayload, { userId: 'u_123' });
      assert.deepStrictEqual(result, { result: 'encapsulated_success' });
    });

    it('3.3: GoatBridge on/emit/off pub-sub works through proxy', () => {
      const script = `
        let received = null;
        const unsubscribe = GoatBridge.on('customEvent', (payload) => {
          received = payload;
        });

        GoatBridge.emit('customEvent', { foo: 'bar' });
        const firstReceive = received;

        unsubscribe();
        GoatBridge.emit('customEvent', { foo: 'baz' });
        const secondReceive = received;

        return { firstReceive, secondReceive };
      `;

      const result = container.evaluateScript(script) as Record<string, unknown>;
      assert.deepStrictEqual(result.firstReceive, { foo: 'bar' });
      assert.deepStrictEqual(result.secondReceive, { foo: 'bar' }, 'Listener must be detached after unsubscribe');
    });
  });
});
