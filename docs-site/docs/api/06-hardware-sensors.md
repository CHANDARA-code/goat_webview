---
sidebar_position: 7
title: Domain 6 - Hardware Sensors & Telephony
description: Complete API reference for Hardware Sensors & Telephony (13 actions).
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Domain 6: Hardware Sensors & Telephony 🧭

Hardware motion sensors (accelerometer, gyroscope, compass, device motion) with 50ms coalesced throttling, plus phone calls and SMS.

**Total Actions in Domain:** `13 actions`

---

## Action Summary

| # | Action String | Permission | Inputs | Returns |
| :--- | :--- | :--- | :--- | :--- |
| 1 | [`START_ACCELEROMETER`](#start-accelerometer) | `none` | `interval` | `SensorStartResult` |
| 2 | [`STOP_ACCELEROMETER`](#stop-accelerometer) | `none` | `{}` | `SensorStopResult` |
| 3 | [`GET_LATEST_ACCELEROMETER`](#get-latest-accelerometer) | `none` | `{}` | `SensorMotionData` |
| 4 | [`START_COMPASS`](#start-compass) | `none` | `{}` | `SensorStartResult` |
| 5 | [`STOP_COMPASS`](#stop-compass) | `none` | `{}` | `SensorStopResult` |
| 6 | [`START_GYROSCOPE`](#start-gyroscope) | `none` | `interval` | `SensorStartResult` |
| 7 | [`STOP_GYROSCOPE`](#stop-gyroscope) | `none` | `{}` | `SensorStopResult` |
| 8 | [`GET_LATEST_GYROSCOPE`](#get-latest-gyroscope) | `none` | `{}` | `SensorMotionData` |
| 9 | [`START_DEVICE_MOTION`](#start-device-motion) | `none` | `interval` | `SensorStartResult` |
| 10 | [`STOP_DEVICE_MOTION`](#stop-device-motion) | `none` | `{}` | `SensorStopResult` |
| 11 | [`GET_LATEST_DEVICE_MOTION`](#get-latest-device-motion) | `none` | `{}` | `DeviceMotionSnapshot` |
| 12 | [`MAKE_PHONE_CALL`](#make-phone-call) | `none` | `phoneNumber` | `TelephonyResult` |
| 13 | [`SEND_SMS`](#send-sms) | `none` | `phoneNumber`, `body` | `TelephonyResult` |

---

## Action Specifications

---

### 1. `START_ACCELEROMETER` {#start-accelerometer}

Subscribes to hardware 3-axis accelerometer sensor events with coalesced 50ms throttling.

**Purpose & Context:** Powers shake detection, step counting, and device tilt interactions.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `START_ACCELEROMETER`
- **Supported Aliases:** `startAccelerometer`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `android.permission.HIGH_SAMPLING_RATE_SENSORS`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `interval` | `"game" \| "ui" \| "normal"` | No | `"normal"` | Sampling frequency preset (game=20ms, ui=60ms, normal=200ms). |


#### Return Value
- **Schema Type:** `SensorStartResult`
- **Description:** Status of accelerometer subscription.

```json title="Return Payload Shape"
{
  "started": "boolean",
  "interval": "string"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('START_ACCELEROMETER', { interval: 'ui' });
goatBridge.on('ACCELEROMETER_CHANGE', ({ x, y, z }) => {
  console.log('Accel:', x, y, z);
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
sensorManager.registerListener(accelListener, accelSensor, SensorManager.SENSOR_DELAY_UI)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
motionManager.startAccelerometerUpdates(to: .main) { data, _ in ... }
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('START_ACCELEROMETER', {'interval': 'ui'});
```

  </TabItem>
</Tabs>


---

### 2. `STOP_ACCELEROMETER` {#stop-accelerometer}

Unregisters hardware accelerometer listener and powers down the sensor to conserve battery.

**Purpose & Context:** Stops accelerometer sampling when exiting motion screen.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `STOP_ACCELEROMETER`
- **Supported Aliases:** `stopAccelerometer`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `SensorStopResult`
- **Description:** Confirmation that sensor was disabled.

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
await goatBridge.callNative('STOP_ACCELEROMETER', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
sensorManager.unregisterListener(accelListener)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
motionManager.stopAccelerometerUpdates()
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('STOP_ACCELEROMETER', {});
```

  </TabItem>
</Tabs>


---

### 3. `GET_LATEST_ACCELEROMETER` {#get-latest-accelerometer}

Queries the latest cached 3-axis acceleration vector (X, Y, Z in m/s²).

**Purpose & Context:** Provides instantaneous single-frame sensor snapshot.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `GET_LATEST_ACCELEROMETER`
- **Supported Aliases:** `getLatestAccelerometer`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `SensorMotionData`
- **Description:** Latest 3-axis acceleration readings.

```json title="Return Payload Shape"
{
  "x": "number",
  "y": "number",
  "z": "number",
  "timestamp": "number (optional)"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { x, y, z } = await goatBridge.callNative('GET_LATEST_ACCELEROMETER', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val (x, y, z) = lastAccelSample
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let data = motionManager.accelerometerData?.acceleration
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('GET_LATEST_ACCELEROMETER', {});
```

  </TabItem>
</Tabs>


---

### 4. `START_COMPASS` {#start-compass}

Subscribes to hardware magnetometer / digital compass orientation changes.

**Purpose & Context:** Enables real-time map heading rotation and directional navigation arrows.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `START_COMPASS`
- **Supported Aliases:** `startCompass`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `SensorStartResult`
- **Description:** Confirmation that compass listener was registered.

```json title="Return Payload Shape"
{
  "started": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('START_COMPASS', {});
goatBridge.on('COMPASS_CHANGE', ({ direction }) => {
  console.log('Heading:', direction);
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
sensorManager.registerListener(compassListener, magSensor, SensorManager.SENSOR_DELAY_UI)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
locationManager.startUpdatingHeading()
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('START_COMPASS', {});
```

  </TabItem>
</Tabs>


---

### 5. `STOP_COMPASS` {#stop-compass}

Unregisters the magnetometer listener to conserve power.

**Purpose & Context:** Stops continuous compass polling.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `STOP_COMPASS`
- **Supported Aliases:** `stopCompass`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `SensorStopResult`
- **Description:** Confirmation that compass was stopped.

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
await goatBridge.callNative('STOP_COMPASS', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
sensorManager.unregisterListener(compassListener)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
locationManager.stopUpdatingHeading()
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('STOP_COMPASS', {});
```

  </TabItem>
</Tabs>


---

### 6. `START_GYROSCOPE` {#start-gyroscope}

Subscribes to 3-axis angular velocity gyroscope measurements (radians/sec).

**Purpose & Context:** Powers 3D panorama photo viewers, VR/AR experiences, and motion games.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `START_GYROSCOPE`
- **Supported Aliases:** `startGyroscope`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `interval` | `"game" \| "ui" \| "normal"` | No | `"normal"` | Sampling rate. |


#### Return Value
- **Schema Type:** `SensorStartResult`
- **Description:** Status of gyroscope activation.

```json title="Return Payload Shape"
{
  "started": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('START_GYROSCOPE', { interval: 'game' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
sensorManager.registerListener(gyroListener, gyroSensor, SensorManager.SENSOR_DELAY_GAME)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
motionManager.startGyroUpdates(to: .main) { data, _ in ... }
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('START_GYROSCOPE', {'interval': 'game'});
```

  </TabItem>
</Tabs>


---

### 7. `STOP_GYROSCOPE` {#stop-gyroscope}

Deactivates the hardware gyroscope.

**Purpose & Context:** Stops high-frequency angular rotation sampling.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `STOP_GYROSCOPE`
- **Supported Aliases:** `stopGyroscope`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `SensorStopResult`
- **Description:** Confirmation of gyroscope shutdown.

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
await goatBridge.callNative('STOP_GYROSCOPE', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
sensorManager.unregisterListener(gyroListener)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
motionManager.stopGyroUpdates()
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('STOP_GYROSCOPE', {});
```

  </TabItem>
</Tabs>


---

### 8. `GET_LATEST_GYROSCOPE` {#get-latest-gyroscope}

Retrieves latest cached angular velocity readings (x, y, z rad/s).

**Purpose & Context:** Single frame query for rotation rates.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `GET_LATEST_GYROSCOPE`
- **Supported Aliases:** `getLatestGyroscope`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `SensorMotionData`
- **Description:** 3-axis rotation velocity in radians per second.

```json title="Return Payload Shape"
{
  "x": "number",
  "y": "number",
  "z": "number",
  "timestamp": "number (optional)"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { x, y, z } = await goatBridge.callNative('GET_LATEST_GYROSCOPE', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val (x, y, z) = lastGyroSample
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let rot = motionManager.gyroData?.rotationRate
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('GET_LATEST_GYROSCOPE', {});
```

  </TabItem>
</Tabs>


---

### 9. `START_DEVICE_MOTION` {#start-device-motion}

Activates sensor fusion pipeline combining accelerometer, gyroscope, and gravity vector into calibrated device attitude orientation.

**Purpose & Context:** Delivers high-precision device tilt and attitude matrices.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `START_DEVICE_MOTION`
- **Supported Aliases:** `startDeviceMotion`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `interval` | `"game" \| "ui" \| "normal"` | No | `"ui"` | Sampling rate. |


#### Return Value
- **Schema Type:** `SensorStartResult`
- **Description:** Status of device motion tracking.

```json title="Return Payload Shape"
{
  "started": "boolean",
  "interval": "string"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('START_DEVICE_MOTION', { interval: 'ui' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
sensorManager.registerListener(rotListener, rotVectorSensor, SensorManager.SENSOR_DELAY_UI)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
motionManager.startDeviceMotionUpdates(to: .main) { motion, _ in ... }
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('START_DEVICE_MOTION', {'interval': 'ui'});
```

  </TabItem>
</Tabs>


---

### 10. `STOP_DEVICE_MOTION` {#stop-device-motion}

Shuts down sensor fusion motion tracking.

**Purpose & Context:** Conserves CPU and battery when motion tracking is inactive.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `STOP_DEVICE_MOTION`
- **Supported Aliases:** `stopDeviceMotion`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `SensorStopResult`
- **Description:** Confirmation that device motion was disabled.

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
await goatBridge.callNative('STOP_DEVICE_MOTION', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
sensorManager.unregisterListener(rotListener)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
motionManager.stopDeviceMotionUpdates()
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('STOP_DEVICE_MOTION', {});
```

  </TabItem>
</Tabs>


---

### 11. `GET_LATEST_DEVICE_MOTION` {#get-latest-device-motion}

Queries latest sensor fusion attitude sample.

**Purpose & Context:** Snapshot of device orientation vector.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `GET_LATEST_DEVICE_MOTION`
- **Supported Aliases:** `getLatestDeviceMotion`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `DeviceMotionSnapshot`
- **Description:** Motion data vector with epoch timestamp.

```json title="Return Payload Shape"
{
  "isStreaming": "boolean",
  "x": "number",
  "y": "number",
  "z": "number",
  "timestampMs": "number"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const motion = await goatBridge.callNative('GET_LATEST_DEVICE_MOTION', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val sample = lastMotionSnapshot
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let attitude = motionManager.deviceMotion?.attitude
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('GET_LATEST_DEVICE_MOTION', {});
```

  </TabItem>
</Tabs>


---

### 12. `MAKE_PHONE_CALL` {#make-phone-call}

Launches native phone dialer with pre-populated phone number string.

**Purpose & Context:** Enables "Call Merchant" or "Customer Support" quick dial buttons.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `MAKE_PHONE_CALL`
- **Supported Aliases:** `makePhoneCall`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `android.permission.CALL_PHONE (optional)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `phoneNumber` | `string` | **Yes** | - | Telephone number string (e.g. "+1-800-555-0199"). |


#### Return Value
- **Schema Type:** `TelephonyResult`
- **Description:** Confirmation that dialer intent was dispatched.

```json title="Return Payload Shape"
{
  "handled": "boolean",
  "phoneNumber": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | phoneNumber missing or invalid. | Provide a valid phone number string. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('MAKE_PHONE_CALL', { phoneNumber: '+18005550199' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phoneNumber"))
context.startActivity(intent)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
if let url = URL(string: "tel://\(phoneNumber)") { UIApplication.shared.open(url) }
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('MAKE_PHONE_CALL', {'phoneNumber': '+18005550199'});
```

  </TabItem>
</Tabs>


---

### 13. `SEND_SMS` {#send-sms}

Opens native messaging app with pre-filled recipient and message body text.

**Purpose & Context:** Enables SMS invite sharing and customer service text messaging.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `SEND_SMS`
- **Supported Aliases:** `sendSms`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `android.permission.SEND_SMS (optional)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `phoneNumber` | `string` | **Yes** | - | Recipient phone number. |
| `body` | `string` | No | - | Pre-populated SMS text. |


#### Return Value
- **Schema Type:** `TelephonyResult`
- **Description:** Confirmation of SMS intent dispatch.

```json title="Return Payload Shape"
{
  "handled": "boolean",
  "phoneNumber": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | phoneNumber missing. | Provide valid phone number. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('SEND_SMS', {
  phoneNumber: '+18005550199',
  body: 'Check out this order on Goat WebView!'
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:$phoneNumber")).apply {
    putExtra("sms_body", body)
}
context.startActivity(intent)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
if let url = URL(string: "sms:\(phoneNumber)&body=\(body.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)!)") {
    UIApplication.shared.open(url)
}
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('SEND_SMS', {
  'phoneNumber': '+18005550199',
  'body': 'Check out this order!',
});
```

  </TabItem>
</Tabs>

