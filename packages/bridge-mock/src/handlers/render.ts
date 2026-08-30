/**
 * @goat/bridge-mock - Domain 17: Visual Rendering & Same-Layer Handlers (10 Actions)
 */

import { mockState } from "../state/store.js";
import {
  RenderLayerConfigResult,
  GestureScrollStateResult,
  NativeComponentDescriptorResult,
} from "../types.js";
import { GoatBridgeError, BridgeErrorCodes } from "../errors.js";

export class RenderHandlers {
  private static lastScrollY: number = 0;

  /**
   * Action 174: CONFIGURE_TRANSPARENCY
   */
  public static configureTransparency(
    payload: any = {},
  ): RenderLayerConfigResult {
    const isTransparent = !!payload.isTransparent;
    const customBgHex =
      payload.customBgHex || (isTransparent ? "#00000000" : "#FFFFFF");

    mockState.isTransparentWindow = isTransparent;
    mockState.windowBgHex = customBgHex;

    return {
      isTransparent,
      backgroundColorHex: customBgHex,
      isHardwareAccelerated: true,
      isWhiteFlashPrevented: true,
    };
  }

  /**
   * Action 175: SYNC_THEME_BACKGROUND
   */
  public static syncThemeBg(payload: any = {}): {
    isTransparent: boolean;
    backgroundColorHex: string;
    isWhiteFlashPrevented: boolean;
  } {
    const isDark = !!payload.isDark;
    const backgroundColorHex = isDark ? "#121212" : "#FFFFFF";
    mockState.statusBarDark = isDark;
    mockState.windowBgHex = backgroundColorHex;

    return {
      isTransparent: mockState.isTransparentWindow,
      backgroundColorHex,
      isWhiteFlashPrevented: true,
    };
  }

  /**
   * Action 176: GET_RENDER_LAYER_CONFIG
   */
  public static getRenderLayerConfig(): RenderLayerConfigResult {
    return {
      isTransparent: mockState.isTransparentWindow,
      backgroundColorHex: mockState.windowBgHex,
      isHardwareAccelerated: true,
      isWhiteFlashPrevented: true,
    };
  }

  /**
   * Action 177: GESTURE_SCROLL_UPDATE
   */
  public static gestureScrollUpdate(
    payload: any = {},
  ): GestureScrollStateResult {
    const scrollY = typeof payload.scrollY === "number" ? payload.scrollY : 0;
    const maxScrollY =
      typeof payload.maxScrollY === "number" ? payload.maxScrollY : 1000;
    const direction = payload.direction || "VERTICAL";

    this.lastScrollY = scrollY;
    const isBoundary = scrollY <= 0 || scrollY >= maxScrollY;

    return {
      isScrollBoundaryReached: isBoundary,
      canParentIntercept: scrollY <= 0,
      activeDirection: direction,
      scrollOffsetPx: scrollY,
      isFlingActive: false,
    };
  }

  /**
   * Action 178: SHOULD_PARENT_INTERCEPT
   */
  public static shouldParentIntercept(payload: any = {}): {
    shouldIntercept: boolean;
  } {
    const deltaY = typeof payload.deltaY === "number" ? payload.deltaY : 0;
    const shouldIntercept = this.lastScrollY <= 0 && deltaY > 0;
    return { shouldIntercept };
  }

  /**
   * Action 179: RESET_GESTURE_COORDINATOR
   */
  public static resetGestureCoordinator(): { reset: boolean } {
    this.lastScrollY = 0;
    return { reset: true };
  }

  /**
   * Action 180: EMBED_NATIVE_VIEW
   */
  public static embedNativeView(
    payload: any = {},
  ): NativeComponentDescriptorResult {
    const componentId =
      payload.componentId || payload.viewId || `native_view_${Date.now()}`;
    const componentType = payload.componentType || "map";
    const x = typeof payload.x === "number" ? payload.x : 0;
    const y = typeof payload.y === "number" ? payload.y : 0;
    const width = typeof payload.width === "number" ? payload.width : 320;
    const height = typeof payload.height === "number" ? payload.height : 240;
    const zIndex = typeof payload.zIndex === "number" ? payload.zIndex : 1;
    const opacity = typeof payload.opacity === "number" ? payload.opacity : 1.0;
    const cornerRadius =
      typeof payload.cornerRadius === "number" ? payload.cornerRadius : 0;

    const descriptor: NativeComponentDescriptorResult = {
      componentId,
      componentType,
      x,
      y,
      width,
      height,
      zIndex,
      opacity,
      cornerRadius,
      isVisible: true,
    };

    mockState.activeNativeViews.set(componentId, descriptor);
    return descriptor;
  }

  /**
   * Action 181: UPDATE_NATIVE_VIEW_BOUNDS
   */
  public static updateNativeViewBounds(payload: any = {}): {
    componentId: string;
    updated: boolean;
  } {
    const componentId = payload.componentId || payload.viewId;
    if (!componentId || !mockState.activeNativeViews.has(componentId)) {
      throw new GoatBridgeError(
        BridgeErrorCodes.INVALID_ARGUMENT,
        `Native view not found: "${componentId}"`,
      );
    }

    const current = mockState.activeNativeViews.get(componentId)!;
    if (typeof payload.x === "number") current.x = payload.x;
    if (typeof payload.y === "number") current.y = payload.y;
    if (typeof payload.width === "number") current.width = payload.width;
    if (typeof payload.height === "number") current.height = payload.height;
    if (typeof payload.zIndex === "number") current.zIndex = payload.zIndex;
    if (typeof payload.opacity === "number") current.opacity = payload.opacity;
    if (typeof payload.cornerRadius === "number")
      current.cornerRadius = payload.cornerRadius;
    if (typeof payload.isVisible === "boolean")
      current.isVisible = payload.isVisible;

    return { componentId, updated: true };
  }

  /**
   * Action 182: REMOVE_NATIVE_VIEW
   */
  public static removeNativeView(payload: any = {}): {
    componentId: string;
    removed: boolean;
  } {
    const componentId = payload.componentId || payload.id;
    if (componentId) {
      const removed = mockState.activeNativeViews.delete(componentId);
      return { componentId, removed };
    }
    return { componentId: "", removed: false };
  }

  /**
   * Action 183: GET_ACTIVE_NATIVE_VIEWS
   */
  public static getActiveNativeViews(): {
    totalActive: number;
    views: NativeComponentDescriptorResult[];
  } {
    const views = Array.from(mockState.activeNativeViews.values());
    return { totalActive: views.length, views };
  }
}
