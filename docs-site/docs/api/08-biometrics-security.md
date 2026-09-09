---
sidebar_position: 9
title: Domain 8 - Biometrics & Permissions
description: Complete API reference for Biometrics & Permissions (8 actions).
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Domain 8: Biometrics & Permissions

Hardware biometric authentication (FaceID, TouchID, BiometricPrompt), two-stage permission priming dialogs, and COOP/COEP sandbox auditing.

**Total Actions in Domain:** `8 actions`

---

## Action Summary

| # | Action String | Permission | Inputs | Returns |
| :--- | :--- | :--- | :--- | :--- |
| 1 | [`CHECK_BIOMETRIC_SUPPORT`](#check-biometric-support) | `none` | `{}` | `BiometricSupportResult` |
| 2 | [`BIOMETRIC_AUTH`](#biometric-auth) | `scope.biometrics` | `title`, `subtitle`, `reason`, `negativeButtonText` | `BiometricAuthResult` |
| 3 | [`CHECK_PERMISSION`](#check-permission) | `none` | `scope` | `PermissionResult` |
| 4 | [`REQUEST_PERMISSION`](#request-permission) | `none` | `scope`, `rationale` | `PermissionResult` |
| 5 | [`GET_SETTING`](#get-setting) | `none` | `{}` | `AuthSettingResult` |
| 6 | [`OPEN_SETTING`](#open-setting) | `none` | `{}` | `OpenSettingResult` |
| 7 | [`AUTHORIZE`](#authorize) | `none` | `scope`, `granted` | `PermissionResult` |
| 8 | [`AUDIT_SANDBOX_HEADERS`](#audit-sandbox-headers) | `none` | `{}` | `SandboxHeadersAuditResult` |

---

## Action Specifications

---

### 1. `CHECK_BIOMETRIC_SUPPORT` {#check-biometric-support}

Probes host device hardware for biometric enrollment and supported sensor modality (FaceID, TouchID, OpticID, Fingerprint).

**Purpose & Context:** Allows mini-apps to conditionally show "Log in with Face ID" or "Biometric Checkout" buttons.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `CHECK_BIOMETRIC_SUPPORT`
- **Supported Aliases:** `checkBiometricSupport`, `checkBiometricsSupport`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `android.permission.USE_BIOMETRIC`, `NSFaceIDUsageDescription`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `BiometricSupportResult`
- **Description:** Hardware availability and sensor type.

```json title="Return Payload Shape"
{
  "supported": "boolean",
  "biometryType": "\"faceID\" | \"touchID\" | \"opticID\" | \"fingerprint\" | \"none\""
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { supported, biometryType } = await goatBridge.callNative('CHECK_BIOMETRIC_SUPPORT', {});
console.log('Biometrics supported:', supported, 'Type:', biometryType);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val biometricManager = BiometricManager.from(context)
val canAuthenticate = biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
var error: NSError?
let context = LAContext()
let supported = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('CHECK_BIOMETRIC_SUPPORT', {});
```

  </TabItem>
</Tabs>


---

### 2. `BIOMETRIC_AUTH` {#biometric-auth}

Displays the native system biometric authentication prompt (TouchID, FaceID, Android BiometricPrompt) under active user gesture gate.

**Purpose & Context:** Authorizes high-security transactions, funds transfers, and confidential record access.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `BIOMETRIC_AUTH`
- **Supported Aliases:** `biometricAuth`, `authenticateWithBiometrics`
- **Permission Scope:** `scope.biometrics`
- **Required Manifest Permissions:** `android.permission.USE_BIOMETRIC`, `NSFaceIDUsageDescription`
- **Security Constraint:** Warning: **Active User Gesture Required** (User touch within &lt;10s)

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `title` | `string` | No | `"Biometric Authentication"` | Authentication prompt title. |
| `subtitle` | `string` | No | - | Prompt subtitle. |
| `reason` | `string` | No | - | Detailed justification string shown to user. |
| `negativeButtonText` | `string` | No | `"Cancel"` | Cancel button label. |


#### Return Value
- **Schema Type:** `BiometricAuthResult`
- **Description:** Authentication result and optional cryptographic verification signature.

```json title="Return Payload Shape"
{
  "authenticated": "boolean",
  "biometryType": "string (optional)",
  "token": "string (optional)"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `GESTURE_REQUIRED` | Biometric prompt triggered without recent user touch gesture (&lt;10s). | Trigger BIOMETRIC_AUTH directly inside an onClick/onTap handler. |
| `PERMISSION_DENIED` | User denied biometric authorization. | Handle fallback authentication. |
| `BIOMETRIC_LOCKOUT` | Too many failed biometric attempts. Device locked. | Prompt user to unlock with device passcode. |
| `BIOMETRIC_UNAVAILABLE` | No biometrics enrolled or hardware disabled. | Fallback to PIN or password. |
| `USER_CANCEL` | User dismissed the biometric dialog. | Allow user to retry or cancel. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const result = await goatBridge.callNative('BIOMETRIC_AUTH', {
  title: 'Confirm Payment',
  subtitle: 'Authorize transfer of $50.00',
  reason: 'Scan your face to authorize transaction'
});
if (result.authenticated) {
  // Transfer authorized
}
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val promptInfo = BiometricPrompt.PromptInfo.Builder()
    .setTitle(title)
    .setSubtitle(subtitle)
    .setNegativeButtonText(negativeButtonText)
    .build()
BiometricPrompt(activity, executor, callback).authenticate(promptInfo)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let context = LAContext()
context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, error in
    // handle success
}
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('BIOMETRIC_AUTH', {
  'title': 'Confirm Payment',
  'reason': 'Authorize payment',
});
```

  </TabItem>
</Tabs>


---

### 3. `CHECK_PERMISSION` {#check-permission}

Checks authorization status for a specific permission scope (e.g., "scope.camera", "scope.userLocation", "scope.bluetooth").

**Purpose & Context:** Determines whether permission priming or direct request is required before invoking hardware features.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `CHECK_PERMISSION`
- **Supported Aliases:** `checkPermission`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `scope` | `string` | **Yes** | - | Permission scope identifier (e.g. "scope.camera", "scope.userLocation"). |


#### Return Value
- **Schema Type:** `PermissionResult`
- **Description:** Current permission grant status.

```json title="Return Payload Shape"
{
  "scope": "string",
  "granted": "boolean",
  "isDeclaredInManifest": "boolean"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Missing scope string. | Pass a valid permission scope. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { granted } = await goatBridge.callNative('CHECK_PERMISSION', { scope: 'scope.camera' });
if (!granted) {
  // Show priming dialog
}
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let status = AVCaptureDevice.authorizationStatus(for: .video)
let granted = status == .authorized
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('CHECK_PERMISSION', {'scope': 'scope.camera'});
```

  </TabItem>
</Tabs>


---

### 4. `REQUEST_PERMISSION` {#request-permission}

Triggers a two-stage permission priming dialog explaining rationale before showing native OS permission prompt.

**Purpose & Context:** Significantly improves permission opt-in rates by providing context before OS dialog.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `REQUEST_PERMISSION`
- **Supported Aliases:** `requestPermission`, `requestPermissionWithPriming`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `scope` | `string` | **Yes** | - | Permission scope identifier. |
| `rationale` | `string` | No | - | Custom explanation text shown in priming dialog. |


#### Return Value
- **Schema Type:** `PermissionResult`
- **Description:** Outcome of permission request.

```json title="Return Payload Shape"
{
  "scope": "string",
  "granted": "boolean",
  "isDeclaredInManifest": "boolean"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | scope missing. | Specify valid scope. |
| `USER_CANCEL` | User dismissed the priming dialog. | Do not prompt again immediately. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { granted } = await goatBridge.callNative('REQUEST_PERMISSION', {
  scope: 'scope.camera',
  rationale: 'Camera access is required to scan QR tickets.'
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Show PrimingDialog then requestPermissions(arrayOf(Manifest.permission.CAMERA), REQ_CODE)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Show custom priming sheet then AVCaptureDevice.requestAccess(for: .video)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('REQUEST_PERMISSION', {
  'scope': 'scope.camera',
  'rationale': 'Scan QR codes',
});
```

  </TabItem>
</Tabs>


---

### 5. `GET_SETTING` {#get-setting}

Queries the complete dictionary of user authorization settings and granted permissions for this mini-app.

**Purpose & Context:** Renders the mini-app permission settings summary page.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `GET_SETTING`
- **Supported Aliases:** `getSetting`, `getAppAuthorizeSetting`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `AuthSettingResult`
- **Description:** Map of permission scopes and their granted boolean states.

```json title="Return Payload Shape"
{
  "authSetting": "Record<string, boolean>"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { authSetting } = await goatBridge.callNative('GET_SETTING', {});
console.log('Location granted:', authSetting['scope.userLocation']);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Query AppPermissionStore
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Return authorization status map
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('GET_SETTING', {});
```

  </TabItem>
</Tabs>


---

### 6. `OPEN_SETTING` {#open-setting}

Deep-links the user directly into the native OS application permissions settings page.

**Purpose & Context:** Allows users to re-enable permissions previously rejected with "Don't ask again".

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `OPEN_SETTING`
- **Supported Aliases:** `openSetting`, `openAppPermissionSettings`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `OpenSettingResult`
- **Description:** Status of settings launch and updated permissions dictionary.

```json title="Return Payload Shape"
{
  "opened": "boolean",
  "authSetting": "Record<string, boolean>"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('OPEN_SETTING', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null))
context.startActivity(intent)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('OPEN_SETTING', {});
```

  </TabItem>
</Tabs>


---

### 7. `AUTHORIZE` {#authorize}

Explicitly requests pre-authorization for a scope without immediately invoking the hardware feature.

**Purpose & Context:** Pre-authorizes location or camera in onboarding steps.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `AUTHORIZE`
- **Supported Aliases:** `authorize`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `scope` | `string` | **Yes** | - | Scope to authorize. |
| `granted` | `boolean` | No | - | Explicit grant override (for mock testing). |


#### Return Value
- **Schema Type:** `PermissionResult`
- **Description:** Result of authorization request.

```json title="Return Payload Shape"
{
  "scope": "string",
  "granted": "boolean",
  "isDeclaredInManifest": "boolean"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | scope missing. | Provide valid scope string. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('AUTHORIZE', { scope: 'scope.camera' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Request permission
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Request permission
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('AUTHORIZE', {'scope': 'scope.camera'});
```

  </TabItem>
</Tabs>


---

### 8. `AUDIT_SANDBOX_HEADERS` {#audit-sandbox-headers}

Audits COOP (Cross-Origin-Opener-Policy) and COEP (Cross-Origin-Embedder-Policy) security headers for hermetic process isolation.

**Purpose & Context:** Verifies the mini-app runtime meets OWASP MASVS requirements for cross-origin isolation and SharedArrayBuffer availability.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `AUDIT_SANDBOX_HEADERS`
- **Supported Aliases:** `auditSandboxHeaders`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `SandboxHeadersAuditResult`
- **Description:** Security header compliance report.

```json title="Return Payload Shape"
{
  "coopHeaderPresent": "boolean",
  "coepHeaderPresent": "boolean",
  "isIsolatedContext": "boolean",
  "status": "string"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const audit = await goatBridge.callNative('AUDIT_SANDBOX_HEADERS', {});
console.log('COOP present:', audit.coopHeaderPresent, 'Isolated:', audit.isIsolatedContext);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Audit WebViewAssetLoader header injection
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// WKURLSchemeHandler header verification
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('AUDIT_SANDBOX_HEADERS', {});
```

  </TabItem>
</Tabs>

