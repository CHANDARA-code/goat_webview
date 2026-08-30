---
sidebar_position: 17
title: Domain 16 - Subpackages, WASM & Bytecode
description: Complete API reference for Subpackages, WASM & Bytecode (9 actions).
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Domain 16: Subpackages, WASM & Bytecode 📦

Dynamic on-demand subpackage downloading and extraction, V8 code cache / JSC bytecode precompilation, and WASM SIMD validation.

**Total Actions in Domain:** `9 actions`

---

## Action Summary

| # | Action String | Permission | Inputs | Returns |
| :--- | :--- | :--- | :--- | :--- |
| 1 | [`LOAD_SUBPACKAGE`](#load-subpackage) | `none` | `subpackageName`, `appId` | `SubpackageLoadResult` |
| 2 | [`IS_SUBPACKAGE_CACHED`](#is-subpackage-cached) | `none` | `subpackageName`, `appId` | `SubpackageCachedResult` |
| 3 | [`CLEAR_SUBPACKAGE_CACHE`](#clear-subpackage-cache) | `none` | `subpackageName`, `appId` | `SubpackageClearResult` |
| 4 | [`GET_SUBPACKAGES`](#get-subpackages) | `none` | `appId` | `SubpackagesListResult` |
| 5 | [`PRECOMPILE_BYTECODE`](#precompile-bytecode) | `none` | `bundlePath`, `appId` | `BytecodePrecompileResult` |
| 6 | [`IS_BYTECODE_WARM`](#is-bytecode-warm) | `none` | `appId` | `BytecodeWarmResult` |
| 7 | [`CLEAR_BYTECODE_CACHE`](#clear-bytecode-cache) | `none` | `appId` | `BytecodeClearResult` |
| 8 | [`GET_BYTECODE_STATS`](#get-bytecode-stats) | `none` | `{}` | `BytecodeStatsResult` |
| 9 | [`VALIDATE_WASM_SUPPORT`](#validate-wasm-support) | `none` | `{}` | `WasmSupportResult` |

---

## Action Specifications

---

### 1. `LOAD_SUBPACKAGE` {#load-subpackage}

Downloads and extracts a split subpackage bundle on-demand with SHA-256 integrity verification.

**Purpose & Context:** Enables sub-package bundle splitting, keeping main bundle size under 2 MB for instant cold boot.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `LOAD_SUBPACKAGE`
- **Supported Aliases:** `loadSubpackage`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `subpackageName` | `string` | **Yes** | - | Subpackage name defined in goat.config.json (e.g. "sub_checkout"). |
| `appId` | `string` | No | - | Target appId. |


#### Return Value
- **Schema Type:** `SubpackageLoadResult`
- **Description:** Extracted directory path and byte metrics.

```json title="Return Payload Shape"
{
  "appId": "string",
  "subpackageName": "string",
  "isSuccess": "boolean",
  "isCached": "boolean",
  "extractedPath": "string",
  "byteSize": "number"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | subpackageName missing. | Specify subpackageName from manifest. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('LOAD_SUBPACKAGE', {
  subpackageName: 'sub_checkout'
});
// Subpackage assets & scripts now available under goat://app/sub_checkout/
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Download subpackage zip, verify SHA-256, extract to sandbox/subpackages/
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Download and extract subpackage bundle into isolated directory
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('LOAD_SUBPACKAGE', {'subpackageName': 'sub_checkout'});
```

  </TabItem>
</Tabs>


---

### 2. `IS_SUBPACKAGE_CACHED` {#is-subpackage-cached}

Tests whether a subpackage bundle is already extracted on disk and warm.

**Purpose & Context:** Checks if subpackage navigation will require a network download.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `IS_SUBPACKAGE_CACHED`
- **Supported Aliases:** `isSubpackageCached`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `subpackageName` | `string` | **Yes** | - | Subpackage name. |
| `appId` | `string` | No | - | Calling appId. |


#### Return Value
- **Schema Type:** `SubpackageCachedResult`
- **Description:** True if cached on disk.

```json title="Return Payload Shape"
{
  "isCached": "boolean",
  "subpackageName": "string",
  "appId": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | subpackageName missing. | Provide subpackageName. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { isCached } = await goatBridge.callNative('IS_SUBPACKAGE_CACHED', { subpackageName: 'sub_checkout' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val cached = File(subpackageDir, subpackageName).exists()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let cached = FileManager.default.fileExists(atPath: subpackageUrl.path)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('IS_SUBPACKAGE_CACHED', {'subpackageName': 'sub_checkout'});
```

  </TabItem>
</Tabs>


---

### 3. `CLEAR_SUBPACKAGE_CACHE` {#clear-subpackage-cache}

Deletes cached subpackage bundles from disk to reclaim storage space.

**Purpose & Context:** Purges unneeded subpackages during storage cleanup.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `CLEAR_SUBPACKAGE_CACHE`
- **Supported Aliases:** `clearSubpackageCache`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `subpackageName` | `string` | No | - | Specific subpackage to delete, or omit to clear all. |
| `appId` | `string` | No | - | Calling appId. |


#### Return Value
- **Schema Type:** `SubpackageClearResult`
- **Description:** Status of subpackage cache purge.

```json title="Return Payload Shape"
{
  "cleared": "boolean",
  "subpackageName": "string",
  "appId": "string"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('CLEAR_SUBPACKAGE_CACHE', { subpackageName: 'sub_checkout' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Delete subpackage files
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Remove subpackage items
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('CLEAR_SUBPACKAGE_CACHE', {'subpackageName': 'sub_checkout'});
```

  </TabItem>
</Tabs>


---

### 4. `GET_SUBPACKAGES` {#get-subpackages}

Lists all available subpackages registered in the mini-app manifest.

**Purpose & Context:** Queries subpackage directory for prefetching algorithms.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `GET_SUBPACKAGES`
- **Supported Aliases:** `getSubpackages`, `prefetchSubpackage`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `appId` | `string` | No | - | Calling appId. |


#### Return Value
- **Schema Type:** `SubpackagesListResult`
- **Description:** List of registered subpackage names.

```json title="Return Payload Shape"
{
  "appId": "string",
  "subpackages": "string[]"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { subpackages } = await goatBridge.callNative('GET_SUBPACKAGES', {});
console.log('Registered subpackages:', subpackages);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Read manifest subpackages array
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Query manifest subpackages
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('GET_SUBPACKAGES', {});
```

  </TabItem>
</Tabs>


---

### 5. `PRECOMPILE_BYTECODE` {#precompile-bytecode}

Triggers Ahead-Of-Time (AOT) JavaScript bytecode precompilation (V8 Code Cache on Android, JavaScriptCore Bytecode on iOS).

**Purpose & Context:** Reduces JavaScript parse/compile time from 150ms to &lt;10ms for instantaneous sub-millisecond execution.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `PRECOMPILE_BYTECODE`
- **Supported Aliases:** `precompileBytecode`, `compileBytecodeCache`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `bundlePath` | `string` | **Yes** | - | Path to JavaScript bundle file. |
| `appId` | `string` | No | - | Target appId. |


#### Return Value
- **Schema Type:** `BytecodePrecompileResult`
- **Description:** Compilation duration and bytecode cache size.

```json title="Return Payload Shape"
{
  "appId": "string",
  "isSuccess": "boolean",
  "compileDurationMs": "number",
  "bytecodeSizeBytes": "number",
  "cachePath": "string"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const result = await goatBridge.callNative('PRECOMPILE_BYTECODE', {
  bundlePath: 'bundles/main.bundle.js'
});
console.log(`Compiled in ${result.compileDurationMs}ms, size: ${result.bytecodeSizeBytes} bytes`);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// V8 ScriptCompiler::CompileUnboundScript with kProduceCodeCache
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// JSC JSBytecodeCache compile
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('PRECOMPILE_BYTECODE', {'bundlePath': 'bundles/main.bundle.js'});
```

  </TabItem>
</Tabs>


---

### 6. `IS_BYTECODE_WARM` {#is-bytecode-warm}

Checks if precompiled bytecode cache is warm and ready on disk for the calling appId.

**Purpose & Context:** Verifies warm boot readiness.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `IS_BYTECODE_WARM`
- **Supported Aliases:** `isBytecodeWarm`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `appId` | `string` | No | - | Calling appId. |


#### Return Value
- **Schema Type:** `BytecodeWarmResult`
- **Description:** True if cached bytecode matches bundle hash.

```json title="Return Payload Shape"
{
  "isWarm": "boolean",
  "appId": "string"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { isWarm } = await goatBridge.callNative('IS_BYTECODE_WARM', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val warm = codeCacheFile.exists() && codeCacheFile.length() > 0
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let warm = FileManager.default.fileExists(atPath: bytecodeUrl.path)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('IS_BYTECODE_WARM', {});
```

  </TabItem>
</Tabs>


---

### 7. `CLEAR_BYTECODE_CACHE` {#clear-bytecode-cache}

Purges compiled V8/JSC bytecode cache files.

**Purpose & Context:** Invalidates stale bytecode when a new bundle version is downloaded.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `CLEAR_BYTECODE_CACHE`
- **Supported Aliases:** `clearBytecodeCache`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `appId` | `string` | No | - | Calling appId. |


#### Return Value
- **Schema Type:** `BytecodeClearResult`
- **Description:** Confirmation that bytecode cache was cleared.

```json title="Return Payload Shape"
{
  "cleared": "boolean",
  "appId": "string"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('CLEAR_BYTECODE_CACHE', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
codeCacheDir.deleteRecursively()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Delete JSC bytecode caches
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('CLEAR_BYTECODE_CACHE', {});
```

  </TabItem>
</Tabs>


---

### 8. `GET_BYTECODE_STATS` {#get-bytecode-stats}

Queries global bytecode cache footprint (total cached bundles, total cache size in bytes).

**Purpose & Context:** Monitors overall code cache memory consumption.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `GET_BYTECODE_STATS`
- **Supported Aliases:** `getBytecodeStats`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `BytecodeStatsResult`
- **Description:** Bytecode metrics.

```json title="Return Payload Shape"
{
  "totalCachedBundles": "number",
  "totalCacheSizeBytes": "number",
  "isWarm": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const stats = await goatBridge.callNative('GET_BYTECODE_STATS', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Query cache directory size
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Calculate bytecode directory footprint
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('GET_BYTECODE_STATS', {});
```

  </TabItem>
</Tabs>


---

### 9. `VALIDATE_WASM_SUPPORT` {#validate-wasm-support}

Probes host WebAssembly engine capabilities (SIMD-128, SharedArrayBuffer, threads, max memory pages).

**Purpose & Context:** Enables high-performance physics engines, crypto libraries, and OpenCV WASM modules.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `VALIDATE_WASM_SUPPORT`
- **Supported Aliases:** `validateWasmSupport`, `probeWasmSupport`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `WasmSupportResult`
- **Description:** WebAssembly capability flags.

```json title="Return Payload Shape"
{
  "wasmSupported": "boolean",
  "simdSupported": "boolean",
  "sharedArrayBufferSupported": "boolean",
  "threadsSupported": "boolean",
  "maxMemoryPages": "number"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const wasm = await goatBridge.callNative('VALIDATE_WASM_SUPPORT', {});
console.log('SIMD supported:', wasm.simdSupported, 'Threads:', wasm.threadsSupported);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Probe V8 WASM flags
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Probe JSC WebAssembly feature set
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('VALIDATE_WASM_SUPPORT', {});
```

  </TabItem>
</Tabs>

