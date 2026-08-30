---
sidebar_position: 10
title: Domain 9 - Media & Audio
description: Complete API reference for Media & Audio (7 actions).
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Domain 9: Media & Audio 🎬

Camera QR/barcode scanner, photo gallery and video pickers, multi-image preview gallery, and background audio player controller.

**Total Actions in Domain:** `7 actions`

---

## Action Summary

| # | Action String | Permission | Inputs | Returns |
| :--- | :--- | :--- | :--- | :--- |
| 1 | [`SCAN_CODE`](#scan-code) | `scope.camera` | `onlyFromCamera`, `scanType` | `ScanCodeResult` |
| 2 | [`CHOOSE_MEDIA`](#choose-media) | `scope.camera` | `count`, `mediaType`, `sourceType`, `maxDuration` | `ChooseMediaResult` |
| 3 | [`PREVIEW_IMAGE`](#preview-image) | `none` | `urls`, `current` | `PreviewImageResult` |
| 4 | [`AUDIO_PLAY`](#audio-play) | `none` | `src`, `title`, `epname`, `singer`, `coverImgUrl`, `startTime` | `AudioStateResult` |
| 5 | [`AUDIO_PAUSE`](#audio-pause) | `none` | `{}` | `AudioStateResult` |
| 6 | [`AUDIO_STOP`](#audio-stop) | `none` | `{}` | `AudioStateResult` |
| 7 | [`AUDIO_SEEK`](#audio-seek) | `none` | `position` | `AudioStateResult` |

---

## Action Specifications

---

### 1. `SCAN_CODE` {#scan-code}

Launches full-screen native camera barcode/QR scanner viewfinder with automatic lighting toggle and multi-format decoding (QR, EAN-13, DataMatrix).

**Purpose & Context:** Enables instant QR payment scanning, asset tracking, and package barcode check-in.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `SCAN_CODE`
- **Supported Aliases:** `scanCode`
- **Permission Scope:** `scope.camera`
- **Required Manifest Permissions:** `android.permission.CAMERA`, `NSCameraUsageDescription`
- **Security Constraint:** ⚠️ **Active User Gesture Required** (User touch within &lt;10s)

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `onlyFromCamera` | `boolean` | No | `false` | Disallow choosing barcode image from album. |
| `scanType` | `("QR_CODE" \| "BARCODE" \| "DATA_MATRIX")[]` | No | - | Target symbology formats. |


#### Return Value
- **Schema Type:** `ScanCodeResult`
- **Description:** Decoded payload string and detected barcode symbology.

```json title="Return Payload Shape"
{
  "result": "string",
  "scanType": "string",
  "charSet": "string (optional)"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `PERMISSION_DENIED` | Camera permission denied. | Request scope.camera. |
| `GESTURE_REQUIRED` | Scanner invoked without recent user tap. | Invoke from tap event. |
| `USER_CANCEL` | User dismissed the camera scanner. | Handle scanner cancellation. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { result, scanType } = await goatBridge.callNative('SCAN_CODE', {
  scanType: ['QR_CODE', 'BARCODE']
});
console.log(`Scanned ${scanType}: ${result}`);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// MLKit Vision BarcodeScanner in CameraX preview
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// AVCaptureMetadataOutput scanning session
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('SCAN_CODE', {
  'scanType': ['QR_CODE'],
});
```

  </TabItem>
</Tabs>


---

### 2. `CHOOSE_MEDIA` {#choose-media}

Presents native media picker for selecting photos or recording videos from camera or photo library.

**Purpose & Context:** Allows uploading profile avatars, KYC identity documents, and video clips.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `CHOOSE_MEDIA`
- **Supported Aliases:** `chooseMedia`, `chooseImage`, `chooseVideo`
- **Permission Scope:** `scope.camera`
- **Required Manifest Permissions:** `android.permission.CAMERA`, `android.permission.READ_MEDIA_IMAGES`, `NSPhotoLibraryUsageDescription`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `count` | `number` | No | `9` | Maximum items to select (1 to 9). |
| `mediaType` | `("image" \| "video" \| "mix")[]` | No | `["image", "video"]` | Allowed media types. |
| `sourceType` | `("album" \| "camera")[]` | No | `["album", "camera"]` | Source options. |
| `maxDuration` | `number` | No | `60` | Max video length in seconds. |


#### Return Value
- **Schema Type:** `ChooseMediaResult`
- **Description:** Array of sandboxed media file descriptors (tempFilePath, size, duration, width, height).

```json title="Return Payload Shape"
{
  "tempFiles": "MediaFile[]",
  "type": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `PERMISSION_DENIED` | Camera or Photo Library permission denied. | Request scope.camera. |
| `USER_CANCEL` | User cancelled media picker. | Handle picker dismissal. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { tempFiles } = await goatBridge.callNative('CHOOSE_MEDIA', {
  count: 3,
  mediaType: ['image'],
  sourceType: ['album', 'camera']
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// ActivityResultContracts.PickMultipleVisualMedia
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// PHPickerViewController
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('CHOOSE_MEDIA', {'count': 3});
```

  </TabItem>
</Tabs>


---

### 3. `PREVIEW_IMAGE` {#preview-image}

Launches full-screen multi-image gallery viewer with pinch-to-zoom and swipe gestures.

**Purpose & Context:** Displays high-resolution product photos or gallery collections.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `PREVIEW_IMAGE`
- **Supported Aliases:** `previewImage`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `urls` | `string[]` | **Yes** | - | Array of image HTTP URLs. |
| `current` | `string \| number` | No | `0` | Starting image URL or 0-based index. |


#### Return Value
- **Schema Type:** `PreviewImageResult`
- **Description:** Confirmation that full-screen gallery was presented.

```json title="Return Payload Shape"
{
  "previewed": "boolean",
  "count": "number"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | urls array was empty. | Provide array of image URLs. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('PREVIEW_IMAGE', {
  urls: [
    'https://images.example.com/item1.jpg',
    'https://images.example.com/item2.jpg'
  ],
  current: 0
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Launch ImageViewerActivity with ViewPager2
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Present UIViewController with UIPageViewController
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('PREVIEW_IMAGE', {
  'urls': ['https://images.example.com/item1.jpg'],
});
```

  </TabItem>
</Tabs>


---

### 4. `AUDIO_PLAY` {#audio-play}

Initiates background audio playback with lock screen media metadata (title, artist, album art).

**Purpose & Context:** Enables podcast, music, and voice narration playback.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `AUDIO_PLAY`
- **Supported Aliases:** `audioPlay`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `src` | `string` | **Yes** | - | Audio stream URL or sandbox file path. |
| `title` | `string` | No | - | Track title. |
| `epname` | `string` | No | - | Album/Episode name. |
| `singer` | `string` | No | - | Artist name. |
| `coverImgUrl` | `string` | No | - | Album art URL. |
| `startTime` | `number` | No | `0` | Starting position in seconds. |


#### Return Value
- **Schema Type:** `AudioStateResult`
- **Description:** Audio playback status and duration metrics.

```json title="Return Payload Shape"
{
  "status": "\"playing\"",
  "src": "string",
  "currentTime": "number",
  "duration": "number"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Missing audio src. | Provide valid audio URL. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('AUDIO_PLAY', {
  src: 'https://audio.example.com/podcast-ep42.mp3',
  title: 'Goat WebView Deep Dive',
  singer: 'Engineering Team'
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// ExoPlayer / Media3 MediaSession setup
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// AVPlayer with MPNowPlayingInfoCenter setup
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('AUDIO_PLAY', {
  'src': 'https://audio.example.com/sample.mp3',
  'title': 'Sample Audio',
});
```

  </TabItem>
</Tabs>


---

### 5. `AUDIO_PAUSE` {#audio-pause}

Pauses active background audio playback.

**Purpose & Context:** Temporarily halts audio playback.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `AUDIO_PAUSE`
- **Supported Aliases:** `audioPause`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `AudioStateResult`
- **Description:** Current playback timestamp.

```json title="Return Payload Shape"
{
  "status": "\"paused\"",
  "currentTime": "number",
  "duration": "number"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('AUDIO_PAUSE', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
player.pause()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
player.pause()
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('AUDIO_PAUSE', {});
```

  </TabItem>
</Tabs>


---

### 6. `AUDIO_STOP` {#audio-stop}

Stops audio playback and releases audio focus.

**Purpose & Context:** Stops audio playback completely.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `AUDIO_STOP`
- **Supported Aliases:** `audioStop`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `AudioStateResult`
- **Description:** Confirmation that audio stopped.

```json title="Return Payload Shape"
{
  "status": "\"stopped\"",
  "currentTime": "0",
  "duration": "number"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('AUDIO_STOP', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
player.stop()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
player.replaceCurrentItem(with: nil)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('AUDIO_STOP', {});
```

  </TabItem>
</Tabs>


---

### 7. `AUDIO_SEEK` {#audio-seek}

Seeks playback position to the specified timestamp in seconds.

**Purpose & Context:** Enables scrubber bar positioning.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `AUDIO_SEEK`
- **Supported Aliases:** `audioSeek`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `position` | `number` | **Yes** | - | Target position in seconds. |


#### Return Value
- **Schema Type:** `AudioStateResult`
- **Description:** Updated playback position.

```json title="Return Payload Shape"
{
  "status": "\"seeked\"",
  "currentTime": "number",
  "duration": "number"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | position is missing or negative. | Pass positive seconds. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('AUDIO_SEEK', { position: 120 });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
player.seekTo((position * 1000).toLong())
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
player.seek(to: CMTime(seconds: position, preferredTimescale: 1000))
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('AUDIO_SEEK', {'position': 120});
```

  </TabItem>
</Tabs>

