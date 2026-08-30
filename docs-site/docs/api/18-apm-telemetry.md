---
sidebar_position: 19
title: Domain 18 - APM & Telemetry
description: Complete API reference for APM & Telemetry (14 actions).
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Domain 18: APM & Telemetry 📊

Runtime API capability discovery, dynamic plugin registration, isolated process status, boot SLA benchmark metrics, and OpenTelemetry spans.

**Total Actions in Domain:** `14 actions`

---

## Action Summary

| # | Action String | Permission | Inputs | Returns |
| :--- | :--- | :--- | :--- | :--- |
| 1 | [`GET_API_CAPABILITIES`](#get-api-capabilities) | `none` | `category` | `ApiCapabilitiesResult` |
| 2 | [`REGISTER_CAPABILITY`](#register-capability) | `none` | `actionName`, `category`, `isSupported` | `RegisterCapabilityResult` |
| 3 | [`GET_SANDBOX_PROCESS_STATUS`](#get-sandbox-process-status) | `none` | `appId` | `ProcessSandboxStatusResult` |
| 4 | [`GET_STARTUP_BENCHMARK_REPORT`](#get-startup-benchmark-report) | `none` | `{}` | `StartupBenchmarkReportResult` |
| 5 | [`RECORD_STARTUP_BENCHMARK_SAMPLE`](#record-startup-benchmark-sample) | `none` | `coldStartTimeMs`, `warmStartTimeMs` | `RecordSampleResult` |
| 6 | [`REPORT_METRICS`](#report-metrics) | `none` | `fcpMs`, `lcpMs`, `inpMs`, `cls`, `domCompleteMs`, `bridgeLatencyAvgMs` | `ApmMetricReportResult` |
| 7 | [`SEND_APM_METRIC`](#send-apm-metric) | `none` | `fcpMs`, `lcpMs` | `ApmMetricReportResult` |
| 8 | [`GET_APM_METRICS`](#get-apm-metrics) | `none` | `{}` | `ApmSummaryResult` |
| 9 | [`GET_APM_SUMMARY`](#get-apm-summary) | `none` | `{}` | `ApmSummaryResult` |
| 10 | [`RECORD_BRIDGE_TIMING`](#record-bridge-timing) | `none` | `action`, `durationMs` | `BridgeTimingResult` |
| 11 | [`START_TRACE`](#start-trace) | `none` | `operationName` | `OpenTelemetrySpanResult` |
| 12 | [`STOP_TRACE`](#stop-trace) | `none` | `spanId` | `SpanStopResult` |
| 13 | [`GET_TRACES`](#get-traces) | `none` | `{}` | `TracesListResult` |
| 14 | [`GET_MEMORY_METRICS`](#get-memory-metrics) | `none` | `{}` | `MemoryMetricsResult` |

---

## Action Specifications

---

### 1. `GET_API_CAPABILITIES` {#get-api-capabilities}

Introspects full matrix of native bridge actions supported by the current host version.

**Purpose & Context:** Enables dynamic feature detection and capabilities discovery across host platforms.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `GET_API_CAPABILITIES`
- **Supported Aliases:** `getApiCapabilities`, `getBridgeVersion`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `category` | `string` | No | - | Optional domain category filter. |


#### Return Value
- **Schema Type:** `ApiCapabilitiesResult`
- **Description:** Array of capabilities with support flags.

```json title="Return Payload Shape"
{
  "totalCapabilities": "number",
  "capabilities": "ApiCapabilityResult[]"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const { capabilities, totalCapabilities } = await goatBridge.callNative('GET_API_CAPABILITIES', {});
console.log(`Host supports ${totalCapabilities} native bridge actions`);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Query registered action handlers
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Query registered actions map
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('GET_API_CAPABILITIES', {});
```

  </TabItem>
</Tabs>


---

### 2. `REGISTER_CAPABILITY` {#register-capability}

Dynamically registers a custom SPI capability plugin handler at runtime.

**Purpose & Context:** Allows third-party SDKs to extend the Goat bridge with domain-specific native capabilities.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `REGISTER_CAPABILITY`
- **Supported Aliases:** `registerCapability`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `actionName` | `string` | **Yes** | - | Custom action string name. |
| `category` | `string` | No | - | Domain category label. |
| `isSupported` | `boolean` | No | `true` | Support flag. |


#### Return Value
- **Schema Type:** `RegisterCapabilityResult`
- **Description:** Registration status.

```json title="Return Payload Shape"
{
  "registered": "boolean",
  "actionName": "string"
}
```

#### Error Codes & Troubleshooting
| Error Code | Meaning | Troubleshooting |
| :--- | :--- | :--- |
| `INVALID_ARGUMENT` | actionName was missing. | Provide actionName. |


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('REGISTER_CAPABILITY', {
  actionName: 'CUSTOM_PRINTER_PRINT',
  category: 'Hardware'
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
bridge.registerCustomHandler(actionName) { ... }
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
bridge.registerHandler(action: actionName) { ... }
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('REGISTER_CAPABILITY', {'actionName': 'CUSTOM_PRINTER_PRINT'});
```

  </TabItem>
</Tabs>


---

### 3. `GET_SANDBOX_PROCESS_STATUS` {#get-sandbox-process-status}

Queries OS process health, isolated render process PID, and memory initialization state for the calling appId.

**Purpose & Context:** Verifies out-of-process multi-tenant renderer isolation.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `GET_SANDBOX_PROCESS_STATUS`
- **Supported Aliases:** `getSandboxProcessStatus`, `getProcessStatus`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `appId` | `string` | No | - | Calling appId. |


#### Return Value
- **Schema Type:** `ProcessSandboxStatusResult`
- **Description:** Host renderer process state descriptor.

```json title="Return Payload Shape"
{
  "pid": "number",
  "isAlive": "boolean",
  "isInitialized": "boolean",
  "activeAppId": "string",
  "isolatedProcessName": "string"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const status = await goatBridge.callNative('GET_SANDBOX_PROCESS_STATUS', {});
console.log('Renderer PID:', status.pid, 'Process:', status.isolatedProcessName);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val pid = android.os.Process.myPid()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let pid = ProcessInfo.processInfo.processIdentifier
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('GET_SANDBOX_PROCESS_STATUS', {});
```

  </TabItem>
</Tabs>


---

### 4. `GET_STARTUP_BENCHMARK_REPORT` {#get-startup-benchmark-report}

Generates comprehensive boot performance metrics report (cold boot time, warm boot time, memory delta, SLA compliance).

**Purpose & Context:** Verifies mini-app launches under the strict &lt;50ms warm boot SLA target.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `GET_STARTUP_BENCHMARK_REPORT`
- **Supported Aliases:** `getStartupBenchmarkReport`, `getStartupPerformance`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `StartupBenchmarkReportResult`
- **Description:** Boot SLA compliance metrics.

```json title="Return Payload Shape"
{
  "coldStartTimeMs": "number",
  "warmStartTimeMs": "number",
  "memoryDeltaMb": "number",
  "isColdBootWithinSla": "boolean",
  "isWarmBootWithinSla": "boolean",
  "isMemoryWithinSla": "boolean",
  "totalSamples": "number"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const report = await goatBridge.callNative('GET_STARTUP_BENCHMARK_REPORT', {});
console.log(`Cold boot: ${report.coldStartTimeMs}ms, SLA Pass: ${report.isColdBootWithinSla}`);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Query BenchmarkTracker report
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Query benchmark metrics report
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final report = await goatController.callNativeAction('GET_STARTUP_BENCHMARK_REPORT', {});
```

  </TabItem>
</Tabs>


---

### 5. `RECORD_STARTUP_BENCHMARK_SAMPLE` {#record-startup-benchmark-sample}

Records a cold or warm boot startup timing sample into the APM database.

**Purpose & Context:** Aggregates launch performance statistics.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `RECORD_STARTUP_BENCHMARK_SAMPLE`
- **Supported Aliases:** `recordStartupBenchmarkSample`, `recordStartupSample`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `coldStartTimeMs` | `number` | No | - | Cold boot duration in ms. |
| `warmStartTimeMs` | `number` | No | - | Warm boot duration in ms. |


#### Return Value
- **Schema Type:** `RecordSampleResult`
- **Description:** Sample recording confirmation.

```json title="Return Payload Shape"
{
  "recorded": "boolean",
  "coldStartTimeMs": "number",
  "warmStartTimeMs": "number"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('RECORD_STARTUP_BENCHMARK_SAMPLE', {
  coldStartTimeMs: 142,
  warmStartTimeMs: 38
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
benchmarkTracker.recordSample(coldStartTimeMs, warmStartTimeMs)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
benchmarkTracker.record(cold: coldStartTimeMs, warm: warmStartTimeMs)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('RECORD_STARTUP_BENCHMARK_SAMPLE', {'coldStartTimeMs': 142});
```

  </TabItem>
</Tabs>


---

### 6. `REPORT_METRICS` {#report-metrics}

Ingests Core Web Vitals (FCP, LCP, INP, CLS), DOM complete duration, and average bridge IPC latency metrics.

**Purpose & Context:** Persists application performance monitoring (APM) telemetry and flags SLA violations.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `REPORT_METRICS`
- **Supported Aliases:** `reportMetrics`, `reportApmMetric`, `sendApmMetric`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `fcpMs` | `number` | No | - | First Contentful Paint in ms. |
| `lcpMs` | `number` | No | - | Largest Contentful Paint in ms. |
| `inpMs` | `number` | No | - | Interaction to Next Paint in ms. |
| `cls` | `number` | No | - | Cumulative Layout Shift score. |
| `domCompleteMs` | `number` | No | - | DOM complete timestamp in ms. |
| `bridgeLatencyAvgMs` | `number` | No | - | Average native bridge round-trip in ms. |


#### Return Value
- **Schema Type:** `ApmMetricReportResult`
- **Description:** Audit result and violation flag.

```json title="Return Payload Shape"
{
  "recorded": "boolean",
  "id": "string",
  "isSlaViolation": "boolean",
  "violationReason": "string (optional)"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('REPORT_METRICS', {
  fcpMs: 320,
  lcpMs: 850,
  inpMs: 45,
  cls: 0.02,
  bridgeLatencyAvgMs: 2.4
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
apmManager.recordMetrics(metrics)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
apmManager.record(metrics: metrics)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('REPORT_METRICS', {'fcpMs': 320, 'lcpMs': 850});
```

  </TabItem>
</Tabs>


---

### 7. `SEND_APM_METRIC` {#send-apm-metric}

Alias for REPORT_METRICS.

**Purpose & Context:** Standard alias for reporting APM web vital metrics.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `SEND_APM_METRIC`
- **Supported Aliases:** `sendApmMetric`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `fcpMs` | `number` | No | - | First Contentful Paint. |
| `lcpMs` | `number` | No | - | Largest Contentful Paint. |


#### Return Value
- **Schema Type:** `ApmMetricReportResult`
- **Description:** Metrics record confirmation.

```json title="Return Payload Shape"
{
  "recorded": "boolean",
  "id": "string",
  "isSlaViolation": "boolean"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('SEND_APM_METRIC', { fcpMs: 280, lcpMs: 650 });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Record APM metric
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Record APM metric
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('SEND_APM_METRIC', {'fcpMs': 280});
```

  </TabItem>
</Tabs>


---

### 8. `GET_APM_METRICS` {#get-apm-metrics}

Queries aggregated APM summary statistics across all recorded telemetry samples.

**Purpose & Context:** Provides performance dashboard metrics for in-app DevMenu and inspector.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `GET_APM_METRICS`
- **Supported Aliases:** `getApmMetrics`, `getApmSummary`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `ApmSummaryResult`
- **Description:** Performance summary averages.

```json title="Return Payload Shape"
{
  "totalReports": "number",
  "avgFcpMs": "number",
  "avgLcpMs": "number",
  "avgBridgeLatencyMs": "number",
  "totalSlaViolations": "number"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const summary = await goatBridge.callNative('GET_APM_METRICS', {});
console.log('Avg FCP:', summary.avgFcpMs, 'Avg Bridge Latency:', summary.avgBridgeLatencyMs);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val summary = apmManager.getSummary()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let summary = apmManager.summary
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final summary = await goatController.callNativeAction('GET_APM_METRICS', {});
```

  </TabItem>
</Tabs>


---

### 9. `GET_APM_SUMMARY` {#get-apm-summary}

Alias for GET_APM_METRICS.

**Purpose & Context:** Compatibility alias for APM summary query.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `GET_APM_SUMMARY`
- **Supported Aliases:** `getApmSummary`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `ApmSummaryResult`
- **Description:** Summary metrics.

```json title="Return Payload Shape"
{
  "totalReports": "number",
  "avgFcpMs": "number",
  "avgLcpMs": "number",
  "avgBridgeLatencyMs": "number",
  "totalSlaViolations": "number"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const summary = await goatBridge.callNative('GET_APM_SUMMARY', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Return APM summary
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Return summary
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('GET_APM_SUMMARY', {});
```

  </TabItem>
</Tabs>


---

### 10. `RECORD_BRIDGE_TIMING` {#record-bridge-timing}

Logs IPC call execution latency and microsecond duration for a specific bridge action.

**Purpose & Context:** Profiles bridge IPC bottlenecks and tracks round-trip overhead.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `RECORD_BRIDGE_TIMING`
- **Supported Aliases:** `recordBridgeTiming`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `action` | `string` | **Yes** | - | Action string measured. |
| `durationMs` | `number` | No | `1.2` | Execution duration in milliseconds. |


#### Return Value
- **Schema Type:** `BridgeTimingResult`
- **Description:** Timing record confirmation.

```json title="Return Payload Shape"
{
  "recorded": "boolean",
  "action": "string",
  "durationMs": "number",
  "id": "string"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('RECORD_BRIDGE_TIMING', {
  action: 'STORAGE_GET',
  durationMs: 0.8
});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
apmManager.recordBridgeTiming(action, durationMs)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
apmManager.recordTiming(action: action, duration: durationMs)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('RECORD_BRIDGE_TIMING', {'action': 'STORAGE_GET'});
```

  </TabItem>
</Tabs>


---

### 11. `START_TRACE` {#start-trace}

Initiates a W3C OpenTelemetry distributed tracing span with valid traceparent header generation.

**Purpose & Context:** Correlates frontend mini-app user interactions with backend microservice API traces.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `START_TRACE`
- **Supported Aliases:** `startTrace`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `operationName` | `string` | No | `"mini_app_operation"` | Span operation name. |


#### Return Value
- **Schema Type:** `OpenTelemetrySpanResult`
- **Description:** W3C trace context with traceparent header.

```json title="Return Payload Shape"
{
  "traceparent": "string",
  "traceId": "string",
  "spanId": "string",
  "operationName": "string",
  "startTimeMs": "number"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const span = await goatBridge.callNative('START_TRACE', { operationName: 'checkout_flow' });
// Attach span.traceparent to outbound fetch headers:
// headers: { 'traceparent': span.traceparent }
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val span = tracer.spanBuilder(operationName).startSpan()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
let span = tracer.startSpan(name: operationName)
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final span = await goatController.callNativeAction('START_TRACE', {'operationName': 'checkout_flow'});
```

  </TabItem>
</Tabs>


---

### 12. `STOP_TRACE` {#stop-trace}

Ends an active OpenTelemetry tracing span and calculates total duration.

**Purpose & Context:** Completes distributed tracing span.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `STOP_TRACE`
- **Supported Aliases:** `stopTrace`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `spanId` | `string` | **Yes** | - | Span identifier returned by START_TRACE. |


#### Return Value
- **Schema Type:** `SpanStopResult`
- **Description:** Span duration and closure status.

```json title="Return Payload Shape"
{
  "stopped": "boolean",
  "spanId": "string",
  "durationMs": "number"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
await goatBridge.callNative('STOP_TRACE', { spanId: span.spanId });
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
span.end()
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
span.end()
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
await goatController.callNativeAction('STOP_TRACE', {'spanId': 'span_123'});
```

  </TabItem>
</Tabs>


---

### 13. `GET_TRACES` {#get-traces}

Queries active and completed OpenTelemetry trace spans.

**Purpose & Context:** Inspects trace spans for performance diagnostics.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `GET_TRACES`
- **Supported Aliases:** `getTraces`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `TracesListResult`
- **Description:** Span count statistics.

```json title="Return Payload Shape"
{
  "activeSpanCount": "number",
  "completedSpanCount": "number"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const traces = await goatBridge.callNative('GET_TRACES', {});
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
// Query trace repository
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// Query trace storage
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('GET_TRACES', {});
```

  </TabItem>
</Tabs>


---

### 14. `GET_MEMORY_METRICS` {#get-memory-metrics}

Queries real-time host RAM allocation metrics (total memory, free memory, used memory in megabytes).

**Purpose & Context:** Monitors memory consumption to preempt Out-Of-Memory (OOM) renderer process termination.

#### Platform Support Matrix
`Android: ✅` `iOS: ✅` `React Native: ✅` `Flutter: ✅` `Web Mock: ✅`

#### Aliases & Method Signatures
- **Canonical Action String:** `GET_MEMORY_METRICS`
- **Supported Aliases:** `getMemoryMetrics`, `getMemoryUsage`
- **Permission Scope:** `none`
- **Required Manifest Permissions:** `None (Zero-Permission)`
- **Security Constraint:** ✅ **No Gesture Required**

#### Input Parameters
_No input parameters required (`{}`)._


#### Return Value
- **Schema Type:** `MemoryMetricsResult`
- **Description:** Host device RAM memory metrics in megabytes.

```json title="Return Payload Shape"
{
  "totalMemoryMb": "number",
  "freeMemoryMb": "number",
  "usedMemoryMb": "number",
  "maxMemoryMb": "number"
}
```

#### Error Codes & Troubleshooting
_This action executes without throwing domain-specific error codes._


#### Multi-Framework Code Examples

<Tabs>
  <TabItem value="ts" label="TypeScript (Mini-App SDK)" default>

```typescript
const memory = await goatBridge.callNative('GET_MEMORY_METRICS', {});
console.log(`Used Memory: ${memory.usedMemoryMb} MB / ${memory.maxMemoryMb} MB`);
```

  </TabItem>
  <TabItem value="kotlin" label="Android (Kotlin)">

```kotlin
val runtime = Runtime.getRuntime()
val used = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024)
```

  </TabItem>
  <TabItem value="swift" label="iOS (Swift)">

```swift
// os_proc_available_memory / mach_task_basic_info
```

  </TabItem>
  <TabItem value="dart" label="Flutter (Dart)">

```dart
final res = await goatController.callNativeAction('GET_MEMORY_METRICS', {});
```

  </TabItem>
</Tabs>

