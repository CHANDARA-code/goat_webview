/**
 * Goat WebView Task 10201 Cross-MiniApp Launch & Windowed Presentation Simulator
 *
 * Implements comprehensive multi-platform models for Task 10201 (GoatCrossMiniAppManager):
 * - Lifecycle orchestrator: OPEN_MINI_APP, CLOSE_MINI_APP, GET_RUNNING_MINIAPPS, ON_MINI_APP_CLOSED
 * - Presentation modes: WINDOWED (floating draggable card), MODAL (bottom sheet), EMBEDDED, FULLSCREEN
 * - Window geometry configuration and viewport / screen safe area clamping
 * - Selective JSAPI name aliasing & fail-closed IPC proxy routing
 * - Strict multi-tenant sandbox isolation (storage, cookies, filesystem directories, cryptographic keys)
 * - GoatFastPool pre-warmed instance acquisition and 8-step leak-free lifecycle recycling
 * - Cascading parent-to-child destruction and orphan prevention
 * - Cross-platform parity models for Android, iOS, React Native Fabric, Flutter, and Web SDK
 */

export type GoatPresentationMode = 'WINDOWED' | 'MODAL' | 'EMBEDDED' | 'FULLSCREEN';

export interface GoatWindowConfigData {
  width: number;
  height: number;
  x: number;
  y: number;
  draggable: boolean;
  resizable: boolean;
  showCloseButton: boolean;
  dimBackground: boolean;
  cornerRadius: number;
  elevation: number;
  title: string;
}

export class GoatWindowConfig implements GoatWindowConfigData {
  public width: number;
  public height: number;
  public x: number;
  public y: number;
  public draggable: boolean;
  public resizable: boolean;
  public showCloseButton: boolean;
  public dimBackground: boolean;
  public cornerRadius: number;
  public elevation: number;
  public title: string;

  constructor(init: Partial<GoatWindowConfigData> = {}) {
    this.width = init.width ?? 360;
    this.height = init.height ?? 520;
    this.x = init.x ?? 20;
    this.y = init.y ?? 60;
    this.draggable = init.draggable ?? true;
    this.resizable = init.resizable ?? false;
    this.showCloseButton = init.showCloseButton ?? true;
    this.dimBackground = init.dimBackground ?? true;
    this.cornerRadius = init.cornerRadius ?? 16;
    this.elevation = init.elevation ?? 8;
    this.title = init.title ?? 'Mini-App';
  }

  static fromObject(obj?: Record<string, any> | null): GoatWindowConfig {
    if (!obj || typeof obj !== 'object') {
      return new GoatWindowConfig();
    }
    return new GoatWindowConfig({
      width: typeof obj.width === 'number' ? obj.width : (typeof obj.widthDp === 'number' ? obj.widthDp : 360),
      height: typeof obj.height === 'number' ? obj.height : (typeof obj.heightDp === 'number' ? obj.heightDp : 520),
      x: typeof obj.x === 'number' ? obj.x : (typeof obj.xDp === 'number' ? obj.xDp : 20),
      y: typeof obj.y === 'number' ? obj.y : (typeof obj.yDp === 'number' ? obj.yDp : 60),
      draggable: obj.draggable !== false,
      resizable: obj.resizable === true,
      showCloseButton: obj.showCloseButton !== false,
      dimBackground: obj.dimBackground !== false,
      cornerRadius: typeof obj.cornerRadius === 'number' ? obj.cornerRadius : 16,
      elevation: typeof obj.elevation === 'number' ? obj.elevation : 8,
      title: typeof obj.title === 'string' ? obj.title : 'Mini-App',
    });
  }

  /**
   * Clamps geometry to ensure the window stays completely within the viewport bounds.
   */
  clampToBounds(screenWidth: number = 390, screenHeight: number = 844, safeTop: number = 44, safeBottom: number = 34): {
    clampedWidth: number;
    clampedHeight: number;
    clampedX: number;
    clampedY: number;
  } {
    const minWidth = 200;
    const minHeight = 250;
    const maxAvailableWidth = screenWidth;
    const maxAvailableHeight = screenHeight - safeTop - safeBottom;

    const clampedWidth = Math.max(minWidth, Math.min(this.width, maxAvailableWidth));
    const clampedHeight = Math.max(minHeight, Math.min(this.height, maxAvailableHeight));

    const minX = 0;
    const maxX = Math.max(0, screenWidth - clampedWidth);
    const minY = safeTop;
    const maxY = Math.max(safeTop, screenHeight - safeBottom - clampedHeight);

    const clampedX = Math.max(minX, Math.min(this.x, maxX));
    const clampedY = Math.max(minY, Math.min(this.y, maxY));

    return { clampedWidth, clampedHeight, clampedX, clampedY };
  }
}

/**
 * Isolated tenant storage partition.
 */
export class GoatTenantStorageSandbox {
  public readonly appId: string;
  private store = new Map<string, string>();
  private vfs = new Map<string, string>();
  private keyStore = new Map<string, string>();

  constructor(appId: string) {
    this.appId = appId;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  getAllKeys(): string[] {
    return Array.from(this.store.keys());
  }

  getStoragePrefix(): string {
    return `goat_storage_${this.appId}`;
  }

  getVfsDirectory(): string {
    return `filesDir/miniapps/${this.appId}/data/`;
  }

  writeVfsFile(path: string, content: string): void {
    if (path.includes('..') || path.includes('\0') || path.startsWith('/') || path.includes('\\')) {
      throw new Error(`SECURITY_ERROR: Path traversal detected in ${path}`);
    }
    this.vfs.set(path, content);
  }

  readVfsFile(path: string): string | null {
    if (path.includes('..') || path.includes('\0') || path.startsWith('/') || path.includes('\\')) {
      throw new Error(`SECURITY_ERROR: Path traversal detected in ${path}`);
    }
    return this.vfs.get(path) ?? null;
  }

  setKeyStoreKey(alias: string, rawKey: string): void {
    this.keyStore.set(`${this.appId}_${alias}`, rawKey);
  }

  getKeyStoreKey(alias: string): string | null {
    return this.keyStore.get(`${this.appId}_${alias}`) ?? null;
  }
}

/**
 * Isolated tenant cookie jar partition.
 */
export class GoatTenantCookieJar {
  public readonly appId: string;
  private cookies = new Map<string, Map<string, string>>();

  constructor(appId: string) {
    this.appId = appId;
  }

  setCookie(domain: string, name: string, value: string): void {
    if (!this.cookies.has(domain)) {
      this.cookies.set(domain, new Map());
    }
    this.cookies.get(domain)!.set(name, value);
  }

  getCookie(domain: string, name: string): string | null {
    return this.cookies.get(domain)?.get(name) ?? null;
  }

  getCookiesForDomain(domain: string): Record<string, string> {
    const map = this.cookies.get(domain);
    if (!map) return {};
    const res: Record<string, string> = {};
    for (const [k, v] of map.entries()) {
      res[k] = v;
    }
    return res;
  }

  clear(): void {
    this.cookies.clear();
  }
}

/**
 * Pre-warmed FastPool WebView simulator.
 */
export class GoatFastPoolSimulator {
  private warmPool: Array<{ id: string; state: string; isDirty: boolean }> = [];
  private poolCapacity: number;
  private totalAllocated: number = 0;
  private totalRecycled: number = 0;

  constructor(poolCapacity: number = 2) {
    this.poolCapacity = poolCapacity;
    this.prewarm(poolCapacity);
  }

  prewarm(count: number): void {
    for (let i = 0; i < count; i++) {
      this.totalAllocated++;
      this.warmPool.push({
        id: `webview_warm_${this.totalAllocated}`,
        state: 'WARM',
        isDirty: false,
      });
    }
  }

  acquire(): { id: string; state: string; fromPool: boolean } {
    if (this.warmPool.length > 0) {
      const item = this.warmPool.pop()!;
      item.state = 'IN_USE';
      return { id: item.id, state: item.state, fromPool: true };
    }
    // Dynamic fallback allocation when saturated
    this.totalAllocated++;
    return {
      id: `webview_dynamic_${this.totalAllocated}`,
      state: 'IN_USE',
      fromPool: false,
    };
  }

  /**
   * 8-step sanitization and recycling sequence.
   */
  recycle(webViewId: string): {
    sanitizationSteps: string[];
    recycled: boolean;
    returnedToPool: boolean;
  } {
    const steps = [
      '1_PURGE_DOM_AND_SCRIPTS',
      '2_CLEAR_NAVIGATION_HISTORY',
      '3_DETACH_STORAGE_AND_COOKIES',
      '4_DEREGISTER_EVENT_LISTENERS',
      '5_RESET_VIEWPORT_AND_ZOOM',
      '6_PURGE_NETWORK_BUFFER_AND_CACHE',
      '7_AUDIT_MEMORY_LEAKS',
      '8_RESET_STATE_AND_REPLENISH_POOL',
    ];

    this.totalRecycled++;
    let returnedToPool = false;

    if (this.warmPool.length < this.poolCapacity) {
      this.warmPool.push({
        id: webViewId,
        state: 'WARM',
        isDirty: false,
      });
      returnedToPool = true;
    }

    return {
      sanitizationSteps: steps,
      recycled: true,
      returnedToPool,
    };
  }

  getAvailableCount(): number {
    return this.warmPool.length;
  }

  getTotalAllocated(): number {
    return this.totalAllocated;
  }

  getTotalRecycled(): number {
    return this.totalRecycled;
  }
}

/**
 * Running Mini-App Instance representation.
 */
export interface RunningMiniAppInstance {
  instanceId: string;
  appId: string;
  parentAppId: string;
  presentation: GoatPresentationMode;
  status: 'OPENING' | 'OPENED' | 'CLOSING' | 'CLOSED';
  launchedAt: number;
  windowConfig: GoatWindowConfig;
  jsApiAlias: Record<string, string>;
  params?: Record<string, any>;
  authTokens?: Record<string, any>;
  storage: GoatTenantStorageSandbox;
  cookies: GoatTenantCookieJar;
  webViewId: string;
  children: string[]; // instanceIds of child mini-apps launched by this instance
}

/**
 * Main Cross-MiniApp Manager Multi-Platform Simulator (GoatCrossMiniAppManager).
 */
export class GoatCrossMiniAppManagerSimulator {
  private instances = new Map<string, RunningMiniAppInstance>();
  private storages = new Map<string, GoatTenantStorageSandbox>();
  private cookieJars = new Map<string, GoatTenantCookieJar>();
  private parentBridgeHandlers = new Map<string, (action: string, payload: any) => Promise<any>>();
  private closedEventListeners: Array<(event: { instanceId: string; targetAppId: string; dismissedByUser: boolean; exitCode?: string; result: any }) => void> = [];
  public fastPool: GoatFastPoolSimulator;

  public screenWidth: number = 390;
  public screenHeight: number = 844;
  public safeTop: number = 44;
  public safeBottom: number = 34;

  constructor(poolCapacity: number = 2) {
    this.fastPool = new GoatFastPoolSimulator(poolCapacity);
  }

  getStorage(appId: string): GoatTenantStorageSandbox {
    if (!this.storages.has(appId)) {
      this.storages.set(appId, new GoatTenantStorageSandbox(appId));
    }
    return this.storages.get(appId)!;
  }

  getCookieJar(appId: string): GoatTenantCookieJar {
    if (!this.cookieJars.has(appId)) {
      this.cookieJars.set(appId, new GoatTenantCookieJar(appId));
    }
    return this.cookieJars.get(appId)!;
  }

  registerParentBridgeHandler(appId: string, handler: (action: string, payload: any) => Promise<any>): void {
    this.parentBridgeHandlers.set(appId, handler);
  }

  onMiniAppClosed(listener: (event: { instanceId: string; targetAppId: string; dismissedByUser: boolean; exitCode?: string; result: any }) => void): () => void {
    this.closedEventListeners.push(listener);
    return () => {
      const idx = this.closedEventListeners.indexOf(listener);
      if (idx !== -1) {
        this.closedEventListeners.splice(idx, 1);
      }
    };
  }

  /**
   * Validates targetAppId for security (prevents path traversal / null bytes).
   */
  private validateAppId(appId?: string | null): string {
    if (!appId || typeof appId !== 'string' || appId.trim() === '') {
      throw new Error("INVALID_ARGUMENT: Missing 'targetAppId' for OPEN_MINI_APP");
    }
    const trimmed = appId.trim();
    if (
      trimmed.includes('..') ||
      trimmed.includes('/') ||
      trimmed.includes('\\') ||
      trimmed.includes('\0') ||
      trimmed.includes('%2e') ||
      trimmed.includes('%2f')
    ) {
      throw new Error(`SECURITY_ERROR: Invalid or path-traversal targetAppId "${appId}"`);
    }
    return trimmed;
  }

  /**
   * OPEN_MINI_APP Bridge Action
   */
  async openMiniApp(
    callerAppId: string,
    payload: {
      targetAppId: string;
      presentation?: GoatPresentationMode;
      windowConfig?: Record<string, any>;
      jsApiAlias?: Record<string, string>;
      params?: Record<string, any>;
      authTokens?: Record<string, any>;
    }
  ): Promise<{
    instanceId: string;
    targetAppId: string;
    presentation: string;
    status: string;
    windowConfig: GoatWindowConfig;
  }> {
    const validTargetAppId = this.validateAppId(payload.targetAppId);
    const presentation: GoatPresentationMode = payload.presentation ?? 'WINDOWED';
    const windowConfig = GoatWindowConfig.fromObject(payload.windowConfig);
    const jsApiAlias = payload.jsApiAlias ? { ...payload.jsApiAlias } : {};

    // Acquire pre-warmed WebView from FastPool
    const acquired = this.fastPool.acquire();

    const instanceId = `inst_${validTargetAppId}_${Math.random().toString(36).substring(2, 10)}`;
    const instance: RunningMiniAppInstance = {
      instanceId,
      appId: validTargetAppId,
      parentAppId: callerAppId,
      presentation,
      status: 'OPENED',
      launchedAt: Date.now(),
      windowConfig,
      jsApiAlias,
      params: payload.params ? JSON.parse(JSON.stringify(payload.params)) : undefined,
      authTokens: payload.authTokens ? JSON.parse(JSON.stringify(payload.authTokens)) : undefined,
      storage: this.getStorage(validTargetAppId),
      cookies: this.getCookieJar(validTargetAppId),
      webViewId: acquired.id,
      children: [],
    };

    // Track parent-child hierarchy
    for (const inst of this.instances.values()) {
      if (inst.appId === callerAppId && inst.status === 'OPENED') {
        inst.children.push(instanceId);
      }
    }

    this.instances.set(instanceId, instance);

    return {
      instanceId,
      targetAppId: validTargetAppId,
      presentation,
      status: 'OPENED',
      windowConfig,
    };
  }

  /**
   * CLOSE_MINI_APP Bridge Action
   */
  async closeMiniApp(
    callerAppId: string,
    payload: {
      instanceId?: string;
      targetAppId?: string;
      result?: Record<string, any>;
      dismissedByUser?: boolean;
      exitCode?: string;
    } = {}
  ): Promise<{
    closed: boolean;
    instanceId: string;
    sanitizationSteps: string[];
  }> {
    let instanceToClose: RunningMiniAppInstance | undefined;

    if (payload.instanceId) {
      instanceToClose = this.instances.get(payload.instanceId);
    } else if (payload.targetAppId) {
      for (const inst of this.instances.values()) {
        if (inst.appId === payload.targetAppId && inst.status === 'OPENED') {
          instanceToClose = inst;
          break;
        }
      }
    } else {
      // Close latest child launched by caller
      for (const inst of Array.from(this.instances.values()).reverse()) {
        if (inst.parentAppId === callerAppId && inst.status === 'OPENED') {
          instanceToClose = inst;
          break;
        }
      }
    }

    if (!instanceToClose) {
      return {
        closed: false,
        instanceId: payload.instanceId ?? '',
        sanitizationSteps: [],
      };
    }

    // Cascade close all children of this instance first
    for (const childId of [...instanceToClose.children]) {
      await this.closeMiniApp(instanceToClose.appId, {
        instanceId: childId,
        result: { cascadingParentClosed: true },
        dismissedByUser: false,
        exitCode: 'CASCADE_PARENT_CLOSED',
      });
    }

    instanceToClose.status = 'CLOSED';
    this.instances.delete(instanceToClose.instanceId);

    // 8-step FastPool sanitization
    const recycleResult = this.fastPool.recycle(instanceToClose.webViewId);

    // Emit ON_MINI_APP_CLOSED event
    const eventPayload = {
      instanceId: instanceToClose.instanceId,
      targetAppId: instanceToClose.appId,
      dismissedByUser: payload.dismissedByUser ?? false,
      exitCode: payload.exitCode ?? 'SUCCESS',
      result: payload.result ?? {},
    };

    for (const listener of this.closedEventListeners) {
      try {
        listener(eventPayload);
      } catch (_e) {}
    }

    return {
      closed: true,
      instanceId: instanceToClose.instanceId,
      sanitizationSteps: recycleResult.sanitizationSteps,
    };
  }

  /**
   * GET_RUNNING_MINIAPPS Query Action
   */
  async getRunningMiniApps(
    callerAppId: string,
    payload: {
      filters?: {
        parentAppId?: string;
        status?: string;
      };
    } = {}
  ): Promise<{
    instances: Array<{
      instanceId: string;
      appId: string;
      parentAppId: string;
      presentation: string;
      status: string;
      launchedAt: number;
      jsApiAlias?: Record<string, string>;
    }>;
    totalCount: number;
  }> {
    let list = Array.from(this.instances.values());

    if (payload.filters?.parentAppId) {
      list = list.filter((i) => i.parentAppId === payload.filters!.parentAppId);
    }
    if (payload.filters?.status) {
      list = list.filter((i) => i.status === payload.filters!.status);
    }

    const mapped = list.map((i) => ({
      instanceId: i.instanceId,
      appId: i.appId,
      parentAppId: i.parentAppId,
      presentation: i.presentation,
      status: i.status,
      launchedAt: i.launchedAt,
      jsApiAlias: i.jsApiAlias,
    }));

    return {
      instances: mapped,
      totalCount: mapped.length,
    };
  }

  /**
   * Dispatches an IPC action from child mini-app.
   * If action is in jsApiAlias, routes to parent bridge handler with fail-closed security.
   * If action is not aliased, executes on child's own bridge.
   */
  async dispatchChildBridgeAction(
    childInstanceId: string,
    action: string,
    payload: Record<string, any>
  ): Promise<{
    routedToParent: boolean;
    targetActionName: string;
    result: any;
  }> {
    const child = this.instances.get(childInstanceId);
    if (!child) {
      throw new Error(`NOT_FOUND: Child instance ${childInstanceId} not running`);
    }

    // Check JSAPI Aliasing table
    if (child.jsApiAlias && action in child.jsApiAlias) {
      const parentActionName = child.jsApiAlias[action];
      const parentHandler = this.parentBridgeHandlers.get(child.parentAppId);
      if (!parentHandler) {
        throw new Error(`FAIL_CLOSED: Parent ${child.parentAppId} has no bridge handler registered for aliased ${action} -> ${parentActionName}`);
      }
      const parentResult = await parentHandler(parentActionName, payload);
      return {
        routedToParent: true,
        targetActionName: parentActionName,
        result: parentResult,
      };
    }

    // Unaliased action: resolves locally in child runtime
    return {
      routedToParent: false,
      targetActionName: action,
      result: { localChildHandled: true, action, appId: child.appId, payload },
    };
  }

  getInstance(instanceId: string): RunningMiniAppInstance | undefined {
    return this.instances.get(instanceId);
  }

  getAllRunningInstances(): RunningMiniAppInstance[] {
    return Array.from(this.instances.values());
  }

  clearAll(): void {
    this.instances.clear();
    this.storages.clear();
    this.cookieJars.clear();
    this.parentBridgeHandlers.clear();
    this.closedEventListeners = [];
  }
}
