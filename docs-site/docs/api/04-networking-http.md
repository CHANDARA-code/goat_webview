---
sidebar_position: 5
title: Domain 4 - Networking, HTTP & WebSockets
description: Complete API reference for Networking, HTTP & WebSockets (10 actions).
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Domain 4: Networking, HTTP & WebSockets 🌐

Zero-trust networking stack with anti-SSRF protections, chunked streaming downloads/uploads, WebSocket bridge, and SSL pinning audits.

**Total Actions in Domain:** `10 actions`

---

## Action Summary

| # | Action String | Permission | Inputs | Returns |
| :--- | :--- | :--- | :--- | :--- |
| 1 | [`API_REQUEST`](#api-request) | `none` | `url`, `method`, `headers`, `body`, `timeoutMs` | `ApiResponseData` |
| 2 | [`DOWNLOAD_FILE`](#download-file) | `none` | `url`, `filePath`, `fileName` | `DownloadResult` |
| 3 | [`UPLOAD_FILE`](#upload-file) | `none` | `url`, `filePath`, `name`, `header`, `formData` | `UploadFileResult` |
| 4 | [`GET_NETWORK_TYPE`](#get-network-type) | `none` | `{}` | `GetNetworkTypeResult` |
| 5 | [`IS_CONNECTED`](#is-connected) | `none` | `{}` | `IsConnectedResult` |
| 6 | [`WEBSOCKET_CONNECT`](#websocket-connect) | `none` | `url`, `protocols`, `headers` | `WebSocketConnectResult` |
| 7 | [`WEBSOCKET_SEND`](#websocket-send) | `none` | `data` | `WebSocketSendResult` |
| 8 | [`WEBSOCKET_CLOSE`](#websocket-close) | `none` | `{}` | `WebSocketCloseResult` |
| 9 | [`VERIFY_SSL_PIN`](#verify-ssl-pin) | `none` | `hostname`, `pinSha256` | `SslPinAuditResult` |
| 10 | [`AUDIT_NETWORK_CERTIFICATE`](#audit-network-certificate) | `none` | `url` | `NetworkCertAuditResult` |

---

## Action Specifications

---

### 1. `API_REQUEST` {#api-request}

Dispatches an out-of-process HTTP/HTTPS request through native network stack with zero-trust anti-SSRF protections.

**Purpose & Context:** Bypasses browser CORS restrictions while blocking SSRF access to loopback (127.0.0.1), RFC1918 private subnets, and Cloud Metadata IMDS (169.254.169.254).

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `API_REQUEST`
- **Supported Aliases:** `apiRequest`, `request`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `android.permission.INTERNET`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `url` | `string` | **Yes** | - | Target remote HTTPS endpoint. |
| `method` | `"GET" \| "POST" \| "PUT" \| "DELETE"` | No | `"GET"` | HTTP method. |
| `headers` | `Record&lt;string, string>` | No | - | HTTP request headers. |
| `body` | `string` | No | - | Request payload string. |
| `timeoutMs` | `number` | No | `30000` | Network timeout in milliseconds. |


#### Return Value
- **Schema Type:** `ApiResponseData`
- **Description:** Response payload parsed as JSON or string with timing metrics.

```json title="Return Payload Shape"
{
  "status": "number",
  "statusText": "string",
  "headers": "Record<string, string>",
  "data": "any",
  "durationMs": "number"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Malformed URL provided. | Ensure URL includes protocol (https://). |
| `SSRF_BLOCKED` | Destination resolved to private IP, localhost, or cloud metadata endpoint. | Requests must target public routable domain names. |
| `NETWORK_OFFLINE` | Host device is offline. | Check network connectivity using GET_NETWORK_TYPE. |
| `TIMEOUT` | Server did not respond within timeoutMs. | Increase timeout or verify backend availability. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const res = await goatBridge.callNative('API_REQUEST', {
  url: 'https://api.example.com/v1/products',
  method: 'GET',
  headers: { 'Accept': 'application/json' },
  timeoutMs: 15000
});
console.log('Status:', res.status, 'Data:', res.data);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// OkHttp client with SSRF Interceptor and SSL Pinning
val request = Request.Builder().url(url).build()
val response = okHttpClient.newCall(request).execute()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// URLSession dataTask with anti-SSRF IP filtering
let (data, response) = try await urlSession.data(for: request)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('API_REQUEST', {
  'url': 'https://api.example.com/v1/products',
  'method': 'GET',
});
```

  </TabItem>
</Tabs>


---

### 2. `DOWNLOAD_FILE` {#download-file}

Downloads a remote binary file in background and saves it into the sandboxed file system.

**Purpose & Context:** Fetches PDF invoices, media streams, and bundle assets with progress tracking.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `DOWNLOAD_FILE`
- **Supported Aliases:** `downloadFile`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `android.permission.INTERNET`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `url` | `string` | **Yes** | - | Remote resource URL. |
| `filePath` | `string` | No | - | Destination relative path in sandbox. |
| `fileName` | `string` | No | - | Suggested filename. |


#### Return Value
- **Schema Type:** `DownloadResult`
- **Description:** Download task tracker metadata.

```json title="Return Payload Shape"
{
  "downloadId": "number",
  "status": "string",
  "fileName": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Missing URL. | Provide target URL. |
| `SSRF_BLOCKED` | Blocked internal IP address. | Only public URLs allowed. |
| `NETWORK_OFFLINE` | Device is offline. | Retry with active connection. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const result = await goatBridge.callNative('DOWNLOAD_FILE', {
  url: 'https://example.com/assets/sample.pdf',
  filePath: 'downloads/sample.pdf'
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let task = urlSession.downloadTask(with: url) { localUrl, ... in }
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('DOWNLOAD_FILE', {
  'url': 'https://example.com/assets/sample.pdf',
});
```

  </TabItem>
</Tabs>


---

### 3. `UPLOAD_FILE` {#upload-file}

Streams a local sandboxed file to a remote server using multipart/form-data POST.

**Purpose & Context:** Enables photo/video uploads, receipt submissions, and crash report uploads.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `UPLOAD_FILE`
- **Supported Aliases:** `uploadFile`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `android.permission.INTERNET`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `url` | `string` | **Yes** | - | Remote upload endpoint. |
| `filePath` | `string` | **Yes** | - | Sandboxed file relative path. |
| `name` | `string` | No | `"file"` | Form field name. |
| `header` | `Record&lt;string, string>` | No | - | Custom headers. |
| `formData` | `Record&lt;string, string>` | No | - | Additional multipart form fields. |


#### Return Value
- **Schema Type:** `UploadFileResult`
- **Description:** HTTP response status and response body from server.

```json title="Return Payload Shape"
{
  "statusCode": "number",
  "data": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | File does not exist or URL is invalid. | Verify file exists in sandbox. |
| `SSRF_BLOCKED` | Target URL is on a private subnet. | Upload only to public endpoints. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const res = await goatBridge.callNative('UPLOAD_FILE', {
  url: 'https://api.example.com/v1/uploads',
  filePath: 'photos/avatar.png',
  name: 'avatar',
  formData: { userId: '1001' }
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val multipartBody = MultipartBody.Builder().setType(MultipartBody.FORM)
multipartBody.addFormDataPart("file", file.name, file.asRequestBody())
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// URLSession upload task with multipart boundary encoding
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('UPLOAD_FILE', {
  'url': 'https://api.example.com/v1/uploads',
  'filePath': 'photos/avatar.png',
});
```

  </TabItem>
</Tabs>


---

### 4. `GET_NETWORK_TYPE` {#get-network-type}

Queries active network connection status and radio carrier technology.

**Purpose & Context:** Adapts video streaming resolution or prefetching strategy based on connection (Wi-Fi vs 2G/3G/4G/5G).

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `GET_NETWORK_TYPE`
- **Supported Aliases:** `getNetworkType`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `android.permission.ACCESS_NETWORK_STATE`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `GetNetworkTypeResult`
- **Description:** Active network category and connectivity flag.

```json title="Return Payload Shape"
{
  "networkType": "\"wifi\" | \"5g\" | \"4g\" | \"3g\" | \"2g\" | \"unknown\" | \"none\"",
  "isConnected": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { networkType, isConnected } = await goatBridge.callNative('GET_NETWORK_TYPE', {});
console.log('Connected:', isConnected, 'Type:', networkType);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
val activeNetwork = connectivityManager.activeNetwork
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// NWPathMonitor path inspection
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('GET_NETWORK_TYPE', {});
```

  </TabItem>
</Tabs>


---

### 5. `IS_CONNECTED` {#is-connected}

Quick boolean probe checking if the host device has an active internet connection.

**Purpose & Context:** Displays offline banner when connection drops.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `IS_CONNECTED`
- **Supported Aliases:** `isConnected`, `onNetworkStatusChange`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `android.permission.ACCESS_NETWORK_STATE`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `IsConnectedResult`
- **Description:** Connection status boolean.

```json title="Return Payload Shape"
{
  "isConnected": "boolean",
  "networkType": "string"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { isConnected } = await goatBridge.callNative('IS_CONNECTED', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val isOnline = activeNetworkCapabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let isOnline = monitor.currentPath.status == .satisfied
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('IS_CONNECTED', {});
```

  </TabItem>
</Tabs>


---

### 6. `WEBSOCKET_CONNECT` {#websocket-connect}

Establishes a native persistent WebSocket connection with automatic ping/pong heartbeats.

**Purpose & Context:** Enables real-time bi-directional streaming for chat apps, live game updates, and financial tickers.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `WEBSOCKET_CONNECT`
- **Supported Aliases:** `connectSocket`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `android.permission.INTERNET`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `url` | `string` | **Yes** | - | Target wss:// or ws:// URL. |
| `protocols` | `string[]` | No | - | Subprotocol negotiation list. |
| `headers` | `Record&lt;string, string>` | No | - | Initial handshake headers. |


#### Return Value
- **Schema Type:** `WebSocketConnectResult`
- **Description:** Status of WebSocket handshake.

```json title="Return Payload Shape"
{
  "connected": "boolean",
  "url": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Invalid WebSocket URL. | Must start with ws:// or wss://. |
| `NETWORK_OFFLINE` | Device is offline. | Check connection. |
| `SSRF_BLOCKED` | Target points to private subnet. | Use public hostnames. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('WEBSOCKET_CONNECT', {
  url: 'wss://stream.example.com/v1/ticker'
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val wsRequest = Request.Builder().url(url).build()
val webSocket = okHttpClient.newWebSocket(wsRequest, listener)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let webSocketTask = urlSession.webSocketTask(with: URL(string: url)!)
webSocketTask.resume()
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('WEBSOCKET_CONNECT', {
  'url': 'wss://stream.example.com/v1/ticker',
});
```

  </TabItem>
</Tabs>


---

### 7. `WEBSOCKET_SEND` {#websocket-send}

Transmits a text or JSON frame over the active WebSocket bridge connection.

**Purpose & Context:** Sends chat messages, order requests, or subscribe events over open socket.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `WEBSOCKET_SEND`
- **Supported Aliases:** `sendSocketMessage`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `data` | `string` | **Yes** | - | Message payload string. |


#### Return Value
- **Schema Type:** `WebSocketSendResult`
- **Description:** Confirmation that frame was buffered for transmission.

```json title="Return Payload Shape"
{
  "sent": "boolean"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Data was missing or socket is closed. | Verify socket is connected. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('WEBSOCKET_SEND', {
  data: JSON.stringify({ event: 'subscribe', channel: 'BTC_USD' })
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
webSocket.send(data)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
webSocketTask.send(.string(data)) { error in }
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('WEBSOCKET_SEND', {
  'data': '{"event": "ping"}',
});
```

  </TabItem>
</Tabs>


---

### 8. `WEBSOCKET_CLOSE` {#websocket-close}

Gracefully closes the active native WebSocket stream.

**Purpose & Context:** Cleans up network resources when exiting live streaming screen.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `WEBSOCKET_CLOSE`
- **Supported Aliases:** `closeSocket`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `WebSocketCloseResult`
- **Description:** Confirmation of socket disconnection.

```json title="Return Payload Shape"
{
  "closed": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('WEBSOCKET_CLOSE', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
webSocket.close(1000, "Normal Closure")
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
webSocketTask.cancel(with: .normalClosure, reason: nil)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('WEBSOCKET_CLOSE', {});
```

  </TabItem>
</Tabs>


---

### 9. `VERIFY_SSL_PIN` {#verify-ssl-pin}

Verifies whether a remote server certificate matches the SHA-256 public key pin configured in the host security policy.

**Purpose & Context:** Protects financial and healthcare mini-apps against Man-in-the-Middle (MITM) proxy interception.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `VERIFY_SSL_PIN`
- **Supported Aliases:** `verifySslPin`, `auditSslPinning`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `android.permission.INTERNET`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `hostname` | `string` | **Yes** | - | Target domain (e.g., "api.bank.com"). |
| `pinSha256` | `string` | No | - | Expected SPKI SHA-256 hash. |


#### Return Value
- **Schema Type:** `SslPinAuditResult`
- **Description:** Audit result and certificate chain validation status.

```json title="Return Payload Shape"
{
  "hostname": "string",
  "isPinned": "boolean",
  "isCertificateValid": "boolean",
  "auditStatus": "string",
  "matchedPin": "string (optional)"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `SECURITY_VIOLATION` | Certificate chain did not match pinned SHA-256 public key. | Ensure server public key matches the declared SPKI pin. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const audit = await goatBridge.callNative('VERIFY_SSL_PIN', {
  hostname: 'api.bank.com',
  pinSha256: 'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
});
console.log('Pinned:', audit.isPinned);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// OkHttp CertificatePinner check
val pinner = CertificatePinner.Builder().add(hostname, pinSha256).build()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// URLSessionDelegate serverTrust evaluation
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('VERIFY_SSL_PIN', {
  'hostname': 'api.bank.com',
});
```

  </TabItem>
</Tabs>


---

### 10. `AUDIT_NETWORK_CERTIFICATE` {#audit-network-certificate}

Performs diagnostic inspection of SSL/TLS certificate chain, expiration, and issuer CA for target URL.

**Purpose & Context:** Enables security health checks and automated certificate expiration warnings.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `AUDIT_NETWORK_CERTIFICATE`
- **Supported Aliases:** `auditNetworkCertificate`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `android.permission.INTERNET`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `url` | `string` | **Yes** | - | HTTPS endpoint to audit. |


#### Return Value
- **Schema Type:** `NetworkCertAuditResult`
- **Description:** TLS handshake certificate validity report.

```json title="Return Payload Shape"
{
  "hostname": "string",
  "isPinned": "boolean",
  "isCertificateValid": "boolean",
  "auditStatus": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Invalid URL provided. | Ensure URL starts with https://. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const report = await goatBridge.callNative('AUDIT_NETWORK_CERTIFICATE', { url: 'https://api.github.com' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Inspect SSLSession peerCertificates
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// SecTrustEvaluateWithError on serverTrust
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('AUDIT_NETWORK_CERTIFICATE', {'url': 'https://api.github.com'});
```

  </TabItem>
</Tabs>

