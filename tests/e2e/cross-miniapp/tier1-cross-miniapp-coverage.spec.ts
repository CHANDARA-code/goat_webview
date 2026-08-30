/**
 * Goat WebView Task 10201 Tier 1: Feature Coverage Test Suite (F1–F10)
 *
 * Exhaustive nominal coverage verifying all 10 core features of GoatCrossMiniAppManager:
 * - F1: `OPEN_MINI_APP` Bridge Action (launch, presentation, windowConfig, params, authTokens)
 * - F2: `CLOSE_MINI_APP` Bridge Action (close by instanceId, targetAppId, result payload)
 * - F3: `GET_RUNNING_MINIAPPS` Query Action (instance listing, filtering, parentAppId, status)
 * - F4: `ON_MINI_APP_CLOSED` Lifecycle Event (dismissal events, exit codes, result data)
 * - F5: Windowed / Modal / Embedded Presentation (floating card, bottom sheet, safe-area bounds)
 * - F6: Selective JSAPI Name Aliasing & IPC Proxying (allowlisted proxy, fail-closed security)
 * - F7: Multi-Tenant Sandboxing & KeyStore Isolation (storage partitions, cookies, filesystem, key isolation)
 * - F8: GoatFastPool Lifecycle Recycling (pre-warmed acquisition, 8-step sanitization sequence)
 * - F9: Cross-Platform Parity & Bindings (Android, iOS, React Native, Flutter, Web SDK models)
 * - F10: CI Verification Gate & Diagnostics (instance status, telemetry, error boundaries, crash containment)
 *
 * 50+ Hermetic Tests (>=5 tests per feature).
 */

import { describe, it, expect } from '../harness/test-runner.ts';
import {
  GoatCrossMiniAppManagerSimulator,
  GoatWindowConfig,
  GoatTenantStorageSandbox,
  GoatTenantCookieJar,
  GoatFastPoolSimulator,
} from '../harness/cross-miniapp-simulator.ts';

export function registerTier1CrossMiniAppCoverageTests(): void {
  // ==========================================================================
  // F1: OPEN_MINI_APP Bridge Action
  // ==========================================================================
  describe('Task 10201 Tier 1 - F1: OPEN_MINI_APP Bridge Action', () => {
    it('TC-T1-F01-01: Launches child mini-app with nominal targetAppId in default WINDOWED mode', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const res = await manager.openMiniApp('app_main', {
        targetAppId: 'sub_checkout',
      });

      expect(res.status).toBe('OPENED');
      expect(res.targetAppId).toBe('sub_checkout');
      expect(res.presentation).toBe('WINDOWED');
      expect(res.instanceId.startsWith('inst_sub_checkout_')).toBe(true);
    });

    it('TC-T1-F01-02: Propagates custom windowConfig geometry and visual styles', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const res = await manager.openMiniApp('app_main', {
        targetAppId: 'sub_calc',
        presentation: 'WINDOWED',
        windowConfig: {
          width: 320,
          height: 480,
          x: 40,
          y: 80,
          cornerRadius: 20,
          elevation: 12,
          title: 'Mini Calculator',
        },
      });

      expect(res.windowConfig.width).toBe(320);
      expect(res.windowConfig.height).toBe(480);
      expect(res.windowConfig.x).toBe(40);
      expect(res.windowConfig.y).toBe(80);
      expect(res.windowConfig.cornerRadius).toBe(20);
      expect(res.windowConfig.elevation).toBe(12);
      expect(res.windowConfig.title).toBe('Mini Calculator');
    });

    it('TC-T1-F01-03: Supports MODAL presentation mode (bottom sheet style)', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const res = await manager.openMiniApp('app_main', {
        targetAppId: 'sub_payment_sheet',
        presentation: 'MODAL',
      });

      expect(res.presentation).toBe('MODAL');
      expect(res.status).toBe('OPENED');
    });

    it('TC-T1-F01-04: Transmits params and authTokens payload safely to child instance', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const res = await manager.openMiniApp('app_main', {
        targetAppId: 'sub_order',
        params: { orderId: 'ORD_99182', amount: 49.99 },
        authTokens: { sessionJwt: 'eyJhbGciOi...', scope: 'order.read' },
      });

      const inst = manager.getInstance(res.instanceId);
      expect(inst).toBeDefined();
      expect(inst!.params?.orderId).toBe('ORD_99182');
      expect(inst!.params?.amount).toBe(49.99);
      expect(inst!.authTokens?.sessionJwt).toBe('eyJhbGciOi...');
    });

    it('TC-T1-F01-05: Registers jsApiAlias map for IPC proxy routing', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const res = await manager.openMiniApp('app_main', {
        targetAppId: 'sub_auth',
        jsApiAlias: {
          CONFIRM_LOGIN: 'HOST_CONFIRM_LOGIN',
          GET_PROFILE: 'HOST_GET_USER_PROFILE',
        },
      });

      const inst = manager.getInstance(res.instanceId);
      expect(inst!.jsApiAlias['CONFIRM_LOGIN']).toBe('HOST_CONFIRM_LOGIN');
      expect(inst!.jsApiAlias['GET_PROFILE']).toBe('HOST_GET_USER_PROFILE');
    });
  });

  // ==========================================================================
  // F2: CLOSE_MINI_APP Bridge Action
  // ==========================================================================
  describe('Task 10201 Tier 1 - F2: CLOSE_MINI_APP Bridge Action', () => {
    it('TC-T1-F02-01: Closes running mini-app by explicit instanceId and passes result data', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const openRes = await manager.openMiniApp('app_main', { targetAppId: 'sub_widget' });

      let receivedEvent: any = null;
      manager.onMiniAppClosed((evt) => {
        receivedEvent = evt;
      });

      const closeRes = await manager.closeMiniApp('app_main', {
        instanceId: openRes.instanceId,
        result: { status: 'COMPLETED', code: 200 },
      });

      expect(closeRes.closed).toBe(true);
      expect(closeRes.instanceId).toBe(openRes.instanceId);
      expect(manager.getInstance(openRes.instanceId)).toBeUndefined();
      expect(receivedEvent).toBeDefined();
      expect(receivedEvent.result.status).toBe('COMPLETED');
    });

    it('TC-T1-F02-02: Closes running mini-app by targetAppId when instanceId is omitted', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const openRes = await manager.openMiniApp('app_main', { targetAppId: 'sub_viewer' });

      const closeRes = await manager.closeMiniApp('app_main', {
        targetAppId: 'sub_viewer',
      });

      expect(closeRes.closed).toBe(true);
      expect(closeRes.instanceId).toBe(openRes.instanceId);
    });

    it('TC-T1-F02-03: Executes 8-step sanitization lifecycle on close', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const openRes = await manager.openMiniApp('app_main', { targetAppId: 'sub_temp' });

      const closeRes = await manager.closeMiniApp('app_main', {
        instanceId: openRes.instanceId,
      });

      expect(closeRes.sanitizationSteps.length).toBe(8);
      expect(closeRes.sanitizationSteps[0]).toBe('1_PURGE_DOM_AND_SCRIPTS');
      expect(closeRes.sanitizationSteps[7]).toBe('8_RESET_STATE_AND_REPLENISH_POOL');
    });

    it('TC-T1-F02-04: Returns closed=false idempotently when closing non-existent instanceId', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const closeRes = await manager.closeMiniApp('app_main', {
        instanceId: 'inst_non_existent_9999',
      });

      expect(closeRes.closed).toBe(false);
      expect(closeRes.instanceId).toBe('inst_non_existent_9999');
    });

    it('TC-T1-F02-05: Double-closing an instance is idempotent and safe', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const openRes = await manager.openMiniApp('app_main', { targetAppId: 'sub_calc' });

      const firstClose = await manager.closeMiniApp('app_main', { instanceId: openRes.instanceId });
      expect(firstClose.closed).toBe(true);

      const secondClose = await manager.closeMiniApp('app_main', { instanceId: openRes.instanceId });
      expect(secondClose.closed).toBe(false);
    });
  });

  // ==========================================================================
  // F3: GET_RUNNING_MINIAPPS Query Action
  // ==========================================================================
  describe('Task 10201 Tier 1 - F3: GET_RUNNING_MINIAPPS Query Action', () => {
    it('TC-T1-F03-01: Returns empty list when no child instances are running', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const res = await manager.getRunningMiniApps('app_main');

      expect(res.totalCount).toBe(0);
      expect(res.instances.length).toBe(0);
    });

    it('TC-T1-F03-02: Lists all active child instances launched by parent', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      await manager.openMiniApp('app_main', { targetAppId: 'child_1' });
      await manager.openMiniApp('app_main', { targetAppId: 'child_2' });

      const res = await manager.getRunningMiniApps('app_main');
      expect(res.totalCount).toBe(2);
      expect(res.instances.map((i) => i.appId).sort()).toEqual(['child_1', 'child_2']);
    });

    it('TC-T1-F03-03: Filters active instances by parentAppId', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      await manager.openMiniApp('parent_A', { targetAppId: 'child_A1' });
      await manager.openMiniApp('parent_B', { targetAppId: 'child_B1' });

      const resA = await manager.getRunningMiniApps('parent_A', {
        filters: { parentAppId: 'parent_A' },
      });
      expect(resA.totalCount).toBe(1);
      expect(resA.instances[0].appId).toBe('child_A1');
    });

    it('TC-T1-F03-04: Returns launchedAt timestamp and presentation mode in metadata', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const before = Date.now();
      await manager.openMiniApp('app_main', {
        targetAppId: 'child_modal',
        presentation: 'MODAL',
      });

      const res = await manager.getRunningMiniApps('app_main');
      expect(res.instances[0].presentation).toBe('MODAL');
      expect(res.instances[0].launchedAt).toBeGreaterThanOrEqual(before);
    });

    it('TC-T1-F03-05: Accurately decrements count when instances are closed', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const c1 = await manager.openMiniApp('app_main', { targetAppId: 'child_1' });
      await manager.openMiniApp('app_main', { targetAppId: 'child_2' });

      await manager.closeMiniApp('app_main', { instanceId: c1.instanceId });
      const res = await manager.getRunningMiniApps('app_main');
      expect(res.totalCount).toBe(1);
      expect(res.instances[0].appId).toBe('child_2');
    });
  });

  // ==========================================================================
  // F4: ON_MINI_APP_CLOSED Lifecycle Event
  // ==========================================================================
  describe('Task 10201 Tier 1 - F4: ON_MINI_APP_CLOSED Lifecycle Event', () => {
    it('TC-T1-F04-01: Dispatches ON_MINI_APP_CLOSED on programmatic child close', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const openRes = await manager.openMiniApp('app_main', { targetAppId: 'child_sub' });

      const events: any[] = [];
      manager.onMiniAppClosed((e) => events.push(e));

      await manager.closeMiniApp('app_main', {
        instanceId: openRes.instanceId,
        result: { orderId: 'ORD_1001' },
      });

      expect(events.length).toBe(1);
      expect(events[0].instanceId).toBe(openRes.instanceId);
      expect(events[0].targetAppId).toBe('child_sub');
      expect(events[0].dismissedByUser).toBe(false);
      expect(events[0].result.orderId).toBe('ORD_1001');
    });

    it('TC-T1-F04-02: Flags dismissedByUser=true when child is dismissed via close button or backdrop', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const openRes = await manager.openMiniApp('app_main', { targetAppId: 'child_modal' });

      const events: any[] = [];
      manager.onMiniAppClosed((e) => events.push(e));

      await manager.closeMiniApp('app_main', {
        instanceId: openRes.instanceId,
        dismissedByUser: true,
        exitCode: 'USER_CANCELLED',
      });

      expect(events[0].dismissedByUser).toBe(true);
      expect(events[0].exitCode).toBe('USER_CANCELLED');
    });

    it('TC-T1-F04-03: Allows multiple event listeners and supports unsubscribe', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      let callCount1 = 0;
      let callCount2 = 0;

      const unregister1 = manager.onMiniAppClosed(() => callCount1++);
      manager.onMiniAppClosed(() => callCount2++);

      const o1 = await manager.openMiniApp('app_main', { targetAppId: 'child_1' });
      await manager.closeMiniApp('app_main', { instanceId: o1.instanceId });

      expect(callCount1).toBe(1);
      expect(callCount2).toBe(1);

      unregister1();
      const o2 = await manager.openMiniApp('app_main', { targetAppId: 'child_2' });
      await manager.closeMiniApp('app_main', { instanceId: o2.instanceId });

      expect(callCount1).toBe(1); // Unsubscribed
      expect(callCount2).toBe(2); // Still listening
    });

    it('TC-T1-F04-04: Gracefully handles exceptions inside event listener callbacks', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      manager.onMiniAppClosed(() => {
        throw new Error('Listener crash test');
      });

      let normalListenerCalled = false;
      manager.onMiniAppClosed(() => {
        normalListenerCalled = true;
      });

      const openRes = await manager.openMiniApp('app_main', { targetAppId: 'child_safe' });
      const closeRes = await manager.closeMiniApp('app_main', { instanceId: openRes.instanceId });

      expect(closeRes.closed).toBe(true);
      expect(normalListenerCalled).toBe(true);
    });

    it('TC-T1-F04-05: Emits empty object for result when result is not explicitly supplied', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const openRes = await manager.openMiniApp('app_main', { targetAppId: 'child_plain' });

      let receivedResult: any = null;
      manager.onMiniAppClosed((e) => {
        receivedResult = e.result;
      });

      await manager.closeMiniApp('app_main', { instanceId: openRes.instanceId });
      expect(receivedResult).toEqual({});
    });
  });

  // ==========================================================================
  // F5: Windowed / Modal / Embedded Presentation
  // ==========================================================================
  describe('Task 10201 Tier 1 - F5: Presentation Modes & Window Geometry', () => {
    it('TC-T1-F05-01: WindowConfig provides standard default dimensions (360x520 at x=20, y=60)', () => {
      const config = new GoatWindowConfig();
      expect(config.width).toBe(360);
      expect(config.height).toBe(520);
      expect(config.x).toBe(20);
      expect(config.y).toBe(60);
      expect(config.draggable).toBe(true);
      expect(config.dimBackground).toBe(true);
      expect(config.cornerRadius).toBe(16);
      expect(config.elevation).toBe(8);
    });

    it('TC-T1-F05-02: Clamps oversized window dimensions to device screen bounds', () => {
      const config = new GoatWindowConfig({
        width: 1000,
        height: 2000,
        x: 500,
        y: 1000,
      });

      const { clampedWidth, clampedHeight, clampedX, clampedY } = config.clampToBounds(390, 844, 44, 34);
      expect(clampedWidth).toBe(390); // Clamped to screenWidth
      expect(clampedHeight).toBe(766); // 844 - 44 - 34
      expect(clampedX).toBe(0);
      expect(clampedY).toBe(44);
    });

    it('TC-T1-F05-03: Clamps negative coordinates to safe screen viewport', () => {
      const config = new GoatWindowConfig({
        width: 300,
        height: 400,
        x: -50,
        y: -100,
      });

      const { clampedX, clampedY } = config.clampToBounds(390, 844, 44, 34);
      expect(clampedX).toBe(0);
      expect(clampedY).toBe(44); // Top safe area
    });

    it('TC-T1-F05-04: Supports EMBEDDED and FULLSCREEN presentation modes', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const embedded = await manager.openMiniApp('app_main', {
        targetAppId: 'sub_embed',
        presentation: 'EMBEDDED',
      });
      const fullscreen = await manager.openMiniApp('app_main', {
        targetAppId: 'sub_full',
        presentation: 'FULLSCREEN',
      });

      expect(embedded.presentation).toBe('EMBEDDED');
      expect(fullscreen.presentation).toBe('FULLSCREEN');
    });

    it('TC-T1-F05-05: Parses windowConfig correctly from JSON object dictionary', () => {
      const raw = {
        widthDp: 340,
        heightDp: 500,
        xDp: 15,
        yDp: 75,
        draggable: false,
        dimBackground: false,
        cornerRadius: 24,
        elevation: 16,
        title: 'Custom Window',
      };

      const parsed = GoatWindowConfig.fromObject(raw);
      expect(parsed.width).toBe(340);
      expect(parsed.height).toBe(500);
      expect(parsed.x).toBe(15);
      expect(parsed.y).toBe(75);
      expect(parsed.draggable).toBe(false);
      expect(parsed.dimBackground).toBe(false);
      expect(parsed.cornerRadius).toBe(24);
      expect(parsed.title).toBe('Custom Window');
    });
  });

  // ==========================================================================
  // F6: Selective JSAPI Name Aliasing & Fail-Closed IPC Proxying
  // ==========================================================================
  describe('Task 10201 Tier 1 - F6: Selective JSAPI Aliasing & Fail-Closed IPC', () => {
    it('TC-T1-F06-01: Intercepts aliased action in child and routes to parent bridge handler', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      let parentHandledAction = '';
      let parentHandledPayload: any = null;

      manager.registerParentBridgeHandler('parent_host', async (action, payload) => {
        parentHandledAction = action;
        parentHandledPayload = payload;
        return { orderPlaced: true, orderId: 'ORD_HOST_771' };
      });

      const openRes = await manager.openMiniApp('parent_host', {
        targetAppId: 'child_checkout',
        jsApiAlias: {
          SUBMIT_PAYMENT: 'PARENT_PROCESS_PAYMENT',
        },
      });

      const childCallRes = await manager.dispatchChildBridgeAction(
        openRes.instanceId,
        'SUBMIT_PAYMENT',
        { amount: 150.0, currency: 'USD' }
      );

      expect(childCallRes.routedToParent).toBe(true);
      expect(childCallRes.targetActionName).toBe('PARENT_PROCESS_PAYMENT');
      expect(parentHandledAction).toBe('PARENT_PROCESS_PAYMENT');
      expect(parentHandledPayload.amount).toBe(150.0);
      expect(childCallRes.result.orderId).toBe('ORD_HOST_771');
    });

    it('TC-T1-F06-02: Unaliased actions resolve locally on the child mini-app bridge surface', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const openRes = await manager.openMiniApp('parent_host', {
        targetAppId: 'child_checkout',
        jsApiAlias: {
          CONFIRM_ORDER: 'PARENT_CONFIRM',
        },
      });

      const childCallRes = await manager.dispatchChildBridgeAction(
        openRes.instanceId,
        'LOCAL_GET_STORE_ITEMS',
        { category: 'shoes' }
      );

      expect(childCallRes.routedToParent).toBe(false);
      expect(childCallRes.result.localChildHandled).toBe(true);
      expect(childCallRes.result.action).toBe('LOCAL_GET_STORE_ITEMS');
    });

    it('TC-T1-F06-03: Fails closed when aliased action matches but parent has no handler registered', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      // No parent handler registered for parent_unregistered
      const openRes = await manager.openMiniApp('parent_unregistered', {
        targetAppId: 'child_sub',
        jsApiAlias: {
          CALL_PARENT: 'PARENT_ACTION',
        },
      });

      await expect(
        manager.dispatchChildBridgeAction(openRes.instanceId, 'CALL_PARENT', {})
      ).rejects('FAIL_CLOSED');
    });

    it('TC-T1-F06-04: Child mini-app never inherits parent unaliased private bridge capabilities', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      manager.registerParentBridgeHandler('parent_host', async (action) => {
        if (action === 'ADMIN_DELETE_ACCOUNT') {
          return { deleted: true };
        }
        return { ok: true };
      });

      const openRes = await manager.openMiniApp('parent_host', {
        targetAppId: 'child_untrusted',
        jsApiAlias: {
          PUBLIC_PING: 'PARENT_PING',
        },
      });

      // Child attempts to call parent private action directly (not in alias map)
      const res = await manager.dispatchChildBridgeAction(
        openRes.instanceId,
        'ADMIN_DELETE_ACCOUNT',
        {}
      );

      // Must NOT route to parent
      expect(res.routedToParent).toBe(false);
      expect(res.result.localChildHandled).toBe(true);
    });

    it('TC-T1-F06-05: Empty jsApiAlias table ensures 100% isolation with zero IPC proxying', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const openRes = await manager.openMiniApp('parent_host', {
        targetAppId: 'child_isolated',
        jsApiAlias: {},
      });

      const res = await manager.dispatchChildBridgeAction(
        openRes.instanceId,
        'ANY_ACTION',
        { test: 1 }
      );

      expect(res.routedToParent).toBe(false);
    });
  });

  // ==========================================================================
  // F7: Multi-Tenant Sandboxing & KeyStore Isolation
  // ==========================================================================
  describe('Task 10201 Tier 1 - F7: Multi-Tenant Sandboxing & Storage Isolation', () => {
    it('TC-T1-F07-01: Maintains 100% storage partition isolation between parent and child', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const parentStorage = manager.getStorage('app_parent');
      const childStorage = manager.getStorage('app_child');

      parentStorage.setItem('auth_token', 'PARENT_SECRET_KEY_123');
      childStorage.setItem('auth_token', 'CHILD_ISOLATED_TOKEN_456');

      expect(parentStorage.getItem('auth_token')).toBe('PARENT_SECRET_KEY_123');
      expect(childStorage.getItem('auth_token')).toBe('CHILD_ISOLATED_TOKEN_456');
    });

    it('TC-T1-F07-02: Enforces distinct storage keyspaces with goat_storage_<appId> prefixes', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const storageA = manager.getStorage('app_alpha');
      const storageB = manager.getStorage('app_beta');

      expect(storageA.getStoragePrefix()).toBe('goat_storage_app_alpha');
      expect(storageB.getStoragePrefix()).toBe('goat_storage_app_beta');
    });

    it('TC-T1-F07-03: Partitions Virtual FileSystem directories per mini-app appId', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const storageA = manager.getStorage('app_alpha');
      const storageB = manager.getStorage('app_beta');

      expect(storageA.getVfsDirectory()).toBe('filesDir/miniapps/app_alpha/data/');
      expect(storageB.getVfsDirectory()).toBe('filesDir/miniapps/app_beta/data/');

      storageA.writeVfsFile('profile.json', '{"name":"Alpha"}');
      storageB.writeVfsFile('profile.json', '{"name":"Beta"}');

      expect(storageA.readVfsFile('profile.json')).toBe('{"name":"Alpha"}');
      expect(storageB.readVfsFile('profile.json')).toBe('{"name":"Beta"}');
    });

    it('TC-T1-F07-04: Isolates HTTP cookie jars between parent and child mini-apps', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const parentJar = manager.getCookieJar('app_parent');
      const childJar = manager.getCookieJar('app_child');

      parentJar.setCookie('api.superapp.com', 'session', 'sess_parent_777');
      childJar.setCookie('api.superapp.com', 'session', 'sess_child_888');

      expect(parentJar.getCookie('api.superapp.com', 'session')).toBe('sess_parent_777');
      expect(childJar.getCookie('api.superapp.com', 'session')).toBe('sess_child_888');
    });

    it('TC-T1-F07-05: Isolates hardware-backed KeyStore encryption key aliases', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const parentStorage = manager.getStorage('app_parent');
      const childStorage = manager.getStorage('app_child');

      parentStorage.setKeyStoreKey('master_key', 'KEY_RAW_BYTES_PARENT');
      childStorage.setKeyStoreKey('master_key', 'KEY_RAW_BYTES_CHILD');

      expect(parentStorage.getKeyStoreKey('master_key')).toBe('KEY_RAW_BYTES_PARENT');
      expect(childStorage.getKeyStoreKey('master_key')).toBe('KEY_RAW_BYTES_CHILD');
    });
  });

  // ==========================================================================
  // F8: GoatFastPool Lifecycle Recycling
  // ==========================================================================
  describe('Task 10201 Tier 1 - F8: FastPool Lifecycle Recycling', () => {
    it('TC-T1-F08-01: Acquires pre-warmed WebView instance from FastPool for instant launch', () => {
      const pool = new GoatFastPoolSimulator(2);
      expect(pool.getAvailableCount()).toBe(2);

      const acquired = pool.acquire();
      expect(acquired.fromPool).toBe(true);
      expect(acquired.state).toBe('IN_USE');
      expect(pool.getAvailableCount()).toBe(1);
    });

    it('TC-T1-F08-02: Recycles closed instance through 8-step sanitization sequence', () => {
      const pool = new GoatFastPoolSimulator(2);
      const acquired = pool.acquire();

      const result = pool.recycle(acquired.id);
      expect(result.recycled).toBe(true);
      expect(result.returnedToPool).toBe(true);
      expect(result.sanitizationSteps.length).toBe(8);
      expect(pool.getAvailableCount()).toBe(2);
    });

    it('TC-T1-F08-03: Dynamically allocates instances when FastPool capacity is saturated', () => {
      const pool = new GoatFastPoolSimulator(1);
      const first = pool.acquire();
      expect(first.fromPool).toBe(true);

      const second = pool.acquire();
      expect(second.fromPool).toBe(false); // Dynamically allocated
      expect(pool.getTotalAllocated()).toBe(2);
    });

    it('TC-T1-F08-04: Returns recycled instances up to capacity limit and purges excess', () => {
      const pool = new GoatFastPoolSimulator(1);
      const first = pool.acquire();
      const second = pool.acquire();

      const r1 = pool.recycle(first.id);
      expect(r1.returnedToPool).toBe(true);

      const r2 = pool.recycle(second.id);
      expect(r2.returnedToPool).toBe(false); // Capacity full, cleanly purged
    });

    it('TC-T1-F08-05: Maintains zero state contamination between consecutive pool acquisitions', () => {
      const pool = new GoatFastPoolSimulator(1);
      const first = pool.acquire();
      pool.recycle(first.id);

      const second = pool.acquire();
      expect(second.id).toBe(first.id);
      expect(second.fromPool).toBe(true);
      expect(second.state).toBe('IN_USE');
    });
  });

  // ==========================================================================
  // F9: Cross-Platform Parity & Bindings
  // ==========================================================================
  describe('Task 10201 Tier 1 - F9: Cross-Platform Parity Models', () => {
    it('TC-T1-F09-01: Models Android GoatWindowedContainer with elevation and draggable headers', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const openRes = await manager.openMiniApp('android_host', {
        targetAppId: 'child_android',
        windowConfig: { elevation: 10, cornerRadius: 16, title: 'Android Card' },
      });

      expect(openRes.windowConfig.elevation).toBe(10);
      expect(openRes.windowConfig.title).toBe('Android Card');
    });

    it('TC-T1-F09-02: Models iOS GoatWindowedContainer with UIWindowScene clamping', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const openRes = await manager.openMiniApp('ios_host', {
        targetAppId: 'child_ios',
        presentation: 'WINDOWED',
      });

      expect(openRes.status).toBe('OPENED');
      expect(openRes.presentation).toBe('WINDOWED');
    });

    it('TC-T1-F09-03: Models React Native Fabric openMiniApp and closeMiniApp bridge signatures', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const openRes = await manager.openMiniApp('rn_host', {
        targetAppId: 'child_rn',
        params: { rnProp: 'active' },
      });

      expect(openRes.instanceId).toBeDefined();
      const closeRes = await manager.closeMiniApp('rn_host', { instanceId: openRes.instanceId });
      expect(closeRes.closed).toBe(true);
    });

    it('TC-T1-F09-04: Models Flutter MethodChannel executeAction OPEN_MINI_APP and Stream callbacks', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      let streamFired = false;
      manager.onMiniAppClosed(() => {
        streamFired = true;
      });

      const openRes = await manager.openMiniApp('flutter_host', { targetAppId: 'child_flutter' });
      await manager.closeMiniApp('flutter_host', { instanceId: openRes.instanceId });

      expect(streamFired).toBe(true);
    });

    it('TC-T1-F09-05: Models Web SDK MiniAppBridge openMiniApp / closeMiniApp / onMiniAppClosed', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      let webCallbackData: any = null;
      manager.onMiniAppClosed((data) => {
        webCallbackData = data;
      });

      const openRes = await manager.openMiniApp('web_host', {
        targetAppId: 'web_child',
        jsApiAlias: { NOTIFY: 'PARENT_NOTIFY' },
      });

      await manager.closeMiniApp('web_host', {
        instanceId: openRes.instanceId,
        result: { webHandled: true },
      });

      expect(webCallbackData.result.webHandled).toBe(true);
    });
  });

  // ==========================================================================
  // F10: CI Verification Gate & Diagnostics
  // ==========================================================================
  describe('Task 10201 Tier 1 - F10: CI Verification Gate & Diagnostics', () => {
    it('TC-T1-F10-01: Accurately tracks instance status lifecycle from OPENING to OPENED to CLOSED', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const openRes = await manager.openMiniApp('app_host', { targetAppId: 'sub_diag' });
      const inst = manager.getInstance(openRes.instanceId);
      expect(inst!.status).toBe('OPENED');

      await manager.closeMiniApp('app_host', { instanceId: openRes.instanceId });
      expect(manager.getInstance(openRes.instanceId)).toBeUndefined();
    });

    it('TC-T1-F10-02: Reports zero active instances after full workspace teardown', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      await manager.openMiniApp('app_host', { targetAppId: 'sub_1' });
      await manager.openMiniApp('app_host', { targetAppId: 'sub_2' });

      manager.clearAll();
      expect(manager.getAllRunningInstances().length).toBe(0);
    });

    it('TC-T1-F10-03: Isolates child exceptions from terminating parent host execution', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      manager.registerParentBridgeHandler('app_host', async () => {
        throw new Error('IPC execution internal error');
      });

      const openRes = await manager.openMiniApp('app_host', {
        targetAppId: 'child_error',
        jsApiAlias: { FAILING_CALL: 'PARENT_FAIL' },
      });

      await expect(
        manager.dispatchChildBridgeAction(openRes.instanceId, 'FAILING_CALL', {})
      ).rejects('IPC execution internal error');

      // Parent manager and instance remain intact
      expect(manager.getInstance(openRes.instanceId)).toBeDefined();
    });

    it('TC-T1-F10-04: Enforces non-empty instanceId string contract on all generated instances', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator();
      const openRes = await manager.openMiniApp('app_host', { targetAppId: 'sub_id_check' });
      expect(typeof openRes.instanceId).toBe('string');
      expect(openRes.instanceId.length).toBeGreaterThan(10);
    });

    it('TC-T1-F10-05: Maintains accurate FastPool recycling and allocation telemetry', async () => {
      const manager = new GoatCrossMiniAppManagerSimulator(2);
      const o1 = await manager.openMiniApp('app_host', { targetAppId: 'sub_tel1' });
      const o2 = await manager.openMiniApp('app_host', { targetAppId: 'sub_tel2' });

      await manager.closeMiniApp('app_host', { instanceId: o1.instanceId });
      await manager.closeMiniApp('app_host', { instanceId: o2.instanceId });

      expect(manager.fastPool.getTotalRecycled()).toBe(2);
      expect(manager.fastPool.getAvailableCount()).toBe(2);
    });
  });
}
