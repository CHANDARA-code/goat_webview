---
sidebar_position: 12
title: Domain 11 - Push Notifications
description: Complete API reference for Push Notifications (9 actions).
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Domain 11: Push Notifications

APNs / FCM push token retrieval, application notification badges, in-app local notification dispatch, and pub/sub topic subscriptions.

**Total Actions in Domain:** `9 actions`

---

## Action Summary

| # | Action String | Permission | Inputs | Returns |
| :--- | :--- | :--- | :--- | :--- |
| 1 | [`PUSH_GET_TOKEN`](#push-get-token) | `none` | `appId` | `PushTokenResult` |
| 2 | [`GET_PUSH_TOKEN`](#get-push-token) | `none` | `{}` | `PushTokenResult` |
| 3 | [`PUSH_REQUEST_PERMISSION`](#push-request-permission) | `none` | `{}` | `PushPermissionResult` |
| 4 | [`PUSH_SET_BADGE`](#push-set-badge) | `none` | `count` | `PushBadgeResult` |
| 5 | [`PUSH_SHOW_NOTIFICATION`](#push-show-notification) | `none` | `title`, `content`, `channelId`, `data` | `PushShowResult` |
| 6 | [`SUBSCRIBE_PUSH_TOPIC`](#subscribe-push-topic) | `none` | `topic` | `PushTopicResult` |
| 7 | [`UNSUBSCRIBE_PUSH_TOPIC`](#unsubscribe-push-topic) | `none` | `topic` | `PushTopicResult` |
| 8 | [`GET_PENDING_NOTIFICATIONS`](#get-pending-notifications) | `none` | `{}` | `PendingNotificationsResult` |
| 9 | [`CLEAR_NOTIFICATIONS`](#clear-notifications) | `none` | `{}` | `ClearNotificationsResult` |

---

## Action Specifications

---

### 1. `PUSH_GET_TOKEN` {#push-get-token}

Retrieves native APNs / Firebase Cloud Messaging (FCM) device push registration token.

**Purpose & Context:** Registers device token with mini-app backend for targeted push alerts and order updates.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `PUSH_GET_TOKEN`
- **Supported Aliases:** `push.getToken`, `getNotificationToken`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `appId` | `string` | No | - | Calling mini-app identifier. |


#### Return Value
- **Schema Type:** `PushTokenResult`
- **Description:** APNs hex device token or FCM registration token string.

```json title="Return Payload Shape"
{
  "token": "string",
  "appId": "string"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { token } = await goatBridge.callNative('PUSH_GET_TOKEN', {});
console.log('FCM / APNs Token:', token);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
FirebaseMessaging.getInstance().token.addOnSuccessListener { token -> reply(token) }
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Convert deviceToken NSData to hex string
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('PUSH_GET_TOKEN', {});
```

  </TabItem>
</Tabs>


---

### 2. `GET_PUSH_TOKEN` {#get-push-token}

Alias for PUSH_GET_TOKEN.

**Purpose & Context:** Standard alias for push token retrieval.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `GET_PUSH_TOKEN`
- **Supported Aliases:** `getPushToken`, `push.getPushToken`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `PushTokenResult`
- **Description:** Device push registration token.

```json title="Return Payload Shape"
{
  "token": "string",
  "appId": "string"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { token } = await goatBridge.callNative('GET_PUSH_TOKEN', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Query FCM token
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Query APNs token
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('GET_PUSH_TOKEN', {});
```

  </TabItem>
</Tabs>


---

### 3. `PUSH_REQUEST_PERMISSION` {#push-request-permission}

Requests notification delivery permissions from the host operating system (POST_NOTIFICATIONS on Android 13+, UNUserNotificationCenter on iOS).

**Purpose & Context:** Prompts user to enable incoming push alert banners.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `PUSH_REQUEST_PERMISSION`
- **Supported Aliases:** `push.requestPermission`, `requestNotificationPermission`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `android.permission.POST_NOTIFICATIONS`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `PushPermissionResult`
- **Description:** True if user granted notification permissions.

```json title="Return Payload Shape"
{
  "granted": "boolean"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `USER_CANCEL` | User tapped Don't Allow. | Direct user to OPEN_SETTING if required. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { granted } = await goatBridge.callNative('PUSH_REQUEST_PERMISSION', {});
if (granted) {
  // Notifications enabled
}
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
ActivityCompat.requestPermissions(activity, arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_CODE)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in }
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('PUSH_REQUEST_PERMISSION', {});
```

  </TabItem>
</Tabs>


---

### 4. `PUSH_SET_BADGE` {#push-set-badge}

Updates the numerical unread notification badge count on the host app launcher icon.

**Purpose & Context:** Displays unread message or item count on the home screen icon.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `PUSH_SET_BADGE`
- **Supported Aliases:** `push.setBadge`, `setBadge`, `setBadgeCount`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `count` | `number` | **Yes** | - | Badge count integer (0 clears badge). |


#### Return Value
- **Schema Type:** `PushBadgeResult`
- **Description:** Applied badge count.

```json title="Return Payload Shape"
{
  "updated": "boolean",
  "count": "number"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Count is not a valid non-negative integer. | Pass integer >= 0. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('PUSH_SET_BADGE', { count: 5 });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// ShortcutBadger.applyCount(context, count)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
UNUserNotificationCenter.current().setBadgeCount(count) { error in }
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('PUSH_SET_BADGE', {'count': 5});
```

  </TabItem>
</Tabs>


---

### 5. `PUSH_SHOW_NOTIFICATION` {#push-show-notification}

Dispatches an immediate in-app local notification banner into the system status bar shade.

**Purpose & Context:** Alerts user when long-running background tasks (downloads, exports) finish.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `PUSH_SHOW_NOTIFICATION`
- **Supported Aliases:** `push.showNotification`, `showNotification`, `showLocalNotification`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `android.permission.POST_NOTIFICATIONS`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `title` | `string` | **Yes** | - | Notification headline. |
| `content` | `string` | **Yes** | - | Notification body. |
| `channelId` | `string` | No | `"default"` | Notification channel identifier. |
| `data` | `any` | No | - | Custom payload delivered on tap. |


#### Return Value
- **Schema Type:** `PushShowResult`
- **Description:** Confirmation that local notification was scheduled.

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
await goatBridge.callNative('PUSH_SHOW_NOTIFICATION', {
  title: 'Download Complete',
  content: 'Your report report_2026.pdf is ready to view.',
  channelId: 'downloads'
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val builder = NotificationCompat.Builder(context, channelId)
    .setContentTitle(title)
    .setContentText(content)
    .setSmallIcon(R.drawable.ic_notification)
notificationManager.notify(101, builder.build())
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let content = UNMutableNotificationContent()
content.title = title
content.body = self.content
let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
UNUserNotificationCenter.current().add(request)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('PUSH_SHOW_NOTIFICATION', {
  'title': 'Download Complete',
  'content': 'Your report is ready.',
});
```

  </TabItem>
</Tabs>


---

### 6. `SUBSCRIBE_PUSH_TOPIC` {#subscribe-push-topic}

Subscribes device to a pub/sub broadcast notification topic (e.g. "flash_sales", "breaking_news").

**Purpose & Context:** Enables group topic broadcasts without individual token tracking.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `SUBSCRIBE_PUSH_TOPIC`
- **Supported Aliases:** `push.subscribeTopic`, `subscribePushTopic`, `subscribeTopic`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `topic` | `string` | **Yes** | - | Topic name string. |


#### Return Value
- **Schema Type:** `PushTopicResult`
- **Description:** Topic subscription confirmation.

```json title="Return Payload Shape"
{
  "subscribed": "boolean",
  "topic": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Topic string was empty. | Provide non-empty topic. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('SUBSCRIBE_PUSH_TOPIC', { topic: 'flash_deals' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
FirebaseMessaging.getInstance().subscribeToTopic(topic)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Register topic with APNs topic dispatcher
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('SUBSCRIBE_PUSH_TOPIC', {'topic': 'flash_deals'});
```

  </TabItem>
</Tabs>


---

### 7. `UNSUBSCRIBE_PUSH_TOPIC` {#unsubscribe-push-topic}

Unsubscribes device from a push broadcast topic.

**Purpose & Context:** Allows users to opt out of specific notification topics.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `UNSUBSCRIBE_PUSH_TOPIC`
- **Supported Aliases:** `push.unsubscribeTopic`, `unsubscribePushTopic`, `unsubscribeTopic`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `topic` | `string` | **Yes** | - | Topic name to leave. |


#### Return Value
- **Schema Type:** `PushTopicResult`
- **Description:** Confirmation of topic cancellation.

```json title="Return Payload Shape"
{
  "unsubscribed": "boolean",
  "topic": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Topic missing. | Specify topic name. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('UNSUBSCRIBE_PUSH_TOPIC', { topic: 'flash_deals' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
FirebaseMessaging.getInstance().unsubscribeFromTopic(topic)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Unregister topic from APNs dispatcher
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('UNSUBSCRIBE_PUSH_TOPIC', {'topic': 'flash_deals'});
```

  </TabItem>
</Tabs>


---

### 8. `GET_PENDING_NOTIFICATIONS` {#get-pending-notifications}

Retrieves array of queued or scheduled notifications waiting in the system tray.

**Purpose & Context:** Inspects upcoming alarms or pending reminder notifications.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `GET_PENDING_NOTIFICATIONS`
- **Supported Aliases:** `push.getPending`, `getPendingNotifications`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `PendingNotificationsResult`
- **Description:** List of pending notification items.

```json title="Return Payload Shape"
{
  "count": "number",
  "notifications": "any[]"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { count, notifications } = await goatBridge.callNative('GET_PENDING_NOTIFICATIONS', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val active = notificationManager.activeNotifications
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
UNUserNotificationCenter.current().getPendingNotificationRequests { requests in }
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('GET_PENDING_NOTIFICATIONS', {});
```

  </TabItem>
</Tabs>


---

### 9. `CLEAR_NOTIFICATIONS` {#clear-notifications}

Clears all delivered and pending notifications posted by this mini-app.

**Purpose & Context:** Cleans up status bar tray when user opens the app.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `CLEAR_NOTIFICATIONS`
- **Supported Aliases:** `push.clear`, `clearNotifications`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `ClearNotificationsResult`
- **Description:** Confirmation that notifications were dismissed.

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
await goatBridge.callNative('CLEAR_NOTIFICATIONS', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
notificationManager.cancelAll()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
UNUserNotificationCenter.current().removeAllDeliveredNotifications()
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('CLEAR_NOTIFICATIONS', {});
```

  </TabItem>
</Tabs>

