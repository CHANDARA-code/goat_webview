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
import { MiniAppLifecycleFSM } from '../src/lifecycle/fsm.js';
import { IpcChannel } from '../src/ipc/channel.js';
import { InMemoryMessagePortPair } from '../src/simulation/in-memory-worker.js';
import { DomNodeStub } from './harness/dom-stub.js';
import { VNode, LifecycleState, LifecycleEventName } from '../src/types.js';

// Simple deterministic LCG pseudo-random generator for reproducible shuffling
function createSeededRandom(seed: number) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('Milestone 1 Re-Challenger: Adversarial Stress & Security Verification', () => {

  // =========================================================================
  // 1. KEYED COLLECTION REORDERING, SHUFFLING, INSERTION & DELETION STRESS
  // =========================================================================
  describe('1. Keyed Collection Reordering Stress (5, 100, 1,200 elements)', () => {
    let container: DomNodeStub;
    let renderer: AppViewDomRenderer;

    beforeEach(() => {
      resetNodeIdCounter();
      container = new DomNodeStub('DIV');
      renderer = new AppViewDomRenderer(container);
    });

    const testScales = [5, 100, 1200];

    for (const N of testScales) {
      it(`1.1 [Scale N=${N}]: Full reverse ordering preserves exact count (${N}), inverted key order, and zero node duplication`, () => {
        // Build initial keyed list
        const initialNodes = Array.from({ length: N }, (_, i) =>
          h('div', { id: `item_${i}`, key: `k_${i}`, class: 'item' }, `Text ${i}`)
        );
        const initialTree = h('div', { id: `container_${N}` }, initialNodes);

        renderer.executePatches(diff(null, initialTree));
        const renderedRoot = container.childNodes[0];

        assert.strictEqual(renderedRoot.childNodes.length, N, `Initial render must have exactly ${N} child nodes`);
        assert.deepStrictEqual(
          renderedRoot.childNodes.map((c: any) => c.id),
          Array.from({ length: N }, (_, i) => `item_${i}`)
        );

        // Verify all DOM node references are unique
        const uniqueSet = new Set(renderedRoot.childNodes);
        assert.strictEqual(uniqueSet.size, N, `All ${N} initial DOM node instances must be unique`);

        // Reverse ordering
        const reversedNodes = Array.from({ length: N }, (_, i) => {
          const revIdx = N - 1 - i;
          return h('div', { id: `item_${revIdx}`, key: `k_${revIdx}`, class: 'item reversed' }, `Reversed Text ${revIdx}`);
        });
        const reversedTree = h('div', { id: `container_${N}` }, reversedNodes);

        const patches = diff(initialTree, reversedTree);
        renderer.executePatches(patches);

        // Verify count, inverted order, and zero duplicates
        assert.strictEqual(renderedRoot.childNodes.length, N, `Reversed render MUST maintain exactly ${N} child nodes`);
        const expectedReversedIds = Array.from({ length: N }, (_, i) => `item_${N - 1 - i}`);
        assert.deepStrictEqual(
          renderedRoot.childNodes.map((c: any) => c.id),
          expectedReversedIds,
          `Child node order must exactly match inverted sequence for N=${N}`
        );

        // Check node uniqueness after reverse
        const reversedUniqueSet = new Set(renderedRoot.childNodes);
        assert.strictEqual(reversedUniqueSet.size, N, `All ${N} reversed DOM node instances must remain unique`);

        // Check internal VNode tree synchronization
        assert.strictEqual(renderer.domTree?.children?.length, N);
        assert.deepStrictEqual(
          renderer.domTree?.children?.map((c) => c.props?.id || c.nodeId),
          expectedReversedIds
        );

        // Re-reverse back to original order
        const backPatches = diff(reversedTree, initialTree);
        renderer.executePatches(backPatches);

        assert.strictEqual(renderedRoot.childNodes.length, N, `Re-reversing MUST maintain exactly ${N} child nodes`);
        assert.deepStrictEqual(
          renderedRoot.childNodes.map((c: any) => c.id),
          Array.from({ length: N }, (_, i) => `item_${i}`)
        );
      });

      it(`1.2 [Scale N=${N}]: Deterministic random shuffle preserves exact count (${N}) and key mapping`, () => {
        const rng = createSeededRandom(42 + N);

        // Initial list
        const initialNodes = Array.from({ length: N }, (_, i) =>
          h('div', { id: `node_${i}`, key: `key_${i}` }, `Node ${i}`)
        );
        const initialTree = h('div', { id: `shuffle_root_${N}` }, initialNodes);
        renderer.executePatches(diff(null, initialTree));
        const renderedRoot = container.childNodes[0];

        assert.strictEqual(renderedRoot.childNodes.length, N);

        // Generate shuffled permutation using Fisher-Yates
        const permutation = Array.from({ length: N }, (_, i) => i);
        for (let i = N - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
        }

        const shuffledNodes = permutation.map((origIdx) =>
          h('div', { id: `node_${origIdx}`, key: `key_${origIdx}`, class: 'shuffled' }, `Shuffled Node ${origIdx}`)
        );
        const shuffledTree = h('div', { id: `shuffle_root_${N}` }, shuffledNodes);

        const patches = diff(initialTree, shuffledTree);
        renderer.executePatches(patches);

        assert.strictEqual(renderedRoot.childNodes.length, N, `Shuffled list must contain exactly ${N} child nodes`);
        const expectedShuffledIds = permutation.map((idx) => `node_${idx}`);
        assert.deepStrictEqual(
          renderedRoot.childNodes.map((c: any) => c.id),
          expectedShuffledIds,
          `DOM node IDs must strictly match the permutation sequence for N=${N}`
        );

        const uniqueSet = new Set(renderedRoot.childNodes);
        assert.strictEqual(uniqueSet.size, N, `All ${N} shuffled child nodes must be unique without duplication`);
      });

      it(`1.3 [Scale N=${N}]: Adversarial Churn (Interleaved 40% Deletions, 30% Insertions, and Key Moves)`, () => {
        const initialNodes = Array.from({ length: N }, (_, i) =>
          h('div', { id: `orig_${i}`, key: `orig_k_${i}` }, `Original ${i}`)
        );
        const initialTree = h('div', { id: `churn_root_${N}` }, initialNodes);
        renderer.executePatches(diff(null, initialTree));
        const renderedRoot = container.childNodes[0];

        // Retain ~60% of original nodes, insert new nodes, and interleave
        const retained: VNode[] = [];
        const expectedKeys: string[] = [];

        // Retain even indices
        for (let i = 0; i < N; i += 2) {
          retained.push(h('div', { id: `orig_${i}`, key: `orig_k_${i}`, class: 'retained' }, `Retained ${i}`));
          expectedKeys.push(`orig_k_${i}`);
        }

        // Insert new elements at beginning, middle, and end
        const insertCount = Math.max(1, Math.floor(N * 0.3));
        const churnedNodes: VNode[] = [];

        // 1. Insert 1/3 of new nodes at head
        const headInserts = Math.floor(insertCount / 3);
        for (let i = 0; i < headInserts; i++) {
          churnedNodes.push(h('div', { id: `new_head_${i}`, key: `new_head_k_${i}` }, `New Head ${i}`));
        }

        // 2. Add half of retained nodes (reversed)
        const halfRetained = Math.floor(retained.length / 2);
        for (let i = halfRetained - 1; i >= 0; i--) {
          churnedNodes.push(retained[i]);
        }

        // 3. Insert 1/3 of new nodes in middle
        const midInserts = Math.floor(insertCount / 3);
        for (let i = 0; i < midInserts; i++) {
          churnedNodes.push(h('div', { id: `new_mid_${i}`, key: `new_mid_k_${i}` }, `New Mid ${i}`));
        }

        // 4. Add remaining retained nodes
        for (let i = halfRetained; i < retained.length; i++) {
          churnedNodes.push(retained[i]);
        }

        // 5. Insert remainder of new nodes at tail
        const tailInserts = insertCount - headInserts - midInserts;
        for (let i = 0; i < tailInserts; i++) {
          churnedNodes.push(h('div', { id: `new_tail_${i}`, key: `new_tail_k_${i}` }, `New Tail ${i}`));
        }

        const expectedIds = churnedNodes.map((n) => n.props?.id as string);
        const expectedTotalCount = churnedNodes.length;

        const churnedTree = h('div', { id: `churn_root_${N}` }, churnedNodes);
        const patches = diff(initialTree, churnedTree);
        renderer.executePatches(patches);

        assert.strictEqual(
          renderedRoot.childNodes.length,
          expectedTotalCount,
          `Churned render must have exact count ${expectedTotalCount}`
        );
        assert.deepStrictEqual(
          renderedRoot.childNodes.map((c: any) => c.id),
          expectedIds,
          `DOM child node IDs must match expected churned order`
        );

        const uniqueSet = new Set(renderedRoot.childNodes);
        assert.strictEqual(uniqueSet.size, expectedTotalCount, 'All nodes in churned DOM must be distinct');
      });

      it(`1.4 [Scale N=${N}]: Cyclic rotation shift across multiple sequential patch applications`, () => {
        let currentNodes = Array.from({ length: N }, (_, i) =>
          h('div', { id: `rot_${i}`, key: `rot_k_${i}` }, `Rot ${i}`)
        );
        let currentTree = h('div', { id: `rot_root_${N}` }, currentNodes);
        renderer.executePatches(diff(null, currentTree));
        const renderedRoot = container.childNodes[0];

        // Perform 5 successive rotations by 1 position (pop tail and unshift to head)
        const cycles = 5;
        for (let c = 1; c <= cycles; c++) {
          const nextNodes: VNode[] = [
            currentNodes[currentNodes.length - 1],
            ...currentNodes.slice(0, currentNodes.length - 1),
          ];
          const nextTree = h('div', { id: `rot_root_${N}` }, nextNodes);

          const patches = diff(currentTree, nextTree);
          renderer.executePatches(patches);

          assert.strictEqual(
            renderedRoot.childNodes.length,
            N,
            `Cycle ${c}: child count must remain strictly ${N}`
          );
          const expectedIds = nextNodes.map((n) => n.props?.id as string);
          assert.deepStrictEqual(
            renderedRoot.childNodes.map((child: any) => child.id),
            expectedIds,
            `Cycle ${c}: DOM node order must match rotation`
          );

          currentNodes = nextNodes;
          currentTree = nextTree;
        }
      });
    }
  });

  // =========================================================================
  // 2. SANDBOX ESCAPE ATTACK RESISTANCE & STRICT MODE AUDIT
  // =========================================================================
  describe('2. Sandbox Escape Attack Resistance & Strict Mode Audit', () => {
    let container: AppServiceWorkerContainer;
    let pair: InMemoryMessagePortPair;
    let ipc: IpcChannel;

    beforeEach(() => {
      pair = new InMemoryMessagePortPair();
      ipc = new IpcChannel('appservice', pair.port1);
      container = new AppServiceWorkerContainer('audit-sandbox-app', ipc);
      container.launch();
    });

    it('2.1: Strict mode is active and "this" is strictly undefined across all function styles', () => {
      const script = `
        const topThis = this;
        const arrowThis = (() => this)();
        function standardFunction() {
          return this;
        }
        const obj = {
          method() {
            return this;
          },
          detached() {
            const f = this.method;
            return f();
          }
        };

        return {
          topThis: topThis,
          topThisType: typeof topThis,
          arrowThis: arrowThis,
          arrowThisType: typeof arrowThis,
          standardThis: standardFunction(),
          standardThisType: typeof standardFunction(),
          detachedThis: obj.detached(),
          detachedThisType: typeof obj.detached(),
        };
      `;

      const result = container.evaluateScript(script) as Record<string, unknown>;

      assert.strictEqual(result.topThis, undefined, 'Top-level "this" MUST be strictly undefined');
      assert.strictEqual(result.topThisType, 'undefined');
      assert.strictEqual(result.arrowThis, undefined, 'Arrow function "this" MUST be strictly undefined');
      assert.strictEqual(result.arrowThisType, 'undefined');
      assert.strictEqual(result.standardThis, undefined, 'Standard function "this" MUST be strictly undefined');
      assert.strictEqual(result.standardThisType, 'undefined');
      assert.strictEqual(result.detachedThis, undefined, 'Detached method "this" MUST be strictly undefined');
      assert.strictEqual(result.detachedThisType, 'undefined');
    });

    it('2.2: Strict mode prevents silent global variable creation via undeclared assignment', () => {
      const script = `
        let caughtError = null;
        try {
          // In strict mode, assigning to undeclared variable throws ReferenceError
          eval('undeclaredGlobalLeakVar = "attack_payload";');
        } catch (e) {
          caughtError = { name: e.name, message: e.message };
        }
        return caughtError;
      `;

      const result = container.evaluateScript(script) as { name: string; message: string } | null;
      assert.ok(result !== null, 'Assignment to undeclared variable must throw an Error');
      assert.strictEqual(result?.name, 'ReferenceError', 'Must throw ReferenceError in strict mode');
      assert.strictEqual((globalThis as any).undeclaredGlobalLeakVar, undefined);
    });

    it('2.3: Cannot breakout of sandbox via constructor chaining (this.constructor, Object, Function)', () => {
      const script = `
        const exploits = {
          thisConstructor: false,
          arrowConstructor: false,
          argumentsCallee: false,
        };

        // Exploit 1: this.constructor
        try {
          const res = (this).constructor('return globalThis')();
          exploits.thisConstructor = !!res;
        } catch (e) {
          exploits.thisConstructor = false;
        }

        // Exploit 2: Function constructor from arrow function
        try {
          const fn = (() => this)();
          const res = fn.constructor('return globalThis')();
          exploits.arrowConstructor = !!res;
        } catch (e) {
          exploits.arrowConstructor = false;
        }

        // Exploit 3: arguments.callee / arguments.caller
        try {
          function testArgs() {
            return arguments.callee;
          }
          testArgs();
          exploits.argumentsCallee = true;
        } catch (e) {
          // In strict mode, accessing arguments.callee throws TypeError
          exploits.argumentsCallee = false;
        }

        return exploits;
      `;

      const result = container.evaluateScript(script) as Record<string, boolean>;
      assert.strictEqual(result.thisConstructor, false, 'this.constructor exploit must fail');
      assert.strictEqual(result.arrowConstructor, false, 'arrow function this exploit must fail');
      assert.strictEqual(result.argumentsCallee, false, 'arguments.callee must throw TypeError in strict mode');
    });

    it('2.4: GoatBridge proxy strictly hides ipc, rpcTable, and internal state', () => {
      const script = `
        return {
          keys: Object.keys(GoatBridge).sort(),
          ipc: GoatBridge.ipc,
          ipcType: typeof GoatBridge.ipc,
          rpcTable: GoatBridge.rpcTable,
          rpcTableType: typeof GoatBridge.rpcTable,
          callCounter: GoatBridge.callCounter,
          eventListeners: GoatBridge.eventListeners,
          bridgeClient: GoatBridge.bridge,
          rawClient: GoatBridge._client,
        };
      `;

      const result = container.evaluateScript(script) as Record<string, unknown>;

      assert.deepStrictEqual(
        result.keys,
        ['call', 'callNative', 'emit', 'off', 'on'],
        'GoatBridge must expose strictly { call, callNative, emit, off, on }'
      );
      assert.strictEqual(result.ipc, undefined, 'GoatBridge.ipc must be undefined');
      assert.strictEqual(result.ipcType, 'undefined');
      assert.strictEqual(result.rpcTable, undefined, 'GoatBridge.rpcTable must be undefined');
      assert.strictEqual(result.rpcTableType, 'undefined');
      assert.strictEqual(result.callCounter, undefined);
      assert.strictEqual(result.eventListeners, undefined);
      assert.strictEqual(result.bridgeClient, undefined);
      assert.strictEqual(result.rawClient, undefined);
    });

    it('2.5: Host DOM and Storage objects remain strictly undefined in sandbox scope', () => {
      const script = `
        return {
          window: typeof window,
          document: typeof document,
          HTMLElement: typeof HTMLElement,
          localStorage: typeof localStorage,
          indexedDB: typeof indexedDB,
          sessionStorage: typeof sessionStorage,
        };
      `;

      const result = container.evaluateScript(script) as Record<string, string>;
      assert.strictEqual(result.window, 'undefined');
      assert.strictEqual(result.document, 'undefined');
      assert.strictEqual(result.HTMLElement, 'undefined');
      assert.strictEqual(result.localStorage, 'undefined');
      assert.strictEqual(result.indexedDB, 'undefined');
    });
  });

  // =========================================================================
  // 3. LIFECYCLE FSM ILLEGAL TRANSITIONS & RECOVERY STRESS
  // =========================================================================
  describe('3. Lifecycle FSM Illegal Transitions & Recovery', () => {
    let fsm: MiniAppLifecycleFSM;
    let pair: InMemoryMessagePortPair;
    let ipc: IpcChannel;
    let emittedSignals: any[] = [];

    beforeEach(() => {
      pair = new InMemoryMessagePortPair();
      ipc = new IpcChannel('appservice', pair.port1);
      emittedSignals = [];
      fsm = new MiniAppLifecycleFSM('fsm-stress-app', ipc);

      pair.port2.onMessage((e: any) => {
        if (e.data?.type === 'LIFECYCLE') {
          emittedSignals.push(e.data.payload);
        }
      });
    });

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

    it('3.1: Rejects all illegal transitions in every state while preserving current state and IPC integrity', () => {
      // 1. UNINITIALIZED state illegal events
      const validFromUninit = new Set<LifecycleEventName>([
        'INIT',
        'LAUNCH_SUCCESS',
        'onAppServiceReady',
        'FATAL_ERROR',
        'LAUNCH_FAILURE',
        'onAppServiceCrash',
        'TERMINATE',
        'onAppServiceTerminate',
      ]);
      for (const ev of allEvents) {
        if (!validFromUninit.has(ev)) {
          assert.strictEqual(fsm.canTransition(ev), false);
          assert.throws(() => fsm.transition(ev), /Invalid state transition/);
          assert.strictEqual(fsm.getState(), 'UNINITIALIZED');
        }
      }

      // Transition to LAUNCHING
      fsm.transition('INIT');
      assert.strictEqual(fsm.getState(), 'LAUNCHING');

      // 2. LAUNCHING state illegal events
      const validFromLaunching = new Set<LifecycleEventName>([
        'LAUNCH_SUCCESS',
        'onAppServiceReady',
        'LAUNCH_FAILURE',
        'FATAL_ERROR',
        'onAppServiceCrash',
        'TERMINATE',
        'onAppServiceTerminate',
      ]);
      for (const ev of allEvents) {
        if (!validFromLaunching.has(ev)) {
          assert.strictEqual(fsm.canTransition(ev), false);
          assert.throws(() => fsm.transition(ev), /Invalid state transition/);
          assert.strictEqual(fsm.getState(), 'LAUNCHING');
        }
      }

      // Transition to RUNNING
      fsm.transition('LAUNCH_SUCCESS');
      assert.strictEqual(fsm.getState(), 'RUNNING');

      // 3. RUNNING state illegal events
      const validFromRunning = new Set<LifecycleEventName>([
        'SUSPEND',
        'onAppServiceSuspend',
        'TERMINATE',
        'onAppServiceTerminate',
        'FATAL_ERROR',
        'LAUNCH_FAILURE',
        'onAppServiceCrash',
      ]);
      for (const ev of allEvents) {
        if (!validFromRunning.has(ev)) {
          assert.strictEqual(fsm.canTransition(ev), false);
          assert.throws(() => fsm.transition(ev), /Invalid state transition/);
          assert.strictEqual(fsm.getState(), 'RUNNING');
        }
      }

      // Transition to SUSPENDED
      fsm.transition('SUSPEND');
      assert.strictEqual(fsm.getState(), 'SUSPENDED');

      // 4. SUSPENDED state illegal events
      const validFromSuspended = new Set<LifecycleEventName>([
        'RESUME',
        'onAppServiceResume',
        'TERMINATE',
        'onAppServiceTerminate',
        'FATAL_ERROR',
        'onAppServiceCrash',
      ]);
      for (const ev of allEvents) {
        if (!validFromSuspended.has(ev)) {
          assert.strictEqual(fsm.canTransition(ev), false);
          assert.throws(() => fsm.transition(ev), /Invalid state transition/);
          assert.strictEqual(fsm.getState(), 'SUSPENDED');
        }
      }

      // Transition to CRASHED from SUSPENDED
      fsm.transition('FATAL_ERROR');
      assert.strictEqual(fsm.getState(), 'CRASHED');

      // 5. CRASHED state illegal events (only TERMINATE allowed)
      const validFromCrashed = new Set<LifecycleEventName>([
        'TERMINATE',
        'onAppServiceTerminate',
      ]);
      for (const ev of allEvents) {
        if (!validFromCrashed.has(ev)) {
          assert.strictEqual(fsm.canTransition(ev), false);
          assert.throws(() => fsm.transition(ev), /Invalid state transition/);
          assert.strictEqual(fsm.getState(), 'CRASHED');
        }
      }

      // Transition to TERMINATED
      fsm.transition('TERMINATE');
      assert.strictEqual(fsm.getState(), 'TERMINATED');

      // 6. TERMINATED state: ALL events are illegal
      for (const ev of allEvents) {
        assert.strictEqual(fsm.canTransition(ev), false);
        assert.throws(() => fsm.transition(ev), /Invalid state transition/);
        assert.strictEqual(fsm.getState(), 'TERMINATED');
      }
    });

    it('3.2: FSM reset cleanly restores UNINITIALIZED state and permits fresh re-launch lifecycle', () => {
      // Advance to RUNNING
      fsm.transition('INIT');
      fsm.transition('LAUNCH_SUCCESS');
      assert.strictEqual(fsm.getState(), 'RUNNING');

      // Crash the app
      fsm.transition('FATAL_ERROR', { error: 'Simulated memory crash' });
      assert.strictEqual(fsm.getState(), 'CRASHED');

      // Reset the FSM
      fsm.reset();
      assert.strictEqual(fsm.getState(), 'UNINITIALIZED');

      // Register new observer
      let newLifecycleReceived = false;
      fsm.onStateChange((payload) => {
        if (payload.toState === 'RUNNING') {
          newLifecycleReceived = true;
        }
      });

      // Relaunch
      fsm.transition('INIT');
      assert.strictEqual(fsm.getState(), 'LAUNCHING');
      fsm.transition('LAUNCH_SUCCESS');
      assert.strictEqual(fsm.getState(), 'RUNNING');
      assert.strictEqual(newLifecycleReceived, true);
    });

    it('3.3: Rapid concurrent transition hammering does not corrupt state machine or throw unhandled exceptions', () => {
      const churnFsm = new MiniAppLifecycleFSM('churn-app');

      // Rapidly attempt valid and invalid transitions in randomized sequence
      const sequence: LifecycleEventName[] = [
        'INIT',
        'INIT', // invalid
        'LAUNCH_SUCCESS',
        'LAUNCH_SUCCESS', // invalid
        'SUSPEND',
        'SUSPEND', // invalid
        'RESUME',
        'FATAL_ERROR',
        'RESUME', // invalid from crashed
        'TERMINATE',
        'INIT', // invalid from terminated
      ];

      for (const ev of sequence) {
        if (churnFsm.canTransition(ev)) {
          assert.doesNotThrow(() => churnFsm.transition(ev));
        } else {
          assert.throws(() => churnFsm.transition(ev), /Invalid state transition/);
        }
      }

      assert.strictEqual(churnFsm.getState(), 'TERMINATED');
    });
  });
});
