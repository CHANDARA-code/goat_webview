/**
 * @goat/bridge-mock - Domain 12: Bluetooth Low Energy & NFC Handlers (16 Actions)
 */

import { mockState } from '../state/store.js';
import { eventBus } from '../transport/event-bus.js';
import { BleScanResult, NfcTagResult } from '../types.js';
import { GoatBridgeError, BridgeErrorCodes } from '../errors.js';

export class BleNfcHandlers {
  private static scanTimer: any = null;

  /**
   * Action 126 / 127: BLE_START_SCAN / START_BLE_SCAN
   */
  public static startScan(payload: any = {}): BleScanResult {
    if (!mockState.permissions.get('BLUETOOTH')) {
      throw new GoatBridgeError(BridgeErrorCodes.PERMISSION_DENIED, 'Bluetooth permission denied');
    }
    mockState.bleScanning = true;

    // Simulate discovering devices
    if (this.scanTimer) clearInterval(this.scanTimer);
    let index = 0;
    this.scanTimer = setInterval(() => {
      if (index < mockState.bleDevices.length) {
        eventBus.emit('BLE_DEVICE_FOUND', mockState.bleDevices[index]);
        index++;
      }
    }, 300);
    if (this.scanTimer && typeof this.scanTimer.unref === 'function') {
      this.scanTimer.unref();
    }

    return {
      isScanning: true,
      devices: [...mockState.bleDevices],
    };
  }

  /**
   * Action 128 / 129: BLE_STOP_SCAN / STOP_BLE_SCAN
   */
  public static stopScan(): { stopped: boolean } {
    mockState.bleScanning = false;
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    return { stopped: true };
  }

  /**
   * Action 130 / 131: BLE_CONNECT / CONNECT_BLE_DEVICE
   */
  public static connect(payload: any = {}): { connected: boolean; deviceId: string } {
    const deviceId = payload.deviceId || (mockState.bleDevices[0] && mockState.bleDevices[0].deviceId);
    if (!deviceId) {
      throw new GoatBridgeError(BridgeErrorCodes.INVALID_ARGUMENT, 'Missing required "deviceId"');
    }
    mockState.connectedBleDevices.add(deviceId);
    return { connected: true, deviceId };
  }

  /**
   * Action 132: DISCONNECT_BLE_DEVICE
   */
  public static disconnect(payload: any = {}): { disconnected: boolean; deviceId?: string } {
    const deviceId = payload.deviceId;
    if (deviceId) {
      mockState.connectedBleDevices.delete(deviceId);
    } else {
      mockState.connectedBleDevices.clear();
    }
    return { disconnected: true, deviceId };
  }

  /**
   * Action 133 / 134: BLE_READ_CHARACTERISTIC / READ_BLE_CHARACTERISTIC
   */
  public static readCharacteristic(payload: any = {}): { deviceId: string; characteristicUuid: string; value: string } {
    const deviceId = payload.deviceId || 'BLE:FA:23:4B:99:01';
    const characteristicUuid = payload.characteristicUuid || payload.uuid || '00002a00-0000-1000-8000-00805f9b34fb';
    const key = `${deviceId}:${characteristicUuid.toLowerCase()}`;

    const value = mockState.bleCharacteristics.has(key)
      ? mockState.bleCharacteristics.get(key)!
      : '0x01A4F8';

    return { deviceId, characteristicUuid, value };
  }

  /**
   * Action 135 / 136: BLE_WRITE_CHARACTERISTIC / WRITE_BLE_CHARACTERISTIC
   */
  public static writeCharacteristic(payload: any = {}): { deviceId: string; characteristicUuid: string; written: boolean } {
    const deviceId = payload.deviceId || 'BLE:FA:23:4B:99:01';
    const characteristicUuid = payload.characteristicUuid || payload.uuid || '00002a00-0000-1000-8000-00805f9b34fb';
    const value = payload.value || '';
    const key = `${deviceId}:${characteristicUuid.toLowerCase()}`;

    mockState.bleCharacteristics.set(key, value);
    return { deviceId, characteristicUuid, written: true };
  }

  /**
   * Action 137 / 138: NFC_READ_TAG / READ_NFC_NDEF_MESSAGE
   */
  public static readTag(): NfcTagResult {
    return { ...mockState.nfcTag };
  }

  /**
   * Action 139: NFC_WRITE_TAG
   */
  public static writeTag(payload: any = {}): { written: boolean; payload: string } {
    const data = typeof payload.payload === 'string' ? payload.payload : payload.data || '';
    mockState.nfcTag.payload = data;
    mockState.nfcTag.uri = data;
    return { written: true, payload: data };
  }

  /**
   * Action 140: START_NFC_DISCOVERY
   */
  public static startNfcDiscovery(): { started: boolean; nfcEnabled: boolean } {
    mockState.nfcDiscovering = true;
    eventBus.emit('NFC_TAG_DISCOVERED', mockState.nfcTag);
    return { started: true, nfcEnabled: mockState.nfcEnabled };
  }

  /**
   * Action 141: STOP_NFC_DISCOVERY
   */
  public static stopNfcDiscovery(): { stopped: boolean } {
    mockState.nfcDiscovering = false;
    return { stopped: true };
  }
}
