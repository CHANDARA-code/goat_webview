/**
 * @goat/bridge-mock - Domain 5: UI Feedback, Navigation Bar, Bottom Sheet & Window Insets (28 Actions)
 */

import { mockState } from '../state/store.js';
import { externalLinkModal } from '../ui/external-link-modal.js';
import {
  ShowToastResult,
  ShowModalResult,
  ShowActionSheetResult,
  LoadingResult,
  KeyboardInsetsResult,
  NavBarTitleResult,
  NavBarColorResult,
  NavBarButtonsResult,
  NavBarProgressResult,
  BottomSheetResult,
  BottomSheetSnapPointsResult,
  SafeAreaInsetsResult,
  OpenExternalLinkResult,
  TabOpenResult,
  TabCloseResult,
  TabSwitchResult,
  TabListResult,
  TabCloseAllResult,
  TabHandle,
  OpenMiniAppResult,
  CloseMiniAppResult,
} from '../types.js';
import { GoatBridgeError, BridgeErrorCodes } from '../errors.js';

export class UIHandlers {
  private static activeToastTimer: any = null;
  private static tabCounter: number = 100;

  /**
   * Action 50: SHOW_TOAST
   */
  public static showToast(payload: any = {}): ShowToastResult {
    const title = String(payload.title || 'Toast message');
    const icon = payload.icon || 'none';
    const duration = typeof payload.duration === 'number' ? payload.duration : 1500;

    return {
      shown: true,
      title,
      duration,
      icon,
    };
  }

  /**
   * Action 51: HIDE_TOAST
   */
  public static hideToast(): { hidden: boolean } {
    return { hidden: true };
  }

  /**
   * Action 52: SHOW_MODAL
   */
  public static showModal(payload: any = {}): ShowModalResult {
    if (!mockState.checkAndRecordDialog(500)) {
      throw new GoatBridgeError(
        BridgeErrorCodes.DIALOG_COOLDOWN_ACTIVE,
        'Dialog cooldown active: please wait 500ms between modal invocations'
      );
    }

    const title = payload.title || '';
    const content = payload.content || '';
    return {
      confirm: true,
      cancel: false,
      title,
      content,
    };
  }

  /**
   * Action 53: SHOW_ACTION_SHEET
   */
  public static showActionSheet(payload: any = {}): ShowActionSheetResult {
    if (!mockState.checkAndRecordDialog(500)) {
      throw new GoatBridgeError(
        BridgeErrorCodes.DIALOG_COOLDOWN_ACTIVE,
        'Dialog cooldown active: please wait 500ms between dialog invocations'
      );
    }

    const items = Array.isArray(payload.itemList) ? payload.itemList : [];
    if (items.length === 0) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'itemList must contain at least one item');
    }

    return {
      tapIndex: 0,
      itemCount: items.length,
    };
  }

  /**
   * Action 54: SHOW_LOADING
   */
  public static showLoading(payload: any = {}): LoadingResult {
    return {
      shown: true,
      title: payload.title || 'Loading...',
    };
  }

  /**
   * Action 55: HIDE_LOADING
   */
  public static hideLoading(): LoadingResult {
    return { hidden: true };
  }

  /**
   * Action 56: GET_KEYBOARD_INSETS
   */
  public static getKeyboardInsets(): KeyboardInsetsResult {
    return { ...mockState.keyboardInsets };
  }

  /**
   * Action 57: SET_KEYBOARD_INSETS
   */
  public static setKeyboardInsets(payload: any = {}): KeyboardInsetsResult {
    const heightPx = typeof payload.heightPx === 'number' ? payload.heightPx : 0;
    mockState.keyboardInsets = {
      isVisible: heightPx > 0,
      heightPx,
      durationMs: payload.durationMs || 250,
      adjustedViewportBottomInset: heightPx,
    };
    return { ...mockState.keyboardInsets };
  }

  /**
   * Action 58: SET_NAV_BAR_TITLE
   */
  public static setNavBarTitle(payload: any = {}): NavBarTitleResult {
    const title = payload.title || '';
    const subtitle = payload.subtitle;
    mockState.navBar.title = title;
    mockState.navBar.subtitle = subtitle;
    return { title, subtitle, success: true };
  }

  /**
   * Action 59: SET_NAV_BAR_COLOR
   */
  public static setNavBarColor(payload: any = {}): NavBarColorResult {
    const backgroundColor = payload.backgroundColor || '#FFFFFF';
    const textColor = payload.textColor || '#000000';
    const isDark = typeof payload.isDark === 'boolean' ? payload.isDark : false;

    mockState.navBar.backgroundColor = backgroundColor;
    mockState.navBar.textColor = textColor;
    mockState.navBar.isDark = isDark;

    return { backgroundColor, textColor, isDark, success: true };
  }

  /**
   * Action 60: SET_NAV_BAR_BUTTONS
   */
  public static setNavBarButtons(payload: any = {}): NavBarButtonsResult {
    const left = payload.left;
    const right = Array.isArray(payload.right) ? payload.right : [];

    mockState.navBar.leftButton = left;
    mockState.navBar.rightButtons = right;

    return { left, right, success: true };
  }

  /**
   * Action 61: SET_NAV_BAR_PROGRESS
   */
  public static setNavBarProgress(payload: any = {}): NavBarProgressResult {
    const visible = !!payload.visible;
    const progress = typeof payload.progress === 'number' ? Math.max(0, Math.min(100, payload.progress)) : 0;

    mockState.navBar.isProgressVisible = visible;
    mockState.navBar.progress = progress;

    return { visible, progress, success: true };
  }

  /**
   * Action 62: EXPAND_BOTTOM_SHEET
   */
  public static expandBottomSheet(): BottomSheetResult {
    mockState.bottomSheet = {
      ...mockState.bottomSheet,
      currentSnap: 2,
      sheetValue: 'EXPANDED',
      isExpanded: true,
      isCollapsed: false,
      isDismissed: false,
      success: true,
    };
    return { ...mockState.bottomSheet };
  }

  /**
   * Action 63: COLLAPSE_BOTTOM_SHEET
   */
  public static collapseBottomSheet(): BottomSheetResult {
    mockState.bottomSheet = {
      ...mockState.bottomSheet,
      currentSnap: 0,
      sheetValue: 'COLLAPSED',
      isExpanded: false,
      isCollapsed: true,
      isDismissed: false,
      success: true,
    };
    return { ...mockState.bottomSheet };
  }

  /**
   * Action 64: SET_SHEET_SNAP_POINTS
   */
  public static setSheetSnapPoints(payload: any = {}): BottomSheetSnapPointsResult {
    const snapPoints = Array.isArray(payload.snapPoints) ? payload.snapPoints : [0.25, 0.5, 0.9];
    const initialSnap = typeof payload.initialSnap === 'number' ? payload.initialSnap : 0;
    const isDismissible = payload.isDismissible !== false;

    return {
      snapPoints,
      initialSnap,
      isDismissible,
      success: true,
    };
  }

  /**
   * Action 65: GET_SAFE_AREA_INSETS
   */
  public static getSafeAreaInsets(): SafeAreaInsetsResult {
    return { ...mockState.safeAreaInsets };
  }

  /**
   * Action 66 / 67 / 68: OPEN_EXTERNAL_LINK / OPEN_URL / OPEN_LINK
   */
  public static openExternalLink(payload: any = {}): Promise<OpenExternalLinkResult> {
    const url = payload.url || '';
    if (!url) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing required "url" parameter');
    }
    return externalLinkModal.prompt(payload);
  }

  /**
   * Action 69: TAB_OPEN
   */
  public static tabOpen(payload: any = {}, callerAppId: string = mockState.defaultAppId): TabOpenResult {
    const tabId = `tab_${++this.tabCounter}`;
    const appId = payload.appId || callerAppId;
    const initialRoute = payload.initialRoute || '/';
    const title = payload.title || 'New Tab';

    const handle: TabHandle = {
      tabId,
      appId,
      initialRoute,
      title,
      isBackgrounded: false,
      memoryTrimmed: false,
      createdAt: Date.now(),
    };

    mockState.tabs.push(handle);
    mockState.activeTabId = tabId;

    return { ...handle };
  }

  /**
   * Action 70: TAB_CLOSE
   */
  public static tabClose(payload: any = {}): TabCloseResult {
    const tabId = payload.tabId;
    const idx = mockState.tabs.findIndex((t) => t.tabId === tabId);
    if (idx >= 0) {
      mockState.tabs.splice(idx, 1);
      if (mockState.activeTabId === tabId) {
        mockState.activeTabId = mockState.tabs.length > 0 ? mockState.tabs[mockState.tabs.length - 1].tabId : null;
      }
      return { closed: true, tabId };
    }
    return { closed: false, tabId };
  }

  /**
   * Action 71: TAB_SWITCH
   */
  public static tabSwitch(payload: any = {}): TabSwitchResult {
    const tabId = payload.tabId;
    const tab = mockState.tabs.find((t) => t.tabId === tabId);
    if (tab) {
      mockState.activeTabId = tabId;
      return { switched: true, tabId };
    }
    return { switched: false, tabId };
  }

  /**
   * Action 72: TAB_GET_ACTIVE
   */
  public static tabGetActive(): TabHandle | null {
    if (!mockState.activeTabId) return null;
    return mockState.tabs.find((t) => t.tabId === mockState.activeTabId) || null;
  }

  /**
   * Action 73: TAB_LIST
   */
  public static tabList(): TabListResult {
    return { tabs: [...mockState.tabs] };
  }

  /**
   * Action 74: TAB_CLOSE_ALL
   */
  public static tabCloseAll(): TabCloseAllResult {
    mockState.tabs = [];
    mockState.activeTabId = null;
    return { closedAll: true };
  }

  /**
   * Action 75: OPEN_MINI_APP
   */
  public static openMiniApp(payload: any = {}): OpenMiniAppResult {
    const targetAppId = payload.targetAppId || 'com.goat.sample.child';
    const presentation = payload.presentation || 'WINDOWED';
    const instanceId = `inst_${Math.random().toString(36).substring(2, 10)}`;

    const res: OpenMiniAppResult = {
      instanceId,
      targetAppId,
      presentation,
      status: 'OPENED',
    };

    mockState.miniAppInstances.set(instanceId, res);
    return res;
  }

  /**
   * Action 76: CLOSE_MINI_APP
   */
  public static closeMiniApp(payload: any = {}): CloseMiniAppResult {
    const instanceId = payload.instanceId;
    if (instanceId && mockState.miniAppInstances.has(instanceId)) {
      mockState.miniAppInstances.delete(instanceId);
      return { closed: true, instanceId };
    }
    return { closed: true, instanceId: instanceId || 'current' };
  }

  /**
   * Action 77: ON_MINI_APP_CLOSED
   */
  public static onMiniAppClosed(): { registered: boolean } {
    return { registered: true };
  }
}
