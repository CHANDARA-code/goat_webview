/**
 * @goat/bridge-mock - Domain 15: Navigation & Predictive Back Handlers (12 Actions)
 */

import { mockState } from '../state/store.js';
import {
  BackNavigationResult,
  PageStackResult,
  PageStackEntryPayload,
  PredictiveBackProgressPayload,
  PredictiveBackResult,
} from '../types.js';
import { GoatBridgeError, BridgeErrorCodes } from '../errors.js';

export class NavigationHandlers {
  private static historyRoutes: string[] = ['/pages/index/index'];
  private static currentHistoryIndex: number = 0;
  private static pageCounter: number = 1;

  /**
   * Action 153: CAN_GO_BACK
   */
  public static canGoBack(): { canGoBack: boolean; currentRoute: string } {
    const currentRoute = mockState.pageStack.length > 0
      ? mockState.pageStack[mockState.pageStack.length - 1].route
      : '/';
    return {
      canGoBack: mockState.pageStack.length > 1,
      currentRoute,
    };
  }

  /**
   * Action 154: HANDLE_BACK_PRESS
   */
  public static handleBackPress(): BackNavigationResult {
    const canGoBack = mockState.pageStack.length > 1;
    let routePopped: string | undefined;

    if (canGoBack) {
      const popped = mockState.pageStack.pop();
      routePopped = popped?.route;
      this.currentHistoryIndex = Math.max(0, this.currentHistoryIndex - 1);
    }

    return {
      action: 'POP',
      canGoBack: mockState.pageStack.length > 1,
      currentHistoryIndex: this.currentHistoryIndex,
      totalHistoryCount: mockState.pageStack.length,
      routePopped,
    };
  }

  /**
   * Action 155: PUSH_HISTORY_STATE
   */
  public static pushHistoryState(payload: any = {}): { route: string; historyIndex: number; canGoBack: boolean } {
    const route = payload.route || '/';
    this.historyRoutes.push(route);
    this.currentHistoryIndex = this.historyRoutes.length - 1;
    return {
      route,
      historyIndex: this.currentHistoryIndex,
      canGoBack: this.currentHistoryIndex > 0,
    };
  }

  /**
   * Action 156: GET_CURRENT_ROUTE
   */
  public static getCurrentRoute(): { currentRoute: string } {
    const currentRoute = mockState.pageStack.length > 0
      ? mockState.pageStack[mockState.pageStack.length - 1].route
      : '/pages/index/index';
    return { currentRoute };
  }

  /**
   * Action 157: NAV_PUSH
   */
  public static navPush(payload: any = {}): PageStackResult {
    const route = payload.route || payload.url || '/pages/detail/index';
    const title = payload.title || 'Page';
    const pageId = `page_${++this.pageCounter}`;

    const newPage: PageStackEntryPayload = {
      pageId,
      route,
      title,
      isSuspended: false,
    };

    mockState.pageStack.push(newPage);

    return {
      action: 'PUSH',
      activePage: newPage,
      stackDepth: mockState.pageStack.length,
      canPop: mockState.pageStack.length > 1,
      totalCount: mockState.pageStack.length,
      stack: [...mockState.pageStack],
    };
  }

  /**
   * Action 158: NAV_POP
   */
  public static navPop(): PageStackResult {
    let popped: PageStackEntryPayload | undefined;
    if (mockState.pageStack.length > 1) {
      popped = mockState.pageStack.pop();
    }
    const activePage = mockState.pageStack[mockState.pageStack.length - 1];

    return {
      action: 'POP',
      activePage,
      stackDepth: mockState.pageStack.length,
      canPop: mockState.pageStack.length > 1,
      totalCount: mockState.pageStack.length,
      stack: [...mockState.pageStack],
    };
  }

  /**
   * Action 159: NAV_POP_TO_ROOT
   */
  public static navPopToRoot(): PageStackResult {
    if (mockState.pageStack.length > 1) {
      mockState.pageStack = [mockState.pageStack[0]];
    }
    return {
      action: 'POP_TO_ROOT',
      activePage: mockState.pageStack[0],
      stackDepth: 1,
      canPop: false,
      totalCount: 1,
      stack: [...mockState.pageStack],
    };
  }

  /**
   * Action 160: NAV_REPLACE
   */
  public static navReplace(payload: any = {}): PageStackResult {
    const route = payload.route || payload.url || '/pages/home/index';
    const title = payload.title || 'Replaced Page';
    const pageId = `page_${++this.pageCounter}`;

    const newPage: PageStackEntryPayload = {
      pageId,
      route,
      title,
      isSuspended: false,
    };

    if (mockState.pageStack.length > 0) {
      mockState.pageStack[mockState.pageStack.length - 1] = newPage;
    } else {
      mockState.pageStack.push(newPage);
    }

    return {
      action: 'REPLACE',
      activePage: newPage,
      stackDepth: mockState.pageStack.length,
      canPop: mockState.pageStack.length > 1,
      totalCount: mockState.pageStack.length,
      stack: [...mockState.pageStack],
    };
  }

  /**
   * Action 161: GET_PAGE_STACK
   */
  public static getPageStack(): { totalCount: number; stack: PageStackEntryPayload[] } {
    return {
      totalCount: mockState.pageStack.length,
      stack: [...mockState.pageStack],
    };
  }

  /**
   * Action 162: PREDICTIVE_BACK_PROGRESS
   */
  public static predictiveBackProgress(payload: PredictiveBackProgressPayload = { progress: 0 }): PredictiveBackResult {
    const p = Math.max(0, Math.min(1, payload.progress || 0));
    // Calculate gesture physics
    const interpolatedScale = Number((1.0 - p * 0.1).toFixed(4)); // Scale down to 0.90
    const interpolatedAlpha = Number((1.0 - p * 0.3).toFixed(4)); // Fade to 0.70
    const interpolatedTranslationX = Number((p * 120).toFixed(2)); // Slide right 120px

    return {
      action: 'PROGRESS',
      progress: p,
      interpolatedScale,
      interpolatedAlpha,
      interpolatedTranslationX,
      canGoBackInWebView: mockState.pageStack.length > 1,
    };
  }

  /**
   * Action 163: PREDICTIVE_BACK_INVOKE
   */
  public static predictiveBackInvoke(): PredictiveBackResult {
    let poppedRoute: string | undefined;
    if (mockState.pageStack.length > 1) {
      const popped = mockState.pageStack.pop();
      poppedRoute = popped?.route;
    }
    return {
      action: 'INVOKE',
      canGoBackInWebView: mockState.pageStack.length > 1,
      poppedRoute,
    };
  }

  /**
   * Action 164: PREDICTIVE_BACK_CANCEL
   */
  public static predictiveBackCancel(): PredictiveBackResult {
    return {
      action: 'CANCEL',
      canGoBackInWebView: mockState.pageStack.length > 1,
    };
  }
}
