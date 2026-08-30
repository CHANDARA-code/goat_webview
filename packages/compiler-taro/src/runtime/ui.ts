/**
 * @goat/compiler-taro - UI Feedback & Dialog JSAPI Runtime Bridge
 * Implements Taro.showModal, showToast, hideToast, showLoading, hideLoading, and showActionSheet.
 */

import { invokeBridgeCallback } from './bridge.js';
import {
  ShowModalOptions,
  ShowModalSuccessResult,
  ShowToastOptions,
  ShowLoadingOptions,
  ShowActionSheetOptions,
  ShowActionSheetSuccessResult,
  GeneralCallbackResult,
} from '../types.js';

let lastModalTime = 0;
const MODAL_COOLDOWN_MS = 500;

/**
 * Taro.showModal -> SHOW_MODAL
 */
export async function showModal(options: ShowModalOptions = {}): Promise<ShowModalSuccessResult> {
  const now = Date.now();
  if (now - lastModalTime < MODAL_COOLDOWN_MS) {
    const err = {
      errMsg: 'showModal:fail dialog cooldown active (wait 500ms)',
      code: 'DIALOG_COOLDOWN_ACTIVE',
    };
    options?.fail?.(err);
    options?.complete?.(err);
    throw err;
  }
  lastModalTime = now;

  const payload = {
    title: options.title || '',
    content: options.content || '',
    showCancel: options.showCancel ?? true,
    cancelText: options.cancelText || 'Cancel',
    confirmText: options.confirmText || 'OK',
    cancelColor: options.cancelColor || '#000000',
    confirmColor: options.confirmColor || '#576B95',
  };

  return invokeBridgeCallback<ShowModalSuccessResult, ShowModalOptions>(
    'showModal',
    'SHOW_MODAL',
    payload,
    options,
    (res) => ({
      confirm: res?.confirm ?? true,
      cancel: res?.cancel ?? false,
      content: res?.content,
    }),
    (err) => err?.message || 'modal failed'
  );
}

/**
 * Taro.showToast -> SHOW_TOAST
 */
export async function showToast(options: ShowToastOptions): Promise<GeneralCallbackResult> {
  if (!options || typeof options.title !== 'string') {
    const err = { errMsg: 'showToast:fail title is required', code: 'INVALID_ARGUMENT' };
    options?.fail?.(err);
    options?.complete?.(err);
    throw err;
  }

  const payload = {
    title: options.title,
    icon: options.icon || 'success',
    image: options.image,
    duration: options.duration ?? 1500,
    mask: options.mask ?? false,
  };

  return invokeBridgeCallback<GeneralCallbackResult, ShowToastOptions>(
    'showToast',
    'SHOW_TOAST',
    payload,
    options,
    () => ({ errMsg: 'showToast:ok' }),
    (err) => err?.message || 'show toast failed'
  );
}

/**
 * Taro.hideToast -> HIDE_TOAST
 */
export async function hideToast(options: { success?: () => void; fail?: () => void; complete?: () => void } = {}): Promise<GeneralCallbackResult> {
  return invokeBridgeCallback<GeneralCallbackResult, any>(
    'hideToast',
    'HIDE_TOAST',
    {},
    options,
    () => ({ errMsg: 'hideToast:ok' }),
    (err) => err?.message || 'hide toast failed'
  );
}

/**
 * Taro.showLoading -> SHOW_LOADING
 */
export async function showLoading(options: ShowLoadingOptions = {}): Promise<GeneralCallbackResult> {
  const payload = {
    title: options.title || 'Loading...',
    mask: options.mask ?? true,
  };

  return invokeBridgeCallback<GeneralCallbackResult, ShowLoadingOptions>(
    'showLoading',
    'SHOW_LOADING',
    payload,
    options,
    () => ({ errMsg: 'showLoading:ok' }),
    (err) => err?.message || 'show loading failed'
  );
}

/**
 * Taro.hideLoading -> HIDE_LOADING
 */
export async function hideLoading(options: { success?: () => void; fail?: () => void; complete?: () => void } = {}): Promise<GeneralCallbackResult> {
  return invokeBridgeCallback<GeneralCallbackResult, any>(
    'hideLoading',
    'HIDE_LOADING',
    {},
    options,
    () => ({ errMsg: 'hideLoading:ok' }),
    (err) => err?.message || 'hide loading failed'
  );
}

/**
 * Taro.showActionSheet -> SHOW_ACTION_SHEET
 */
export async function showActionSheet(options: ShowActionSheetOptions): Promise<ShowActionSheetSuccessResult> {
  if (!options || !Array.isArray(options.itemList) || options.itemList.length === 0) {
    const err = { errMsg: 'showActionSheet:fail itemList must contain at least 1 item', code: 'INVALID_ARGUMENT' };
    options?.fail?.(err);
    options?.complete?.(err);
    throw err;
  }

  const payload = {
    itemList: options.itemList,
    itemColor: options.itemColor || '#000000',
  };

  return invokeBridgeCallback<ShowActionSheetSuccessResult, ShowActionSheetOptions>(
    'showActionSheet',
    'SHOW_ACTION_SHEET',
    payload,
    options,
    (res) => ({
      tapIndex: typeof res?.tapIndex === 'number' ? res.tapIndex : 0,
    }),
    (err) => (err?.code === 'USER_CANCELLED' ? 'cancel' : err?.message || 'action sheet failed')
  );
}
