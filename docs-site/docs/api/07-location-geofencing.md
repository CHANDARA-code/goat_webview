---
sidebar_position: 8
title: Domain 7 - Location & Geofencing
description: Complete API reference for Location & Geofencing (7 actions).
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Domain 7: Location & Geofencing

High-accuracy GPS positioning (WGS84 / GCJ02), map location pickers, and circular geofence boundary transition triggers.

**Total Actions in Domain:** `7 actions`

---

## Action Summary

| # | Action String | Permission | Inputs | Returns |
| :--- | :--- | :--- | :--- | :--- |
| 1 | [`GET_LOCATION`](#get-location) | `scope.userLocation` | `type`, `altitude`, `highAccuracy`, `highAccuracyExpireTime` | `LocationData` |
| 2 | [`CHOOSE_LOCATION`](#choose-location) | `scope.userLocation` | `{}` | `ChooseLocationResult` |
| 3 | [`OPEN_LOCATION`](#open-location) | `none` | `latitude`, `longitude`, `scale`, `name`, `address` | `OpenLocationResult` |
| 4 | [`START_GEOFENCE`](#start-geofence) | `scope.userLocation` | `geofenceId`, `latitude`, `longitude`, `radiusMeters`, `transitionType` | `GeofenceStartResult` |
| 5 | [`STOP_GEOFENCE`](#stop-geofence) | `scope.userLocation` | `geofenceId` | `GeofenceStopResult` |
| 6 | [`LIST_GEOFENCES`](#list-geofences) | `scope.userLocation` | `{}` | `GeofenceListResult` |
| 7 | [`EVALUATE_GEOFENCE`](#evaluate-geofence) | `scope.userLocation` | `latitude`, `longitude` | `GeofenceTransitionResult` |

---

## Action Specifications

---

### 1. `GET_LOCATION` {#get-location}

Retrieves current geographical coordinates (latitude, longitude, speed, altitude, accuracy) with WGS84 and GCJ02 support under active user permission and gesture gate.

**Purpose & Context:** Enables ride-hailing pickup, food delivery address detection, and nearby store locators.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `GET_LOCATION`
- **Supported Aliases:** `getLocation`
- **Permission Scope:** `scope.userLocation`
- **Required Manifest Permissions:** `android.permission.ACCESS_FINE_LOCATION`, `android.permission.ACCESS_COARSE_LOCATION`, `NSLocationWhenInUseUsageDescription`
- **Security Constraint:** Warning: **Active User Gesture Required** (User touch within &lt;10s)

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `type` | `"wgs84" \| "gcj02"` | No | `"wgs84"` | Coordinate datum standard. |
| `altitude` | `boolean` | No | `false` | Include altitude elevation. |
| `highAccuracy` | `boolean` | No | `true` | Force GPS high accuracy mode. |
| `highAccuracyExpireTime` | `number` | No | `3000` | High accuracy timeout in ms. |


#### Return Value
- **Schema Type:** `LocationData`
- **Description:** Geographic coordinate object.

```json title="Return Payload Shape"
{
  "latitude": "number",
  "longitude": "number",
  "speed": "number",
  "accuracy": "number",
  "altitude": "number",
  "verticalAccuracy": "number (optional)",
  "horizontalAccuracy": "number (optional)"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `PERMISSION_DENIED` | User denied location permission request or system location services disabled. | Prompt user to grant location permission using REQUEST_PERMISSION. |
| `GESTURE_REQUIRED` | GET_LOCATION invoked in background without recent user gesture. | Call GET_LOCATION directly within user click/tap handler. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const loc = await goatBridge.callNative('GET_LOCATION', {
  type: 'wgs84',
  highAccuracy: true
});
console.log(`Lat: ${loc.latitude}, Lon: ${loc.longitude}, Accuracy: ${loc.accuracy}m`);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null).addOnSuccessListener { ... }
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
locationManager.requestLocation()
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final loc = await goatController.callNativeAction('GET_LOCATION', {
  'type': 'wgs84',
  'highAccuracy': true,
});
```

  </TabItem>
</Tabs>


---

### 2. `CHOOSE_LOCATION` {#choose-location}

Presents a native full-screen interactive map picker for choosing a physical point of interest or custom address.

**Purpose & Context:** Allows users to visually select delivery addresses or meeting spots on a map.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `CHOOSE_LOCATION`
- **Supported Aliases:** `chooseLocation`
- **Permission Scope:** `scope.userLocation`
- **Required Manifest Permissions:** `android.permission.ACCESS_FINE_LOCATION`, `NSLocationWhenInUseUsageDescription`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `ChooseLocationResult`
- **Description:** Selected location details.

```json title="Return Payload Shape"
{
  "name": "string",
  "address": "string",
  "latitude": "number",
  "longitude": "number"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `PERMISSION_DENIED` | Location permission was denied. | Request scope.userLocation. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const poi = await goatBridge.callNative('CHOOSE_LOCATION', {});
console.log('Selected POI:', poi.name, poi.address);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Launch MapPickerActivity
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Present MKLocalSearch or MapPickerViewController
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('CHOOSE_LOCATION', {});
```

  </TabItem>
</Tabs>


---

### 3. `OPEN_LOCATION` {#open-location}

Opens native system map application (Google Maps / Apple Maps) centered at designated coordinates.

**Purpose & Context:** Directs user to navigate to merchant location in external turn-by-turn navigation apps.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `OPEN_LOCATION`
- **Supported Aliases:** `openLocation`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `latitude` | `number` | **Yes** | - | Destination latitude. |
| `longitude` | `number` | **Yes** | - | Destination longitude. |
| `scale` | `number` | No | `14` | Map zoom scale (5 to 18). |
| `name` | `string` | No | - | Location POI label. |
| `address` | `string` | No | - | Detailed street address. |


#### Return Value
- **Schema Type:** `OpenLocationResult`
- **Description:** Status of map intent launch.

```json title="Return Payload Shape"
{
  "opened": "boolean",
  "latitude": "number",
  "longitude": "number"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | Invalid latitude or longitude. | Provide valid coordinate numbers. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('OPEN_LOCATION', {
  latitude: 37.7749,
  longitude: -122.4194,
  name: 'San Francisco HQ',
  address: '1 Market St, San Francisco, CA'
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val gmmIntentUri = Uri.parse("geo:$latitude,$longitude?q=" + Uri.encode(name))
context.startActivity(Intent(Intent.ACTION_VIEW, gmmIntentUri))
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let mapItem = MKMapItem(placemark: MKPlacemark(coordinate: CLLocationCoordinate2D(latitude: latitude, longitude: longitude)))
mapItem.name = name
mapItem.openInMaps()
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('OPEN_LOCATION', {
  'latitude': 37.7749,
  'longitude': -122.4194,
  'name': 'San Francisco HQ',
});
```

  </TabItem>
</Tabs>


---

### 4. `START_GEOFENCE` {#start-geofence}

Registers a circular geofence boundary zone for background transition monitoring (ENTER / EXIT).

**Purpose & Context:** Triggers proximity discounts, store arrival notifications, or automated check-ins.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `START_GEOFENCE`
- **Supported Aliases:** `startGeofence`, `geofence`
- **Permission Scope:** `scope.userLocation`
- **Required Manifest Permissions:** `android.permission.ACCESS_FINE_LOCATION`, `android.permission.ACCESS_BACKGROUND_LOCATION`, `NSLocationAlwaysAndWhenInUseUsageDescription`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `geofenceId` | `string` | **Yes** | - | Unique zone identifier. |
| `latitude` | `number` | **Yes** | - | Zone center latitude. |
| `longitude` | `number` | **Yes** | - | Zone center longitude. |
| `radiusMeters` | `number` | No | `200` | Circular boundary radius in meters. |
| `transitionType` | `"ENTER" \| "EXIT" \| "BOTH"` | No | `"BOTH"` | Trigger transition events. |


#### Return Value
- **Schema Type:** `GeofenceStartResult`
- **Description:** Confirmation that geofence is active.

```json title="Return Payload Shape"
{
  "started": "boolean",
  "geofenceId": "string",
  "radiusMeters": "number"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | geofenceId or coordinates missing. | Provide valid geofenceId, latitude, and longitude. |
| `PERMISSION_DENIED` | Background location permission missing. | Request background location scope. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('START_GEOFENCE', {
  geofenceId: 'store_downtown',
  latitude: 37.7749,
  longitude: -122.4194,
  radiusMeters: 250,
  transitionType: 'BOTH'
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val geofence = Geofence.Builder()
    .setRequestId(geofenceId)
    .setCircularRegion(latitude, longitude, radiusMeters)
    .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER or Geofence.GEOFENCE_TRANSITION_EXIT)
    .build()
geofencingClient.addGeofences(request, pendingIntent)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let region = CLCircularRegion(center: CLLocationCoordinate2D(latitude: latitude, longitude: longitude), radius: radiusMeters, identifier: geofenceId)
locationManager.startMonitoring(for: region)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('START_GEOFENCE', {
  'geofenceId': 'store_downtown',
  'latitude': 37.7749,
  'longitude': -122.4194,
});
```

  </TabItem>
</Tabs>


---

### 5. `STOP_GEOFENCE` {#stop-geofence}

Removes an active circular geofence zone.

**Purpose & Context:** Cleans up location monitoring when leaving an area.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `STOP_GEOFENCE`
- **Supported Aliases:** `stopGeofence`
- **Permission Scope:** `scope.userLocation`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `geofenceId` | `string` | **Yes** | - | Geofence identifier to remove. |


#### Return Value
- **Schema Type:** `GeofenceStopResult`
- **Description:** Status of geofence removal.

```json title="Return Payload Shape"
{
  "stopped": "boolean",
  "geofenceId": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | geofenceId missing. | Specify geofenceId. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('STOP_GEOFENCE', { geofenceId: 'store_downtown' });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
geofencingClient.removeGeofences(listOf(geofenceId))
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// locationManager.stopMonitoring(for: region)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('STOP_GEOFENCE', {'geofenceId': 'store_downtown'});
```

  </TabItem>
</Tabs>


---

### 6. `LIST_GEOFENCES` {#list-geofences}

Queries all currently active monitored geofence regions.

**Purpose & Context:** Inspects active perimeter boundaries.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `LIST_GEOFENCES`
- **Supported Aliases:** `listGeofences`
- **Permission Scope:** `scope.userLocation`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `GeofenceListResult`
- **Description:** Array of active geofence zones.

```json title="Return Payload Shape"
{
  "geofences": "GeofenceRegionResult[]"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { geofences } = await goatBridge.callNative('LIST_GEOFENCES', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Query active geofence list
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let regions = locationManager.monitoredRegions
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('LIST_GEOFENCES', {});
```

  </TabItem>
</Tabs>


---

### 7. `EVALUATE_GEOFENCE` {#evaluate-geofence}

Manually tests current coordinate against registered geofence zones and returns transition events using Haversine calculation.

**Purpose & Context:** Simulates or performs client-side geofence boundary testing.

#### Platform Support Matrix
`Android: [Supported]` `iOS: [Supported]` `React Native: [Supported]` `Flutter: [Supported]` `Web Mock: [Supported]`

#### Aliases & Method Signatures
- **Canonical Action String:** `EVALUATE_GEOFENCE`
- **Supported Aliases:** `evaluateGeofence`, `onLocationChange`
- **Permission Scope:** `scope.userLocation`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** [Supported] **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `latitude` | `number` | **Yes** | - | Test latitude. |
| `longitude` | `number` | **Yes** | - | Test longitude. |


#### Return Value
- **Schema Type:** `GeofenceTransitionResult`
- **Description:** List of boundary crossing events.

```json title="Return Payload Shape"
{
  "events": "Array<{ geofenceId: string, transition: \"ENTER\" | \"EXIT\" }>"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const transitions = await goatBridge.callNative('EVALUATE_GEOFENCE', {
  latitude: 37.7749,
  longitude: -122.4194
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Evaluate distanceTo across geofence centers
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Evaluate coordinate against monitored regions
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('EVALUATE_GEOFENCE', {
  'latitude': 37.7749,
  'longitude': -122.4194,
});
```

  </TabItem>
</Tabs>

