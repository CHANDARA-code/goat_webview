/**
 * @goat/compiler-taro - Router JSAPI Runtime Bridge
 * Implements Taro.navigateTo, redirectTo, navigateBack, switchTab, reLaunch, and getCurrentPages.
 */

import { invokeBridgeCallback } from './bridge.js';
import {
  NavigateToOptions,
  NavigateToSuccessResult,
  RedirectToOptions,
  NavigateBackOptions,
  SwitchTabOptions,
  ReLaunchOptions,
  GeneralCallbackResult,
} from '../types.js';

interface PageInstance {
  route: string;
  options: Record<string, string>;
}

const MAX_STACK_DEPTH = 10;
const pageStack: PageInstance[] = [{ route: 'pages/index/index', options: {} }];

/**
 * Creates an event channel instance for page-to-page communication
 */
function createEventChannel(events: Record<string, (...args: any[]) => void> = {}) {
  const listeners = new Map<string, Set<(...args: any[]) => void>>();

  for (const [key, fn] of Object.entries(events)) {
    listeners.set(key, new Set([fn]));
  }

  return {
    emit(event: string, ...args: any[]) {
      listeners.get(event)?.forEach((fn) => fn(...args));
    },
    on(event: string, fn: (...args: any[]) => void) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(fn);
    },
    once(event: string, fn: (...args: any[]) => void) {
      const onceWrapper = (...args: any[]) => {
        listeners.get(event)?.delete(onceWrapper);
        fn(...args);
      };
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(onceWrapper);
    },
    off(event: string, fn?: (...args: any[]) => void) {
      if (fn) {
        listeners.get(event)?.delete(fn);
      } else {
        listeners.delete(event);
      }
    },
  };
}

/**
 * Taro.navigateTo -> NAV_PUSH
 */
export async function navigateTo(options: NavigateToOptions): Promise<NavigateToSuccessResult> {
  if (!options || !options.url) {
    const err = { errMsg: 'navigateTo:fail url is required', code: 'INVALID_ARGUMENT' };
    options?.fail?.(err);
    options?.complete?.(err);
    throw err;
  }

  if (pageStack.length >= MAX_STACK_DEPTH) {
    const err = { errMsg: 'navigateTo:fail page stack depth limit exceeded (max 10)', code: 'STACK_OVERFLOW' };
    options?.fail?.(err);
    options?.complete?.(err);
    throw err;
  }

  const eventChannel = createEventChannel(options.events);
  const route = options.url.split('?')[0] || options.url;

  return invokeBridgeCallback<NavigateToSuccessResult, NavigateToOptions>(
    'navigateTo',
    'NAV_PUSH',
    { url: options.url, route, animated: true },
    options,
    () => {
      pageStack.push({ route, options: {} });
      return { eventChannel };
    },
    (err) => err?.message || 'navigation failed'
  );
}

/**
 * Taro.redirectTo -> NAV_REPLACE
 */
export async function redirectTo(options: RedirectToOptions): Promise<GeneralCallbackResult> {
  if (!options || !options.url) {
    const err = { errMsg: 'redirectTo:fail url is required', code: 'INVALID_ARGUMENT' };
    options?.fail?.(err);
    options?.complete?.(err);
    throw err;
  }

  const route = options.url.split('?')[0] || options.url;

  return invokeBridgeCallback<GeneralCallbackResult, RedirectToOptions>(
    'redirectTo',
    'NAV_REPLACE',
    { url: options.url, route },
    options,
    () => {
      if (pageStack.length > 0) {
        pageStack[pageStack.length - 1] = { route, options: {} };
      } else {
        pageStack.push({ route, options: {} });
      }
      return { errMsg: 'redirectTo:ok' };
    },
    (err) => err?.message || 'redirect failed'
  );
}

/**
 * Taro.navigateBack -> NAV_POP
 */
export async function navigateBack(options: NavigateBackOptions = {}): Promise<GeneralCallbackResult> {
  if (pageStack.length <= 1) {
    const err = { errMsg: 'navigateBack:fail cannot pop root page', code: 'STACK_UNDERFLOW' };
    options?.fail?.(err);
    options?.complete?.(err);
    throw err;
  }

  const delta = Math.min(options.delta || 1, pageStack.length - 1);

  return invokeBridgeCallback<GeneralCallbackResult, NavigateBackOptions>(
    'navigateBack',
    'NAV_POP',
    { delta, animated: true },
    options,
    () => {
      for (let i = 0; i < delta; i++) {
        if (pageStack.length > 1) {
          pageStack.pop();
        }
      }
      return { errMsg: 'navigateBack:ok' };
    },
    (err) => err?.message || 'navigate back failed'
  );
}

/**
 * Taro.switchTab -> TAB_SWITCH
 */
export async function switchTab(options: SwitchTabOptions): Promise<GeneralCallbackResult> {
  if (!options || !options.url) {
    const err = { errMsg: 'switchTab:fail url is required', code: 'INVALID_ARGUMENT' };
    options?.fail?.(err);
    options?.complete?.(err);
    throw err;
  }

  const route = options.url.split('?')[0] || options.url;

  return invokeBridgeCallback<GeneralCallbackResult, SwitchTabOptions>(
    'switchTab',
    'TAB_SWITCH',
    { url: options.url, route },
    options,
    () => {
      pageStack.length = 0;
      pageStack.push({ route, options: {} });
      return { errMsg: 'switchTab:ok' };
    },
    (err) => err?.message || 'switch tab failed'
  );
}

/**
 * Taro.reLaunch -> NAV_POP_TO_ROOT
 */
export async function reLaunch(options: ReLaunchOptions): Promise<GeneralCallbackResult> {
  if (!options || !options.url) {
    const err = { errMsg: 'reLaunch:fail url is required', code: 'INVALID_ARGUMENT' };
    options?.fail?.(err);
    options?.complete?.(err);
    throw err;
  }

  const route = options.url.split('?')[0] || options.url;

  return invokeBridgeCallback<GeneralCallbackResult, ReLaunchOptions>(
    'reLaunch',
    'NAV_POP_TO_ROOT',
    { url: options.url, route },
    options,
    () => {
      pageStack.length = 0;
      pageStack.push({ route, options: {} });
      return { errMsg: 'reLaunch:ok' };
    },
    (err) => err?.message || 'relaunch failed'
  );
}

/**
 * Taro.getCurrentPages -> Returns array of active page instances
 */
export function getCurrentPages(): PageInstance[] {
  return [...pageStack];
}

/**
 * Resets the page stack (for test simulation)
 */
export function __resetPageStack(initialRoute = 'pages/index/index'): void {
  pageStack.length = 0;
  pageStack.push({ route: initialRoute, options: {} });
}
