import { defineFeature } from '../types';

/**
 * T10 — BLE GATT + NFC (Domain 12).
 *
 * WeChat splits adapter lifecycle from scanning (`openBluetoothAdapter` then
 * `startBluetoothDevicesDiscovery`); the engine has no separate adapter-open action, so both map
 * onto the scan lifecycle rather than inventing a no-op.
 *
 * Every GATT operation past connect is android-only. Android has a real client
 * (AndroidBleTransport -- connectGatt, discoverServices, characteristic read/write,
 * setCharacteristicNotification + CCCD write). iOS CoreBluetooth is real for
 * scan/connect/disconnect ONLY: GoatBluetoothManager never implemented the CBPeripheralDelegate
 * discovery/read/write callbacks, so those methods used to return hardcoded UUIDs and the constant
 * base64 "AQIDBA==". As of 2026-09-06 they throw instead of fabricating.
 *
 * readBLECharacteristicValue / writeBLECharacteristicValue stay declared portable because
 * `platformOnly` here means "the other platform has no dispatch branch", which is a static fact
 * this package can verify -- and iOS does have BLE_READ_CHARACTERISTIC / BLE_WRITE_CHARACTERISTIC
 * branches. They now FAIL on iOS rather than returning fabricated data. That runtime distinction is
 * deliberately outside what this table models; do not mislabel it as platformOnly, which would make
 * the declaration disagree with the source.
 *
 * NFC_START_SESSION and NFC_STOP_SESSION remain unbacked on both platforms.
 */
export const bluetoothFeature = defineFeature('bluetooth', {
  openBluetoothAdapter: 'BLE_START_SCAN',
  closeBluetoothAdapter: 'BLE_STOP_SCAN',
  startBluetoothDevicesDiscovery: 'BLE_START_SCAN',
  stopBluetoothDevicesDiscovery: 'BLE_STOP_SCAN',
  createBLEConnection: 'BLE_CONNECT',
  connectBLEDevice: 'BLE_CONNECT',
  closeBLEConnection: 'BLE_DISCONNECT',
  readBLECharacteristicValue: 'BLE_READ_CHARACTERISTIC',
  writeBLECharacteristicValue: 'BLE_WRITE_CHARACTERISTIC',
  readNFCTag: 'NFC_READ_TAG',
  writeNFCTag: 'NFC_WRITE_TAG',
  getBLEDeviceServices: 'BLE_LIST_SERVICES',
  notifyBLECharacteristicValueChange: 'BLE_SUBSCRIBE',
  stopNotifyBLECharacteristicValueChange: 'BLE_UNSUBSCRIBE',
},
{
  startNFCSession: 'NFC_START_SESSION',
  stopNFCSession: 'NFC_STOP_SESSION',
},
{
  getBLEDeviceServices: 'android',
  notifyBLECharacteristicValueChange: 'android',
  stopNotifyBLECharacteristicValueChange: 'android',
});
export default bluetoothFeature;
