---
sidebar_position: 11
title: Domain 10 - Contacts & Social Sharing
description: Complete API reference for Contacts & Social Sharing (5 actions).
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Domain 10: Contacts & Social Sharing 👥

Address book picker with privacy guardrails, contacts counter, system share sheet, and Instagram/Snapchat Story sharing.

**Total Actions in Domain:** `5 actions`

---

## Action Summary

| # | Action String | Permission | Inputs | Returns |
| :--- | :--- | :--- | :--- | :--- |
| 1 | [`CHOOSE_CONTACT`](#choose-contact) | `scope.address` | `{}` | `ContactResult` |
| 2 | [`PICK_CONTACTS`](#pick-contacts) | `scope.address` | `{}` | `ContactResult` |
| 3 | [`GET_CONTACTS_COUNT`](#get-contacts-count) | `scope.address` | `{}` | `ContactsCountResult` |
| 4 | [`SHARE_SHEET`](#share-sheet) | `none` | `title`, `text`, `url`, `mediaPath` | `ShareSheetResult` |
| 5 | [`SHARE_TO_STORY`](#share-to-story) | `none` | `mediaPath`, `backgroundTopColor`, `backgroundBottomColor`, `attributionUrl` | `ShareStoryResult` |

---

## Action Specifications

---

### 1. `CHOOSE_CONTACT` {#choose-contact}

Launches native contact picker allowing user to select a single contact without exposing the entire address book.

**Purpose & Context:** Enables contact selection for money transfers, airtime top-ups, and gift sending while preserving user privacy.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `CHOOSE_CONTACT`
- **Supported Aliases:** `chooseContact`, `pickContacts`
- **Permission Scope:** `scope.address`
- **Required Manifest Permissions:** `android.permission.READ_CONTACTS (optional)`, `NSContactsUsageDescription`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `ContactResult`
- **Description:** Selected contact name, normalized phone number, and email.

```json title="Return Payload Shape"
{
  "name": "string",
  "phoneNumber": "string",
  "email": "string (optional)"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `PERMISSION_DENIED` | Contacts permission denied. | Request scope.address. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const contact = await goatBridge.callNative('CHOOSE_CONTACT', {});
console.log('Recipient:', contact.name, contact.phoneNumber);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// ActivityResultContracts.PickContact()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// CNContactPickerViewController
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('CHOOSE_CONTACT', {});
```

  </TabItem>
</Tabs>


---

### 2. `PICK_CONTACTS` {#pick-contacts}

Alias for CHOOSE_CONTACT.

**Purpose & Context:** Standard alias for address book contact selection.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `PICK_CONTACTS`
- **Supported Aliases:** `pickContacts`
- **Permission Scope:** `scope.address`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `ContactResult`
- **Description:** Chosen contact details.

```json title="Return Payload Shape"
{
  "name": "string",
  "phoneNumber": "string",
  "email": "string (optional)"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const contact = await goatBridge.callNative('PICK_CONTACTS', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Launch contact picker
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Present CNContactPickerViewController
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('PICK_CONTACTS', {});
```

  </TabItem>
</Tabs>


---

### 3. `GET_CONTACTS_COUNT` {#get-contacts-count}

Returns the total number of contacts available in the device address book.

**Purpose & Context:** Checks if address book is populated before suggesting contact import.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `GET_CONTACTS_COUNT`
- **Supported Aliases:** `getContactsCount`
- **Permission Scope:** `scope.address`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `ContactsCountResult`
- **Description:** Total number of contacts.

```json title="Return Payload Shape"
{
  "count": "number"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `PERMISSION_DENIED` | Contacts permission not granted. | Request scope.address. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { count } = await goatBridge.callNative('GET_CONTACTS_COUNT', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Query ContactsContract count
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// CNContactStore count
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('GET_CONTACTS_COUNT', {});
```

  </TabItem>
</Tabs>


---

### 4. `SHARE_SHEET` {#share-sheet}

Displays the native system share sheet (UIActivityViewController on iOS, Intent.ACTION_SEND on Android).

**Purpose & Context:** Enables sharing referral links, product cards, or photos to WhatsApp, Telegram, iMessage, and Twitter.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `SHARE_SHEET`
- **Supported Aliases:** `shareSheet`, `share`, `shareAppMessage`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `title` | `string` | No | - | Share card title. |
| `text` | `string` | No | - | Share message body. |
| `url` | `string` | No | - | Share link URL. |
| `mediaPath` | `string` | No | - | Local image/file path to share. |


#### Return Value
- **Schema Type:** `ShareSheetResult`
- **Description:** Confirmation and target app activity name.

```json title="Return Payload Shape"
{
  "shared": "boolean",
  "activityType": "string (optional)"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('SHARE_SHEET', {
  title: 'Check out Goat WebView',
  text: 'High-performance mini-app engine with 120 FPS rendering!',
  url: 'https://goat-webview.github.io'
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val intent = Intent(Intent.ACTION_SEND).apply {
    type = "text/plain"
    putExtra(Intent.EXTRA_TEXT, text)
}
context.startActivity(Intent.createChooser(intent, title))
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let activityVC = UIActivityViewController(activityItems: [text, URL(string: url)!], applicationActivities: nil)
present(activityVC, animated: true)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('SHARE_SHEET', {
  'title': 'Check out Goat WebView',
  'url': 'https://goat-webview.github.io',
});
```

  </TabItem>
</Tabs>


---

### 5. `SHARE_TO_STORY` {#share-to-story}

Directly shares media sticker and background assets into Instagram Stories or Snapchat Story.

**Purpose & Context:** Enables high-conversion viral social story sharing with interactive attribution link.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `SHARE_TO_STORY`
- **Supported Aliases:** `shareToStory`, `shareToTimeline`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `mediaPath` | `string` | **Yes** | - | Path to background image/video asset. |
| `backgroundTopColor` | `string` | No | `"#3b82f6"` | Gradient top hex color. |
| `backgroundBottomColor` | `string` | No | `"#1d4ed8"` | Gradient bottom hex color. |
| `attributionUrl` | `string` | No | - | Deep link back into mini-app. |


#### Return Value
- **Schema Type:** `ShareStoryResult`
- **Description:** Status of Story app launch.

```json title="Return Payload Shape"
{
  "shared": "boolean"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | mediaPath missing. | Provide path to media. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('SHARE_TO_STORY', {
  mediaPath: 'photos/badge.png',
  backgroundTopColor: '#6366f1',
  attributionUrl: 'https://miniapp.example.com'
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Intent for com.instagram.share.ADD_TO_STORY
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// UIPasteboard item for instagram-stories://share
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('SHARE_TO_STORY', {
  'mediaPath': 'photos/badge.png',
});
```

  </TabItem>
</Tabs>

