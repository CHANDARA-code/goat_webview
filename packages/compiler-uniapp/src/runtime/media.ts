/**
 * @goat/compiler-uniapp Media, Camera, & Location JSAPI Shims
 */
import { callBridgeAction } from './bridge.js';
import type {
  ChooseImageOptions,
  ChooseImageResult,
  ChooseLocationOptions,
  ChooseLocationResult,
  GetLocationOptions,
  LocationResult,
  OpenLocationOptions,
  PreviewImageOptions,
  ScanCodeOptions,
  ScanCodeResult,
  UniError,
} from '../types.js';

/**
 * uni.scanCode
 */
export function scanCode(options: ScanCodeOptions = {}): Promise<ScanCodeResult> {
  return callBridgeAction('SCAN_CODE', {
    onlyFromCamera: options.onlyFromCamera ?? false,
    scanType: options.scanType || ['qrCode', 'barCode'],
  })
    .then((nativeRes: any) => {
      const result: ScanCodeResult = {
        result: nativeRes?.result || '',
        scanType: nativeRes?.scanType || 'QR_CODE',
        charSet: nativeRes?.charSet || 'UTF-8',
        path: nativeRes?.path,
        rawData: nativeRes?.rawData,
        errMsg: 'scanCode:ok',
      };
      options.success?.(result);
      options.complete?.(result);
      return result;
    })
    .catch((err: any) => {
      const error: UniError = {
        errMsg: err.errMsg || `scanCode:fail ${err.message || 'auth deny'}`,
        code: err.code || 'PERMISSION_DENIED',
      };
      options.fail?.(error);
      options.complete?.(error);
      return Promise.reject(error);
    });
}

/**
 * uni.chooseImage
 */
export function chooseImage(options: ChooseImageOptions = {}): Promise<ChooseImageResult> {
  return callBridgeAction('CHOOSE_MEDIA', {
    count: options.count || 9,
    mediaType: ['image'],
    sourceType: options.sourceType || ['album', 'camera'],
  })
    .then((nativeRes: any) => {
      const paths = nativeRes?.tempFilePaths || ['/tmp/image_0.png'];
      const files = nativeRes?.tempFiles || paths.map((p: string) => ({ path: p, size: 1024 }));
      const result: ChooseImageResult = {
        tempFilePaths: paths,
        tempFiles: files,
        errMsg: 'chooseImage:ok',
      };
      options.success?.(result);
      options.complete?.(result);
      return result;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: err.errMsg || `chooseImage:fail ${err.message || 'error'}` };
      options.fail?.(error);
      options.complete?.(error);
      return Promise.reject(error);
    });
}

/**
 * uni.chooseMedia (alias)
 */
export const chooseMedia = chooseImage;

/**
 * uni.previewImage
 */
export function previewImage(options: PreviewImageOptions): Promise<{ errMsg: string }> {
  if (!options || !Array.isArray(options.urls) || options.urls.length === 0) {
    const err: UniError = { errMsg: 'previewImage:fail urls must be a non-empty array' };
    options?.fail?.(err);
    options?.complete?.(err);
    return Promise.reject(err);
  }

  return callBridgeAction('PREVIEW_IMAGE', {
    current: options.current ?? 0,
    urls: options.urls,
    indicator: options.indicator || 'number',
  })
    .then(() => {
      const res = { errMsg: 'previewImage:ok' };
      options.success?.(res);
      options.complete?.(res);
      return res;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: err.errMsg || `previewImage:fail ${err.message || 'error'}` };
      options.fail?.(error);
      options.complete?.(error);
      return Promise.reject(error);
    });
}

/**
 * uni.getLocation
 */
export function getLocation(options: GetLocationOptions = {}): Promise<LocationResult> {
  return callBridgeAction('GET_LOCATION', {
    type: options.type || 'wgs84',
    altitude: options.altitude ?? false,
    isHighAccuracy: options.isHighAccuracy ?? false,
    highAccuracyExpireTime: options.highAccuracyExpireTime,
  })
    .then((nativeRes: any) => {
      const result: LocationResult = {
        latitude: nativeRes?.latitude || nativeRes?.lat || 0,
        longitude: nativeRes?.longitude || nativeRes?.lng || 0,
        speed: nativeRes?.speed || 0,
        accuracy: nativeRes?.accuracy || 5,
        altitude: nativeRes?.altitude || 0,
        verticalAccuracy: nativeRes?.verticalAccuracy || 5,
        horizontalAccuracy: nativeRes?.horizontalAccuracy || 5,
        errMsg: 'getLocation:ok',
      };
      options.success?.(result);
      options.complete?.(result);
      return result;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: err.errMsg || `getLocation:fail ${err.message || 'error'}` };
      options.fail?.(error);
      options.complete?.(error);
      return Promise.reject(error);
    });
}

/**
 * uni.chooseLocation
 */
export function chooseLocation(options: ChooseLocationOptions = {}): Promise<ChooseLocationResult> {
  return callBridgeAction('CHOOSE_LOCATION', {
    latitude: options.latitude,
    longitude: options.longitude,
    keyword: options.keyword,
  })
    .then((nativeRes: any) => {
      const result: ChooseLocationResult = {
        name: nativeRes?.name || '',
        address: nativeRes?.address || '',
        latitude: nativeRes?.latitude || nativeRes?.lat || 0,
        longitude: nativeRes?.longitude || nativeRes?.lng || 0,
        errMsg: 'chooseLocation:ok',
      };
      options.success?.(result);
      options.complete?.(result);
      return result;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: err.errMsg || `chooseLocation:fail ${err.message || 'error'}` };
      options.fail?.(error);
      options.complete?.(error);
      return Promise.reject(error);
    });
}

/**
 * uni.openLocation
 */
export function openLocation(options: OpenLocationOptions): Promise<{ errMsg: string }> {
  if (!options || typeof options.latitude !== 'number' || typeof options.longitude !== 'number') {
    const err: UniError = { errMsg: 'openLocation:fail latitude and longitude are required' };
    options?.fail?.(err);
    options?.complete?.(err);
    return Promise.reject(err);
  }

  return callBridgeAction('OPEN_LOCATION', {
    latitude: options.latitude,
    longitude: options.longitude,
    scale: options.scale || 18,
    name: options.name || '',
    address: options.address || '',
  })
    .then(() => {
      const res = { errMsg: 'openLocation:ok' };
      options.success?.(res);
      options.complete?.(res);
      return res;
    })
    .catch((err: any) => {
      const error: UniError = { errMsg: err.errMsg || `openLocation:fail ${err.message || 'error'}` };
      options.fail?.(error);
      options.complete?.(error);
      return Promise.reject(error);
    });
}
