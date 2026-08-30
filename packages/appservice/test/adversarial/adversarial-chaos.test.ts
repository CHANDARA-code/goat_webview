import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  h,
  diff,
  diffTrees,
  VDomEngine,
  createVNode,
  createTextVNode,
  resetNodeIdCounter,
} from '../../src/vdom/index.js';
import { AppViewDomRenderer } from '../../src/renderer/dom-renderer.js';
import { MiniAppLifecycleFSM } from '../../src/lifecycle/fsm.js';
import { AppServiceWorkerContainer } from '../../src/worker/container.js';
import { ScriptEvaluator } from '../../src/worker/evaluator.js';
import { IpcChannel } from '../../src/ipc/channel.js';
import { InMemoryMessagePortPair } from '../../src/simulation/in-memory-worker.js';
import { DomNodeStub } from '../harness/dom-stub.js';
import { VNode, VDomPatch, LifecycleEventName, LifecycleState } from '../../src/types.js';

/**
 * Utility to deeply compare a rendered synthetic DOM or VNode tree with an expected VNode tree
 */
function assertDomMatchesVNode(domNode: any, expected: VNode): void {
  assert.ok(domNode, 'DOM node must exist');

  if (expected.type === 'TEXT' || expected.tag === '#text') {
    assert.strictEqual(
      domNode.textContent || domNode.nodeValue,
      expected.text || '',
      `Text content mismatch: expected "${expected.text}", got "${domNode.textContent || domNode.nodeValue}"`
    );
    return;
  }

  // Tag check
  const actualTag = (domNode.nodeName || domNode.tag || '').toLowerCase();
  const expectedTag = (expected.tag || 'div').toLowerCase();
  assert.strictEqual(actualTag, expectedTag, `Tag mismatch: expected <${expectedTag}>, got <${actualTag}>`);

  // Props check
  if (expected.props) {
    for (const [key, value] of Object.entries(expected.props)) {
      if (key === 'key') continue;
      if (key === 'id') {
        assert.strictEqual(domNode.id, String(value), `Prop id mismatch: expected "${value}", got "${domNode.id}"`);
      } else if (key === 'class' || key === 'className') {
        assert.strictEqual(
          domNode.className,
          String(value),
          `Prop class mismatch: expected "${value}", got "${domNode.className}"`
        );
      } else if (key.startsWith('data-')) {
        const actualAttr = domNode.props?.[key] || (typeof domNode.getAttribute === 'function' ? domNode.getAttribute(key) : undefined);
        assert.strictEqual(
          actualAttr,
          String(value),
          `Attribute ${key} mismatch: expected "${value}", got "${actualAttr}"`
        );
      }
    }
  }

  // Children check
  const expectedChildren = expected.children || [];
  const actualChildNodes = domNode.childNodes || [];
  assert.strictEqual(
    actualChildNodes.length,
    expectedChildren.length,
    `Children count mismatch at <${expectedTag}>: expected ${expectedChildren.length}, got ${actualChildNodes.length}`
  );

  for (let i = 0; i < expectedChildren.length; i++) {
    assertDomMatchesVNode(actualChildNodes[i], expectedChildren[i]);
  }
}

/**
 * Utility to deeply compare two VNode trees
 */
function assertVNodesEqual(actual: VNode | null, expected: VNode | null, path: string = 'root'): void {
  if (!actual && !expected) return;
  assert.ok(actual && expected, `Tree existence mismatch at ${path}: actual=${Boolean(actual)}, expected=${Boolean(expected)}`);

  assert.strictEqual(actual.tag, expected.tag, `Tag mismatch at ${path}: ${actual.tag} vs ${expected.tag}`);
  assert.strictEqual(actual.text, expected.text, `Text mismatch at ${path}: "${actual.text}" vs "${expected.text}"`);

  // Compare props
  const actualProps = actual.props || {};
  const expectedProps = expected.props || {};
  const allKeys = new Set([...Object.keys(actualProps), ...Object.keys(expectedProps)]);
  for (const k of allKeys) {
    if (k === 'key') continue;
    assert.strictEqual(
      actualProps[k],
      expectedProps[k],
      `Prop '${k}' mismatch at ${path}: ${actualProps[k]} vs ${expectedProps[k]}`
    );
  }

  // Compare children
  const actualChildren = actual.children || [];
  const expectedChildren = expected.children || [];
  assert.strictEqual(
    actualChildren.length,
    expectedChildren.length,
    `Child count mismatch at ${path}: ${actualChildren.length} vs ${expectedChildren.length}`
  );

  for (let i = 0; i < actualChildren.length; i++) {
    assertVNodesEqual(actualChildren[i], expectedChildren[i], `${path}.children[${i}]`);
  }
}

describe('Adversarial Stress Test Suite: VDOM Chaos, Lifecycle FSM & Sandbox Escape', () => {

  // =========================================================================
  // 1. VDOM CHAOS & PROPERTY INVERSION
  // =========================================================================
  describe('1. VDOM Chaos & Property Inversion', () => {
    let container: DomNodeStub;
    let renderer: AppViewDomRenderer;

    beforeEach(() => {
      resetNodeIdCounter();
      container = new DomNodeStub('DIV');
      renderer = new AppViewDomRenderer(container);
    });

    it('VDOM-01: Deeply nested tree diffing and patch application (Depth 60)', () => {
      const depth = 60;

      // Construct old deeply nested tree
      function buildDeepTree(d: number, prefix: string, textSuffix: string): VNode {
        if (d === 0) {
          return h('span', { id: `leaf_${prefix}` }, `Leaf content ${textSuffix}`);
        }
        return h('div', { id: `level_${d}_${prefix}`, 'data-depth': String(d) }, [
          buildDeepTree(d - 1, prefix, textSuffix),
        ]);
      }

      const tree1 = buildDeepTree(depth, 'old', 'v1');
      const patches1 = diff(null, tree1);
      renderer.executePatches(patches1);

      assert.strictEqual(container.childNodes.length, 1);
      assertDomMatchesVNode(container.childNodes[0], tree1);
      assertVNodesEqual(renderer.domTree, tree1);

      // Mutate at leaf and intermediate depths (depth 30 and leaf)
      function buildMutatedDeepTree(d: number): VNode {
        if (d === 0) {
          return h('p', { id: 'leaf_mutated', class: 'highlight' }, 'Leaf mutated content v2');
        }
        if (d === 30) {
          return h('section', { id: 'level_30_mutated', 'data-depth': '30-mutated' }, [
            buildMutatedDeepTree(d - 1),
          ]);
        }
        return h('div', { id: `level_${d}_mutated`, 'data-depth': String(d) }, [
          buildMutatedDeepTree(d - 1),
        ]);
      }

      const tree2 = buildMutatedDeepTree(depth);
      const patches2 = diff(tree1, tree2);
      renderer.executePatches(patches2);

      assert.strictEqual(container.childNodes.length, 1);
      assertDomMatchesVNode(container.childNodes[0], tree2);
      assertVNodesEqual(renderer.domTree, tree2);
    });

    it('VDOM-02: Large-scale tree with 1,200 nodes diffing and patch application', () => {
      const itemCount = 1200;

      const oldItems: VNode[] = [];
      for (let i = 0; i < itemCount; i++) {
        oldItems.push(
          h('li', { id: `item_${i}`, key: `k_${i}`, class: 'list-item' }, [
            h('span', { class: 'idx' }, `Index #${i}`),
            h('strong', { class: 'val' }, `Value ${i * 10}`),
          ])
        );
      }
      const tree1 = h('ul', { id: 'large_list', class: 'container' }, oldItems);

      const patches1 = diff(null, tree1);
      renderer.executePatches(patches1);
      assert.strictEqual(container.childNodes[0].childNodes.length, itemCount);

      // Mutate: reverse list, update 50% props, change values
      const newItems: VNode[] = [];
      for (let i = itemCount - 1; i >= 0; i--) {
        newItems.push(
          h('li', { id: `item_${i}`, key: `k_${i}`, class: i % 2 === 0 ? 'list-item active' : 'list-item' }, [
            h('span', { class: 'idx' }, `Updated Index #${i}`),
            h('strong', { class: 'val' }, `New Value ${i * 20}`),
          ])
        );
      }
      const tree2 = h('ul', { id: 'large_list', class: 'container updated' }, newItems);

      const patches2 = diff(tree1, tree2);
      renderer.executePatches(patches2);

      assert.strictEqual(container.childNodes[0].childNodes.length, itemCount);
      assertDomMatchesVNode(container.childNodes[0], tree2);
      assertVNodesEqual(renderer.domTree, tree2);
    });

    it('VDOM-03: Adversarial key permutations, shuffles, additions, and deletions', () => {
      const keys1 = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'];
      const tree1 = h(
        'div',
        { id: 'key_container' },
        keys1.map((k) => h('div', { key: k, id: `k_${k}` }, `Content ${k}`))
      );

      renderer.executePatches(diff(null, tree1));
      assertDomMatchesVNode(container.childNodes[0], tree1);

      // Permuted + deleted + inserted keys
      const keys2 = ['theta', 'omega', 'beta', 'delta', 'sigma', 'alpha', 'kappa'];
      const tree2 = h(
        'div',
        { id: 'key_container' },
        keys2.map((k) => h('div', { key: k, id: `k_${k}` }, `Mutated ${k}`))
      );

      const patches = diff(tree1, tree2);
      renderer.executePatches(patches);

      assertDomMatchesVNode(container.childNodes[0], tree2);
      assertVNodesEqual(renderer.domTree, tree2);
    });

    it('VDOM-04: Adversarial node swaps (Text-to-Element, Element-to-Text, Tag changes)', () => {
      const tree1 = h('div', { id: 'swap_root' }, [
        h('span', { id: 'node_1' }, 'Pure Text Node'),
        h('div', { id: 'node_2' }, [h('button', { id: 'btn_nested' }, 'Click')]),
        h('p', { id: 'node_3' }, 'Paragraph'),
      ]);

      renderer.executePatches(diff(null, tree1));

      // Swap node_1 to an element hierarchy, node_2 to plain text, node_3 to an input
      const tree2 = h('div', { id: 'swap_root' }, [
        h('div', { id: 'node_1' }, [
          h('span', { class: 'inner' }, 'Now Nested Element 1'),
          h('span', { class: 'inner' }, 'Now Nested Element 2'),
        ]),
        h('span', { id: 'node_2' }, 'Now plain text child'),
        h('input', { id: 'node_3', type: 'text', value: 'hello' }),
      ]);

      const patches = diff(tree1, tree2);
      renderer.executePatches(patches);

      assertDomMatchesVNode(container.childNodes[0], tree2);
      assertVNodesEqual(renderer.domTree, tree2);
    });

    it('VDOM-05: Property Inversion (Massive attribute addition, removal, and modification)', () => {
      const oldProps: Record<string, unknown> = { id: 'prop_root' };
      for (let i = 0; i < 50; i++) {
        oldProps[`data-old-${i}`] = `val_${i}`;
      }
      oldProps.class = 'initial-class';
      oldProps.style = 'color: red;';

      const tree1 = h('div', oldProps, 'Prop Target');
      renderer.executePatches(diff(null, tree1));

      const newProps: Record<string, unknown> = { id: 'prop_root' };
      for (let i = 0; i < 50; i++) {
        newProps[`data-new-${i}`] = `new_val_${i}`;
      }
      newProps.class = 'transformed-class active';
      newProps.style = 'color: blue; font-size: 16px;';

      const tree2 = h('div', newProps, 'Prop Target Modified');
      const patches = diff(tree1, tree2);
      renderer.executePatches(patches);

      assertDomMatchesVNode(container.childNodes[0], tree2);
      assertVNodesEqual(renderer.domTree, tree2);
    });

    it('VDOM-06: Handling null, undefined, boolean, and empty children gracefully', () => {
      const tree1 = h(
        'div',
        { id: 'falsy_root' },
        null,
        undefined,
        false,
        true,
        h('span', { id: 's1' }, 'Valid Span 1'),
        h('span', { id: 's2' }, 'Valid Span 2')
      );

      assert.strictEqual(tree1.children?.length, 2);
      const patches = diff(null, tree1);
      renderer.executePatches(patches);

      assertDomMatchesVNode(container.childNodes[0], tree1);
      assertVNodesEqual(renderer.domTree, tree1);
    });

    it('VDOM-07: Handling duplicate keys safely without crash', () => {
      const tree1 = h('ul', { id: 'dup_list' }, [
        h('li', { key: 'dup', id: 'li_1' }, 'Item 1'),
        h('li', { key: 'dup', id: 'li_2' }, 'Item 2'),
        h('li', { key: 'unique', id: 'li_3' }, 'Item 3'),
      ]);

      const tree2 = h('ul', { id: 'dup_list' }, [
        h('li', { key: 'unique', id: 'li_3' }, 'Item 3 Updated'),
        h('li', { key: 'dup', id: 'li_1' }, 'Item 1 Updated'),
        h('li', { key: 'dup', id: 'li_2' }, 'Item 2 Updated'),
      ]);

      // Diffs duplicate keys without throwing unhandled exceptions
      const patches = diff(tree1, tree2);
      assert.ok(Array.isArray(patches));
      assert.doesNotThrow(() => {
        renderer.executePatches(patches);
      });
    });
  });

  // =========================================================================
  // 2. LIFECYCLE FSM CHAOS
  // =========================================================================
  describe('2. Lifecycle FSM Chaos & Edge Cases', () => {
    let fsm: MiniAppLifecycleFSM;
    let pair: InMemoryMessagePortPair;
    let ipc: IpcChannel;

    beforeEach(() => {
      pair = new InMemoryMessagePortPair();
      ipc = new IpcChannel('appservice', pair.port1);
      fsm = new MiniAppLifecycleFSM('test-app-fsm', ipc);
    });

    afterEach(() => {
      ipc.dispose();
    });

    it('FSM-01: Rejects illegal transitions with descriptive Error without corrupting state', () => {
      assert.strictEqual(fsm.getState(), 'UNINITIALIZED');

      const illegalEventsFromUninit: LifecycleEventName[] = [
        'SUSPEND',
        'onAppServiceSuspend',
        'RESUME',
        'onAppServiceResume',
      ];

      for (const event of illegalEventsFromUninit) {
        assert.strictEqual(fsm.canTransition(event), false);
        assert.throws(
          () => fsm.transition(event),
          /Invalid state transition/,
          `Should reject ${event} from UNINITIALIZED`
        );
        // Verify state remains clean and uncorrupted
        assert.strictEqual(fsm.getState(), 'UNINITIALIZED');
      }

      // Transition to RUNNING
      fsm.transition('INIT');
      fsm.transition('LAUNCH_SUCCESS');
      assert.strictEqual(fsm.getState(), 'RUNNING');

      // Attempt illegal transitions from RUNNING
      const illegalEventsFromRunning: LifecycleEventName[] = [
        'INIT',
        'RESUME',
        'onAppServiceResume',
      ];

      for (const event of illegalEventsFromRunning) {
        assert.strictEqual(fsm.canTransition(event), false);
        assert.throws(
          () => fsm.transition(event),
          /Invalid state transition/,
          `Should reject ${event} from RUNNING`
        );
        assert.strictEqual(fsm.getState(), 'RUNNING');
      }

      // Suspend
      fsm.transition('SUSPEND');
      assert.strictEqual(fsm.getState(), 'SUSPENDED');

      // Attempt illegal transitions from SUSPENDED
      const illegalEventsFromSuspended: LifecycleEventName[] = [
        'INIT',
        'LAUNCH_SUCCESS',
        'onAppServiceReady',
        'SUSPEND',
        'onAppServiceSuspend',
      ];

      for (const event of illegalEventsFromSuspended) {
        assert.strictEqual(fsm.canTransition(event), false);
        assert.throws(
          () => fsm.transition(event),
          /Invalid state transition/,
          `Should reject ${event} from SUSPENDED`
        );
        assert.strictEqual(fsm.getState(), 'SUSPENDED');
      }

      // Terminate
      fsm.transition('TERMINATE');
      assert.strictEqual(fsm.getState(), 'TERMINATED');

      // Once TERMINATED, all transitions must be rejected
      const allEvents: LifecycleEventName[] = [
        'INIT',
        'LAUNCH_SUCCESS',
        'onAppServiceReady',
        'SUSPEND',
        'onAppServiceSuspend',
        'RESUME',
        'onAppServiceResume',
        'FATAL_ERROR',
        'LAUNCH_FAILURE',
        'onAppServiceCrash',
        'TERMINATE',
        'onAppServiceTerminate',
      ];

      for (const event of allEvents) {
        assert.strictEqual(fsm.canTransition(event), false);
        assert.throws(
          () => fsm.transition(event),
          /Invalid state transition/,
          `Should reject ${event} from TERMINATED`
        );
        assert.strictEqual(fsm.getState(), 'TERMINATED');
      }
    });

    it('FSM-02: Isolates observer errors so state transitions and subsequent observers complete', () => {
      let observer2Called = false;

      // Faulty observer that throws
      fsm.onStateChange(() => {
        throw new Error('Exploding observer');
      });

      // Healthy observer
      fsm.onStateChange((payload) => {
        if (payload.toState === 'RUNNING') {
          observer2Called = true;
        }
      });

      assert.doesNotThrow(() => {
        fsm.transition('INIT');
        fsm.transition('LAUNCH_SUCCESS');
      });

      assert.strictEqual(fsm.getState(), 'RUNNING');
      assert.strictEqual(observer2Called, true);
    });

    it('FSM-03: Handles crashes during all valid active states (LAUNCHING, RUNNING, SUSPENDED)', () => {
      // 1. Crash during LAUNCHING
      const fsm1 = new MiniAppLifecycleFSM('app_1');
      fsm1.transition('INIT');
      assert.strictEqual(fsm1.getState(), 'LAUNCHING');
      fsm1.transition('FATAL_ERROR', { error: 'SyntaxError during script eval' });
      assert.strictEqual(fsm1.getState(), 'CRASHED');

      // 2. Crash during RUNNING
      const fsm2 = new MiniAppLifecycleFSM('app_2');
      fsm2.transition('INIT');
      fsm2.transition('LAUNCH_SUCCESS');
      assert.strictEqual(fsm2.getState(), 'RUNNING');
      fsm2.transition('FATAL_ERROR', { error: 'Unhandled Promise Rejection' });
      assert.strictEqual(fsm2.getState(), 'CRASHED');

      // 3. Crash during SUSPENDED
      const fsm3 = new MiniAppLifecycleFSM('app_3');
      fsm3.transition('INIT');
      fsm3.transition('LAUNCH_SUCCESS');
      fsm3.transition('SUSPEND');
      assert.strictEqual(fsm3.getState(), 'SUSPENDED');
      fsm3.transition('FATAL_ERROR', { error: 'Background memory eviction crash' });
      assert.strictEqual(fsm3.getState(), 'CRASHED');

      // From CRASHED, can still safely TERMINATE
      fsm3.transition('TERMINATE');
      assert.strictEqual(fsm3.getState(), 'TERMINATED');
    });

    it('FSM-04: Worker Container double terminate / destroy safety', () => {
      const container = new AppServiceWorkerContainer('safe-app', ipc);
      container.launch();
      assert.strictEqual(container.state, 'RUNNING');

      // First terminate
      container.terminate();
      assert.strictEqual(container.state, 'TERMINATED');

      // Double terminate / destroy must not crash host
      assert.doesNotThrow(() => {
        container.destroy();
      });
      assert.doesNotThrow(() => {
        container.dispose();
      });
      assert.strictEqual(container.state, 'TERMINATED');
    });

    it('FSM-05: Blocks bridge calls and script evaluations when in TERMINATED or CRASHED states', async () => {
      const container = new AppServiceWorkerContainer('blocked-app', ipc);
      container.launch();

      // Crash container
      container.errorBoundary.handleError({
        message: 'Simulated fatal crash',
        timestamp: Date.now(),
      });
      assert.strictEqual(container.state, 'CRASHED');

      // Script evaluation should be blocked
      assert.throws(() => {
        container.evaluateScript('const x = 1;');
      }, /Cannot execute script in CRASHED state/);

      // Bridge calls should be rejected
      await assert.rejects(async () => {
        await container.GoatBridge.call('storage.get', { key: 'test' });
      }, /Cannot invoke GoatBridge.call in CRASHED state/);

      await assert.rejects(async () => {
        await container.GoatBridge.callNative('storage.get', { key: 'test' });
      }, /Cannot invoke GoatBridge.callNative in CRASHED state/);
    });
  });

  // =========================================================================
  // 3. SANDBOX ESCAPE ATTACKS
  // =========================================================================
  describe('3. Sandbox Escape Attack Resistance', () => {
    let container: AppServiceWorkerContainer;
    let pair: InMemoryMessagePortPair;
    let ipc: IpcChannel;

    beforeEach(() => {
      pair = new InMemoryMessagePortPair();
      ipc = new IpcChannel('appservice', pair.port1);
      container = new AppServiceWorkerContainer('sandbox-test-app', ipc);
      container.launch();
    });

    afterEach(() => {
      container.destroy();
      ipc.dispose();
    });

    it('SANDBOX-01: Direct DOM globals (window, document, HTMLElement, localStorage) are undefined', () => {
      const script = `
        return {
          windowType: typeof window,
          documentType: typeof document,
          htmlElementType: typeof HTMLElement,
          localStorageType: typeof localStorage,
          indexedDBType: typeof indexedDB,
          windowVal: window,
          documentVal: document,
        };
      `;

      const result = container.evaluateScript(script) as Record<string, unknown>;
      assert.strictEqual(result.windowType, 'undefined');
      assert.strictEqual(result.documentType, 'undefined');
      assert.strictEqual(result.htmlElementType, 'undefined');
      assert.strictEqual(result.localStorageType, 'undefined');
      assert.strictEqual(result.indexedDBType, 'undefined');
      assert.strictEqual(result.windowVal, undefined);
      assert.strictEqual(result.documentVal, undefined);
    });

    it('SANDBOX-02: Function constructor / strict mode "this" cannot access outer window or DOM', () => {
      // In strict mode, "this" should be undefined, but currently sloppy mode exposes globalThis!
      const script1 = `
        const getThis = () => this;
        return {
          thisType: typeof this,
          arrowThis: getThis(),
        };
      `;
      const result1 = container.evaluateScript(script1) as Record<string, unknown>;
      
      // We empirically record whether this evaluates as undefined or leaked global object
      console.log('[EMPIRICAL VULNERABILITY AUDIT] SANDBOX-02 `this` type in evaluateScript:', result1.thisType);
      
      // Document the vulnerability: result1.thisType is 'object' (globalThis) instead of 'undefined' because "use strict" was placed after const declarations!
      assert.strictEqual(
        result1.thisType,
        'undefined',
        'CRITICAL BUG: evaluateScript executes in sloppy mode; "this" leaks global object instead of being undefined!'
      );
    });

    it('SANDBOX-03: Prototype pollution attempts do not corrupt core object behavior', () => {
      const maliciousScript = `
        try {
          const evilPayload = JSON.parse('{"__proto__": {"polluted": true, "isAdmin": true}}');
          setData(evilPayload);
        } catch (e) {}

        return ({})['polluted'];
      `;

      const result = container.evaluateScript(maliciousScript);
      assert.strictEqual(result, undefined, 'Clean object must not have prototype pollution');
      assert.strictEqual(({} as any).polluted, undefined);
      assert.strictEqual(({} as any).isAdmin, undefined);
    });

    it('SANDBOX-04: Script evaluation catches syntax and runtime exceptions via error boundary', () => {
      let capturedError: any = null;
      container.errorBoundary.handleError = (err) => {
        capturedError = err;
      };

      assert.throws(() => {
        container.evaluateScript('thisIsAnUndefinedVariable.someMethod();');
      }, /thisIsAnUndefinedVariable/);

      assert.ok(capturedError, 'Error boundary must capture thrown runtime error');
      assert.match(capturedError.message, /thisIsAnUndefinedVariable/);
    });

    it('SANDBOX-05: setData and Bridge cannot leak private container references or IPC transport', () => {
      const script = `
        return {
          hasBridgeIpc: typeof GoatBridge.ipc !== 'undefined',
          hasContainer: typeof getApp().container !== 'undefined',
          hasEvaluator: typeof getApp().evaluator !== 'undefined',
        };
      `;

      const result = container.evaluateScript(script) as Record<string, unknown>;
      assert.strictEqual(result.hasBridgeIpc, false);
      assert.strictEqual(result.hasContainer, false);
      assert.strictEqual(result.hasEvaluator, false);
    });
  });
});
