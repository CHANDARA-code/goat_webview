import { defineFeature } from '../types';

/**
 * T5 — Hardware sensors (Domain 6).
 *
 * The 20 Hz cap and the background auto-pause are enforced natively by the sensor dispatcher, not
 * here; a web-side throttle would be trivially bypassable by calling the bridge directly.
 */
export const sensorsFeature = defineFeature(
  'sensors',
  {
    startAccelerometer: 'START_ACCELEROMETER',
    stopAccelerometer: 'STOP_ACCELEROMETER',
    getLatestAccelerometer: 'GET_LATEST_ACCELEROMETER',
    startGyroscope: 'START_GYROSCOPE',
    stopGyroscope: 'STOP_GYROSCOPE',
    getLatestGyroscope: 'GET_LATEST_GYROSCOPE',
    startDeviceMotionListening: 'START_DEVICE_MOTION',
    stopDeviceMotionListening: 'STOP_DEVICE_MOTION',
    getLatestDeviceMotion: 'GET_LATEST_DEVICE_MOTION',
    startCompass: 'START_COMPASS',
    stopCompass: 'STOP_COMPASS',
  }
);
export default sensorsFeature;
