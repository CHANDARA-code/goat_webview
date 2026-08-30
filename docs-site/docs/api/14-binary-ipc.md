---
sidebar_position: 15
title: Domain 14 - Binary IPC Channels
description: Complete API reference for Binary IPC Channels (4 actions).
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Domain 14: Binary IPC Channels ⚡

High-throughput, zero-copy ArrayBuffer binary message ports for large payloads (images, audio frames, WASM memory buffers).

**Total Actions in Domain:** `4 actions`

---

## Action Summary

| # | Action String | Permission | Inputs | Returns |
| :--- | :--- | :--- | :--- | :--- |
| 1 | [`CREATE_BINARY_PORT`](#create-binary-port) | `none` | `portId` | `BinaryPortCreateResult` |
| 2 | [`POST_BINARY_MESSAGE`](#post-binary-message) | `none` | `portId`, `dataBase64` | `BinaryPortPacketResult` |
| 3 | [`READ_BINARY_MESSAGE`](#read-binary-message) | `none` | `portId` | `BinaryPortReadResult` |
| 4 | [`CLOSE_BINARY_PORT`](#close-binary-port) | `none` | `portId` | `BinaryPortCloseResult` |

---

## Action Specifications

---

### 1. `CREATE_BINARY_PORT` {#create-binary-port}

Initializes a high-throughput, zero-copy ArrayBuffer binary message port channel between WebView and native host.

**Purpose & Context:** Enables streaming large binary payloads (WASM memory heap, camera image frame buffers, audio PCM buffers) without JSON stringification overhead.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `CREATE_BINARY_PORT`
- **Supported Aliases:** `createBinaryPort`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `portId` | `string` | No | - | Optional custom port identifier. |


#### Return Value
- **Schema Type:** `BinaryPortCreateResult`
- **Description:** Allocated binary port handle.

```json title="Return Payload Shape"
{
  "portId": "string",
  "created": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { portId } = await goatBridge.callNative('CREATE_BINARY_PORT', {});
console.log('Opened binary port:', portId);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Create WebMessagePortCompat channel
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// WKScriptMessageHandler sendWithReply ArrayBuffer channel
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('CREATE_BINARY_PORT', {});
```

  </TabItem>
</Tabs>


---

### 2. `POST_BINARY_MESSAGE` {#post-binary-message}

Transmits a binary ArrayBuffer frame through the active binary port.

**Purpose & Context:** High-speed transfer of raw byte arrays.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `POST_BINARY_MESSAGE`
- **Supported Aliases:** `postBinaryMessage`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `portId` | `string` | **Yes** | - | Active port identifier. |
| `dataBase64` | `string` | **Yes** | - | Base64 encoded binary buffer. |


#### Return Value
- **Schema Type:** `BinaryPortPacketResult`
- **Description:** Transfer acknowledgment with byte length and sequence counter.

```json title="Return Payload Shape"
{
  "posted": "boolean",
  "portId": "string",
  "byteSize": "number",
  "sequenceNumber": "number"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `PORT_NOT_FOUND` | The specified portId does not exist or has been closed. | Ensure port is opened with CREATE_BINARY_PORT before sending. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('POST_BINARY_MESSAGE', {
  portId: 'port_01',
  dataBase64: btoa('Raw PCM audio bytes...')
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
webMessagePort.postMessage(WebMessageCompat(payloadBytes))
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Transfer raw Data over IPC port
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('POST_BINARY_MESSAGE', {
  'portId': 'port_01',
  'dataBase64': '...',
});
```

  </TabItem>
</Tabs>


---

### 3. `READ_BINARY_MESSAGE` {#read-binary-message}

Reads or dequeues the next available binary message packet from the designated port buffer.

**Purpose & Context:** Receives native-generated camera frames or sensor buffers.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `READ_BINARY_MESSAGE`
- **Supported Aliases:** `readBinaryMessage`, `onBinaryMessage`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `portId` | `string` | **Yes** | - | Port identifier to read from. |


#### Return Value
- **Schema Type:** `BinaryPortReadResult`
- **Description:** Dequeued binary packet in Base64 or null if queue is empty.

```json title="Return Payload Shape"
{
  "portId": "string",
  "dataBase64": "string | null",
  "byteSize": "number"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `PORT_NOT_FOUND` | Invalid portId. | Check portId. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const packet = await goatBridge.callNative('READ_BINARY_MESSAGE', { portId: 'port_01' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Dequeue from port buffer
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Read next packet from buffer
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final packet = await goatController.callNativeAction('READ_BINARY_MESSAGE', {'portId': 'port_01'});
```

  </TabItem>
</Tabs>


---

### 4. `CLOSE_BINARY_PORT` {#close-binary-port}

Closes and disposes the binary IPC port, freeing native ring buffers.

**Purpose & Context:** Cleans up binary streaming channels.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `CLOSE_BINARY_PORT`
- **Supported Aliases:** `closeBinaryPort`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `portId` | `string` | **Yes** | - | Port identifier to close. |


#### Return Value
- **Schema Type:** `BinaryPortCloseResult`
- **Description:** Confirmation that port resources were freed.

```json title="Return Payload Shape"
{
  "closed": "boolean",
  "portId": "string"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('CLOSE_BINARY_PORT', { portId: 'port_01' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
webMessagePort.close()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Invalidate port channel
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('CLOSE_BINARY_PORT', {'portId': 'port_01'});
```

  </TabItem>
</Tabs>

