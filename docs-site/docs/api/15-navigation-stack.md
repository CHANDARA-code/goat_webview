---
sidebar_position: 16
title: Domain 15 - Navigation & Predictive Back
description: Complete API reference for Navigation & Predictive Back (12 actions).
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Domain 15: Navigation & Predictive Back 🔙

Multi-page navigation stack management (push, pop, replace, popToRoot) and Android 14+ / iOS 18+ predictive back gesture physics.

**Total Actions in Domain:** `12 actions`

---

## Action Summary

| # | Action String | Permission | Inputs | Returns |
| :--- | :--- | :--- | :--- | :--- |
| 1 | [`CAN_GO_BACK`](#can-go-back) | `none` | `{}` | `CanGoBackResult` |
| 2 | [`HANDLE_BACK_PRESS`](#handle-back-press) | `none` | `{}` | `BackNavigationResult` |
| 3 | [`PUSH_HISTORY_STATE`](#push-history-state) | `none` | `route` | `PushHistoryResult` |
| 4 | [`GET_CURRENT_ROUTE`](#get-current-route) | `none` | `{}` | `CurrentRouteResult` |
| 5 | [`NAV_PUSH`](#nav-push) | `none` | `route`, `title` | `PageStackResult` |
| 6 | [`NAV_POP`](#nav-pop) | `none` | `{}` | `PageStackResult` |
| 7 | [`NAV_POP_TO_ROOT`](#nav-pop-to-root) | `none` | `{}` | `PageStackResult` |
| 8 | [`NAV_REPLACE`](#nav-replace) | `none` | `route`, `title` | `PageStackResult` |
| 9 | [`GET_PAGE_STACK`](#get-page-stack) | `none` | `{}` | `PageStackListResult` |
| 10 | [`PREDICTIVE_BACK_PROGRESS`](#predictive-back-progress) | `none` | `progress`, `touchX`, `touchY`, `swipeEdge` | `PredictiveBackResult` |
| 11 | [`PREDICTIVE_BACK_INVOKE`](#predictive-back-invoke) | `none` | `{}` | `PredictiveBackInvokeResult` |
| 12 | [`PREDICTIVE_BACK_CANCEL`](#predictive-back-cancel) | `none` | `{}` | `PredictiveBackCancelResult` |

---

## Action Specifications

---

### 1. `CAN_GO_BACK` {#can-go-back}

Queries whether the active mini-app navigation history stack contains prior pages that can be popped.

**Purpose & Context:** Allows UI to conditionally render or hide the header Back chevron button.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `CAN_GO_BACK`
- **Supported Aliases:** `canGoBack`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `CanGoBackResult`
- **Description:** Back history availability.

```json title="Return Payload Shape"
{
  "canGoBack": "boolean",
  "currentRoute": "string"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { canGoBack } = await goatBridge.callNative('CAN_GO_BACK', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val canGoBack = webView.canGoBack() || pageStack.size > 1
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let canGoBack = webView.canGoBack || navigationController?.viewControllers.count ?? 0 > 1
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('CAN_GO_BACK', {});
```

  </TabItem>
</Tabs>


---

### 2. `HANDLE_BACK_PRESS` {#handle-back-press}

Simulates or triggers physical Android back button / swipe back gesture handling.

**Purpose & Context:** Standardizes back button event interceptors.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `HANDLE_BACK_PRESS`
- **Supported Aliases:** `handleBackPress`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `BackNavigationResult`
- **Description:** Result of back navigation pop.

```json title="Return Payload Shape"
{
  "action": "\"POP\"",
  "canGoBack": "boolean",
  "currentHistoryIndex": "number",
  "totalHistoryCount": "number",
  "routePopped": "string (optional)"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('HANDLE_BACK_PRESS', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
activity.onBackPressedDispatcher.onBackPressed()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
navigationController?.popViewController(animated: true)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('HANDLE_BACK_PRESS', {});
```

  </TabItem>
</Tabs>


---

### 3. `PUSH_HISTORY_STATE` {#push-history-state}

Pushes a new route state entry into the native page stack history without reloading the DOM.

**Purpose & Context:** Integrates Single Page Application (SPA) client-side routers (React Router, Vue Router) with native back gesture stack.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `PUSH_HISTORY_STATE`
- **Supported Aliases:** `pushHistoryState`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `route` | `string` | **Yes** | - | New route path (e.g. "/settings/profile"). |


#### Return Value
- **Schema Type:** `PushHistoryResult`
- **Description:** Updated history index position.

```json title="Return Payload Shape"
{
  "route": "string",
  "historyIndex": "number",
  "canGoBack": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('PUSH_HISTORY_STATE', { route: '/cart/checkout' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
pageStack.push(route)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
pageStack.append(route)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('PUSH_HISTORY_STATE', {'route': '/cart/checkout'});
```

  </TabItem>
</Tabs>


---

### 4. `GET_CURRENT_ROUTE` {#get-current-route}

Queries the current active path of the top-most page on the native stack.

**Purpose & Context:** Determines active page context for analytics logging and deep links.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `GET_CURRENT_ROUTE`
- **Supported Aliases:** `getCurrentRoute`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `CurrentRouteResult`
- **Description:** Current path string.

```json title="Return Payload Shape"
{
  "currentRoute": "string"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { currentRoute } = await goatBridge.callNative('GET_CURRENT_ROUTE', {});
console.log('Active page:', currentRoute);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val route = pageStack.peek() ?: "/"
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let route = pageStack.last ?? "/"
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('GET_CURRENT_ROUTE', {});
```

  </TabItem>
</Tabs>


---

### 5. `NAV_PUSH` {#nav-push}

Pushes a new separate WebView page onto the 120 FPS native multi-page stack.

**Purpose & Context:** Enables high-performance multi-WebView architectures where each page executes in its own isolated frame with zero DOM reflow.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `NAV_PUSH`
- **Supported Aliases:** `navPush`, `navigateTo`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `route` | `string` | **Yes** | - | Target destination route path. |
| `title` | `string` | No | - | Page header title. |


#### Return Value
- **Schema Type:** `PageStackResult`
- **Description:** Updated page stack descriptor.

```json title="Return Payload Shape"
{
  "action": "\"PUSH\"",
  "activePage": "PageStackEntryPayload",
  "stackDepth": "number",
  "canPop": "boolean",
  "totalCount": "number",
  "stack": "PageStackEntryPayload[]"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('NAV_PUSH', {
  route: '/details?id=101',
  title: 'Product Details'
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Instantiate and slide in new GoatWebViewPageFragment
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Push new GoatWebViewController with slide transition
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('NAV_PUSH', {
  'route': '/details?id=101',
  'title': 'Product Details',
});
```

  </TabItem>
</Tabs>


---

### 6. `NAV_POP` {#nav-pop}

Pops the top WebView page off the multi-page stack with native physics animation and disposes its DOM tree.

**Purpose & Context:** Navigates back to the previous screen.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `NAV_POP`
- **Supported Aliases:** `navPop`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `PageStackResult`
- **Description:** Updated stack after pop.

```json title="Return Payload Shape"
{
  "action": "\"POP\"",
  "activePage": "PageStackEntryPayload (optional)",
  "stackDepth": "number",
  "canPop": "boolean",
  "totalCount": "number",
  "stack": "PageStackEntryPayload[]"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('NAV_POP', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Pop top WebView and slide out
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
navigationController?.popViewController(animated: true)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('NAV_POP', {});
```

  </TabItem>
</Tabs>


---

### 7. `NAV_POP_TO_ROOT` {#nav-pop-to-root}

Pops all stacked sub-pages down to the root page container.

**Purpose & Context:** Quickly returns user to home screen or re-launches app upon checkout completion.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `NAV_POP_TO_ROOT`
- **Supported Aliases:** `navPopToRoot`, `reLaunch`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `PageStackResult`
- **Description:** Stack descriptor reset to root page.

```json title="Return Payload Shape"
{
  "action": "\"POP_TO_ROOT\"",
  "activePage": "PageStackEntryPayload",
  "stackDepth": "1",
  "canPop": "false",
  "totalCount": "1",
  "stack": "PageStackEntryPayload[]"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('NAV_POP_TO_ROOT', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Pop all fragments back to root
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
navigationController?.popToRootViewController(animated: true)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('NAV_POP_TO_ROOT', {});
```

  </TabItem>
</Tabs>


---

### 8. `NAV_REPLACE` {#nav-replace}

Replaces the current top page in the stack with a new destination route without altering stack depth.

**Purpose & Context:** Redirects from login to dashboard or switches main navigation tabs.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `NAV_REPLACE`
- **Supported Aliases:** `navReplace`, `redirectTo`, `switchTab`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `route` | `string` | **Yes** | - | Replacement route. |
| `title` | `string` | No | - | New page title. |


#### Return Value
- **Schema Type:** `PageStackResult`
- **Description:** Updated stack record.

```json title="Return Payload Shape"
{
  "action": "\"REPLACE\"",
  "activePage": "PageStackEntryPayload",
  "stackDepth": "number",
  "canPop": "boolean",
  "totalCount": "number",
  "stack": "PageStackEntryPayload[]"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('NAV_REPLACE', {
  route: '/dashboard',
  title: 'Dashboard'
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Replace active fragment
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Replace top view controller
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('NAV_REPLACE', {'route': '/dashboard'});
```

  </TabItem>
</Tabs>


---

### 9. `GET_PAGE_STACK` {#get-page-stack}

Inspects all active page entries currently in the multi-page navigation stack.

**Purpose & Context:** Debugs stack state and memory allocation across multi-page mini-app.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `GET_PAGE_STACK`
- **Supported Aliases:** `getPageStack`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `PageStackListResult`
- **Description:** Array of page entries (pageId, route, title, isSuspended).

```json title="Return Payload Shape"
{
  "totalCount": "number",
  "stack": "PageStackEntryPayload[]"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { stack, totalCount } = await goatBridge.callNative('GET_PAGE_STACK', {});
console.log('Stack depth:', totalCount, stack);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Return current page stack list
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Return view controller hierarchy list
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('GET_PAGE_STACK', {});
```

  </TabItem>
</Tabs>


---

### 10. `PREDICTIVE_BACK_PROGRESS` {#predictive-back-progress}

Feeds continuous touch gesture progress (0.0 to 1.0) into Android 14+ / iOS 18+ predictive back physics engine, interpolating scale, corner radius, and opacity.

**Purpose & Context:** Provides fluid interactive swipe-to-reveal preview of the underlying page before committing navigation.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `PREDICTIVE_BACK_PROGRESS`
- **Supported Aliases:** `predictiveBackProgress`, `enablePredictiveBack`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `progress` | `number` | **Yes** | - | Normalized swipe progress (0.0 to 1.0). |
| `touchX` | `number` | No | - | Touch X position in pixels. |
| `touchY` | `number` | No | - | Touch Y position in pixels. |
| `swipeEdge` | `number` | No | `0` | Swipe start edge (0=left, 1=right). |


#### Return Value
- **Schema Type:** `PredictiveBackResult`
- **Description:** Computed physics transforms for current gesture frame.

```json title="Return Payload Shape"
{
  "action": "\"PROGRESS\"",
  "progress": "number",
  "interpolatedScale": "number",
  "interpolatedAlpha": "number",
  "interpolatedTranslationX": "number",
  "canGoBackInWebView": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const frame = await goatBridge.callNative('PREDICTIVE_BACK_PROGRESS', {
  progress: 0.45,
  touchX: 180,
  swipeEdge: 0
});
console.log('Scale transform:', frame.interpolatedScale);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// OnBackAnimationCallback.onBackProgressed(BackEventCompat)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Interactive UIPercentDrivenInteractiveTransition update
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('PREDICTIVE_BACK_PROGRESS', {'progress': 0.45});
```

  </TabItem>
</Tabs>


---

### 11. `PREDICTIVE_BACK_INVOKE` {#predictive-back-invoke}

Finalizes the predictive back gesture by committing the pop transition.

**Purpose & Context:** Completes swipe back navigation.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `PREDICTIVE_BACK_INVOKE`
- **Supported Aliases:** `predictiveBackInvoke`, `onPredictiveBackGesture`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `PredictiveBackInvokeResult`
- **Description:** Confirmation that page was popped.

```json title="Return Payload Shape"
{
  "action": "\"INVOKE\"",
  "canGoBackInWebView": "boolean",
  "poppedRoute": "string (optional)"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('PREDICTIVE_BACK_INVOKE', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// OnBackAnimationCallback.onBackInvoked()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Finish interactive transition
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('PREDICTIVE_BACK_INVOKE', {});
```

  </TabItem>
</Tabs>


---

### 12. `PREDICTIVE_BACK_CANCEL` {#predictive-back-cancel}

Cancels the predictive back gesture and springs the active page back to fullscreen.

**Purpose & Context:** Aborts swipe back when user pulls back finger.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `PREDICTIVE_BACK_CANCEL`
- **Supported Aliases:** `predictiveBackCancel`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `PredictiveBackCancelResult`
- **Description:** Confirmation that spring-back animation completed.

```json title="Return Payload Shape"
{
  "action": "\"CANCEL\"",
  "canGoBackInWebView": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('PREDICTIVE_BACK_CANCEL', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// OnBackAnimationCallback.onBackCancelled()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Cancel interactive transition
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('PREDICTIVE_BACK_CANCEL', {});
```

  </TabItem>
</Tabs>

