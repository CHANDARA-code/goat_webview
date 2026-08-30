---
sidebar_position: 18
title: Domain 17 - Visual Rendering & Same-Layer
description: Complete API reference for Visual Rendering & Same-Layer (10 actions).
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Domain 17: Visual Rendering & Same-Layer 🖼️

WebView window transparency, anti-white-flash background color synchronization, nested scrolling coordinator, and same-layer native views.

**Total Actions in Domain:** `10 actions`

---

## Action Summary

| # | Action String | Permission | Inputs | Returns |
| :--- | :--- | :--- | :--- | :--- |
| 1 | [`CONFIGURE_TRANSPARENCY`](#configure-transparency) | `none` | `isTransparent`, `customBgHex` | `RenderLayerConfigResult` |
| 2 | [`SYNC_THEME_BACKGROUND`](#sync-theme-background) | `none` | `isDark` | `ThemeBgSyncResult` |
| 3 | [`GET_RENDER_LAYER_CONFIG`](#get-render-layer-config) | `none` | `{}` | `RenderLayerConfigResult` |
| 4 | [`GESTURE_SCROLL_UPDATE`](#gesture-scroll-update) | `none` | `scrollY`, `maxScrollY`, `direction` | `GestureScrollStateResult` |
| 5 | [`SHOULD_PARENT_INTERCEPT`](#should-parent-intercept) | `none` | `deltaY` | `ParentInterceptResult` |
| 6 | [`RESET_GESTURE_COORDINATOR`](#reset-gesture-coordinator) | `none` | `{}` | `ResetCoordinatorResult` |
| 7 | [`EMBED_NATIVE_VIEW`](#embed-native-view) | `none` | `componentId`, `componentType`, `x`, `y`, `width`, `height`, `zIndex` | `NativeComponentDescriptorResult` |
| 8 | [`UPDATE_NATIVE_VIEW_BOUNDS`](#update-native-view-bounds) | `none` | `componentId`, `x`, `y`, `width`, `height`, `isVisible` | `UpdateViewBoundsResult` |
| 9 | [`REMOVE_NATIVE_VIEW`](#remove-native-view) | `none` | `componentId` | `RemoveViewResult` |
| 10 | [`GET_ACTIVE_NATIVE_VIEWS`](#get-active-native-views) | `none` | `{}` | `ActiveViewsResult` |

---

## Action Specifications

---

### 1. `CONFIGURE_TRANSPARENCY` {#configure-transparency}

Enables alpha transparency on the native WebView surface view, allowing host UI elements or camera preview to show through.

**Purpose & Context:** Powers AR overlays, transparent blur overlays, and floating UI widgets.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `CONFIGURE_TRANSPARENCY`
- **Supported Aliases:** `configureTransparency`, `setWebviewTransparent`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `isTransparent` | `boolean` | **Yes** | - | True to make WebView background transparent. |
| `customBgHex` | `string` | No | - | Fallback background hex color when opacity is restored. |


#### Return Value
- **Schema Type:** `RenderLayerConfigResult`
- **Description:** Applied surface composition configuration.

```json title="Return Payload Shape"
{
  "isTransparent": "boolean",
  "backgroundColorHex": "string",
  "isHardwareAccelerated": "boolean",
  "isWhiteFlashPrevented": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('CONFIGURE_TRANSPARENCY', {
  isTransparent: true
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
webView.setBackgroundColor(Color.TRANSPARENT)
webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
webView.isOpaque = false
webView.backgroundColor = .clear
webView.scrollView.backgroundColor = .clear
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('CONFIGURE_TRANSPARENCY', {'isTransparent': true});
```

  </TabItem>
</Tabs>


---

### 2. `SYNC_THEME_BACKGROUND` {#sync-theme-background}

Synchronizes host native window background color with mini-app theme before DOM first paint, eliminating white-flash flickers.

**Purpose & Context:** Guarantees zero white flash when launching dark-mode mini-apps.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `SYNC_THEME_BACKGROUND`
- **Supported Aliases:** `syncThemeBg`, `setWindowBackground`, `preventWhiteFlash`, `syncThemeBackground`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `isDark` | `boolean` | **Yes** | - | True for dark mode (#0f172a), false for light mode (#ffffff). |


#### Return Value
- **Schema Type:** `ThemeBgSyncResult`
- **Description:** Applied background hex color.

```json title="Return Payload Shape"
{
  "isTransparent": "boolean",
  "backgroundColorHex": "string",
  "isWhiteFlashPrevented": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('SYNC_THEME_BACKGROUND', { isDark: true });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val color = if (isDark) Color.parseColor("#0f172a") else Color.WHITE
window.decorView.setBackgroundColor(color)
webView.setBackgroundColor(color)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let color = isDark ? UIColor(hex: "#0f172a") : .white
view.backgroundColor = color
webView.backgroundColor = color
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('SYNC_THEME_BACKGROUND', {'isDark': true});
```

  </TabItem>
</Tabs>


---

### 3. `GET_RENDER_LAYER_CONFIG` {#get-render-layer-config}

Queries active hardware layer acceleration, surface transparency, and background color settings.

**Purpose & Context:** Diagnostics for compositor layer performance.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `GET_RENDER_LAYER_CONFIG`
- **Supported Aliases:** `getRenderLayerConfig`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `RenderLayerConfigResult`
- **Description:** Composition layer descriptor.

```json title="Return Payload Shape"
{
  "isTransparent": "boolean",
  "backgroundColorHex": "string",
  "isHardwareAccelerated": "boolean",
  "isWhiteFlashPrevented": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const config = await goatBridge.callNative('GET_RENDER_LAYER_CONFIG', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Query window composition flags
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Query WKWebView layer properties
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('GET_RENDER_LAYER_CONFIG', {});
```

  </TabItem>
</Tabs>


---

### 4. `GESTURE_SCROLL_UPDATE` {#gesture-scroll-update}

Dispatches scroll coordinates into the nested scrolling coordinator, determining whether WebView or parent container intercepts drag.

**Purpose & Context:** Enables nested scrolling between bottom sheet containers and inner scrollable lists.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `GESTURE_SCROLL_UPDATE`
- **Supported Aliases:** `gestureScrollUpdate`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `scrollY` | `number` | **Yes** | - | Current vertical scroll offset in pixels. |
| `maxScrollY` | `number` | No | - | Maximum scrollable extent. |
| `direction` | `"VERTICAL" \| "HORIZONTAL"` | No | `"VERTICAL"` | Scroll axis. |


#### Return Value
- **Schema Type:** `GestureScrollStateResult`
- **Description:** Coordinator interception decision.

```json title="Return Payload Shape"
{
  "isScrollBoundaryReached": "boolean",
  "canParentIntercept": "boolean",
  "activeDirection": "string",
  "scrollOffsetPx": "number",
  "isFlingActive": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const state = await goatBridge.callNative('GESTURE_SCROLL_UPDATE', {
  scrollY: 0,
  direction: 'VERTICAL'
});
if (state.canParentIntercept) {
  // Allow bottom sheet drag
}
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// NestedScrollingChildHelper dispatchNestedScroll
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// UIScrollViewDelegate scrollViewDidScroll coordination
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('GESTURE_SCROLL_UPDATE', {'scrollY': 0});
```

  </TabItem>
</Tabs>


---

### 5. `SHOULD_PARENT_INTERCEPT` {#should-parent-intercept}

Queries whether the parent container should intercept upcoming drag gestures.

**Purpose & Context:** Prevents scroll locking in nested sheets.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `SHOULD_PARENT_INTERCEPT`
- **Supported Aliases:** `shouldParentIntercept`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `deltaY` | `number` | **Yes** | - | Swipe delta distance in pixels. |


#### Return Value
- **Schema Type:** `ParentInterceptResult`
- **Description:** Interception decision boolean.

```json title="Return Payload Shape"
{
  "shouldIntercept": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { shouldIntercept } = await goatBridge.callNative('SHOULD_PARENT_INTERCEPT', { deltaY: -15 });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// CoordinatorLayout onInterceptTouchEvent probe
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Gesture recognizer shouldRecognizeSimultaneouslyWith
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('SHOULD_PARENT_INTERCEPT', {'deltaY': -15});
```

  </TabItem>
</Tabs>


---

### 6. `RESET_GESTURE_COORDINATOR` {#reset-gesture-coordinator}

Resets scroll physics and boundary states in the nested scrolling coordinator.

**Purpose & Context:** Resets coordinator when route changes or DOM elements refresh.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `RESET_GESTURE_COORDINATOR`
- **Supported Aliases:** `resetGestureCoordinator`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `ResetCoordinatorResult`
- **Description:** Reset confirmation.

```json title="Return Payload Shape"
{
  "reset": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('RESET_GESTURE_COORDINATOR', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
coordinator.reset()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
coordinator.reset()
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('RESET_GESTURE_COORDINATOR', {});
```

  </TabItem>
</Tabs>


---

### 7. `EMBED_NATIVE_VIEW` {#embed-native-view}

Embeds a high-performance native component (MapView, Hardware Video Player, Camera Viewfinder) directly into the DOM flow via same-layer composition.

**Purpose & Context:** Overcomes WebView HTML5 performance limits by rendering 60/120 FPS native views synchronized with DOM scroll offsets.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `EMBED_NATIVE_VIEW`
- **Supported Aliases:** `embedNativeView`, `enableSameLayerRendering`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `componentId` | `string` | **Yes** | - | Unique identifier for the native component. |
| `componentType` | `string` | **Yes** | - | Component type (e.g. "map", "video", "camera", "canvas"). |
| `x` | `number` | No | `0` | Viewport X coordinate in pixels. |
| `y` | `number` | No | `0` | Viewport Y coordinate in pixels. |
| `width` | `number` | No | `300` | Width in pixels. |
| `height` | `number` | No | `200` | Height in pixels. |
| `zIndex` | `number` | No | `1` | Composition z-index. |


#### Return Value
- **Schema Type:** `NativeComponentDescriptorResult`
- **Description:** Rendered native view descriptor.

```json title="Return Payload Shape"
{
  "componentId": "string",
  "componentType": "string",
  "x": "number",
  "y": "number",
  "width": "number",
  "height": "number",
  "zIndex": "number",
  "isVisible": "boolean"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | componentId or componentType missing. | Specify valid componentId and type. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('EMBED_NATIVE_VIEW', {
  componentId: 'native_map_1',
  componentType: 'map',
  x: 0,
  y: 120,
  width: 375,
  height: 250
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// SameLayerManager attaches MapView below or as synchronized overlay
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// SameLayerManager inserts MKMapView or AVPlayerLayer
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('EMBED_NATIVE_VIEW', {
  'componentId': 'native_map_1',
  'componentType': 'map',
});
```

  </TabItem>
</Tabs>


---

### 8. `UPDATE_NATIVE_VIEW_BOUNDS` {#update-native-view-bounds}

Updates position, dimensions, visibility, and z-index of an embedded native view as user scrolls.

**Purpose & Context:** Synchronizes embedded native view layout with DOM bounding client rects.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `UPDATE_NATIVE_VIEW_BOUNDS`
- **Supported Aliases:** `updateNativeViewBounds`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `componentId` | `string` | **Yes** | - | Target component ID. |
| `x` | `number` | No | - | Updated X coordinate. |
| `y` | `number` | No | - | Updated Y coordinate. |
| `width` | `number` | No | - | Updated width. |
| `height` | `number` | No | - | Updated height. |
| `isVisible` | `boolean` | No | - | Visibility toggle. |


#### Return Value
- **Schema Type:** `UpdateViewBoundsResult`
- **Description:** Status of view bounds update.

```json title="Return Payload Shape"
{
  "componentId": "string",
  "updated": "boolean"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | componentId not found. | Ensure component was embedded first. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('UPDATE_NATIVE_VIEW_BOUNDS', {
  componentId: 'native_map_1',
  y: 80,
  height: 300
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
sameLayerManager.updateBounds(componentId, x, y, width, height)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
sameLayerManager.update(componentId: componentId, frame: rect)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('UPDATE_NATIVE_VIEW_BOUNDS', {
  'componentId': 'native_map_1',
  'y': 80,
});
```

  </TabItem>
</Tabs>


---

### 9. `REMOVE_NATIVE_VIEW` {#remove-native-view}

Destroys an embedded native component and frees its native graphics memory.

**Purpose & Context:** Cleans up embedded views when their DOM element unmounts.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `REMOVE_NATIVE_VIEW`
- **Supported Aliases:** `removeNativeView`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `componentId` | `string` | **Yes** | - | Component ID to destroy. |


#### Return Value
- **Schema Type:** `RemoveViewResult`
- **Description:** Confirmation that native view was disposed.

```json title="Return Payload Shape"
{
  "componentId": "string",
  "removed": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('REMOVE_NATIVE_VIEW', { componentId: 'native_map_1' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
sameLayerManager.removeView(componentId)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
sameLayerManager.remove(componentId: componentId)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('REMOVE_NATIVE_VIEW', {'componentId': 'native_map_1'});
```

  </TabItem>
</Tabs>


---

### 10. `GET_ACTIVE_NATIVE_VIEWS` {#get-active-native-views}

Lists all currently composited native view instances.

**Purpose & Context:** Inspects active embedded views for debugging.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `GET_ACTIVE_NATIVE_VIEWS`
- **Supported Aliases:** `getActiveNativeViews`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `ActiveViewsResult`
- **Description:** Array of active component descriptors.

```json title="Return Payload Shape"
{
  "totalActive": "number",
  "views": "NativeComponentDescriptorResult[]"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { views } = await goatBridge.callNative('GET_ACTIVE_NATIVE_VIEWS', {});
console.log('Active native components:', views);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Query active same-layer view list
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Query active same-layer views
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('GET_ACTIVE_NATIVE_VIEWS', {});
```

  </TabItem>
</Tabs>

