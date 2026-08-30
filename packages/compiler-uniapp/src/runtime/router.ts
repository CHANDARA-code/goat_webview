/**
 * @goat/compiler-uniapp Navigation & Routing JSAPI Shims
 * Bridges Uni-app navigation calls to Goat WebView multi-page stack operations.
 */
import { callBridgeAction } from './bridge.js';
import type {
  NavigateBackOptions,
  NavigateToOptions,
  RedirectToOptions,
  ReLaunchOptions,
  SwitchTabOptions,
  UniError,
} from '../types.js';

interface PageStackEntry {
  url: string;
  isTab: boolean;
}

const pageStack: PageStackEntry[] = [{ url: 'pages/index/index', isTab: true }];
const tabPages = new Set<string>();

export function registerTabPages(tabs: string[]): void {
  tabPages.clear();
  for (const t of tabs) {
    tabPages.add(t.replace(/^\//, ''));
  }
}

export function getPageStack(): PageStackEntry[] {
  return [...pageStack];
}

export function resetPageStack(initialUrl = 'pages/index/index'): void {
  pageStack.length = 0;
  pageStack.push({ url: initialUrl.replace(/^\//, ''), isTab: tabPages.has(initialUrl.replace(/^\//, '')) });
}

function normalizeUrl(url: string): string {
  return url.replace(/^\//, '').split('?')[0];
}

/**
 * uni.navigateTo
 */
export function navigateTo(options: NavigateToOptions): Promise<{ errMsg: string }> {
  if (!options || typeof options.url !== 'string' || !options.url) {
    const err: UniError = { errMsg: 'navigateTo:fail url must be a non-empty string' };
    options?.fail?.(err);
    options?.complete?.(err);
    return Promise.reject(err);
  }

  const normalized = normalizeUrl(options.url);

  // In mini-programs, navigateTo cannot target a tabBar page
  if (tabPages.has(normalized)) {
    const err: UniError = { errMsg: 'navigateTo:fail can not navigate to a tab bar page' };
    options.fail?.(err);
    options.complete?.(err);
    return Promise.reject(err);
  }

  pageStack.push({ url: normalized, isTab: false });

  return callBridgeAction('NAV_PUSH', {
    route: options.url,
    url: options.url,
    animationType: options.animationType,
    animationDuration: options.animationDuration,
  })
    .then(() => {
      const res = { errMsg: 'navigateTo:ok' };
      options.success?.(res);
      options.complete?.(res);
      return res;
    })
    .catch((err: any) => {
      pageStack.pop();
      const error: UniError = { errMsg: err.errMsg || `navigateTo:fail ${err.message || 'navigation failed'}` };
      options.fail?.(error);
      options.complete?.(error);
      return Promise.reject(error);
    });
}

/**
 * uni.redirectTo
 */
export function redirectTo(options: RedirectToOptions): Promise<{ errMsg: string }> {
  if (!options || typeof options.url !== 'string' || !options.url) {
    const err: UniError = { errMsg: 'redirectTo:fail url must be a non-empty string' };
    options?.fail?.(err);
    options?.complete?.(err);
    return Promise.reject(err);
  }

  const normalized = normalizeUrl(options.url);

  if (tabPages.has(normalized)) {
    const err: UniError = { errMsg: 'redirectTo:fail can not redirect to a tab bar page' };
    options.fail?.(err);
    options.complete?.(err);
    return Promise.reject(err);
  }

  if (pageStack.length > 0) {
    pageStack.pop();
  }
  pageStack.push({ url: normalized, isTab: false });

  return callBridgeAction('NAV_REPLACE', {
    route: options.url,
    url: options.url,
  })
    .then(() => {
      const res = { errMsg: 'redirectTo:ok' };
      options.success?.(res);
      options.complete?.(res);
      return res;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: err.errMsg || `redirectTo:fail ${err.message || 'redirect failed'}` };
      options.fail?.(error);
      options.complete?.(error);
      return Promise.reject(error);
    });
}

/**
 * uni.navigateBack
 */
export function navigateBack(options?: NavigateBackOptions): Promise<{ errMsg: string }> {
  const delta = options?.delta && options.delta > 0 ? options.delta : 1;

  // Prevent popping below root
  const pops = Math.min(delta, Math.max(0, pageStack.length - 1));
  for (let i = 0; i < pops; i++) {
    pageStack.pop();
  }

  return callBridgeAction('NAV_POP', {
    delta: pops,
    animationType: options?.animationType,
    animationDuration: options?.animationDuration,
  })
    .then(() => {
      const res = { errMsg: 'navigateBack:ok' };
      options?.success?.(res);
      options?.complete?.(res);
      return res;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: err.errMsg || `navigateBack:fail ${err.message || 'pop failed'}` };
      options?.fail?.(error);
      options?.complete?.(error);
      return Promise.reject(error);
    });
}

/**
 * uni.switchTab
 */
export function switchTab(options: SwitchTabOptions): Promise<{ errMsg: string }> {
  if (!options || typeof options.url !== 'string' || !options.url) {
    const err: UniError = { errMsg: 'switchTab:fail url must be a non-empty string' };
    options?.fail?.(err);
    options?.complete?.(err);
    return Promise.reject(err);
  }

  const normalized = normalizeUrl(options.url);

  if (tabPages.size > 0 && !tabPages.has(normalized)) {
    const err: UniError = { errMsg: 'switchTab:fail can not switch to non-tabBar page' };
    options.fail?.(err);
    options.complete?.(err);
    return Promise.reject(err);
  }

  // Clear stack down to target tab
  pageStack.length = 0;
  pageStack.push({ url: normalized, isTab: true });

  return callBridgeAction('TAB_SWITCH', {
    route: options.url,
    url: options.url,
  })
    .then(() => {
      const res = { errMsg: 'switchTab:ok' };
      options.success?.(res);
      options.complete?.(res);
      return res;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: err.errMsg || `switchTab:fail ${err.message || 'tab switch failed'}` };
      options.fail?.(error);
      options.complete?.(error);
      return Promise.reject(error);
    });
}

/**
 * uni.reLaunch
 */
export function reLaunch(options: ReLaunchOptions): Promise<{ errMsg: string }> {
  if (!options || typeof options.url !== 'string' || !options.url) {
    const err: UniError = { errMsg: 'reLaunch:fail url must be a non-empty string' };
    options?.fail?.(err);
    options?.complete?.(err);
    return Promise.reject(err);
  }

  const normalized = normalizeUrl(options.url);
  pageStack.length = 0;
  pageStack.push({ url: normalized, isTab: tabPages.has(normalized) });

  return callBridgeAction('NAV_POP_TO_ROOT', {})
    .then(() =>
      callBridgeAction('NAV_REPLACE', {
        route: options.url,
        url: options.url,
      })
    )
    .then(() => {
      const res = { errMsg: 'reLaunch:ok' };
      options.success?.(res);
      options.complete?.(res);
      return res;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: err.errMsg || `reLaunch:fail ${err.message || 'relaunch failed'}` };
      options.fail?.(error);
      options.complete?.(error);
      return Promise.reject(error);
    });
}

/**
 * uni.preloadPage
 */
export function preloadPage(options: { url: string } & { success?: () => void; fail?: (err: any) => void }): Promise<{ errMsg: string }> {
  return callBridgeAction('LOAD_SUBPACKAGE', { route: options.url })
    .then(() => {
      const res = { errMsg: 'preloadPage:ok' };
      options.success?.();
      return res;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: `preloadPage:fail ${err.message || 'preload failed'}` };
      options.fail?.(error);
      return Promise.reject(error);
    });
}
