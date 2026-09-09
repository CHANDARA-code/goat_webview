import { DSL_ACTION_MAP } from './actionMap';

/**
 * T12 — navigation & back-stack adapter.
 *
 * All five core methods are backed by engine actions that exist and dispatch on both platforms:
 *
 *   navigateTo   -> PUSH_HISTORY_STATE
 *   navigateBack -> NAVIGATE_BACK
 *   redirectTo   -> NAV_REPLACE
 *   reLaunch     -> NAV_POP_TO_ROOT
 *   switchTab    -> TAB_SWITCH
 *
 * preloadPage has no engine action. It is exposed and rejects with UNSUPPORTED_NAVIGATION rather
 * than being omitted or silently resolving -- a mini-app calling it must find out, not appear to
 * succeed and then sit on the wrong route.
 */

export const NAVIGATION_ACTIONS = Object.freeze({
  navigateTo: 'PUSH_HISTORY_STATE',
  navigateBack: 'NAVIGATE_BACK',
  redirectTo: 'NAV_REPLACE',
  reLaunch: 'NAV_POP_TO_ROOT',
  switchTab: 'TAB_SWITCH',
});

export const UNBACKED_NAVIGATION = Object.freeze({
  preloadPage: 'PRELOAD_PAGE',
});

export const UNSUPPORTED_NAVIGATION = 'UNSUPPORTED_NAVIGATION';

export function navigationActionFor(method: string): string | null {
  return (NAVIGATION_ACTIONS as Record<string, string>)[method] ?? null;
}

export function isUnbackedNavigation(method: string): boolean {
  return Object.prototype.hasOwnProperty.call(UNBACKED_NAVIGATION, method);
}

/** The engine action a currently-unbacked method would need. Used by docs and by the error text. */
export function requiredEngineAction(method: string): string | null {
  return (UNBACKED_NAVIGATION as Record<string, string>)[method] ?? null;
}

/** Navigation methods are intentionally absent from the generic DSL action map. */
export function navigationIsNotInGenericMap(): boolean {
  return !('navigateTo' in DSL_ACTION_MAP) && !('redirectTo' in DSL_ACTION_MAP);
}
