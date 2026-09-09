---
sidebar_position: 2
title: Domain 1 - Core & System Lifecycle
description: Complete API reference for Core & System Lifecycle (12 actions).
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Domain 1: Core & System Lifecycle

Hardware metrics, vibration haptics, status bar appearance, brightness, screen wake locks, clipboard exchange, back navigation, and secure OAuth sessions.

**Total Actions in Domain:** `12 actions`

---

## Action Summary

| # | Action String | Permission | Inputs | Returns |
| :--- | :--- | :--- | :--- | :--- |
| 1 | [`GET_DEVICE_INFO`](#get-device-info) | `none` | `{}` | `DeviceInfo` |
| 2 | [`HAPTIC_FEEDBACK`](#haptic-feedback) | `none` | `type`, `style`, `notificationType` | `HapticResult` |
| 3 | [`SET_STATUS_BAR_THEME`](#set-status-bar-theme) | `none` | `isDark` | `StatusBarResult` |
| 4 | [`SET_SCREEN_BRIGHTNESS`](#set-screen-brightness) | `none` | `value` | `BrightnessResult` |
| 5 | [`GET_SCREEN_BRIGHTNESS`](#get-screen-brightness) | `none` | `{}` | `BrightnessResult` |
| 6 | [`SET_KEEP_SCREEN_ON`](#set-keep-screen-on) | `none` | `keepScreenOn` | `KeepScreenOnResult` |
| 7 | [`CLIPBOARD_SET`](#clipboard-set) | `none` | `text` | `ClipboardSetResult` |
| 8 | [`CLIPBOARD_GET`](#clipboard-get) | `none` | `{}` | `ClipboardGetResult` |
| 9 | [`NAVIGATE_BACK`](#navigate-back) | `none` | `{}` | `NavigateBackResult` |
| 10 | [`CAN_I_USE`](#can-i-use) | `none` | `action` | `CanIUseResult` |
| 11 | [`START_OAUTH_SESSION`](#start-oauth-session) | `none` | `authUrl`, `redirectScheme`, `state` | `OAuthSessionResult` |
| 12 | [`CANCEL_OAUTH_SESSION`](#cancel-oauth-session) | `none` | `{}` | `OAuthCancelResult` |

---

## Action Specifications

---

### 1. `GET_DEVICE_INFO` {#get-device-info}

Retrieves comprehensive hardware specifications, operating system release, screen display metrics, and power status of the host device.

**Purpose & Context:** Allows mini-apps to adapt responsive layouts, feature tiers, and dark/light system theme rendering based on host hardware attributes.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `GET_DEVICE_INFO`
- **Supported Aliases:** `getDeviceInfo`, `getSystemInfo`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `DeviceInfo`
- **Description:** Device hardware details, display metrics, battery status, and application build metadata.

```json title="Return Payload Shape"
{
  "model": "string",
  "manufacturer": "string",
  "brand": "string",
  "platform": "string (optional)",
  "androidVersion": "string (optional)",
  "systemVersion": "string (optional)",
  "sdkInt": "number",
  "screenWidthDp": "number",
  "screenHeightDp": "number",
  "density": "number",
  "batteryLevel": "number",
  "isCharging": "boolean",
  "isAlgorithmicDarkening": "boolean",
  "appVersion": "string",
  "installGuid": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `NATIVE_EXECUTION_ERROR` | Host platform failed to query WindowManager or BatteryManager service. | Ensure the host Activity is in a valid resumed lifecycle state. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
import { goatBridge } from '@goat/sdk';

const info = await goatBridge.callNative('GET_DEVICE_INFO', {});
console.log(`Device: ${info.manufacturer} ${info.model}, Battery: ${info.batteryLevel}%`);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Android Kotlin Bridge Handler
val info = buildJsonObject {
    put("model", Build.MODEL)
    put("manufacturer", Build.MANUFACTURER)
    put("sdkInt", Build.VERSION.SDK_INT)
    put("batteryLevel", batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY))
    put("isCharging", isDeviceCharging())
}
bridge.sendResponse(requestId, info)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// iOS Swift Bridge Handler
let info: [String: Any] = [
    "platform": "iOS",
    "model": UIDevice.current.model,
    "systemVersion": UIDevice.current.systemVersion,
    "batteryLevel": Int(UIDevice.current.batteryLevel * 100),
    "isCharging": UIDevice.current.batteryState == .charging
]
replyHandler(info, nil)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
// Flutter Dart Bridge Channel
final res = await goatController.callNativeAction('GET_DEVICE_INFO', {});
final model = res.data['model'];
final battery = res.data['batteryLevel'];
```

  </TabItem>
</Tabs>


---

### 2. `HAPTIC_FEEDBACK` {#haptic-feedback}

Triggers tactile haptic feedback impulses on supported hardware actuators (Taptic Engine / Android Vibrator).

**Purpose & Context:** Provides subtle physical confirmation for user UI gestures such as button taps, pull-to-refresh snaps, and error states.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `HAPTIC_FEEDBACK`
- **Supported Aliases:** `triggerHaptic`, `hapticFeedback`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `android.permission.VIBRATE`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `type` | `"impact" \| "notification" \| "selection"` | No | `"impact"` | Haptic feedback category. |
| `style` | `"light" \| "medium" \| "heavy" \| "rigid" \| "soft"` | No | `"medium"` | Intensity style for impact feedback. |
| `notificationType` | `"success" \| "warning" \| "error"` | No | - | Semantic pattern for notification haptics. |


#### Return Value
- **Schema Type:** `HapticResult`
- **Description:** Confirmation that the haptic impulse was submitted to the native vibrator engine.

```json title="Return Payload Shape"
{
  "triggered": "boolean",
  "type": "string",
  "style": "string (optional)",
  "notificationType": "string (optional)"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Unrecognized haptic style or invalid type string. | Use valid style strings: light, medium, heavy, rigid, or soft. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('HAPTIC_FEEDBACK', {
  type: 'impact',
  style: 'heavy'
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Android VibratorEffect
val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK))
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// iOS UIImpactFeedbackGenerator
let generator = UIImpactFeedbackGenerator(style: .heavy)
generator.impactOccurred()
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('HAPTIC_FEEDBACK', {
  'type': 'impact',
  'style': 'heavy'
});
```

  </TabItem>
</Tabs>


---

### 3. `SET_STATUS_BAR_THEME` {#set-status-bar-theme}

Configures the host status bar icon and text tinting between dark and light modes.

**Purpose & Context:** Ensures status bar icons (clock, battery, Wi-Fi) remain clearly legible over custom mini-app header backgrounds.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `SET_STATUS_BAR_THEME`
- **Supported Aliases:** `setStatusBarTheme`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `isDark` | `boolean` | **Yes** | - | True for dark icons (light background), false for light icons (dark background). |


#### Return Value
- **Schema Type:** `StatusBarResult`
- **Description:** Status of window insets controller update.

```json title="Return Payload Shape"
{
  "updated": "boolean",
  "isDark": "boolean"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | isDark property missing or not a boolean. | Provide a boolean isDark parameter. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('SET_STATUS_BAR_THEME', { isDark: true });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars = isDark
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
UIApplication.shared.statusBarStyle = isDark ? .darkContent : .lightContent
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('SET_STATUS_BAR_THEME', {'isDark': true});
```

  </TabItem>
</Tabs>


---

### 4. `SET_SCREEN_BRIGHTNESS` {#set-screen-brightness}

Overrides the current window display brightness level between 0.0 (minimum) and 1.0 (maximum).

**Purpose & Context:** Useful for high-visibility situations such as presenting barcode/QR tickets at payment counters.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `SET_SCREEN_BRIGHTNESS`
- **Supported Aliases:** `setScreenBrightness`, `setBrightness`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `value` | `number` | **Yes** | - | Brightness intensity value between 0.0 and 1.0. |


#### Return Value
- **Schema Type:** `BrightnessResult`
- **Description:** The applied window brightness value.

```json title="Return Payload Shape"
{
  "value": "number",
  "updated": "boolean"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Brightness value is out of bounds (must be between 0.0 and 1.0). | Clamp brightness input values to the range [0.0, 1.0]. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('SET_SCREEN_BRIGHTNESS', { value: 0.9 });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val layoutParams = window.attributes
layoutParams.screenBrightness = value.toFloat()
window.attributes = layoutParams
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
UIScreen.main.brightness = CGFloat(value)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('SET_SCREEN_BRIGHTNESS', {'value': 0.9});
```

  </TabItem>
</Tabs>


---

### 5. `GET_SCREEN_BRIGHTNESS` {#get-screen-brightness}

Queries the current active screen brightness level of the host window.

**Purpose & Context:** Allows mini-apps to cache original user brightness before boosting it for barcode scanning.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `GET_SCREEN_BRIGHTNESS`
- **Supported Aliases:** `getScreenBrightness`, `getBrightness`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `BrightnessResult`
- **Description:** Current brightness floating point level between 0.0 and 1.0.

```json title="Return Payload Shape"
{
  "value": "number"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { value } = await goatBridge.callNative('GET_SCREEN_BRIGHTNESS', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val brightness = window.attributes.screenBrightness
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let brightness = Double(UIScreen.main.brightness)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('GET_SCREEN_BRIGHTNESS', {});
```

  </TabItem>
</Tabs>


---

### 6. `SET_KEEP_SCREEN_ON` {#set-keep-screen-on}

Acquires or releases the host window screen wake lock preventing the display from dimming or locking.

**Purpose & Context:** Keeps the screen awake during video playback, route navigation, or continuous scanner reading.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `SET_KEEP_SCREEN_ON`
- **Supported Aliases:** `setKeepScreenOn`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `android.permission.WAKE_LOCK`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `keepScreenOn` | `boolean` | **Yes** | - | True to lock screen awake, false to restore standard display timeout. |


#### Return Value
- **Schema Type:** `KeepScreenOnResult`
- **Description:** Updated screen wake lock status.

```json title="Return Payload Shape"
{
  "keepScreenOn": "boolean",
  "updated": "boolean"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | keepScreenOn parameter was not provided as a boolean. | Pass `{ keepScreenOn: true }` or `{ keepScreenOn: false }`. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('SET_KEEP_SCREEN_ON', { keepScreenOn: true });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
if (keepScreenOn) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
UIApplication.shared.isIdleTimerDisabled = keepScreenOn
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('SET_KEEP_SCREEN_ON', {'keepScreenOn': true});
```

  </TabItem>
</Tabs>


---

### 7. `CLIPBOARD_SET` {#clipboard-set}

Copies plain text strings onto the native system clipboard.

**Purpose & Context:** Enables quick copy-to-clipboard functionality for order numbers, coupon codes, and shareable links.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `CLIPBOARD_SET`
- **Supported Aliases:** `setClipboard`, `setClipboardData`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `text` | `string` | **Yes** | - | String payload to write into system clipboard. |


#### Return Value
- **Schema Type:** `ClipboardSetResult`
- **Description:** Confirmation that string was committed to the clipboard buffer.

```json title="Return Payload Shape"
{
  "copied": "boolean",
  "length": "number"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | text parameter was missing or not a string. | Provide a valid string in the text field. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('CLIPBOARD_SET', { text: 'GOAT-DISCOUNT-2026' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val clip = ClipData.newPlainText("text", text)
clipboardManager.setPrimaryClip(clip)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
UIPasteboard.general.string = text
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('CLIPBOARD_SET', {'text': 'GOAT-DISCOUNT-2026'});
```

  </TabItem>
</Tabs>


---

### 8. `CLIPBOARD_GET` {#clipboard-get}

Reads current plain text string from system clipboard under active user gesture gate.

**Purpose & Context:** Allows pasting tracking codes, invite tokens, or addresses directly into mini-app forms.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `CLIPBOARD_GET`
- **Supported Aliases:** `getClipboard`, `getClipboardData`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** Warning: **Active User Gesture Required** (User touch within &lt;10s)

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `ClipboardGetResult`
- **Description:** Content of the clipboard and presence indicator.

```json title="Return Payload Shape"
{
  "text": "string",
  "hasContent": "boolean"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `GESTURE_REQUIRED` | Clipboard read was invoked without recent user interaction touch gesture. | Trigger CLIPBOARD_GET directly inside an onClick/onTouch handler. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { text } = await goatBridge.callNative('CLIPBOARD_GET', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val clip = clipboardManager.primaryClip?.getItemAt(0)?.text?.toString() ?: ""
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let text = UIPasteboard.general.string ?? ""
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('CLIPBOARD_GET', {});
```

  </TabItem>
</Tabs>


---

### 9. `NAVIGATE_BACK` {#navigate-back}

Signals the host container to pop the top page or finish the mini-app activity if on root page.

**Purpose & Context:** Standardizes physical back gesture and custom mini-app header back button handling.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `NAVIGATE_BACK`
- **Supported Aliases:** `navigateBack`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `NavigateBackResult`
- **Description:** Indicates whether the back navigation was handled inside WebView stack or host activity.

```json title="Return Payload Shape"
{
  "handled": "boolean",
  "canGoBack": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('NAVIGATE_BACK', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
if (webView.canGoBack()) webView.goBack() else activity.finish()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
if webView.canGoBack { webView.goBack() } else { navigationController?.popViewController(animated: true) }
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('NAVIGATE_BACK', {});
```

  </TabItem>
</Tabs>


---

### 10. `CAN_I_USE` {#can-i-use}

Probes host bridge runtime support for a specific action string or capability.

**Purpose & Context:** Allows progressive enhancement and graceful fallback when running on older host app versions.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `CAN_I_USE`
- **Supported Aliases:** `canIUse`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `action` | `string` | **Yes** | - | Action string or feature key to probe (e.g., "BIOMETRIC_AUTH" or "BLE_START_SCAN"). |


#### Return Value
- **Schema Type:** `CanIUseResult`
- **Description:** True if host container registers an active handler for the action.

```json title="Return Payload Shape"
{
  "supported": "boolean",
  "action": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Action parameter is missing. | Provide an action name string to test. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { supported } = await goatBridge.callNative('CAN_I_USE', { action: 'BIOMETRIC_AUTH' });
if (supported) {
  // Use biometrics
}
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val isSupported = handlerRegistry.containsKey(action.uppercase())
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let isSupported = registeredHandlers[action.uppercased()] != nil
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('CAN_I_USE', {'action': 'BIOMETRIC_AUTH'});
```

  </TabItem>
</Tabs>


---

### 11. `START_OAUTH_SESSION` {#start-oauth-session}

Launches a secure in-app authentication session (ASWebAuthenticationSession on iOS, Chrome Custom Tabs on Android).

**Purpose & Context:** Enables single sign-on (SSO) OAuth2/OIDC authorization with isolated cookie jars and zero plain credential leakage.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `START_OAUTH_SESSION`
- **Supported Aliases:** `startOAuthSession`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `authUrl` | `string` | **Yes** | - | HTTPS authorization endpoint URL. |
| `redirectScheme` | `string` | No | - | Custom URI callback scheme (e.g., "goat://oauth-callback"). |
| `state` | `string` | No | - | CSRF state verification token. |


#### Return Value
- **Schema Type:** `OAuthSessionResult`
- **Description:** The final redirect URL containing authorization code or access token.

```json title="Return Payload Shape"
{
  "callbackUrl": "string",
  "status": "\"SUCCESS\" | \"CANCELLED\""
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | authUrl was missing or not a valid HTTPS URL. | Ensure authUrl starts with https://. |
| `SECURITY_VIOLATION` | Cleartext HTTP URL supplied to OAuth session. | OAuth endpoints must strictly use TLS (HTTPS). |
| `USER_CANCEL` | User dismissed the authentication sheet before completing login. | Handle user cancellation gracefully in login UI. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const result = await goatBridge.callNative('START_OAUTH_SESSION', {
  authUrl: 'https://auth.example.com/oauth/authorize?client_id=goat_app&response_type=code',
  redirectScheme: 'goat://oauth-callback'
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// CustomTabsIntent launch with redirect listener
val intent = CustomTabsIntent.Builder().build()
intent.launchUrl(activity, Uri.parse(authUrl))
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// ASWebAuthenticationSession
let session = ASWebAuthenticationSession(url: URL(string: authUrl)!, callbackURLScheme: redirectScheme) { url, error in
    // handle callback
}
session.start()
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('START_OAUTH_SESSION', {
  'authUrl': 'https://auth.example.com/oauth/authorize',
  'redirectScheme': 'goat://oauth-callback'
});
```

  </TabItem>
</Tabs>


---

### 12. `CANCEL_OAUTH_SESSION` {#cancel-oauth-session}

Dismisses an active in-app OAuth authentication browser sheet.

**Purpose & Context:** Allows programmatic timeout or user cancellation of pending OAuth authentication requests.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `CANCEL_OAUTH_SESSION`
- **Supported Aliases:** `cancelOAuthSession`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `OAuthCancelResult`
- **Description:** Indicates the OAuth session was aborted.

```json title="Return Payload Shape"
{
  "cancelled": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('CANCEL_OAUTH_SESSION', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
activeCustomTabSession?.cancel()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
activeAuthSession?.cancel()
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('CANCEL_OAUTH_SESSION', {});
```

  </TabItem>
</Tabs>

