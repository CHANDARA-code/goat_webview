# @goat/appservice

> Next-Gen Dual-Thread Mini-App Engine Worker Container & AppView DOM Renderer for Goat WebView.

`@goat/appservice` provides an isolated, zero-jank dual-thread mini-app architecture modeled after WeChat's AppService/AppView and Skyline renderers.

## Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AppService (Worker Context)                     │
│  - Mini-App JS Business Logic (Page / Component logic, this.setData)    │
│  - Virtual DOM Diffing Engine (Generates Patch Operations)             │
│  - Sandboxed GoatBridge Proxy (GoatBridge.call / callNative)          │
│  - Mini-App Lifecycle State Machine (LAUNCH, SUSPEND, RESUME, TERM)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Bidirectional IPC Channel
                                    │ (BRIDGE_CALL, UI_PATCH, LIFECYCLE)
                                    │ 16.6ms Frame-Aligned Batching
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         AppView (Render Context / DOM)                 │
│  - DOM Patch Renderer (Applies VDOM Patches to Real DOM via rAF)       │
│  - User Event Interceptor (Dispatches UI_EVENT to AppService)          │
│  - Native Bridge Forwarder (Routes BRIDGE_CALL to Native Host)         │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌──────────────────────────────────────┐ ┌───────────────────────────────┐
│   Native Host Dispatchers            │ │  DevTools & Observability     │
│  - Android: GoatBridgeActionHandler  │ │  - @goat/server CDP Relay     │
│  - iOS: GoatScriptMessageHandler     │ │  - docs-site/ IPC Inspector   │
│  - Flutter, RN, Compose Host Signals │ │  - packages/bridge-mock Sim   │
└──────────────────────────────────────┘ └───────────────────────────────┘
```

## Subsystems

1. **Sandboxed Worker Container (`src/worker/`)**: Executes mini-app JS bundles in an isolated Worker scope with zero direct DOM access (`window`, `document`, and `HTMLElement` stripped). Handles runtime exceptions via `WorkerErrorBoundary`.
2. **Bridge Proxy & Interception (`src/bridge/`)**: Intercepts `GoatBridge.call(action, payload)` and `callNative(action, payload)` in the Worker thread, generates monotonic `callId`s, tracks promises in `RpcPromiseTable` with configurable timeouts, and sends `BRIDGE_CALL` frames across IPC.
3. **Mini-App Lifecycle FSM (`src/lifecycle/`)**: Finite state machine managing `UNINITIALIZED`, `LAUNCHING`, `RUNNING`, `SUSPENDED`, `TERMINATED`, and `CRASHED` states and broadcasting host signals (`onAppServiceReady`, `onAppServiceCrash`, `onAppServiceTerminate`).
4. **Virtual DOM Diffing Engine (`src/vdom/`)**: `h()` hyperscript factory, structured VNode trees, and a recursive keyed reconciliation engine generating `CREATE`, `REMOVE`, `REPLACE`, `UPDATE_PROPS`, `SET_TEXT`, and `REORDER` patches.
5. **Thread-to-Thread IPC & Batching (`src/ipc/`)**: Message framing with monotonic sequence IDs (`seq`), structured clone/JSON serialization, and `FrameBatcher` with 16.6ms frame alignment and immediate RPC bypass (<5ms warm latency).
6. **AppView DOM Patch Renderer (`src/renderer/`)**: Applies VDOM patches to real DOM nodes, delegates UI event listeners (`click`, `input`, `touch`), and forwards `BRIDGE_CALL` frames to native hosts.
7. **Hermetic Simulation (`src/simulation/`)**: `InMemoryMessagePortPair`, `MockBridgeTransport`, and `DualThreadTestEnvironment` for deterministic testing without browser or native dependencies.

## Usage

```typescript
import {
  AppServiceWorkerContainer,
  AppViewDomRenderer,
  IpcChannel,
  InMemoryMessagePortPair,
  h,
} from '@goat/appservice';

// 1. Create Bidirectional IPC Transport
const pair = new InMemoryMessagePortPair();
const workerIpc = new IpcChannel('appservice', pair.port1);
const renderIpc = new IpcChannel('appview', pair.port2);

// 2. Instantiate Worker Container and DOM Renderer
const worker = new AppServiceWorkerContainer('mini_app_1', workerIpc);
const renderer = new AppViewDomRenderer(document.getElementById('app'), renderIpc);

// 3. Launch App and Evaluate Logic
worker.launch();
worker.loadBundle(`
  App({
    onLaunch() {
      console.log('Mini-App launched!');
    }
  });
  Page({
    onTap() {
      GoatBridge.call('storage.set', { key: 'visited', value: true });
    }
  });
`);
```

## Verification & Scripts

```bash
# Build TypeScript to dist/
npm run build

# Run unit tests & multi-tier E2E suites
npm test

# Run warm-path round-trip latency benchmark (<5.0ms quality gate)
npm run benchmark
```

## License

MIT
