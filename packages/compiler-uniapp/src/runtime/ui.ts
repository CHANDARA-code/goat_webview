/**
 * @goat/compiler-uniapp UI & Navigation Bar JSAPI Shims
 */
import { callBridgeAction, createUniApiWrapper } from './bridge.js';
import type {
  ActionSheetResult,
  HideLoadingOptions,
  HideToastOptions,
  ModalResult,
  SetNavigationBarColorOptions,
  SetNavigationBarTitleOptions,
  ShowActionSheetOptions,
  ShowLoadingOptions,
  ShowModalOptions,
  ShowToastOptions,
  UniError,
} from '../types.js';

/**
 * uni.showToast
 */
export function showToast(options: ShowToastOptions): Promise<{ errMsg: string }> {
  if (!options || typeof options.title !== 'string') {
    const err: UniError = { errMsg: 'showToast:fail title is required' };
    options?.fail?.(err);
    options?.complete?.(err);
    return Promise.reject(err);
  }

  return callBridgeAction('SHOW_TOAST', {
    title: options.title,
    icon: options.icon || 'success',
    duration: options.duration ?? 1500,
    mask: options.mask ?? false,
    image: options.image,
  })
    .then(() => {
      const res = { errMsg: 'showToast:ok' };
      options.success?.(res);
      options.complete?.(res);
      return res;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: err.errMsg || `showToast:fail ${err.message || 'error'}` };
      options.fail?.(error);
      options.complete?.(error);
      return Promise.reject(error);
    });
}

/**
 * uni.hideToast
 */
export function hideToast(options?: HideToastOptions): Promise<{ errMsg: string }> {
  return callBridgeAction('HIDE_TOAST', {})
    .then(() => {
      const res = { errMsg: 'hideToast:ok' };
      options?.success?.(res);
      options?.complete?.(res);
      return res;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: err.errMsg || `hideToast:fail ${err.message || 'error'}` };
      options?.fail?.(error);
      options?.complete?.(error);
      return Promise.reject(error);
    });
}

/**
 * uni.showLoading
 */
export function showLoading(options: ShowLoadingOptions = {}): Promise<{ errMsg: string }> {
  return callBridgeAction('SHOW_LOADING', {
    title: options.title || 'Loading...',
    mask: options.mask ?? true,
  })
    .then(() => {
      const res = { errMsg: 'showLoading:ok' };
      options.success?.(res);
      options.complete?.(res);
      return res;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: err.errMsg || `showLoading:fail ${err.message || 'error'}` };
      options.fail?.(error);
      options.complete?.(error);
      return Promise.reject(error);
    });
}

/**
 * uni.hideLoading
 */
export function hideLoading(options?: HideLoadingOptions): Promise<{ errMsg: string }> {
  return callBridgeAction('HIDE_LOADING', {})
    .then(() => {
      const res = { errMsg: 'hideLoading:ok' };
      options?.success?.(res);
      options?.complete?.(res);
      return res;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: err.errMsg || `hideLoading:fail ${err.message || 'error'}` };
      options?.fail?.(error);
      options?.complete?.(error);
      return Promise.reject(error);
    });
}

/**
 * uni.showModal
 */
export function showModal(options: ShowModalOptions): Promise<ModalResult> {
  if (!options || typeof options.content !== 'string' || !options.content.trim()) {
    const err: UniError = { errMsg: 'showModal:fail content must not be blank' };
    options?.fail?.(err);
    options?.complete?.(err);
    return Promise.reject(err);
  }

  return callBridgeAction('SHOW_MODAL', {
    title: options.title || '',
    content: options.content,
    showCancel: options.showCancel ?? true,
    cancelText: options.cancelText || 'Cancel',
    confirmText: options.confirmText || 'OK',
    editable: options.editable ?? false,
    placeholderText: options.placeholderText,
  })
    .then((nativeRes: any) => {
      const res: ModalResult = {
        confirm: !!nativeRes?.confirm,
        cancel: !nativeRes?.confirm,
        content: nativeRes?.content,
        errMsg: 'showModal:ok',
      };
      options.success?.(res);
      options.complete?.(res);
      return res;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: err.errMsg || `showModal:fail ${err.message || 'error'}` };
      options.fail?.(error);
      options.complete?.(error);
      return Promise.reject(error);
    });
}

/**
 * uni.showActionSheet
 */
export function showActionSheet(options: ShowActionSheetOptions): Promise<ActionSheetResult> {
  if (!options || !Array.isArray(options.itemList) || options.itemList.length === 0) {
    const err: UniError = { errMsg: 'showActionSheet:fail itemList must be a non-empty array' };
    options?.fail?.(err);
    options?.complete?.(err);
    return Promise.reject(err);
  }

  return callBridgeAction('SHOW_ACTION_SHEET', {
    itemList: options.itemList,
    itemColor: options.itemColor || '#000000',
    title: options.title,
  })
    .then((nativeRes: any) => {
      const res: ActionSheetResult = {
        tapIndex: typeof nativeRes?.tapIndex === 'number' ? nativeRes.tapIndex : 0,
        errMsg: 'showActionSheet:ok',
      };
      options.success?.(res);
      options.complete?.(res);
      return res;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: err.errMsg || `showActionSheet:fail ${err.message || 'error'}` };
      options.fail?.(error);
      options.complete?.(error);
      return Promise.reject(error);
    });
}

/**
 * uni.setNavigationBarTitle
 */
export function setNavigationBarTitle(options: SetNavigationBarTitleOptions): Promise<{ errMsg: string }> {
  if (!options || typeof options.title !== 'string') {
    const err: UniError = { errMsg: 'setNavigationBarTitle:fail title is required' };
    options?.fail?.(err);
    options?.complete?.(err);
    return Promise.reject(err);
  }

  return callBridgeAction('SET_NAV_BAR_TITLE', { title: options.title })
    .then(() => {
      const res = { errMsg: 'setNavigationBarTitle:ok' };
      options.success?.(res);
      options.complete?.(res);
      return res;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: err.errMsg || `setNavigationBarTitle:fail ${err.message || 'error'}` };
      options.fail?.(error);
      options.complete?.(error);
      return Promise.reject(error);
    });
}

/**
 * uni.setNavigationBarColor
 */
export function setNavigationBarColor(options: SetNavigationBarColorOptions): Promise<{ errMsg: string }> {
  if (!options || !options.frontColor || !options.backgroundColor) {
    const err: UniError = { errMsg: 'setNavigationBarColor:fail frontColor and backgroundColor are required' };
    options?.fail?.(err);
    options?.complete?.(err);
    return Promise.reject(err);
  }

  return callBridgeAction('SET_NAV_BAR_COLOR', {
    textColor: options.frontColor,
    backgroundColor: options.backgroundColor,
    animation: options.animation,
  })
    .then(() => {
      const res = { errMsg: 'setNavigationBarColor:ok' };
      options.success?.(res);
      options.complete?.(res);
      return res;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: err.errMsg || `setNavigationBarColor:fail ${err.message || 'error'}` };
      options.fail?.(error);
      options.complete?.(error);
      return Promise.reject(error);
    });
}
