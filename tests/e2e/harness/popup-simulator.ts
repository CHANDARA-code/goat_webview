/**
 * Goat WebView Task 10183 Popup Manager Multi-Platform Runtime Simulator
 *
 * Implements comprehensive multi-platform models for Task 10183 (GoatPopupManager):
 * - WindowFeatures parser and geometry propagation (W3C & WKWindowFeatures)
 * - Origin classifier (same-origin goat://<appId>, cross-origin HTTPS, file:// block, system schemes)
 * - Host-configurable routing policy (AUTO, SYSTEM_BROWSER, MODAL, SAME_FRAME, BLOCK)
 * - Android WebChromeClient.onCreateWindow / onCloseWindow interception & transport target
 * - iOS WKUIDelegate createWebViewWithConfiguration / webViewDidClose interception
 * - Standardized ON_POPUP_REQUEST IPC event telemetry emission across bridges
 * - External link warning dialog with per-session domain opt-out suppression
 * - Isolated tenant storage sandbox and cookie sharing for secondary modal WebViews
 * - React Native Fabric direct event and prop binding simulation
 * - Flutter MethodChannel and Stream<GoatPopupRequest> simulation
 * - Leak-free modal lifecycle, fast-pool recycling, and cascading parent destruction
 */

export type GoatPopupRoutingPolicy = 'AUTO' | 'SYSTEM_BROWSER' | 'MODAL' | 'SAME_FRAME' | 'BLOCK';

export interface GoatWindowFeaturesData {
  width: number | null;
  height: number | null;
  x: number | null;
  y: number | null;
  menuBar: boolean | null;
  statusBar: boolean | null;
  toolbars: boolean | null;
  resizable: boolean | null;
  scrollbars: boolean | null;
}

export class GoatWindowFeatures implements GoatWindowFeaturesData {
  public width: number | null;
  public height: number | null;
  public x: number | null;
  public y: number | null;
  public menuBar: boolean | null;
  public statusBar: boolean | null;
  public toolbars: boolean | null;
  public resizable: boolean | null;
  public scrollbars: boolean | null;

  constructor(init: Partial<GoatWindowFeaturesData> = {}) {
    this.width = init.width ?? null;
    this.height = init.height ?? null;
    this.x = init.x ?? null;
    this.y = init.y ?? null;
    this.menuBar = init.menuBar ?? null;
    this.statusBar = init.statusBar ?? null;
    this.toolbars = init.toolbars ?? null;
    this.resizable = init.resizable ?? null;
    this.scrollbars = init.scrollbars ?? null;
  }

  static parse(featureString?: string | null): GoatWindowFeatures {
    if (!featureString || typeof featureString !== 'string' || featureString.trim() === '') {
      return new GoatWindowFeatures();
    }

    const features = new GoatWindowFeatures();
    const pairs = featureString.split(',').map((p) => p.trim());

    for (const pair of pairs) {
      if (!pair) continue;
      const parts = pair.split('=');
      const key = parts[0].trim().toLowerCase();
      const val = parts.length > 1 ? parts[1].trim().toLowerCase() : 'yes';

      const parseBool = (v: string): boolean => v === 'yes' || v === '1' || v === 'true';
      const parseNum = (v: string): number | null => {
        const num = parseFloat(v);
        return isNaN(num) ? null : num;
      };

      switch (key) {
        case 'width':
        case 'innerwidth': {
          const w = parseNum(val);
          features.width = w !== null ? (w < 200 ? 360 : w) : 360;
          break;
        }
        case 'height':
        case 'innerheight': {
          const h = parseNum(val);
          features.height = h !== null ? (h < 200 ? 520 : h) : 520;
          break;
        }
        case 'left':
        case 'screenx':
        case 'x': {
          features.x = parseNum(val);
          break;
        }
        case 'top':
        case 'screeny':
        case 'y': {
          features.y = parseNum(val);
          break;
        }
        case 'resizable': {
          features.resizable = parseBool(val);
          break;
        }
        case 'menubar': {
          features.menuBar = parseBool(val);
          break;
        }
        case 'status':
        case 'statusbar': {
          features.statusBar = parseBool(val);
          break;
        }
        case 'toolbar':
        case 'toolbars': {
          features.toolbars = parseBool(val);
          break;
        }
        case 'scrollbars': {
          features.scrollbars = parseBool(val);
          break;
        }
      }
    }

    return features;
  }

  static fromWKWindowFeatures(wkFeatures: Partial<Record<string, any>>): GoatWindowFeatures {
    return new GoatWindowFeatures({
      width: typeof wkFeatures.width === 'number' ? wkFeatures.width : null,
      height: typeof wkFeatures.height === 'number' ? wkFeatures.height : null,
      x: typeof wkFeatures.x === 'number' ? wkFeatures.x : null,
      y: typeof wkFeatures.y === 'number' ? wkFeatures.y : null,
      menuBar: typeof wkFeatures.menuBarVisibility === 'boolean' ? wkFeatures.menuBarVisibility : null,
      statusBar: typeof wkFeatures.statusBarVisibility === 'boolean' ? wkFeatures.statusBarVisibility : null,
      toolbars: typeof wkFeatures.toolbarsVisibility === 'boolean' ? wkFeatures.toolbarsVisibility : null,
      resizable: typeof wkFeatures.allowsResizing === 'boolean' ? wkFeatures.allowsResizing : null,
      scrollbars: null,
    });
  }

  toJson(): GoatWindowFeaturesData {
    return {
      width: this.width,
      height: this.height,
      x: this.x,
      y: this.y,
      menuBar: this.menuBar,
      statusBar: this.statusBar,
      toolbars: this.toolbars,
      resizable: this.resizable,
      scrollbars: this.scrollbars,
    };
  }
}

export interface GoatPopupRequestEvent {
  event: 'ON_POPUP_REQUEST';
  data: {
    url: string;
    target: string;
    policy: GoatPopupRoutingPolicy;
    isUserGesture: boolean;
    isDialog: boolean;
    windowFeatures: GoatWindowFeaturesData;
  };
}

export interface GoatPopupNavigationResult {
  handled: boolean;
  action: 'OPENED_MODAL' | 'OPENED_SYSTEM_BROWSER' | 'NAVIGATED_SAME_FRAME' | 'BLOCKED' | 'SYSTEM_INTENT';
  popupViewId?: string;
  externalUrl?: string;
  intentScheme?: string;
  warningDialogShown?: boolean;
  eventEmitted: GoatPopupRequestEvent;
}

/**
 * Storage and Cookie Partition Sandbox for Multi-Tenant Mini-Apps
 */
export class GoatTenantSandbox {
  public readonly appId: string;
  public cookies: Map<string, string> = new Map();
  public localStorage: Map<string, string> = new Map();

  constructor(appId: string) {
    this.appId = appId;
  }

  setCookie(key: string, val: string): void {
    this.cookies.set(key, val);
  }

  getCookie(key: string): string | undefined {
    return this.cookies.get(key);
  }

  setItem(key: string, val: string): void {
    this.localStorage.set(key, val);
  }

  getItem(key: string): string | undefined {
    return this.localStorage.get(key);
  }

  clear(): void {
    this.cookies.clear();
    this.localStorage.clear();
  }
}

/**
 * Modal GoatView Instance representing secondary window in container
 */
export class GoatModalWebViewInstance {
  public readonly viewId: string;
  public readonly parentViewId: string;
  public readonly tenantAppId: string;
  public readonly url: string;
  public readonly windowFeatures: GoatWindowFeatures;
  public readonly sandbox: GoatTenantSandbox;
  public isDestroyed = false;
  public isVisible = true;
  public messageHandlers: Map<string, Function> = new Map();

  constructor(
    viewId: string,
    parentViewId: string,
    tenantAppId: string,
    url: string,
    windowFeatures: GoatWindowFeatures,
    sandbox: GoatTenantSandbox
  ) {
    this.viewId = viewId;
    this.parentViewId = parentViewId;
    this.tenantAppId = tenantAppId;
    this.url = url;
    this.windowFeatures = windowFeatures;
    this.sandbox = sandbox;
  }

  public addScriptMessageHandler(name: string, handler: Function): void {
    this.messageHandlers.set(name, handler);
  }

  public destroy(): void {
    this.messageHandlers.clear();
    this.isDestroyed = true;
    this.isVisible = false;
  }
}

/**
 * External Link Warning Dialog Manager with per-session opt-out
 */
export class GoatExternalLinkWarningDialogSimulator {
  private sessionOptOuts = new Map<string, Set<string>>(); // appId -> Set<domain>
  public dialogShowCount = 0;
  public promptHistory: Array<{ appId: string; domain: string; url: string; confirmed: boolean }> = [];

  public isDomainOptedOut(appId: string, domain: string): boolean {
    const set = this.sessionOptOuts.get(appId);
    return set?.has(domain.toLowerCase()) ?? false;
  }

  public optOutDomain(appId: string, domain: string): void {
    let set = this.sessionOptOuts.get(appId);
    if (!set) {
      set = new Set<string>();
      this.sessionOptOuts.set(appId, set);
    }
    set.add(domain.toLowerCase());
  }

  public clearSession(appId?: string): void {
    if (appId) {
      this.sessionOptOuts.delete(appId);
    } else {
      this.sessionOptOuts.clear();
    }
  }

  public prompt(
    appId: string,
    url: string,
    userDecision: 'CONFIRM' | 'CANCEL' = 'CONFIRM',
    rememberChoice = false
  ): { showDialog: boolean; allowed: boolean; domain: string } {
    let domain = 'unknown';
    try {
      const parsed = new URL(url);
      domain = parsed.hostname.toLowerCase();
    } catch {
      domain = 'invalid-host';
    }

    if (this.isDomainOptedOut(appId, domain)) {
      return { showDialog: false, allowed: true, domain };
    }

    this.dialogShowCount++;
    const confirmed = userDecision === 'CONFIRM';
    this.promptHistory.push({ appId, domain, url, confirmed });

    if (confirmed && rememberChoice) {
      this.optOutDomain(appId, domain);
    }

    return { showDialog: true, allowed: confirmed, domain };
  }
}

/**
 * Fast Pool Manager for Modal WebViews
 */
export class GoatModalFastPoolSimulator {
  private pool: GoatModalWebViewInstance[] = [];
  public poolHits = 0;
  public creations = 0;
  public destructions = 0;

  public acquire(
    parentViewId: string,
    tenantAppId: string,
    url: string,
    windowFeatures: GoatWindowFeatures,
    sandbox: GoatTenantSandbox
  ): GoatModalWebViewInstance {
    const existing = this.pool.pop();
    if (existing) {
      this.poolHits++;
      return new GoatModalWebViewInstance(
        existing.viewId,
        parentViewId,
        tenantAppId,
        url,
        windowFeatures,
        sandbox
      );
    }
    this.creations++;
    const viewId = `modal_wv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return new GoatModalWebViewInstance(viewId, parentViewId, tenantAppId, url, windowFeatures, sandbox);
  }

  public release(instance: GoatModalWebViewInstance, recycle = true): void {
    instance.destroy();
    this.destructions++;
    if (recycle && this.pool.length < 5) {
      this.pool.push(instance);
    }
  }

  public clear(): void {
    this.pool.forEach((i) => i.destroy());
    this.pool = [];
  }
}

/**
 * Master GoatPopupManager Multi-Platform Engine Simulator
 */
export class GoatPopupManagerSimulator {
  public readonly appId: string;
  public readonly parentViewId: string;
  public popupRoutingPolicy: GoatPopupRoutingPolicy = 'AUTO';
  public isSupportMultipleWindows = true;
  public javaScriptCanOpenWindowsAutomatically = true;
  public hasFocus = true;

  public readonly sandbox: GoatTenantSandbox;
  public readonly warningDialog: GoatExternalLinkWarningDialogSimulator;
  public readonly pool: GoatModalFastPoolSimulator;

  public activeModals: GoatModalWebViewInstance[] = [];
  public emittedEvents: GoatPopupRequestEvent[] = [];
  public systemBrowserInvocations: string[] = [];
  public systemIntentsDispatched: Array<{ scheme: string; url: string }> = [];

  public onPopupRequestListener?: (event: GoatPopupRequestEvent) => void;
  public onModalOpenedListener?: (modal: GoatModalWebViewInstance) => void;
  public onModalClosedListener?: (modalId: string) => void;

  public maxConcurrentModals = 3;
  public isDestroyed = false;

  constructor(
    appId = 'app-10183',
    parentViewId = 'root_view_main',
    warningDialog?: GoatExternalLinkWarningDialogSimulator,
    pool?: GoatModalFastPoolSimulator
  ) {
    this.appId = appId;
    this.parentViewId = parentViewId;
    this.sandbox = new GoatTenantSandbox(appId);
    this.warningDialog = warningDialog || new GoatExternalLinkWarningDialogSimulator();
    this.pool = pool || new GoatModalFastPoolSimulator();
  }

  /**
   * Origin Classifier
   */
  public classifyOrigin(rawUrl: string): 'SAME_ORIGIN' | 'CROSS_ORIGIN' | 'BLOCKED_SCHEME' | 'SYSTEM_SCHEME' | 'JAVASCRIPT' {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return 'BLOCKED_SCHEME';
    }

    const trimmed = rawUrl.trim();

    if (trimmed.startsWith('javascript:')) {
      return 'JAVASCRIPT';
    }

    if (trimmed.startsWith('file://') || trimmed.startsWith('content://')) {
      return 'BLOCKED_SCHEME';
    }

    const systemSchemes = ['tel:', 'mailto:', 'sms:', 'geo:'];
    for (const scheme of systemSchemes) {
      if (trimmed.startsWith(scheme)) {
        return 'SYSTEM_SCHEME';
      }
    }

    // Relative URLs resolve against same-origin tenant root
    if (trimmed.startsWith('/') || trimmed.startsWith('./') || (!trimmed.includes('://') && !trimmed.startsWith('about:'))) {
      return 'SAME_ORIGIN';
    }

    if (trimmed.startsWith(`goat://${this.appId}/`)) {
      return 'SAME_ORIGIN';
    }

    if (trimmed.startsWith('goat://')) {
      // Different tenant appId
      return 'CROSS_ORIGIN';
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return 'CROSS_ORIGIN';
    }

    return 'CROSS_ORIGIN';
  }

  public resolveFullUrl(rawUrl: string): string {
    const trimmed = (rawUrl || '').trim();
    if (
      trimmed.startsWith('tel:') ||
      trimmed.startsWith('mailto:') ||
      trimmed.startsWith('sms:') ||
      trimmed.startsWith('geo:') ||
      trimmed.startsWith('javascript:') ||
      trimmed.startsWith('about:') ||
      trimmed.startsWith('file:') ||
      trimmed.startsWith('content:') ||
      trimmed.includes('://')
    ) {
      return trimmed;
    }

    const cleanPath = trimmed.startsWith('/') ? trimmed.substring(1) : trimmed.replace(/^\.\//, '');
    return `goat://${this.appId}/${cleanPath}`;
  }

  /**
   * Main Interception Handler: Simulates Android WebChromeClient.onCreateWindow / iOS WKUIDelegate
   */
  public handleCreateWindow(params: {
    url: string;
    target?: string;
    windowFeatures?: string | GoatWindowFeatures | null;
    isUserGesture?: boolean;
    isDialog?: boolean;
    userConfirmDialog?: 'CONFIRM' | 'CANCEL';
    rememberOptOut?: boolean;
    customPolicy?: GoatPopupRoutingPolicy;
  }): GoatPopupNavigationResult {
    if (this.isDestroyed) {
      throw new Error('ILLEGAL_STATE: GoatPopupManager instance has been destroyed');
    }

    const target = params.target || '_blank';
    const isUserGesture = params.isUserGesture ?? true;
    const isDialog = params.isDialog ?? false;
    const rawUrl = params.url;
    const fullUrl = this.resolveFullUrl(rawUrl);

    // 1. Parse WindowFeatures
    let features: GoatWindowFeatures;
    if (params.windowFeatures instanceof GoatWindowFeatures) {
      features = params.windowFeatures;
    } else if (typeof params.windowFeatures === 'string') {
      features = GoatWindowFeatures.parse(params.windowFeatures);
    } else {
      features = new GoatWindowFeatures();
    }

    // 2. Classify Origin
    const originType = this.classifyOrigin(rawUrl);

    // 3. Determine Effective Policy
    const configuredPolicy = params.customPolicy || this.popupRoutingPolicy;
    let effectivePolicy: GoatPopupRoutingPolicy = configuredPolicy;

    if (originType === 'BLOCKED_SCHEME' || originType === 'JAVASCRIPT') {
      effectivePolicy = 'BLOCK';
    } else if (originType === 'SYSTEM_SCHEME') {
      effectivePolicy = 'AUTO';
    } else if (configuredPolicy === 'AUTO') {
      if (originType === 'SAME_ORIGIN') {
        effectivePolicy = 'MODAL';
      } else {
        effectivePolicy = 'SYSTEM_BROWSER';
      }
    }

    // 4. Construct Event Telemetry
    const event: GoatPopupRequestEvent = {
      event: 'ON_POPUP_REQUEST',
      data: {
        url: fullUrl,
        target,
        policy: effectivePolicy,
        isUserGesture,
        isDialog,
        windowFeatures: features.toJson(),
      },
    };
    this.emittedEvents.push(event);
    if (this.onPopupRequestListener) {
      this.onPopupRequestListener(event);
    }

    // 5. Execute Action based on Policy & Origin
    if (originType === 'BLOCKED_SCHEME' || effectivePolicy === 'BLOCK') {
      return {
        handled: false,
        action: 'BLOCKED',
        eventEmitted: event,
      };
    }

    if (originType === 'SYSTEM_SCHEME') {
      const scheme = fullUrl.split(':')[0] + ':';
      this.systemIntentsDispatched.push({ scheme, url: fullUrl });
      return {
        handled: true,
        action: 'SYSTEM_INTENT',
        intentScheme: scheme,
        externalUrl: fullUrl,
        eventEmitted: event,
      };
    }

    if (effectivePolicy === 'SAME_FRAME') {
      return {
        handled: true,
        action: 'NAVIGATED_SAME_FRAME',
        eventEmitted: event,
      };
    }

    if (effectivePolicy === 'SYSTEM_BROWSER') {
      // Guarded by External Link Warning Dialog
      const promptRes = this.warningDialog.prompt(
        this.appId,
        fullUrl,
        params.userConfirmDialog || 'CONFIRM',
        params.rememberOptOut || false
      );

      if (promptRes.allowed) {
        this.systemBrowserInvocations.push(fullUrl);
        return {
          handled: true,
          action: 'OPENED_SYSTEM_BROWSER',
          externalUrl: fullUrl,
          warningDialogShown: promptRes.showDialog,
          eventEmitted: event,
        };
      } else {
        return {
          handled: false,
          action: 'BLOCKED',
          warningDialogShown: true,
          eventEmitted: event,
        };
      }
    }

    if (effectivePolicy === 'MODAL') {
      // Guard against rapid multi-window spam / stacking overflow
      if (this.activeModals.length >= this.maxConcurrentModals) {
        // Coalesce / reuse top modal or recycle oldest
        const oldest = this.activeModals.shift();
        if (oldest) {
          this.pool.release(oldest);
        }
      }

      const modal = this.pool.acquire(
        this.parentViewId,
        this.appId,
        fullUrl,
        features,
        this.sandbox
      );

      this.activeModals.push(modal);
      this.hasFocus = false; // focus moved to child modal
      if (this.onModalOpenedListener) {
        this.onModalOpenedListener(modal);
      }

      return {
        handled: true,
        action: 'OPENED_MODAL',
        popupViewId: modal.viewId,
        eventEmitted: event,
      };
    }

    return {
      handled: false,
      action: 'BLOCKED',
      eventEmitted: event,
    };
  }

  /**
   * Close hook: Simulates WebChromeClient.onCloseWindow / WKUIDelegate.webViewDidClose
   */
  public handleCloseWindow(modalViewId?: string): boolean {
    if (this.activeModals.length === 0) {
      return false;
    }

    let targetModal: GoatModalWebViewInstance | undefined;
    if (modalViewId) {
      const idx = this.activeModals.findIndex((m) => m.viewId === modalViewId);
      if (idx !== -1) {
        targetModal = this.activeModals.splice(idx, 1)[0];
      }
    } else {
      targetModal = this.activeModals.pop();
    }

    if (!targetModal) {
      return false;
    }

    this.pool.release(targetModal);
    this.hasFocus = true; // focus restored to parent

    if (this.onModalClosedListener) {
      this.onModalClosedListener(targetModal.viewId);
    }
    return true;
  }

  /**
   * Cascading Teardown on Parent Destruction
   */
  public destroy(): void {
    for (const modal of this.activeModals) {
      this.pool.release(modal, false);
    }
    this.activeModals = [];
    this.emittedEvents = [];
    this.systemBrowserInvocations = [];
    this.systemIntentsDispatched = [];
    this.isDestroyed = true;
  }
}

/**
 * React Native Fabric Simulator for GoatWebView popup props & events
 */
export class ReactNativeGoatWebViewPopupSimulator {
  public popupRoutingPolicy: GoatPopupRoutingPolicy = 'AUTO';
  public onPopupRequestReceived: Array<Record<string, any>> = [];
  public manager: GoatPopupManagerSimulator;

  constructor(appId: string) {
    this.manager = new GoatPopupManagerSimulator(appId);
    this.manager.onPopupRequestListener = (event) => {
      this.onPopupRequestReceived.push({
        url: event.data.url,
        target: event.data.target,
        policy: event.data.policy,
        isUserGesture: event.data.isUserGesture,
        isDialog: event.data.isDialog,
        windowFeaturesJson: JSON.stringify(event.data.windowFeatures),
      });
    };
  }

  public setPopupRoutingPolicy(policy: GoatPopupRoutingPolicy): void {
    this.popupRoutingPolicy = policy;
    this.manager.popupRoutingPolicy = policy;
  }

  public triggerPopup(url: string, target = '_blank', features = ''): GoatPopupNavigationResult {
    return this.manager.handleCreateWindow({ url, target, windowFeatures: features });
  }
}

/**
 * Flutter PlatformView & MethodChannel Simulator for GoatWebView
 */
export class FlutterGoatWebViewPopupSimulator {
  public popupRoutingPolicy: GoatPopupRoutingPolicy = 'AUTO';
  public popupStreamHistory: GoatPopupRequestEvent[] = [];
  public manager: GoatPopupManagerSimulator;

  constructor(appId: string) {
    this.manager = new GoatPopupManagerSimulator(appId);
    this.manager.onPopupRequestListener = (event) => {
      this.popupStreamHistory.push(event);
    };
  }

  public async setPopupRoutingPolicy(policy: GoatPopupRoutingPolicy): Promise<void> {
    this.popupRoutingPolicy = policy;
    this.manager.popupRoutingPolicy = policy;
  }

  public triggerWindowOpen(url: string, target = '_blank', features = ''): GoatPopupNavigationResult {
    return this.manager.handleCreateWindow({ url, target, windowFeatures: features });
  }
}
