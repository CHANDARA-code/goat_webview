---
sidebar_position: 13
title: Domain 12 - Bluetooth Low Energy & NFC
description: Complete API reference for Bluetooth Low Energy & NFC (16 actions).
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Domain 12: Bluetooth Low Energy & NFC

GATT client communication (device discovery, service discovery, characteristic read/write) and ISO 14443 / NDEF NFC tag operations.

**Total Actions in Domain:** `16 actions`

---

## Action Summary

| # | Action String | Permission | Inputs | Returns |
| :--- | :--- | :--- | :--- | :--- |
| 1 | [`BLE_START_SCAN`](#ble-start-scan) | `scope.bluetooth` | `serviceUuids`, `allowDuplicates` | `BleScanResult` |
| 2 | [`START_BLE_SCAN`](#start-ble-scan) | `scope.bluetooth` | `serviceUuids` | `BleScanResult` |
| 3 | [`BLE_STOP_SCAN`](#ble-stop-scan) | `scope.bluetooth` | `{}` | `BleStopScanResult` |
| 4 | [`STOP_BLE_SCAN`](#stop-ble-scan) | `scope.bluetooth` | `{}` | `BleStopScanResult` |
| 5 | [`BLE_CONNECT`](#ble-connect) | `scope.bluetooth` | `deviceId` | `BleConnectResult` |
| 6 | [`CONNECT_BLE_DEVICE`](#connect-ble-device) | `scope.bluetooth` | `deviceId` | `BleConnectResult` |
| 7 | [`DISCONNECT_BLE_DEVICE`](#disconnect-ble-device) | `scope.bluetooth` | `deviceId` | `BleDisconnectResult` |
| 8 | [`BLE_READ_CHARACTERISTIC`](#ble-read-characteristic) | `scope.bluetooth` | `deviceId`, `characteristicUuid` | `BleCharacteristicResult` |
| 9 | [`READ_BLE_CHARACTERISTIC`](#read-ble-characteristic) | `scope.bluetooth` | `deviceId`, `characteristicUuid` | `BleCharacteristicResult` |
| 10 | [`BLE_WRITE_CHARACTERISTIC`](#ble-write-characteristic) | `scope.bluetooth` | `deviceId`, `characteristicUuid`, `value` | `BleWriteResult` |
| 11 | [`WRITE_BLE_CHARACTERISTIC`](#write-ble-characteristic) | `scope.bluetooth` | `deviceId`, `characteristicUuid`, `value` | `BleWriteResult` |
| 12 | [`NFC_READ_TAG`](#nfc-read-tag) | `none` | `{}` | `NfcTagResult` |
| 13 | [`READ_NFC_NDEF_MESSAGE`](#read-nfc-ndef-message) | `none` | `{}` | `NfcTagResult` |
| 14 | [`NFC_WRITE_TAG`](#nfc-write-tag) | `none` | `payload` | `NfcWriteResult` |
| 15 | [`START_NFC_DISCOVERY`](#start-nfc-discovery) | `none` | `{}` | `NfcDiscoveryResult` |
| 16 | [`STOP_NFC_DISCOVERY`](#stop-nfc-discovery) | `none` | `{}` | `NfcStopDiscoveryResult` |

---

## Action Specifications

---

### 1. `BLE_START_SCAN` {#ble-start-scan}

Powers on Bluetooth adapter and initiates scanning for nearby BLE peripheral devices broadcasting specific service UUIDs.

**Purpose & Context:** Discovers IoT smart devices, fitness bands, smart locks, and BLE payment terminals.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `BLE_START_SCAN`
- **Supported Aliases:** `bleStartScan`, `openBluetoothAdapter`, `startBluetoothDevicesDiscovery`
- **Permission Scope:** `scope.bluetooth`
- **Required Manifest Permissions:** `android.permission.BLUETOOTH_SCAN`, `android.permission.BLUETOOTH_CONNECT`, `NSBluetoothAlwaysUsageDescription`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `serviceUuids` | `string[]` | No | - | Filter by advertised 128-bit or 16-bit service UUIDs. |
| `allowDuplicates` | `boolean` | No | `false` | Allow repeated RSSI updates from the same peripheral. |


#### Return Value
- **Schema Type:** `BleScanResult`
- **Description:** Scan status and initial list of detected peripherals.

```json title="Return Payload Shape"
{
  "isScanning": "boolean",
  "devices": "BleDevice[]"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `PERMISSION_DENIED` | Bluetooth scan permission missing or Bluetooth disabled. | Prompt user to grant Bluetooth permission or turn on Bluetooth. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('BLE_START_SCAN', {
  serviceUuids: ['0000ffe0-0000-1000-8000-00805f9b34fb']
});
goatBridge.on('BLE_DEVICE_FOUND', (device) => {
  console.log('Found BLE device:', device.name, device.deviceId, device.rssi);
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val leScanner = bluetoothAdapter.bluetoothLeScanner
leScanner.startScan(filters, scanSettings, scanCallback)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
centralManager.scanForPeripherals(withServices: serviceUUIDs, options: [CBCentralManagerScanOptionAllowDuplicatesKey: false])
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('BLE_START_SCAN', {
  'serviceUuids': ['0000ffe0-0000-1000-8000-00805f9b34fb'],
});
```

  </TabItem>
</Tabs>


---

### 2. `START_BLE_SCAN` {#start-ble-scan}

Alias for BLE_START_SCAN.

**Purpose & Context:** Standard alias for BLE device discovery.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `START_BLE_SCAN`
- **Supported Aliases:** `startBluetoothDevicesDiscovery`
- **Permission Scope:** `scope.bluetooth`
- **Required Manifest Permissions:** `android.permission.BLUETOOTH_SCAN`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `serviceUuids` | `string[]` | No | - | Service UUID filter. |


#### Return Value
- **Schema Type:** `BleScanResult`
- **Description:** BLE scan result.

```json title="Return Payload Shape"
{
  "isScanning": "boolean",
  "devices": "BleDevice[]"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `PERMISSION_DENIED` | Bluetooth permission denied. | Request scope.bluetooth. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('START_BLE_SCAN', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Start BLE Scan
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Start centralManager scan
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('START_BLE_SCAN', {});
```

  </TabItem>
</Tabs>


---

### 3. `BLE_STOP_SCAN` {#ble-stop-scan}

Stops BLE device discovery and closes the scanner session.

**Purpose & Context:** Conserves device battery once target peripheral has been discovered.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `BLE_STOP_SCAN`
- **Supported Aliases:** `bleStopScan`, `closeBluetoothAdapter`, `stopBluetoothDevicesDiscovery`
- **Permission Scope:** `scope.bluetooth`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `BleStopScanResult`
- **Description:** Confirmation that scanner was stopped.

```json title="Return Payload Shape"
{
  "stopped": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('BLE_STOP_SCAN', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
leScanner.stopScan(scanCallback)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
centralManager.stopScan()
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('BLE_STOP_SCAN', {});
```

  </TabItem>
</Tabs>


---

### 4. `STOP_BLE_SCAN` {#stop-ble-scan}

Alias for BLE_STOP_SCAN.

**Purpose & Context:** Compatibility alias for stopping BLE scan.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `STOP_BLE_SCAN`
- **Supported Aliases:** `stopBluetoothDevicesDiscovery`
- **Permission Scope:** `scope.bluetooth`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `BleStopScanResult`
- **Description:** Scan stop status.

```json title="Return Payload Shape"
{
  "stopped": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('STOP_BLE_SCAN', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Stop scan
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Stop scan
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('STOP_BLE_SCAN', {});
```

  </TabItem>
</Tabs>


---

### 5. `BLE_CONNECT` {#ble-connect}

Establishes a GATT client connection to a discovered BLE peripheral device.

**Purpose & Context:** Opens GATT session for reading/writing characteristics and services.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `BLE_CONNECT`
- **Supported Aliases:** `bleConnect`, `createBLEConnection`
- **Permission Scope:** `scope.bluetooth`
- **Required Manifest Permissions:** `android.permission.BLUETOOTH_CONNECT`, `NSBluetoothAlwaysUsageDescription`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `deviceId` | `string` | **Yes** | - | MAC address (Android) or CoreBluetooth UUID (iOS). |


#### Return Value
- **Schema Type:** `BleConnectResult`
- **Description:** GATT connection confirmation.

```json title="Return Payload Shape"
{
  "connected": "boolean",
  "deviceId": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | deviceId missing. | Pass a valid deviceId string. |
| `PERMISSION_DENIED` | Bluetooth connect permission missing. | Request scope.bluetooth. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('BLE_CONNECT', { deviceId: 'E4:7F:B2:11:22:33' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val bluetoothDevice = bluetoothAdapter.getRemoteDevice(deviceId)
bluetoothGatt = bluetoothDevice.connectGatt(context, false, gattCallback)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
centralManager.connect(peripheral, options: nil)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('BLE_CONNECT', {'deviceId': 'E4:7F:B2:11:22:33'});
```

  </TabItem>
</Tabs>


---

### 6. `CONNECT_BLE_DEVICE` {#connect-ble-device}

Alias for BLE_CONNECT.

**Purpose & Context:** Standard alias for BLE GATT connection.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `CONNECT_BLE_DEVICE`
- **Supported Aliases:** `connectBleDevice`
- **Permission Scope:** `scope.bluetooth`
- **Required Manifest Permissions:** `android.permission.BLUETOOTH_CONNECT`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `deviceId` | `string` | **Yes** | - | Peripheral device ID. |


#### Return Value
- **Schema Type:** `BleConnectResult`
- **Description:** Connection status.

```json title="Return Payload Shape"
{
  "connected": "boolean",
  "deviceId": "string"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('CONNECT_BLE_DEVICE', { deviceId: 'E4:7F:B2:11:22:33' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Connect GATT
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Connect peripheral
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('CONNECT_BLE_DEVICE', {'deviceId': 'E4:7F:B2:11:22:33'});
```

  </TabItem>
</Tabs>


---

### 7. `DISCONNECT_BLE_DEVICE` {#disconnect-ble-device}

Terminates the GATT connection and releases the peripheral connection handle.

**Purpose & Context:** Closes BLE session.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `DISCONNECT_BLE_DEVICE`
- **Supported Aliases:** `closeBLEConnection`, `disconnectBleDevice`
- **Permission Scope:** `scope.bluetooth`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `deviceId` | `string` | No | - | Target peripheral ID. |


#### Return Value
- **Schema Type:** `BleDisconnectResult`
- **Description:** Disconnection confirmation.

```json title="Return Payload Shape"
{
  "disconnected": "boolean",
  "deviceId": "string (optional)"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('DISCONNECT_BLE_DEVICE', { deviceId: 'E4:7F:B2:11:22:33' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
bluetoothGatt?.disconnect()
bluetoothGatt?.close()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
centralManager.cancelPeripheralConnection(peripheral)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('DISCONNECT_BLE_DEVICE', {'deviceId': 'E4:7F:B2:11:22:33'});
```

  </TabItem>
</Tabs>


---

### 8. `BLE_READ_CHARACTERISTIC` {#ble-read-characteristic}

Reads binary data from a GATT characteristic on the connected peripheral.

**Purpose & Context:** Fetches battery levels, sensor measurements, or firmware revisions from BLE devices.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `BLE_READ_CHARACTERISTIC`
- **Supported Aliases:** `bleReadCharacteristic`, `readBLECharacteristicValue`, `readBleChar`
- **Permission Scope:** `scope.bluetooth`
- **Required Manifest Permissions:** `android.permission.BLUETOOTH_CONNECT`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `deviceId` | `string` | **Yes** | - | Target peripheral ID. |
| `characteristicUuid` | `string` | **Yes** | - | GATT characteristic UUID. |


#### Return Value
- **Schema Type:** `BleCharacteristicResult`
- **Description:** Base64 encoded characteristic payload.

```json title="Return Payload Shape"
{
  "deviceId": "string",
  "characteristicUuid": "string",
  "value": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Characteristic UUID or deviceId missing. | Verify UUID strings. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { value } = await goatBridge.callNative('BLE_READ_CHARACTERISTIC', {
  deviceId: 'E4:7F:B2:11:22:33',
  characteristicUuid: '00002a19-0000-1000-8000-00805f9b34fb' // Battery Level
});
console.log('Base64 value:', value);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
bluetoothGatt?.readCharacteristic(characteristic)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
peripheral.readValue(for: characteristic)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('BLE_READ_CHARACTERISTIC', {
  'deviceId': 'E4:7F:B2:11:22:33',
  'characteristicUuid': '00002a19-0000-1000-8000-00805f9b34fb',
});
```

  </TabItem>
</Tabs>


---

### 9. `READ_BLE_CHARACTERISTIC` {#read-ble-characteristic}

Alias for BLE_READ_CHARACTERISTIC.

**Purpose & Context:** Standard alias for reading GATT characteristic.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `READ_BLE_CHARACTERISTIC`
- **Supported Aliases:** `readBLECharacteristicValue`, `readBleChar`
- **Permission Scope:** `scope.bluetooth`
- **Required Manifest Permissions:** `android.permission.BLUETOOTH_CONNECT`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `deviceId` | `string` | **Yes** | - | Device ID. |
| `characteristicUuid` | `string` | **Yes** | - | Characteristic UUID. |


#### Return Value
- **Schema Type:** `BleCharacteristicResult`
- **Description:** Characteristic value.

```json title="Return Payload Shape"
{
  "deviceId": "string",
  "characteristicUuid": "string",
  "value": "string"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const res = await goatBridge.callNative('READ_BLE_CHARACTERISTIC', { deviceId: '...', characteristicUuid: '...' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Read characteristic
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Read characteristic
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('READ_BLE_CHARACTERISTIC', {'deviceId': '...', 'characteristicUuid': '...'});
```

  </TabItem>
</Tabs>


---

### 10. `BLE_WRITE_CHARACTERISTIC` {#ble-write-characteristic}

Writes a binary or Base64 payload into a GATT characteristic on the connected peripheral.

**Purpose & Context:** Sends commands (e.g. unlock door, toggle LED, configure calibration) to IoT devices.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `BLE_WRITE_CHARACTERISTIC`
- **Supported Aliases:** `bleWriteCharacteristic`, `writeBLECharacteristicValue`, `writeBleChar`
- **Permission Scope:** `scope.bluetooth`
- **Required Manifest Permissions:** `android.permission.BLUETOOTH_CONNECT`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `deviceId` | `string` | **Yes** | - | Target device ID. |
| `characteristicUuid` | `string` | **Yes** | - | Target characteristic UUID. |
| `value` | `string` | **Yes** | - | Base64 encoded payload. |


#### Return Value
- **Schema Type:** `BleWriteResult`
- **Description:** Status of GATT write operation.

```json title="Return Payload Shape"
{
  "deviceId": "string",
  "characteristicUuid": "string",
  "written": "boolean"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Missing write parameters or malformed payload. | Provide valid deviceId, UUID, and Base64 string. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('BLE_WRITE_CHARACTERISTIC', {
  deviceId: 'E4:7F:B2:11:22:33',
  characteristicUuid: '0000ffe1-0000-1000-8000-00805f9b34fb',
  value: btoa(String.fromCharCode(0x01, 0xFF))
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
characteristic.value = Base64.decode(value, Base64.DEFAULT)
bluetoothGatt?.writeCharacteristic(characteristic)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
peripheral.writeValue(Data(base64Encoded: value)!, for: characteristic, type: .withResponse)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('BLE_WRITE_CHARACTERISTIC', {
  'deviceId': 'E4:7F:B2:11:22:33',
  'characteristicUuid': '0000ffe1-0000-1000-8000-00805f9b34fb',
  'value': 'AQ//',
});
```

  </TabItem>
</Tabs>


---

### 11. `WRITE_BLE_CHARACTERISTIC` {#write-ble-characteristic}

Alias for BLE_WRITE_CHARACTERISTIC.

**Purpose & Context:** Standard alias for writing GATT characteristic.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `WRITE_BLE_CHARACTERISTIC`
- **Supported Aliases:** `writeBLECharacteristicValue`, `writeBleChar`
- **Permission Scope:** `scope.bluetooth`
- **Required Manifest Permissions:** `android.permission.BLUETOOTH_CONNECT`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `deviceId` | `string` | **Yes** | - | Target device. |
| `characteristicUuid` | `string` | **Yes** | - | Target UUID. |
| `value` | `string` | **Yes** | - | Payload string. |


#### Return Value
- **Schema Type:** `BleWriteResult`
- **Description:** Write confirmation.

```json title="Return Payload Shape"
{
  "deviceId": "string",
  "characteristicUuid": "string",
  "written": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('WRITE_BLE_CHARACTERISTIC', { deviceId: '...', characteristicUuid: '...', value: '...' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Write characteristic
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Write characteristic
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('WRITE_BLE_CHARACTERISTIC', {'deviceId': '...', 'characteristicUuid': '...', 'value': '...'});
```

  </TabItem>
</Tabs>


---

### 12. `NFC_READ_TAG` {#nfc-read-tag}

Awaits an NFC tag touch and decodes ISO 14443 / NDEF payload records (text, URI, MIME).

**Purpose & Context:** Reads smart transit passes, NFC poster tags, and inventory assets.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `NFC_READ_TAG`
- **Supported Aliases:** `nfcReadTag`, `readNfcTag`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `android.permission.NFC`, `NFCReaderUsageDescription`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `NfcTagResult`
- **Description:** NDEF record payload and decoded URI.

```json title="Return Payload Shape"
{
  "type": "string",
  "payload": "string",
  "uri": "string (optional)"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const tag = await goatBridge.callNative('NFC_READ_TAG', {});
console.log('NFC Tag type:', tag.type, 'Payload:', tag.payload);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Enable NFC foreground dispatch and parse NdefMessage
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// NFCNDEFReaderSessionDelegate session
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final tag = await goatController.callNativeAction('NFC_READ_TAG', {});
```

  </TabItem>
</Tabs>


---

### 13. `READ_NFC_NDEF_MESSAGE` {#read-nfc-ndef-message}

Alias for NFC_READ_TAG.

**Purpose & Context:** Reads NDEF message from NFC tag.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `READ_NFC_NDEF_MESSAGE`
- **Supported Aliases:** `readNfcNdefMessage`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `android.permission.NFC`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `NfcTagResult`
- **Description:** NDEF message payload.

```json title="Return Payload Shape"
{
  "type": "string",
  "payload": "string",
  "uri": "string (optional)"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const ndef = await goatBridge.callNative('READ_NFC_NDEF_MESSAGE', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Read NDEF message
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Read NDEF message
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('READ_NFC_NDEF_MESSAGE', {});
```

  </TabItem>
</Tabs>


---

### 14. `NFC_WRITE_TAG` {#nfc-write-tag}

Formats and writes an NDEF record payload onto a writable physical NFC tag.

**Purpose & Context:** Programs NFC tags for smart home triggers, Wi-Fi sharing, or equipment labeling.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `NFC_WRITE_TAG`
- **Supported Aliases:** `nfcWriteTag`, `writeNfcTag`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `android.permission.NFC`, `NFCReaderUsageDescription`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `payload` | `string` | **Yes** | - | Text or URI string to encode into NDEF record. |


#### Return Value
- **Schema Type:** `NfcWriteResult`
- **Description:** Confirmation that tag was formatted and written.

```json title="Return Payload Shape"
{
  "written": "boolean",
  "payload": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | payload missing. | Provide non-empty payload string. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('NFC_WRITE_TAG', {
  payload: 'https://goat-webview.github.io'
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val ndefRecord = NdefRecord.createUri(payload)
val ndefMessage = NdefMessage(arrayOf(ndefRecord))
Ndef.get(tag).writeNdefMessage(ndefMessage)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// NFCNDEFReaderSession tag.writeNDEF(message)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('NFC_WRITE_TAG', {
  'payload': 'https://goat-webview.github.io',
});
```

  </TabItem>
</Tabs>


---

### 15. `START_NFC_DISCOVERY` {#start-nfc-discovery}

Presents the native NFC scanning sheet and listens for continuous tag encounters.

**Purpose & Context:** Enables continuous inventory tag scanning.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `START_NFC_DISCOVERY`
- **Supported Aliases:** `startNfcDiscovery`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `android.permission.NFC`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `NfcDiscoveryResult`
- **Description:** Status of NFC discovery session.

```json title="Return Payload Shape"
{
  "started": "boolean",
  "nfcEnabled": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('START_NFC_DISCOVERY', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
nfcAdapter.enableReaderMode(...)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
nfcSession.begin()
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('START_NFC_DISCOVERY', {});
```

  </TabItem>
</Tabs>


---

### 16. `STOP_NFC_DISCOVERY` {#stop-nfc-discovery}

Dismisses the native NFC scanning sheet and ends the discovery session.

**Purpose & Context:** Shuts down NFC polling.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `STOP_NFC_DISCOVERY`
- **Supported Aliases:** `stopNfcDiscovery`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `NfcStopDiscoveryResult`
- **Description:** Confirmation that NFC session was closed.

```json title="Return Payload Shape"
{
  "stopped": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('STOP_NFC_DISCOVERY', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
nfcAdapter.disableReaderMode(...)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
nfcSession.invalidate()
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('STOP_NFC_DISCOVERY', {});
```

  </TabItem>
</Tabs>

