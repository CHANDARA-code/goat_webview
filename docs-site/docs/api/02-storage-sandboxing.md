---
sidebar_position: 3
title: Domain 2 - Multi-Tenant Storage & Sandboxing
description: Complete API reference for Multi-Tenant Storage & Sandboxing (16 actions).
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Domain 2: Multi-Tenant Storage & Sandboxing 🔒

Hardware-backed AES-256-GCM enclave storage, tenant isolation per appId, RFC 6265 cookie management, and web storage quota accounting.

**Total Actions in Domain:** `16 actions`

---

## Action Summary

| # | Action String | Permission | Inputs | Returns |
| :--- | :--- | :--- | :--- | :--- |
| 1 | [`STORAGE_SET`](#storage-set) | `none` | `key`, `value`, `appId` | `StorageSetResult` |
| 2 | [`STORAGE_GET`](#storage-get) | `none` | `key`, `appId` | `StorageGetResult` |
| 3 | [`STORAGE_REMOVE`](#storage-remove) | `none` | `key`, `appId` | `StorageRemoveResult` |
| 4 | [`STORAGE_CLEAR`](#storage-clear) | `none` | `appId` | `StorageClearResult` |
| 5 | [`SECURE_STORAGE_SET`](#secure-storage-set) | `none` | `key`, `value`, `appId` | `SecureStorageResult` |
| 6 | [`SECURE_STORAGE_GET`](#secure-storage-get) | `none` | `key`, `appId` | `SecureStorageGetResult` |
| 7 | [`SECURE_STORAGE_REMOVE`](#secure-storage-remove) | `none` | `key`, `appId` | `SecureStorageRemoveResult` |
| 8 | [`SECURE_STORAGE_CLEAR`](#secure-storage-clear) | `none` | `appId` | `SecureStorageClearResult` |
| 9 | [`COOKIE_GET`](#cookie-get) | `none` | `url`, `appId` | `CookieGetResult` |
| 10 | [`COOKIE_SET`](#cookie-set) | `none` | `url`, `value`, `domain`, `path` | `CookieSetResult` |
| 11 | [`COOKIE_REMOVE`](#cookie-remove) | `none` | `url`, `name` | `CookieRemoveResult` |
| 12 | [`COOKIE_REMOVE_ALL`](#cookie-remove-all) | `none` | `appId` | `CookieClearResult` |
| 13 | [`WEB_STORAGE_GET_QUOTA_USAGE`](#web-storage-get-quota-usage) | `none` | `appId` | `WebStorageQuotaResult` |
| 14 | [`WEB_STORAGE_CLEAR`](#web-storage-clear) | `none` | `appId` | `WebStorageClearResult` |
| 15 | [`HTTP_AUTH_SAVE_CREDENTIAL`](#http-auth-save-credential) | `none` | `host`, `username`, `password` | `HttpAuthResult` |
| 16 | [`HTTP_AUTH_CLEAR_CREDENTIALS`](#http-auth-clear-credentials) | `none` | `host` | `HttpAuthClearResult` |

---

## Action Specifications

---

### 1. `STORAGE_SET` {#storage-set}

Stores key-value pair string data in isolated tenant partition with quota management (10 MB quota).

**Purpose & Context:** Standard non-sensitive application cache and state persistence isolated per mini-app appId.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `STORAGE_SET`
- **Supported Aliases:** `storageSet`, `setStorage`, `setStorageSync`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `key` | `string` | **Yes** | - | Storage lookup key. |
| `value` | `string` | **Yes** | - | String value to store. |
| `appId` | `string` | No | - | Implicitly bound mini-app identifier. |


#### Return Value
- **Schema Type:** `StorageSetResult`
- **Description:** Confirmation that data was committed to disk storage.

```json title="Return Payload Shape"
{
  "saved": "boolean",
  "key": "string",
  "appId": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Missing key or value. | Ensure key and value are valid strings. |
| `STORAGE_QUOTA_EXCEEDED` | Storage usage exceeds the 10 MB per-app limit. | Clear obsolete cache entries using STORAGE_REMOVE or STORAGE_CLEAR. |
| `SECURITY_VIOLATION` | Caller attempted to access another appId partition. | Do not pass mismatched appId parameters. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('STORAGE_SET', { key: 'user_theme', value: 'dark' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val sharedPref = context.getSharedPreferences("goat_kv_$appId", Context.MODE_PRIVATE)
sharedPref.edit().putString(key, value).apply()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
UserDefaults.standard.set(value, forKey: "goat_kv_\(appId)_\(key)")
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('STORAGE_SET', {'key': 'user_theme', 'value': 'dark'});
```

  </TabItem>
</Tabs>


---

### 2. `STORAGE_GET` {#storage-get}

Retrieves stored string value corresponding to the specified key in the calling mini-app partition.

**Purpose & Context:** Recovers saved mini-app user settings, form drafts, and session preferences.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `STORAGE_GET`
- **Supported Aliases:** `storageGet`, `getStorage`, `getStorageSync`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `key` | `string` | **Yes** | - | Storage key to look up. |
| `appId` | `string` | No | - | Implicit mini-app identifier. |


#### Return Value
- **Schema Type:** `StorageGetResult`
- **Description:** Stored value or null if key does not exist.

```json title="Return Payload Shape"
{
  "key": "string",
  "value": "string | null",
  "data": "any (optional)"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Key parameter is missing. | Provide a non-empty key string. |
| `SECURITY_VIOLATION` | Cross-tenant appId partition access blocked. | Access only your own partition. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { value } = await goatBridge.callNative('STORAGE_GET', { key: 'user_theme' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val value = sharedPref.getString(key, null)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let value = UserDefaults.standard.string(forKey: "goat_kv_\(appId)_\(key)")
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('STORAGE_GET', {'key': 'user_theme'});
```

  </TabItem>
</Tabs>


---

### 3. `STORAGE_REMOVE` {#storage-remove}

Deletes a single key-value entry from the calling mini-app storage partition.

**Purpose & Context:** Removes specific cached keys when items expire or user logs out.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `STORAGE_REMOVE`
- **Supported Aliases:** `storageRemove`, `removeStorage`, `removeStorageSync`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `key` | `string` | **Yes** | - | Key to remove. |
| `appId` | `string` | No | - | Mini-app identifier. |


#### Return Value
- **Schema Type:** `StorageRemoveResult`
- **Description:** Confirmation that the key was purged.

```json title="Return Payload Shape"
{
  "removed": "boolean",
  "key": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Key parameter missing. | Specify the key string to delete. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('STORAGE_REMOVE', { key: 'user_theme' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
sharedPref.edit().remove(key).apply()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
UserDefaults.standard.removeObject(forKey: "goat_kv_\(appId)_\(key)")
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('STORAGE_REMOVE', {'key': 'user_theme'});
```

  </TabItem>
</Tabs>


---

### 4. `STORAGE_CLEAR` {#storage-clear}

Purges all key-value entries belonging to the calling mini-app storage partition.

**Purpose & Context:** Complete cleanup of local cache during app reset or full user sign-out.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `STORAGE_CLEAR`
- **Supported Aliases:** `storageClear`, `clearStorage`, `clearStorageSync`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `appId` | `string` | No | - | Calling mini-app identifier. |


#### Return Value
- **Schema Type:** `StorageClearResult`
- **Description:** Confirmation that tenant storage partition is completely empty.

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
await goatBridge.callNative('STORAGE_CLEAR', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
sharedPref.edit().clear().apply()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Clear keys prefixed with tenant appId
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('STORAGE_CLEAR', {});
```

  </TabItem>
</Tabs>


---

### 5. `SECURE_STORAGE_SET` {#secure-storage-set}

Stores sensitive secrets in hardware-backed encrypted enclave (Keychain / EncryptedSharedPreferences with AES-256-GCM).

**Purpose & Context:** Safe storage of JWT bearer tokens, private keys, and payment credentials.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `SECURE_STORAGE_SET`
- **Supported Aliases:** `secureStorageSet`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `key` | `string` | **Yes** | - | Secret key identifier. |
| `value` | `string` | **Yes** | - | Secret string to encrypt. |
| `appId` | `string` | No | - | Calling appId partition. |


#### Return Value
- **Schema Type:** `SecureStorageResult`
- **Description:** Confirmation that secret was encrypted and stored in secure enclave.

```json title="Return Payload Shape"
{
  "saved": "boolean",
  "key": "string",
  "appId": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Key or value missing. | Provide valid strings for key and value. |
| `SECURITY_VIOLATION` | Hardware Keystore / Secure Enclave error. | Ensure device supports hardware cryptographic keystores. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('SECURE_STORAGE_SET', {
  key: 'auth_token',
  value: 'eyJhbGciOiJIUzI1Ni...'
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val masterKey = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
val encryptedPref = EncryptedSharedPreferences.create(context, "sec_$appId", masterKey, ...)
encryptedPref.edit().putString(key, value).apply()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// iOS Keychain Services SecItemAdd with kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('SECURE_STORAGE_SET', {
  'key': 'auth_token',
  'value': 'eyJhbGciOi...'
});
```

  </TabItem>
</Tabs>


---

### 6. `SECURE_STORAGE_GET` {#secure-storage-get}

Decodes and retrieves a secret string from hardware-backed encrypted storage.

**Purpose & Context:** Recovers authenticated session tokens for authorized API calls.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `SECURE_STORAGE_GET`
- **Supported Aliases:** `secureStorageGet`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `key` | `string` | **Yes** | - | Secret key identifier. |
| `appId` | `string` | No | - | Calling appId. |


#### Return Value
- **Schema Type:** `SecureStorageGetResult`
- **Description:** Decrypted secret string or null if not found.

```json title="Return Payload Shape"
{
  "key": "string",
  "value": "string | null"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Key missing. | Pass non-empty key. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { value } = await goatBridge.callNative('SECURE_STORAGE_GET', { key: 'auth_token' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val value = encryptedPref.getString(key, null)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Query Keychain with SecItemCopyMatching
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('SECURE_STORAGE_GET', {'key': 'auth_token'});
```

  </TabItem>
</Tabs>


---

### 7. `SECURE_STORAGE_REMOVE` {#secure-storage-remove}

Purges a secret key from the hardware-backed keystore partition.

**Purpose & Context:** Revokes sensitive credentials immediately upon logout.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `SECURE_STORAGE_REMOVE`
- **Supported Aliases:** `secureStorageRemove`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `key` | `string` | **Yes** | - | Secret key to purge. |
| `appId` | `string` | No | - | Calling appId. |


#### Return Value
- **Schema Type:** `SecureStorageRemoveResult`
- **Description:** Confirmation that key was wiped from keystore.

```json title="Return Payload Shape"
{
  "removed": "boolean",
  "key": "string"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('SECURE_STORAGE_REMOVE', { key: 'auth_token' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
encryptedPref.edit().remove(key).apply()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// SecItemDelete from Keychain
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('SECURE_STORAGE_REMOVE', {'key': 'auth_token'});
```

  </TabItem>
</Tabs>


---

### 8. `SECURE_STORAGE_CLEAR` {#secure-storage-clear}

Purges all encrypted secrets stored in the hardware enclave for the calling mini-app.

**Purpose & Context:** Complete security sanitization when uninstalling or switching mini-app accounts.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `SECURE_STORAGE_CLEAR`
- **Supported Aliases:** `secureStorageClear`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `appId` | `string` | No | - | Calling appId. |


#### Return Value
- **Schema Type:** `SecureStorageClearResult`
- **Description:** Confirmation that all secrets for the tenant were wiped.

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
await goatBridge.callNative('SECURE_STORAGE_CLEAR', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
encryptedPref.edit().clear().apply()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Clear all Keychain items matching appId prefix
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('SECURE_STORAGE_CLEAR', {});
```

  </TabItem>
</Tabs>


---

### 9. `COOKIE_GET` {#cookie-get}

Retrieves RFC 6265 HTTP cookie records matching domain or target URL from native CookieManager.

**Purpose & Context:** Inspects active session cookies and expiration timestamps for authenticated web views.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `COOKIE_GET`
- **Supported Aliases:** `getCookies`, `getCookie`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `url` | `string` | No | - | Target URL to filter cookies. |
| `appId` | `string` | No | - | Calling appId. |


#### Return Value
- **Schema Type:** `CookieGetResult`
- **Description:** Array of cookie objects (name, value, domain, path, expires, secure, httpOnly).

```json title="Return Payload Shape"
{
  "cookies": "CookieItem[]",
  "totalCount": "number"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { cookies } = await goatBridge.callNative('COOKIE_GET', { url: 'https://api.example.com' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val cookieStr = CookieManager.getInstance().getCookie(url)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let cookies = HTTPCookieStorage.shared.cookies(for: URL(string: url)!)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('COOKIE_GET', {'url': 'https://api.example.com'});
```

  </TabItem>
</Tabs>


---

### 10. `COOKIE_SET` {#cookie-set}

Sets an RFC 6265 HTTP cookie string for the designated URL in the isolated cookie jar.

**Purpose & Context:** Synchronizes authentication cookies across native HTTP client and embedded WebViews.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `COOKIE_SET`
- **Supported Aliases:** `setCookie`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `url` | `string` | **Yes** | - | Target URL. |
| `value` | `string` | **Yes** | - | Cookie string (e.g., "session_id=xyz; Secure; HttpOnly"). |
| `domain` | `string` | No | - | Target cookie domain. |
| `path` | `string` | No | - | Target cookie path. |


#### Return Value
- **Schema Type:** `CookieSetResult`
- **Description:** Status of cookie synchronization.

```json title="Return Payload Shape"
{
  "success": "boolean",
  "url": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Missing url or value. | Provide valid URL and cookie strings. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('COOKIE_SET', {
  url: 'https://api.example.com',
  value: 'sid=abc12345; Secure; SameSite=Strict'
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
CookieManager.getInstance().setCookie(url, value) { success -> /* callback */ }
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
HTTPCookieStorage.shared.setCookies(cookies, for: URL(string: url)!, mainDocumentURL: nil)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('COOKIE_SET', {
  'url': 'https://api.example.com',
  'value': 'sid=abc12345'
});
```

  </TabItem>
</Tabs>


---

### 11. `COOKIE_REMOVE` {#cookie-remove}

Deletes a specific named cookie associated with the URL.

**Purpose & Context:** Clears single session cookies during partial de-authentication.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `COOKIE_REMOVE`
- **Supported Aliases:** `removeCookie`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `url` | `string` | **Yes** | - | Target URL. |
| `name` | `string` | **Yes** | - | Cookie name to delete. |


#### Return Value
- **Schema Type:** `CookieRemoveResult`
- **Description:** Indicates the cookie was expired and removed.

```json title="Return Payload Shape"
{
  "removed": "boolean",
  "name": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Missing URL or cookie name. | Pass url and name. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('COOKIE_REMOVE', { url: 'https://api.example.com', name: 'sid' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
CookieManager.getInstance().setCookie(url, "$name=; Max-Age=0")
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Delete matching cookie from HTTPCookieStorage
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('COOKIE_REMOVE', {'url': 'https://api.example.com', 'name': 'sid'});
```

  </TabItem>
</Tabs>


---

### 12. `COOKIE_REMOVE_ALL` {#cookie-remove-all}

Purges all cookies stored in the mini-app isolated cookie jar.

**Purpose & Context:** Guarantees zero session retention when switching accounts.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `COOKIE_REMOVE_ALL`
- **Supported Aliases:** `clearCookies`, `removeAllCookies`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `appId` | `string` | No | - | Mini-app identifier. |


#### Return Value
- **Schema Type:** `CookieClearResult`
- **Description:** Status of cookie purge.

```json title="Return Payload Shape"
{
  "cleared": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('COOKIE_REMOVE_ALL', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
CookieManager.getInstance().removeAllCookies { success -> }
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
WKWebsiteDataStore.default().removeData(ofTypes: [WKWebsiteDataTypeCookies], modifiedSince: .distantPast) {}
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('COOKIE_REMOVE_ALL', {});
```

  </TabItem>
</Tabs>


---

### 13. `WEB_STORAGE_GET_QUOTA_USAGE` {#web-storage-get-quota-usage}

Calculates the current disk space consumed by localStorage, IndexedDB, and CacheStorage for the calling appId.

**Purpose & Context:** Helps mini-apps monitor cache footprint against the 10 MB quota limit.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `WEB_STORAGE_GET_QUOTA_USAGE`
- **Supported Aliases:** `getWebStorageQuota`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `appId` | `string` | No | - | Mini-app identifier. |


#### Return Value
- **Schema Type:** `WebStorageQuotaResult`
- **Description:** Breakdown of storage usage in bytes.

```json title="Return Payload Shape"
{
  "usageBytes": "number",
  "quotaBytes": "number",
  "remainingBytes": "number"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { usageBytes, remainingBytes } = await goatBridge.callNative('WEB_STORAGE_GET_QUOTA_USAGE', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
WebStorage.getInstance().getUsageForOrigin(origin) { usage -> /* ... */ }
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
WKWebsiteDataStore.default().fetchDataRecords(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes()) { records in }
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('WEB_STORAGE_GET_QUOTA_USAGE', {});
```

  </TabItem>
</Tabs>


---

### 14. `WEB_STORAGE_CLEAR` {#web-storage-clear}

Deletes all HTML5 localStorage, sessionStorage, and IndexedDB data associated with the calling mini-app origin.

**Purpose & Context:** Frees browser storage when app storage quota is nearly exhausted.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `WEB_STORAGE_CLEAR`
- **Supported Aliases:** `clearWebStorage`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `appId` | `string` | No | - | Mini-app identifier. |


#### Return Value
- **Schema Type:** `WebStorageClearResult`
- **Description:** Number of bytes reclaimed from disk.

```json title="Return Payload Shape"
{
  "cleared": "boolean",
  "freedBytes": "number"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('WEB_STORAGE_CLEAR', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
WebStorage.getInstance().deleteOrigin(origin)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
WKWebsiteDataStore.default().removeData(ofTypes: [WKWebsiteDataTypeLocalStorage, WKWebsiteDataTypeIndexedDBDatabases], modifiedSince: .distantPast) {}
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('WEB_STORAGE_CLEAR', {});
```

  </TabItem>
</Tabs>


---

### 15. `HTTP_AUTH_SAVE_CREDENTIAL` {#http-auth-save-credential}

Persists HTTP Basic/Digest authentication credentials in host credential manager for automatic WebView challenge handling.

**Purpose & Context:** Eliminates repeated authentication popups when loading password-protected internal proxy resources.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `HTTP_AUTH_SAVE_CREDENTIAL`
- **Supported Aliases:** `saveHttpAuthCredential`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `host` | `string` | **Yes** | - | Authentication realm host. |
| `username` | `string` | **Yes** | - | HTTP auth username. |
| `password` | `string` | **Yes** | - | HTTP auth password. |


#### Return Value
- **Schema Type:** `HttpAuthResult`
- **Description:** Status of credential persistence.

```json title="Return Payload Shape"
{
  "saved": "boolean",
  "host": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Host, username, or password was empty. | Supply valid credential fields. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('HTTP_AUTH_SAVE_CREDENTIAL', {
  host: 'internal.corp.net',
  username: 'engineer',
  password: 'secret_password'
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
webView.setHttpAuthUsernamePassword(host, realm, username, password)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Store credential in URLCredentialStorage.shared
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('HTTP_AUTH_SAVE_CREDENTIAL', {
  'host': 'internal.corp.net',
  'username': 'engineer',
  'password': 'secret_password'
});
```

  </TabItem>
</Tabs>


---

### 16. `HTTP_AUTH_CLEAR_CREDENTIALS` {#http-auth-clear-credentials}

Clears saved HTTP Basic and Digest credentials for a specific host or all realms.

**Purpose & Context:** Removes cached HTTP basic credentials when corporate session expires.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `HTTP_AUTH_CLEAR_CREDENTIALS`
- **Supported Aliases:** `clearHttpAuthCredentials`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `host` | `string` | No | - | Specific host to clear, or omit to purge all. |


#### Return Value
- **Schema Type:** `HttpAuthClearResult`
- **Description:** Confirmation that credentials were removed.

```json title="Return Payload Shape"
{
  "cleared": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('HTTP_AUTH_CLEAR_CREDENTIALS', { host: 'internal.corp.net' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
WebViewDatabase.getInstance(context).clearHttpAuthUsernamePassword()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
URLCredentialStorage.shared.allCredentials.forEach { ... }
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('HTTP_AUTH_CLEAR_CREDENTIALS', {'host': 'internal.corp.net'});
```

  </TabItem>
</Tabs>

