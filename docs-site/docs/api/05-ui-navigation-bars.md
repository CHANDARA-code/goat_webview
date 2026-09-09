---
sidebar_position: 6
title: Domain 5 - UI, Navigation Bar & Sheets
description: Complete API reference for UI, Navigation Bar & Sheets (28 actions).
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Domain 5: UI, Navigation Bar & Sheets

Native navigation bar styling, multi-snap draggable bottom sheets, safe-area window insets, toasts, modals, and multi-tab presentation.

**Total Actions in Domain:** `28 actions`

---

## Action Summary

| # | Action String | Permission | Inputs | Returns |
| :--- | :--- | :--- | :--- | :--- |
| 1 | [`SHOW_TOAST`](#show-toast) | `none` | `title`, `icon`, `duration`, `mask` | `ShowToastResult` |
| 2 | [`HIDE_TOAST`](#hide-toast) | `none` | `{}` | `HideToastResult` |
| 3 | [`SHOW_MODAL`](#show-modal) | `none` | `title`, `content`, `showCancel`, `cancelText`, `cancelColor`, `confirmText`, `confirmColor` | `ShowModalResult` |
| 4 | [`SHOW_ACTION_SHEET`](#show-action-sheet) | `none` | `itemList`, `itemColor` | `ShowActionSheetResult` |
| 5 | [`SHOW_LOADING`](#show-loading) | `none` | `title`, `mask` | `ShowLoadingResult` |
| 6 | [`HIDE_LOADING`](#hide-loading) | `none` | `{}` | `HideLoadingResult` |
| 7 | [`GET_KEYBOARD_INSETS`](#get-keyboard-insets) | `none` | `{}` | `KeyboardInsetsResult` |
| 8 | [`SET_KEYBOARD_INSETS`](#set-keyboard-insets) | `none` | `heightPx`, `durationMs` | `KeyboardInsetsResult` |
| 9 | [`SET_NAV_BAR_TITLE`](#set-nav-bar-title) | `none` | `title`, `subtitle` | `NavBarTitleResult` |
| 10 | [`SET_NAV_BAR_COLOR`](#set-nav-bar-color) | `none` | `backgroundColor`, `textColor`, `isDark` | `NavBarColorResult` |
| 11 | [`SET_NAV_BAR_BUTTONS`](#set-nav-bar-buttons) | `none` | `left`, `right` | `NavBarButtonsResult` |
| 12 | [`SET_NAV_BAR_PROGRESS`](#set-nav-bar-progress) | `none` | `visible`, `progress` | `NavBarProgressResult` |
| 13 | [`EXPAND_BOTTOM_SHEET`](#expand-bottom-sheet) | `none` | `{}` | `BottomSheetResult` |
| 14 | [`COLLAPSE_BOTTOM_SHEET`](#collapse-bottom-sheet) | `none` | `{}` | `BottomSheetResult` |
| 15 | [`SET_SHEET_SNAP_POINTS`](#set-sheet-snap-points) | `none` | `snapPoints`, `initialSnap`, `isDismissible`, `showDragHandle` | `BottomSheetSnapPointsResult` |
| 16 | [`GET_SAFE_AREA_INSETS`](#get-safe-area-insets) | `none` | `{}` | `SafeAreaInsetsResult` |
| 17 | [`OPEN_EXTERNAL_LINK`](#open-external-link) | `none` | `url`, `skipWarningIfOptedOut`, `appId` | `OpenExternalLinkResult` |
| 18 | [`OPEN_URL`](#open-url) | `none` | `url` | `OpenUrlResult` |
| 19 | [`OPEN_LINK`](#open-link) | `none` | `url` | `OpenLinkResult` |
| 20 | [`TAB_OPEN`](#tab-open) | `none` | `appId`, `initialRoute`, `title` | `TabHandle` |
| 21 | [`TAB_CLOSE`](#tab-close) | `none` | `tabId` | `TabCloseResult` |
| 22 | [`TAB_SWITCH`](#tab-switch) | `none` | `tabId` | `TabSwitchResult` |
| 23 | [`TAB_GET_ACTIVE`](#tab-get-active) | `none` | `{}` | `TabHandle | null` |
| 24 | [`TAB_LIST`](#tab-list) | `none` | `{}` | `TabListResult` |
| 25 | [`TAB_CLOSE_ALL`](#tab-close-all) | `none` | `{}` | `TabCloseAllResult` |
| 26 | [`OPEN_MINI_APP`](#open-mini-app) | `none` | `targetAppId`, `presentation`, `params` | `OpenMiniAppResult` |
| 27 | [`CLOSE_MINI_APP`](#close-mini-app) | `none` | `instanceId`, `result` | `CloseMiniAppResult` |
| 28 | [`ON_MINI_APP_CLOSED`](#on-mini-app-closed) | `none` | `{}` | `OnMiniAppClosedResult` |

---

## Action Specifications

---

### 1. `SHOW_TOAST` {#show-toast}

Displays a non-intrusive native toast message with optional icon and duration.

**Purpose & Context:** Notifies users of transient actions like "Saved", "Copied", or "Error".

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `SHOW_TOAST`
- **Supported Aliases:** `showToast`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `title` | `string` | **Yes** | - | Message text. |
| `icon` | `"success" \| "error" \| "loading" \| "none"` | No | `"none"` | Icon type. |
| `duration` | `number` | No | `1500` | Display time in milliseconds. |
| `mask` | `boolean` | No | `false` | Prevent touch events while toast is visible. |


#### Return Value
- **Schema Type:** `ShowToastResult`
- **Description:** Status of toast display.

```json title="Return Payload Shape"
{
  "shown": "boolean",
  "title": "string",
  "duration": "number",
  "icon": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Title missing. | Pass a non-empty title string. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('SHOW_TOAST', {
  title: 'Profile Updated',
  icon: 'success',
  duration: 2000
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
Toast.makeText(context, title, Toast.LENGTH_SHORT).show()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Render custom overlay toast or banner
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('SHOW_TOAST', {
  'title': 'Profile Updated',
  'icon': 'success',
});
```

  </TabItem>
</Tabs>


---

### 2. `HIDE_TOAST` {#hide-toast}

Dismisses an active toast notification immediately.

**Purpose & Context:** Cleans up loading or long-lived toast messages programmatically.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `HIDE_TOAST`
- **Supported Aliases:** `hideToast`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `HideToastResult`
- **Description:** Confirmation that toast was hidden.

```json title="Return Payload Shape"
{
  "hidden": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('HIDE_TOAST', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
activeToast?.cancel()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
toastView?.removeFromSuperview()
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('HIDE_TOAST', {});
```

  </TabItem>
</Tabs>


---

### 3. `SHOW_MODAL` {#show-modal}

Presents a native modal alert dialog with Confirm/Cancel action buttons and 500ms anti-spam cooldown protection.

**Purpose & Context:** Obtains explicit user confirmation for destructive or irreversible actions.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `SHOW_MODAL`
- **Supported Aliases:** `showModal`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `title` | `string` | **Yes** | - | Modal dialog title. |
| `content` | `string` | **Yes** | - | Modal message body. |
| `showCancel` | `boolean` | No | `true` | Show cancel button. |
| `cancelText` | `string` | No | `"Cancel"` | Cancel button label. |
| `cancelColor` | `string` | No | - | Cancel button text color hex. |
| `confirmText` | `string` | No | `"OK"` | Confirm button label. |
| `confirmColor` | `string` | No | - | Confirm button text color hex. |


#### Return Value
- **Schema Type:** `ShowModalResult`
- **Description:** Indicates which button the user tapped.

```json title="Return Payload Shape"
{
  "confirm": "boolean",
  "cancel": "boolean",
  "title": "string",
  "content": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `DIALOG_COOLDOWN_ACTIVE` | Dialog requested too quickly (&lt;500ms) after previous dialog. | Throttle modal requests to prevent dialog spam. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { confirm } = await goatBridge.callNative('SHOW_MODAL', {
  title: 'Delete Account',
  content: 'Are you sure you want to permanently delete this account?',
  confirmText: 'Delete',
  confirmColor: '#ef4444'
});
if (confirm) {
  // Proceed with deletion
}
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
AlertDialog.Builder(context)
    .setTitle(title)
    .setMessage(content)
    .setPositiveButton(confirmText) { _, _ -> reply(true) }
    .setNegativeButton(cancelText) { _, _ -> reply(false) }
    .show()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let alert = UIAlertController(title: title, message: content, preferredStyle: .alert)
alert.addAction(UIAlertAction(title: confirmText, style: .destructive) { _ in reply(true) })
alert.addAction(UIAlertAction(title: cancelText, style: .cancel) { _ in reply(false) })
present(alert, animated: true)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('SHOW_MODAL', {
  'title': 'Delete Item',
  'content': 'Confirm delete?',
});
```

  </TabItem>
</Tabs>


---

### 4. `SHOW_ACTION_SHEET` {#show-action-sheet}

Presents a bottom native action sheet list of selectable items.

**Purpose & Context:** Offers multiple options such as "Camera", "Photo Library", or sorting criteria.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `SHOW_ACTION_SHEET`
- **Supported Aliases:** `showActionSheet`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `itemList` | `string[]` | **Yes** | - | Array of option labels. |
| `itemColor` | `string` | No | - | Text color hex for items. |


#### Return Value
- **Schema Type:** `ShowActionSheetResult`
- **Description:** Zero-based index of the chosen option.

```json title="Return Payload Shape"
{
  "tapIndex": "number",
  "itemCount": "number"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | itemList was empty or missing. | Provide an array of at least 1 string. |
| `DIALOG_COOLDOWN_ACTIVE` | Anti-spam cooldown active. | Wait 500ms before opening another sheet. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { tapIndex } = await goatBridge.callNative('SHOW_ACTION_SHEET', {
  itemList: ['Take Photo', 'Choose from Gallery', 'View Document']
});
console.log('User picked item at index:', tapIndex);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// BottomSheetDialog or ListDialog
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let sheet = UIAlertController(title: nil, message: nil, preferredStyle: .actionSheet)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('SHOW_ACTION_SHEET', {
  'itemList': ['Option A', 'Option B', 'Option C'],
});
```

  </TabItem>
</Tabs>


---

### 5. `SHOW_LOADING` {#show-loading}

Displays a modal loading spinner HUD with optional message and touch blocking mask.

**Purpose & Context:** Blocks interaction while waiting for async background operations.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `SHOW_LOADING`
- **Supported Aliases:** `showLoading`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `title` | `string` | No | `"Loading..."` | Loading message text. |
| `mask` | `boolean` | No | `true` | Block touch input. |


#### Return Value
- **Schema Type:** `ShowLoadingResult`
- **Description:** Status of loading HUD.

```json title="Return Payload Shape"
{
  "shown": "boolean",
  "title": "string"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('SHOW_LOADING', { title: 'Processing payment...' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
progressDialog = ProgressDialog.show(context, "", title, true)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Present UIActivityIndicatorView HUD
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('SHOW_LOADING', {'title': 'Processing...'});
```

  </TabItem>
</Tabs>


---

### 6. `HIDE_LOADING` {#hide-loading}

Dismisses the active loading HUD spinner.

**Purpose & Context:** Resumes user interaction once async task finishes.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `HIDE_LOADING`
- **Supported Aliases:** `hideLoading`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `HideLoadingResult`
- **Description:** Confirmation that loading HUD was removed.

```json title="Return Payload Shape"
{
  "hidden": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('HIDE_LOADING', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
progressDialog?.dismiss()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
hudView?.removeFromSuperview()
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('HIDE_LOADING', {});
```

  </TabItem>
</Tabs>


---

### 7. `GET_KEYBOARD_INSETS` {#get-keyboard-insets}

Queries current soft keyboard visibility, pixel height, animation duration, and bottom viewport insets.

**Purpose & Context:** Enables smooth layout lifting so inputs are never covered by the on-screen keyboard.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `GET_KEYBOARD_INSETS`
- **Supported Aliases:** `getKeyboardInsets`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `KeyboardInsetsResult`
- **Description:** Keyboard layout dimensions and visibility state.

```json title="Return Payload Shape"
{
  "isVisible": "boolean",
  "heightPx": "number",
  "durationMs": "number (optional)",
  "adjustedViewportBottomInset": "number"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { isVisible, heightPx } = await goatBridge.callNative('GET_KEYBOARD_INSETS', {});
console.log('Keyboard height:', heightPx);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val insets = ViewCompat.getRootWindowInsets(window.decorView)
val imeHeight = insets?.getInsets(WindowInsetsCompat.Type.ime())?.bottom ?: 0
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Keyboard notification observer bounds
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('GET_KEYBOARD_INSETS', {});
```

  </TabItem>
</Tabs>


---

### 8. `SET_KEYBOARD_INSETS` {#set-keyboard-insets}

Manually adjusts keyboard layout insets for the container window.

**Purpose & Context:** Overrides keyboard insets in custom embedded view setups.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `SET_KEYBOARD_INSETS`
- **Supported Aliases:** `setKeyboardInsets`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `heightPx` | `number` | **Yes** | - | Target keyboard inset height in pixels. |
| `durationMs` | `number` | No | - | Animation transition duration. |


#### Return Value
- **Schema Type:** `KeyboardInsetsResult`
- **Description:** Updated keyboard insets state.

```json title="Return Payload Shape"
{
  "isVisible": "boolean",
  "heightPx": "number",
  "durationMs": "number (optional)",
  "adjustedViewportBottomInset": "number"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | heightPx missing. | Specify heightPx as a number. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('SET_KEYBOARD_INSETS', { heightPx: 300, durationMs: 250 });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Update custom view bottom padding
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Update constraint constant with animation
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('SET_KEYBOARD_INSETS', {'heightPx': 300});
```

  </TabItem>
</Tabs>


---

### 9. `SET_NAV_BAR_TITLE` {#set-nav-bar-title}

Updates the title and optional subtitle rendered on the host native navigation header bar.

**Purpose & Context:** Dynamically updates header title as user navigates sub-views.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `SET_NAV_BAR_TITLE`
- **Supported Aliases:** `setNavBarTitle`, `setNavigationBarTitle`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `title` | `string` | **Yes** | - | Main title string. |
| `subtitle` | `string` | No | - | Subtitle string. |


#### Return Value
- **Schema Type:** `NavBarTitleResult`
- **Description:** Confirmation of title change.

```json title="Return Payload Shape"
{
  "title": "string",
  "subtitle": "string (optional)",
  "success": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('SET_NAV_BAR_TITLE', {
  title: 'Order Details',
  subtitle: '#98432'
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
supportActionBar?.title = title
supportActionBar?.subtitle = subtitle
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
navigationItem.title = title
navigationController?.navigationBar.prefersLargeTitles = false
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('SET_NAV_BAR_TITLE', {
  'title': 'Order Details',
});
```

  </TabItem>
</Tabs>


---

### 10. `SET_NAV_BAR_COLOR` {#set-nav-bar-color}

Configures background color, text tint, and theme mode of the native navigation bar.

**Purpose & Context:** Matches navigation bar aesthetics with brand theme colors.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `SET_NAV_BAR_COLOR`
- **Supported Aliases:** `setNavBarColor`, `setNavigationBarColor`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `backgroundColor` | `string` | **Yes** | - | Hex color string (e.g., "#1e293b"). |
| `textColor` | `string` | No | `"#ffffff"` | Title text hex color. |
| `isDark` | `boolean` | No | `false` | Dark theme mode indicator. |


#### Return Value
- **Schema Type:** `NavBarColorResult`
- **Description:** Applied color palette.

```json title="Return Payload Shape"
{
  "backgroundColor": "string",
  "textColor": "string",
  "isDark": "boolean",
  "success": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('SET_NAV_BAR_COLOR', {
  backgroundColor: '#0f172a',
  textColor: '#ffffff',
  isDark: true
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
supportActionBar?.setBackgroundDrawable(ColorDrawable(Color.parseColor(backgroundColor)))
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let appearance = UINavigationBarAppearance()
appearance.backgroundColor = UIColor(hex: backgroundColor)
navigationController?.navigationBar.standardAppearance = appearance
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('SET_NAV_BAR_COLOR', {
  'backgroundColor': '#0f172a',
  'textColor': '#ffffff',
});
```

  </TabItem>
</Tabs>


---

### 11. `SET_NAV_BAR_BUTTONS` {#set-nav-bar-buttons}

Configures left and right action buttons on the native navigation header bar.

**Purpose & Context:** Adds Share, More, or Close buttons directly in host header chrome.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `SET_NAV_BAR_BUTTONS`
- **Supported Aliases:** `setNavBarButtons`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `left` | `string` | No | - | Left button type ("BACK", "CLOSE", "CUSTOM"). |
| `right` | `string[]` | No | - | Array of right button types (e.g., ["SHARE", "MORE"]). |


#### Return Value
- **Schema Type:** `NavBarButtonsResult`
- **Description:** Active header button configuration.

```json title="Return Payload Shape"
{
  "left": "string (optional)",
  "right": "string[]",
  "success": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('SET_NAV_BAR_BUTTONS', {
  left: 'CLOSE',
  right: ['SHARE', 'MORE']
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Update menu items in onCreateOptionsMenu
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
navigationItem.rightBarButtonItems = [...]
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('SET_NAV_BAR_BUTTONS', {
  'right': ['SHARE', 'MORE'],
});
```

  </TabItem>
</Tabs>


---

### 12. `SET_NAV_BAR_PROGRESS` {#set-nav-bar-progress}

Displays or updates a fine progress indicator bar along the bottom of the navigation bar.

**Purpose & Context:** Indicates multi-step form completion or page download progress.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `SET_NAV_BAR_PROGRESS`
- **Supported Aliases:** `setNavBarProgress`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `visible` | `boolean` | **Yes** | - | Toggle progress bar visibility. |
| `progress` | `number` | No | `0` | Progress percentage (0.0 to 1.0). |


#### Return Value
- **Schema Type:** `NavBarProgressResult`
- **Description:** Updated progress bar state.

```json title="Return Payload Shape"
{
  "visible": "boolean",
  "progress": "number",
  "success": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('SET_NAV_BAR_PROGRESS', { visible: true, progress: 0.65 });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
progressBar.visibility = if (visible) View.VISIBLE else View.GONE
progressBar.progress = (progress * 100).toInt()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
progressView.isHidden = !visible
progressView.setProgress(Float(progress), animated: true)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('SET_NAV_BAR_PROGRESS', {'visible': true, 'progress': 0.65});
```

  </TabItem>
</Tabs>


---

### 13. `EXPAND_BOTTOM_SHEET` {#expand-bottom-sheet}

Expands the native bottom sheet container to its maximum snap height.

**Purpose & Context:** Reveals full details, filter panels, or checkout summary in bottom sheet.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `EXPAND_BOTTOM_SHEET`
- **Supported Aliases:** `expandBottomSheet`, `showBottomSheet`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `BottomSheetResult`
- **Description:** Current snap index and sheet state.

```json title="Return Payload Shape"
{
  "currentSnap": "number",
  "sheetValue": "string",
  "isExpanded": "boolean",
  "isCollapsed": "boolean",
  "isDismissed": "boolean",
  "success": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('EXPAND_BOTTOM_SHEET', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
bottomSheetBehavior.state = BottomSheetBehavior.STATE_EXPANDED
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
sheetPresentationController?.animateChanges { sheetPresentationController?.selectedDetentIdentifier = .large }
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('EXPAND_BOTTOM_SHEET', {});
```

  </TabItem>
</Tabs>


---

### 14. `COLLAPSE_BOTTOM_SHEET` {#collapse-bottom-sheet}

Collapses the native bottom sheet to its initial or hidden snap point.

**Purpose & Context:** Minimizes sheet to give focus back to the main map or background content.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `COLLAPSE_BOTTOM_SHEET`
- **Supported Aliases:** `collapseBottomSheet`, `hideBottomSheet`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `BottomSheetResult`
- **Description:** Updated sheet state.

```json title="Return Payload Shape"
{
  "currentSnap": "number",
  "sheetValue": "string",
  "isExpanded": "boolean",
  "isCollapsed": "boolean",
  "isDismissed": "boolean",
  "success": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('COLLAPSE_BOTTOM_SHEET', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
bottomSheetBehavior.state = BottomSheetBehavior.STATE_COLLAPSED
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
sheetPresentationController?.animateChanges { sheetPresentationController?.selectedDetentIdentifier = .medium }
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('COLLAPSE_BOTTOM_SHEET', {});
```

  </TabItem>
</Tabs>


---

### 15. `SET_SHEET_SNAP_POINTS` {#set-sheet-snap-points}

Configures normalized vertical snap heights (e.g., [0.25, 0.5, 0.9]) for interactive draggable bottom sheets.

**Purpose & Context:** Enables custom multi-stage sheet transitions matching app UX.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `SET_SHEET_SNAP_POINTS`
- **Supported Aliases:** `setSheetSnapPoints`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `snapPoints` | `number[]` | **Yes** | - | Array of snap ratios (0.0 to 1.0). |
| `initialSnap` | `number` | No | `0` | Initial active snap index. |
| `isDismissible` | `boolean` | No | `true` | Allow dragging down to close. |
| `showDragHandle` | `boolean` | No | `true` | Render top drag indicator pill. |


#### Return Value
- **Schema Type:** `BottomSheetSnapPointsResult`
- **Description:** Applied snap points configuration.

```json title="Return Payload Shape"
{
  "snapPoints": "number[]",
  "initialSnap": "number",
  "isDismissible": "boolean",
  "success": "boolean"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | snapPoints was empty or contained invalid numbers. | Provide array of ratios between 0.0 and 1.0. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('SET_SHEET_SNAP_POINTS', {
  snapPoints: [0.25, 0.6, 0.95],
  initialSnap: 1,
  isDismissible: true
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Configure CustomBottomSheetBehavior snap points
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
sheetPresentationController?.detents = [.medium(), .large()]
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('SET_SHEET_SNAP_POINTS', {
  'snapPoints': [0.25, 0.6, 0.95],
});
```

  </TabItem>
</Tabs>


---

### 16. `GET_SAFE_AREA_INSETS` {#get-safe-area-insets}

Retrieves physical safe area insets (Dynamic Island, notch, home indicator bar, keyboard) in device pixels.

**Purpose & Context:** Prevents overlapping critical buttons with device notches or gesture navigation bars.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `GET_SAFE_AREA_INSETS`
- **Supported Aliases:** `getSafeAreaInsets`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `SafeAreaInsetsResult`
- **Description:** Physical screen cutout and border insets in pixels.

```json title="Return Payload Shape"
{
  "top": "number",
  "bottom": "number",
  "left": "number",
  "right": "number",
  "keyboardHeight": "number",
  "totalBottom": "number"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const insets = await goatBridge.callNative('GET_SAFE_AREA_INSETS', {});
console.log('Top notch:', insets.top, 'Home bar:', insets.bottom);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val windowInsets = ViewCompat.getRootWindowInsets(window.decorView)
val cutouts = windowInsets?.getInsets(WindowInsetsCompat.Type.displayCutout())
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let insets = view.safeAreaInsets
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('GET_SAFE_AREA_INSETS', {});
```

  </TabItem>
</Tabs>


---

### 17. `OPEN_EXTERNAL_LINK` {#open-external-link}

Presents an interstitial security warning before launching an external third-party URL in system browser.

**Purpose & Context:** Protects users against phishing by confirming intent when leaving the secure mini-app perimeter.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `OPEN_EXTERNAL_LINK`
- **Supported Aliases:** `openExternalLink`, `showExternalLinkWarning`, `openUrl`, `openLink`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `url` | `string` | **Yes** | - | Target destination URL. |
| `skipWarningIfOptedOut` | `boolean` | No | `false` | Skip modal if user previously checked "Don't ask again". |
| `appId` | `string` | No | - | Calling appId. |


#### Return Value
- **Schema Type:** `OpenExternalLinkResult`
- **Description:** Status of browser launch.

```json title="Return Payload Shape"
{
  "opened": "boolean",
  "destinationHost": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Missing or malformed URL. | Provide a valid HTTP or HTTPS URL. |
| `USER_CANCEL` | User tapped Cancel on the interstitial security dialog. | Do not open external browser. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const res = await goatBridge.callNative('OPEN_EXTERNAL_LINK', {
  url: 'https://developer.apple.com'
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Show ExternalLinkWarningDialogFragment before starting Intent.ACTION_VIEW
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Show confirmation alert then UIApplication.shared.open(url)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('OPEN_EXTERNAL_LINK', {
  'url': 'https://developer.apple.com',
});
```

  </TabItem>
</Tabs>


---

### 18. `OPEN_URL` {#open-url}

Opens a URL or custom app scheme (e.g., mailto:, tel:) in the system handler.

**Purpose & Context:** Dispatches intents to external installed applications.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `OPEN_URL`
- **Supported Aliases:** `openUrl`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `url` | `string` | **Yes** | - | Target URL or URI scheme. |


#### Return Value
- **Schema Type:** `OpenUrlResult`
- **Description:** Result of system URL launch.

```json title="Return Payload Shape"
{
  "opened": "boolean",
  "destinationHost": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Malformed URL. | Verify URL format. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('OPEN_URL', { url: 'mailto:support@example.com' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
UIApplication.shared.open(URL(string: url)!)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('OPEN_URL', {'url': 'mailto:support@example.com'});
```

  </TabItem>
</Tabs>


---

### 19. `OPEN_LINK` {#open-link}

Alias for OPEN_EXTERNAL_LINK.

**Purpose & Context:** Compatibility alias for opening external web links.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `OPEN_LINK`
- **Supported Aliases:** `openLink`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `url` | `string` | **Yes** | - | Target destination URL. |


#### Return Value
- **Schema Type:** `OpenLinkResult`
- **Description:** Status of browser launch.

```json title="Return Payload Shape"
{
  "opened": "boolean",
  "destinationHost": "string"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('OPEN_LINK', { url: 'https://example.com' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Launch browser
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Open URL
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('OPEN_LINK', {'url': 'https://example.com'});
```

  </TabItem>
</Tabs>


---

### 20. `TAB_OPEN` {#tab-open}

Spawns a new concurrent mini-app tab or page container in multi-tab presentation.

**Purpose & Context:** Enables tabbed browsing inside SuperApp container.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `TAB_OPEN`
- **Supported Aliases:** `tabOpen`, `showMultiTabSheet`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `appId` | `string` | No | - | Target appId. |
| `initialRoute` | `string` | No | `"/"` | Initial route URL. |
| `title` | `string` | No | - | Tab title. |


#### Return Value
- **Schema Type:** `TabHandle`
- **Description:** Created tab handle metadata.

```json title="Return Payload Shape"
{
  "tabId": "string",
  "appId": "string",
  "initialRoute": "string",
  "title": "string",
  "isBackgrounded": "boolean",
  "memoryTrimmed": "boolean",
  "createdAt": "number (optional)"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const tab = await goatBridge.callNative('TAB_OPEN', {
  initialRoute: '/catalog',
  title: 'Catalog'
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Create new WebViewTab instance in TabManager
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Append new WKWebView tab
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('TAB_OPEN', {'initialRoute': '/catalog'});
```

  </TabItem>
</Tabs>


---

### 21. `TAB_CLOSE` {#tab-close}

Closes a specific backgrounded or active tab and frees its allocated WebView memory.

**Purpose & Context:** Frees resources when closing unused mini-app tabs.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `TAB_CLOSE`
- **Supported Aliases:** `tabClose`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `tabId` | `string` | **Yes** | - | Tab identifier to close. |


#### Return Value
- **Schema Type:** `TabCloseResult`
- **Description:** Confirmation that tab was destroyed.

```json title="Return Payload Shape"
{
  "closed": "boolean",
  "tabId": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | tabId missing or not found. | Pass a valid tabId. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('TAB_CLOSE', { tabId: 'tab_101' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
tabManager.closeTab(tabId)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
tabManager.close(tabId: tabId)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('TAB_CLOSE', {'tabId': 'tab_101'});
```

  </TabItem>
</Tabs>


---

### 22. `TAB_SWITCH` {#tab-switch}

Brings a backgrounded mini-app tab into the active foreground viewport.

**Purpose & Context:** Fast tab switching with zero cold-boot overhead.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `TAB_SWITCH`
- **Supported Aliases:** `tabSwitch`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `tabId` | `string` | **Yes** | - | Tab identifier to switch to. |


#### Return Value
- **Schema Type:** `TabSwitchResult`
- **Description:** Status of tab switch.

```json title="Return Payload Shape"
{
  "switched": "boolean",
  "tabId": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | tabId not found. | Ensure tab exists in tabList. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('TAB_SWITCH', { tabId: 'tab_101' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
tabManager.switchToTab(tabId)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
tabManager.activate(tabId: tabId)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('TAB_SWITCH', {'tabId': 'tab_101'});
```

  </TabItem>
</Tabs>


---

### 23. `TAB_GET_ACTIVE` {#tab-get-active}

Retrieves handle metadata for the currently focused foreground tab.

**Purpose & Context:** Queries current tab state and route information.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `TAB_GET_ACTIVE`
- **Supported Aliases:** `tabGetActive`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `TabHandle | null`
- **Description:** Active tab record or null if single-view.

```json title="Return Payload Shape"
{
  "tabId": "string",
  "appId": "string",
  "initialRoute": "string",
  "title": "string",
  "isBackgrounded": "boolean",
  "memoryTrimmed": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const activeTab = await goatBridge.callNative('TAB_GET_ACTIVE', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val active = tabManager.getActiveTab()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let active = tabManager.currentTab
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('TAB_GET_ACTIVE', {});
```

  </TabItem>
</Tabs>


---

### 24. `TAB_LIST` {#tab-list}

Lists all active and backgrounded tabs managed by the host container.

**Purpose & Context:** Powers visual multi-tab grid switcher.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `TAB_LIST`
- **Supported Aliases:** `tabList`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `TabListResult`
- **Description:** Array of all open tab descriptors.

```json title="Return Payload Shape"
{
  "tabs": "TabHandle[]"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { tabs } = await goatBridge.callNative('TAB_LIST', {});
console.log('Open tabs:', tabs.length);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val list = tabManager.getAllTabs()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let list = tabManager.tabs
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('TAB_LIST', {});
```

  </TabItem>
</Tabs>


---

### 25. `TAB_CLOSE_ALL` {#tab-close-all}

Destroys all backgrounded tabs and resets tab container state.

**Purpose & Context:** Frees memory when exiting multi-tab mode.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `TAB_CLOSE_ALL`
- **Supported Aliases:** `tabCloseAll`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `TabCloseAllResult`
- **Description:** Confirmation that all secondary tabs were destroyed.

```json title="Return Payload Shape"
{
  "closedAll": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('TAB_CLOSE_ALL', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
tabManager.closeAll()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
tabManager.removeAll()
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('TAB_CLOSE_ALL', {});
```

  </TabItem>
</Tabs>


---

### 26. `OPEN_MINI_APP` {#open-mini-app}

Launches a secondary mini-app in windowed, modal, or fullscreen presentation mode.

**Purpose & Context:** Enables cross-app workflows (e.g., e-commerce app launching payment or delivery tracker mini-app).

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `OPEN_MINI_APP`
- **Supported Aliases:** `openMiniApp`, `openCrossAppWindow`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `targetAppId` | `string` | **Yes** | - | Target mini-app identifier. |
| `presentation` | `"WINDOWED" \| "MODAL" \| "FULLSCREEN"` | No | `"FULLSCREEN"` | Window layout mode. |
| `params` | `Record&lt;string, any>` | No | - | Initialization payload passed to child app. |


#### Return Value
- **Schema Type:** `OpenMiniAppResult`
- **Description:** Instance handle of the launched mini-app.

```json title="Return Payload Shape"
{
  "instanceId": "string",
  "targetAppId": "string",
  "presentation": "string",
  "status": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | targetAppId was missing. | Provide a registered targetAppId. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const app = await goatBridge.callNative('OPEN_MINI_APP', {
  targetAppId: 'mini_taxi_service',
  presentation: 'MODAL',
  params: { origin: 'Current Location', dest: 'Airport' }
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val intent = Intent(context, MiniAppActivity::class.java).apply {
    putExtra("APP_ID", targetAppId)
}
context.startActivity(intent)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let vc = MiniAppViewController(appId: targetAppId)
present(vc, animated: true)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('OPEN_MINI_APP', {
  'targetAppId': 'mini_taxi_service',
});
```

  </TabItem>
</Tabs>


---

### 27. `CLOSE_MINI_APP` {#close-mini-app}

Terminates an active child mini-app instance and returns optional result payload to parent.

**Purpose & Context:** Returns execution control and outcome data to caller app.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `CLOSE_MINI_APP`
- **Supported Aliases:** `closeMiniApp`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `instanceId` | `string` | No | - | Target instance to close (or active if omitted). |
| `result` | `Record&lt;string, any>` | No | - | Result data passed back to opener. |


#### Return Value
- **Schema Type:** `CloseMiniAppResult`
- **Description:** Confirmation that child app was dismissed.

```json title="Return Payload Shape"
{
  "closed": "boolean",
  "instanceId": "string"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('CLOSE_MINI_APP', {
  result: { selectedAddressId: 'addr_987' }
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
setResult(Activity.RESULT_OK, resultIntent)
finish()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
dismiss(animated: true) { onDismiss?(result) }
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('CLOSE_MINI_APP', {});
```

  </TabItem>
</Tabs>


---

### 28. `ON_MINI_APP_CLOSED` {#on-mini-app-closed}

Registers a lifecycle callback listener triggered when a launched child mini-app is dismissed.

**Purpose & Context:** Receives return values from cross-app child tasks.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `ON_MINI_APP_CLOSED`
- **Supported Aliases:** `onMiniAppClosed`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `OnMiniAppClosedResult`
- **Description:** Confirmation of event listener attachment.

```json title="Return Payload Shape"
{
  "registered": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
goatBridge.on('MINI_APP_CLOSED', (event) => {
  console.log('Child app closed with data:', event.result);
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Broadcast onMiniAppClosed event to parent WebView
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Post notification to WKWebView
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
goatController.onEvent('MINI_APP_CLOSED', (event) { ... });
```

  </TabItem>
</Tabs>

