/**
 * @goat/bridge-mock - Domain 6: Hardware Sensors & Telephony Handlers (12 Actions)
 */

import { mockState } from '../state/store.js';
import { eventBus } from '../transport/event-bus.js';
import { SensorMotionData, TelephonyResult } from '../types.js';
import { GoatBridgeError, BridgeErrorCodes } from '../errors.js';

export class SensorHandlers {
  private static accelTimer: any = null;
  private static gyroTimer: any = null;
  private static compassTimer: any = null;
  private static motionTimer: any = null;

  private static latestAccel: SensorMotionData = { x: 0.12, y: 9.81, z: 0.05, timestamp: Date.now() };
  private static latestGyro: SensorMotionData = { x: 0.01, y: -0.02, z: 0.00, timestamp: Date.now() };
  private static latestMotion: SensorMotionData = { x: 0.12, y: 9.81, z: 0.05, timestamp: Date.now() };

  /**
   * Action 78: START_ACCELEROMETER
   */
  public static startAccelerometer(payload: any = {}): { started: boolean; interval: string } {
    const interval = payload.interval || 'normal';
    const ms = interval === 'game' ? 20 : interval === 'ui' ? 60 : 200;

    if (this.accelTimer) clearInterval(this.accelTimer);
    this.accelTimer = setInterval(() => {
      // Simulate subtle jitter
      this.latestAccel = {
        x: Number((Math.sin(Date.now() / 1000) * 0.5).toFixed(3)),
        y: Number((9.8 + Math.cos(Date.now() / 1000) * 0.2).toFixed(3)),
        z: Number((Math.sin(Date.now() / 2000) * 0.1).toFixed(3)),
        timestamp: Date.now(),
      };
      eventBus.emit('ACCELEROMETER_CHANGE', this.latestAccel);
    }, ms);
    if (this.accelTimer && typeof this.accelTimer.unref === 'function') {
      this.accelTimer.unref();
    }

    return { started: true, interval };
  }

  /**
   * Action 79: STOP_ACCELEROMETER
   */
  public static stopAccelerometer(): { stopped: boolean } {
    if (this.accelTimer) {
      clearInterval(this.accelTimer);
      this.accelTimer = null;
    }
    return { stopped: true };
  }

  /**
   * Action 80: GET_LATEST_ACCELEROMETER
   */
  public static getLatestAccelerometer(): SensorMotionData {
    return { ...this.latestAccel, timestamp: Date.now() };
  }

  /**
   * Action 81: START_COMPASS
   */
  public static startCompass(payload: any = {}): { started: boolean } {
    if (this.compassTimer) clearInterval(this.compassTimer);
    this.compassTimer = setInterval(() => {
      const heading = (Date.now() / 50) % 360;
      eventBus.emit('COMPASS_CHANGE', { direction: Number(heading.toFixed(1)), accuracy: 5.0 });
    }, 200);
    if (this.compassTimer && typeof this.compassTimer.unref === 'function') {
      this.compassTimer.unref();
    }
    return { started: true };
  }

  public static stopCompass(): { stopped: boolean } {
    if (this.compassTimer) {
      clearInterval(this.compassTimer);
      this.compassTimer = null;
    }
    return { stopped: true };
  }

  /**
   * Action 82: START_GYROSCOPE
   */
  public static startGyroscope(payload: any = {}): { started: boolean } {
    if (this.gyroTimer) clearInterval(this.gyroTimer);
    this.gyroTimer = setInterval(() => {
      this.latestGyro = {
        x: Number((Math.sin(Date.now() / 500) * 0.05).toFixed(4)),
        y: Number((Math.cos(Date.now() / 500) * 0.05).toFixed(4)),
        z: 0.001,
        timestamp: Date.now(),
      };
      eventBus.emit('GYROSCOPE_CHANGE', this.latestGyro);
    }, 100);
    if (this.gyroTimer && typeof this.gyroTimer.unref === 'function') {
      this.gyroTimer.unref();
    }
    return { started: true };
  }

  /**
   * Action 83: STOP_GYROSCOPE
   */
  public static stopGyroscope(): { stopped: boolean } {
    if (this.gyroTimer) {
      clearInterval(this.gyroTimer);
      this.gyroTimer = null;
    }
    return { stopped: true };
  }

  /**
   * Action 84: GET_LATEST_GYROSCOPE
   */
  public static getLatestGyroscope(): SensorMotionData {
    return { ...this.latestGyro, timestamp: Date.now() };
  }

  /**
   * Action 85: START_DEVICE_MOTION
   */
  public static startDeviceMotion(payload: any = {}): { started: boolean; interval: string } {
    const interval = payload.interval || 'normal';
    if (this.motionTimer) clearInterval(this.motionTimer);
    this.motionTimer = setInterval(() => {
      this.latestMotion = {
        x: Number((Math.sin(Date.now() / 1000) * 0.3).toFixed(3)),
        y: Number((Math.cos(Date.now() / 1000) * 0.3).toFixed(3)),
        z: Number((Math.sin(Date.now() / 1500) * 0.1).toFixed(3)),
        timestamp: Date.now(),
      };
    }, 100);
    if (this.motionTimer && typeof this.motionTimer.unref === 'function') {
      this.motionTimer.unref();
    }
    return { started: true, interval };
  }

  /**
   * Action 86: STOP_DEVICE_MOTION
   */
  public static stopDeviceMotion(): { stopped: boolean } {
    if (this.motionTimer) {
      clearInterval(this.motionTimer);
      this.motionTimer = null;
    }
    return { stopped: true };
  }

  /**
   * Action 87: GET_LATEST_DEVICE_MOTION
   */
  public static getLatestDeviceMotion(): { isStreaming: boolean; x: number; y: number; z: number; timestampMs: number } {
    return {
      isStreaming: this.motionTimer !== null,
      x: this.latestMotion.x,
      y: this.latestMotion.y,
      z: this.latestMotion.z,
      timestampMs: Date.now(),
    };
  }

  /**
   * Action 88: MAKE_PHONE_CALL
   */
  public static makePhoneCall(payload: any = {}): TelephonyResult {
    const phoneNumber = payload.phoneNumber;
    if (!phoneNumber) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing required "phoneNumber"');
    }
    return { handled: true, phoneNumber };
  }

  /**
   * Action 89: SEND_SMS
   */
  public static sendSms(payload: any = {}): TelephonyResult {
    const phoneNumber = payload.phoneNumber;
    if (!phoneNumber) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing required "phoneNumber"');
    }
    return { handled: true, phoneNumber };
  }
}
