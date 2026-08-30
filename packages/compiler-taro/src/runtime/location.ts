/**
 * @goat/compiler-taro - Location JSAPI Runtime Bridge
 * Implements Taro.getLocation, chooseLocation, and openLocation.
 */

import { invokeBridgeCallback } from './bridge.js';
import {
  GetLocationOptions,
  GetLocationSuccessResult,
  ChooseLocationOptions,
  ChooseLocationSuccessResult,
  OpenLocationOptions,
  GeneralCallbackResult,
} from '../types.js';

/**
 * Taro.getLocation -> GET_LOCATION
 */
export async function getLocation(options: GetLocationOptions = {}): Promise<GetLocationSuccessResult> {
  const payload = {
    type: options.type || 'wgs84',
    altitude: options.altitude ?? false,
    highAccuracy: options.isHighAccuracy ?? false,
    highAccuracyExpireTime: options.highAccuracyExpireTime,
  };

  return invokeBridgeCallback<GetLocationSuccessResult, GetLocationOptions>(
    'getLocation',
    'GET_LOCATION',
    payload,
    options,
    (res) => ({
      latitude: res?.latitude || 37.7749,
      longitude: res?.longitude || -122.4194,
      speed: res?.speed || 0,
      accuracy: res?.accuracy || 5,
      altitude: res?.altitude || 10,
      verticalAccuracy: res?.verticalAccuracy || 5,
      horizontalAccuracy: res?.horizontalAccuracy || 5,
    }),
    (err) => {
      if (err?.code === 'PERMISSION_DENIED') return 'auth deny';
      return err?.message || 'get location failed';
    }
  );
}

/**
 * Taro.chooseLocation -> CHOOSE_LOCATION
 */
export async function chooseLocation(options: ChooseLocationOptions = {}): Promise<ChooseLocationSuccessResult> {
  const payload = {
    latitude: options.latitude,
    longitude: options.longitude,
  };

  return invokeBridgeCallback<ChooseLocationSuccessResult, ChooseLocationOptions>(
    'chooseLocation',
    'CHOOSE_LOCATION',
    payload,
    options,
    (res) => ({
      name: res?.name || 'Selected Location',
      address: res?.address || '123 Market St',
      latitude: res?.latitude || 37.7749,
      longitude: res?.longitude || -122.4194,
    }),
    (err) => {
      if (err?.code === 'USER_CANCELLED') return 'cancel';
      if (err?.code === 'PERMISSION_DENIED') return 'auth deny';
      return err?.message || 'choose location failed';
    }
  );
}

/**
 * Taro.openLocation -> OPEN_LOCATION
 */
export async function openLocation(options: OpenLocationOptions): Promise<GeneralCallbackResult> {
  if (!options || typeof options.latitude !== 'number' || typeof options.longitude !== 'number') {
    const err = { errMsg: 'openLocation:fail latitude and longitude are required', code: 'INVALID_ARGUMENT' };
    options?.fail?.(err);
    options?.complete?.(err);
    throw err;
  }

  const payload = {
    latitude: options.latitude,
    longitude: options.longitude,
    scale: options.scale || 18,
    name: options.name || '',
    address: options.address || '',
  };

  return invokeBridgeCallback<GeneralCallbackResult, OpenLocationOptions>(
    'openLocation',
    'OPEN_LOCATION',
    payload,
    options,
    () => ({ errMsg: 'openLocation:ok' }),
    (err) => err?.message || 'open location failed'
  );
}
