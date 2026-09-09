# Goat WebView: Principal Engineering Guidelines & Enterprise Compliance Standards (`CODE_RULE.md`)

> **Document Classification**: Senior Staff / Principal Systems Architect Level Standard  
> **Target Platforms**: Native Android (Kotlin/Compose), Flutter (Dart/Pigeon), React Native (TypeScript/Fabric/TurboModules), Web SPA (React 18/19, Vite, Tailwind CSS)  
> **Status**: Active & Mandatory for all Repository Contributions

---

## 1. Enterprise Security, Privacy & App Store Compliance Matrix

All code contributions must strictly adhere to the **OWASP Mobile Application Security Verification Standard (MASVS v2.0)**, **Google Play Policy Requirements**, and **Apple App Store Review Guidelines**.

```
+-------------------------------------------------------------------------------------------------------------------------+
|                                           ENTERPRISE SECURITY & COMPLIANCE MATRIX                                       |
|                                                                                                                         |
|  1. MASVS-PLATFORM (Secure IPC)          2. MASVS-STORAGE (Data Sandboxing)     3. MASVS-CRYPTO (Signature Verification)|
|  - WebMessageListener only               - Strict appId-scoped directories      - RSA-2048 / ECDSA SHA256withECDSA      |
|  - Origin: https://appassets...          - Zero plaintext PII in logs/prefs     - Pre-extraction cryptographic validation|
|  - Legacy @JavascriptInterface BANNED    - Zip Slip canonical path traversal   - Tamper-evident staging directory      |
|                                            exploit prevention                                                           |
|                                                                                                                         |
|  4. MASVS-NETWORK (Zero-Trust Transport) 5. MASVS-CODE (Renderer Resilience)    6. STORE POLICY & COMPLIANCE            |
|  - In-memory WebViewAssetLoader          - onRenderProcessGone crash isolation  - Zero dynamic DEX/native binary loading|
|  - Cleartext HTTP traffic blocked        - R8/ProGuard obfuscation keep rules   - Standard Web SPA hosting via HTTPS    |
|  - Strict Content Security Policy (CSP)  - Dependency license compliance (MIT)  - Scoped runtime permissions (scope.*)  |
+-------------------------------------------------------------------------------------------------------------------------+
```

### 1.1 OWASP MASVS Security Controls

| MASVS Domain | Standard ID | Mandatory Architectural Rule & Implementation Standard |
| :--- | :--- | :--- |
| **MASVS-PLATFORM** | `MSTG-PLATFORM-07` | **Strict Prohibition of Legacy Bridge**: `@JavascriptInterface` is strictly forbidden due to Remote Code Execution (RCE) and Cross-Site Scripting (XSS) elevation risks. All communication must utilize `WebViewCompat.addWebMessageListener` restricted exclusively to `https://appassets.androidplatform.net`. Wildcard `*` origins are rejected at compile-time. |
| **MASVS-STORAGE** | `MSTG-STORAGE-01` | **Zip Slip Vulnerability Protection**: During archive decompression, every file entry's canonical path MUST be asserted: `file.canonicalPath.startsWith(stagingDir.canonicalPath)`. Any directory traversal breach immediately aborts extraction, purges `.staging`, and logs a critical security alert. |
| **MASVS-STORAGE** | `MSTG-STORAGE-02` | **Multi-Tenant Sandboxing**: Mini-app data partitions are strictly isolated per `app_id` (`context.filesDir/miniapps/{app_id}/{version}/`). Mini-App A cannot read, write, or inspect Mini-App B's files, databases, or `SharedPreferences` keyspaces. |
| **MASVS-CRYPTO** | `MSTG-CRYPTO-01` | **Digital Signature Verification**: Remote and local bundle archives must be cryptographically verified using **RSA-2048** or **ECDSA (SHA256withECDSA)** public keys before decompression and before execution by the Chromium runtime. |
| **MASVS-NETWORK** | `MSTG-NETWORK-01` | **Zero-Trust Network Boundary**: Disable `allowFileAccess`, disable `allowContentAccess`, and enforce `setHttpAllowed(false)`. Cleartext `http://` traffic is permanently blocked in both Android Manifest and Network Security Config. |
| **MASVS-CODE** | `MSTG-CODE-04` | **Renderer Crash Isolation**: `WebViewClient.onRenderProcessGone` MUST return `true` to ensure Chromium renderer terminations (triggered by Android Low Memory Killer) are isolated from aborting the host application PID. |

### 1.2 App Store & Regulatory Compliance (Google Play & Apple)
1. **No Remote Executable Code Loading**: Dynamic downloading of native shared objects (`.so`), Android Dalvik executables (`.dex`), or interpreted binary scripts outside Google Play is prohibited. Mini-apps host standard, non-executable Web content (`.html`, `.js`, `.css`, `.wasm`) executed strictly inside the platform WebView sandbox.
2. **Privacy Manifest & Data Transparency**: Any access to camera, microphone, coarse/fine location, or Bluetooth must trigger standardized native runtime consent dialogs with explicit user disclosures (`scope.camera`, `scope.userLocation`, etc.).
3. **Open-Source License Hygiene**: Only permissive open-source dependencies (**MIT**, **Apache 2.0**, **BSD-3-Clause**) are permitted. Copyleft licenses (**GPL**, **AGPL**, **LGPL**) are strictly prohibited to prevent enterprise intellectual property contamination.

---

## 2. SOLID Principles & Clean Code Standards

### 2.1 Single Responsibility Principle (SRP)
- **High Cohesion**: Every component has exactly one well-defined responsibility:
  - `GoatAssetManager`: Bundle decompression, version pointer swapping, SHA-256 verification, and Zip Slip guard.
  - `GoatWebViewClient`: AndroidX virtual HTTPS domain routing via `WebViewAssetLoader`.
  - `GoatFastPool`: 2-instance memory-guarded queue lifecycle management and emergency eviction.
  - `GoatBridgeDispatcher`: IPC JSON deserialization, action routing, and error envelope formatting.
  - `GoatComposeWebView` / `GoatPlatformView`: UI rendering, layout, window insets, and gesture routing.

### 2.2 Open/Closed Principle (OCP)
- Core dispatchers are **closed for modification, open for extension**.
- New bridge capabilities are added by registering modular `GoatBridgePlugin` handlers without modifying core dispatchers:
  ```kotlin
  interface GoatBridgePlugin {
      val actionName: String
      val requiredPermission: String? get() = null
      suspend fun execute(payload: JsonObject, context: Context): Result<JsonObject>
  }
  ```

### 2.3 Liskov Substitution Principle (LSP)
- Derived types and interface implementations (e.g., `GoatStorageProvider`, `GoatAssetHandler`) must be completely substitutable for their base abstractions without altering program correctness:
  ```dart
  abstract class GoatStorageProvider {
    Future<void> write(String key, String value);
    Future<String?> read(String key);
    Future<void> remove(String key);
  }
  ```

### 2.4 Interface Segregation Principle (ISP)
- Segregate monolithic interfaces into fine-grained, client-focused contracts:
  ```kotlin
  interface GoatNavigable {
      fun push(route: String)
      fun pop(): Boolean
  }

  interface GoatThemeSynchronizable {
      fun setDarkMode(isDark: Boolean)
  }

  interface GoatMemoryTrimmable {
      fun trimMemory(level: Int)
  }
  ```

### 2.5 Dependency Inversion Principle (DIP)
- High-level orchestrators depend on abstractions. Inject `CoroutineDispatcher`, `Logger`, and `Context` via constructor injection to guarantee testability with mock test dispatchers:
  ```kotlin
  class GoatBridgeActionHandler(
      private val context: Context,
      private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
      private val mainDispatcher: CoroutineDispatcher = Dispatchers.Main
  )
  ```

---

## 3. Concurrency, Memory & Lifecycle Rules

```
+-------------------------------------------------------------------------------------------------------------------------+
|                                              CONCURRENCY & MEMORY GOLDEN RULES                                          |
|                                                                                                                         |
|  [THREADING RULES]                           [MEMORY CONSTRAINTS]                   [LIFECYCLE RULES]                   |
|  1. UI Thread: WebView & WebSettings calls   1. Active Base RAM: < 45 MB            1. onDispose: mandatory 6-step reset|
|  2. IO Thread: FS, Crypto, Network, SQLite   2. Suspended Standby RAM: < 8 MB       2. BackHandler: history stack sync  |
|  3. Zero Dispatchers.Main blocking           3. onTrimMemory: immediate pool purge  3. Zero static Context leaks        |
|  4. Supervised CoroutineScopes only          4. Non-dangling ValueCallbacks         4. State restoration across death   |
+-------------------------------------------------------------------------------------------------------------------------+
```

### 3.1 Concurrency & Thread Confinement
1. **Thread Confinement for WebKit**: All calls to `WebView`, `WebSettings`, and `JavaScriptReplyProxy.postMessage` MUST execute strictly on `Dispatchers.Main` / Android UI Thread.
2. **Non-Blocking I/O**: File reading, unzipping, SHA-256 computation, network calls, and database operations MUST execute on `Dispatchers.IO` or background worker threads.
3. **Structured Concurrency**: Never use `GlobalScope`. Always bind coroutines to a supervised lifecycle scope (`viewModelScope`, `rememberCoroutineScope()`, or custom `CoroutineScope(SupervisorJob() + Dispatchers.Default)`).

### 3.2 Memory Management & Leak Prevention (Zero-Leak Policy)
1. **Mandatory 6-Step View Teardown**: When unmounting or disposing of a WebView container (`DisposableEffect.onDispose` or `PlatformView.dispose`), execute the mandatory 6-step cleanup sequence:
   ```kotlin
   webView?.apply {
       stopLoading()
       loadUrl("about:blank")
       clearHistory()
       removeAllViews()
       destroy()
   }
   webView = null
   ```
2. **Non-Dangling File Chooser Callbacks**: `WebChromeClient.onShowFileChooser` `filePathCallback` MUST NEVER remain dangling on user cancel/back-press. Always deliver `null` if canceled to prevent permanent WebKit engine deadlocks.
3. **Memory Trimming (`ComponentCallbacks2`)**: On `TRIM_MEMORY_RUNNING_CRITICAL` or `TRIM_MEMORY_UI_HIDDEN`, immediately destroy standby instances in `GoatFastPool` and disable `offscreenPreRaster`.

### 3.3 `goat_webview_compat`: Zero-Retention Migration Config (Lint-Enforced)

The `flutter_inappwebview`-compat adapter (`goat_webview_compat`, a staged-migration aid — see `TASK_PORTABLE_PLUG_AND_PLAY_ADAPTER.md` G1) accepts config/options value types that a consumer coming from `flutter_inappwebview` is used to constructing once and keeping around. Doing that here defeats the adapter's zero-retention guarantee: these types must be built inline at the call site and handed straight to `InAppWebView`/its controller, never stored past that call.

1. **Rule**: `tools/goat_compat_lint` (a `custom_lint` plugin, rule id `goat_compat_retained_config`) flags a field, top-level variable, `static` variable, or generic state holder (`ValueNotifier<T>`, `StateController<T>`, etc.) whose type is `InAppWebViewSettings`, `InAppWebViewGroupOptions`, `InAppWebViewOptions`, `URLRequest`, `PullToRefreshSettings`, or `LoadedResource`.
2. **Exemptions** (not retention, so not flagged): a `Widget` subclass's own constructor-parameter field (discarded with the widget, not state) and a field inside one of the package's own `@immutable` value types (the type's definition, not a consumer holding config).
3. **Escape hatch**: a documented `// ignore: goat_compat_retained_config` comment explaining the exception — used once in the adapter itself, for `PullToRefreshController.settings`, which is exempted under G4 (controllers, unlike config/settings value types, are allowed to hold state for their own operational lifetime).
4. **Enforcement**: run via `dart run custom_lint` from any package that adds `custom_lint` + `goat_compat_lint` as dev dependencies and enables `analyzer: plugins: [custom_lint]` in `analysis_options.yaml`. `goat_webview_compat`'s own source must lint clean (self-check).

### 3.4 `react-native-goat-webview-compat`: Zero-Retention Migration Config (Lint-Enforced)

The React Native twin of §3.3, and the same guarantee for the same reason (`TASK_PORTABLE_PLUG_AND_PLAY_RN_ADAPTER.md` G1). A consumer coming from `react-native-webview` habitually hoists a `source` object or a props bag to module scope and reuses it; holding it there keeps it alive for the process lifetime, which is exactly the RAM regression the adapter exists to avoid. Compat props are built inline and handed to `<WebView>`.

1. **Rule**: `react-native-goat-webview-compat/eslint-plugin`, rule id `no-retained-compat-config`, flags a module-scope binding, class field, or `useRef` whose type annotation is `WebViewProps`, `WebViewSource`, `WebViewSourceUri`, `WebViewSourceHtml`, or `CreationProps`, or whose initialiser is a call to the `toCreationProps` factory.
2. **Exemption** (not retention, so not flagged): the intended shape — config constructed inline inside a component and passed straight to `<WebView>`.
3. **Escape hatch**: the standard `// eslint-disable-next-line no-retained-compat-config` comment, which must carry a justification.
4. **Enforcement**: `npm run test:lint-rule` in `react-native-goat-webview-compat` runs the rule's `RuleTester` suite (4 valid / 5 invalid cases). The adapter's own source must pass the rule (self-check).

---

## 4. Battery, Network & Thermal Efficiency Standards

1. **Background Network Throttling**: Large OTA bundle updates (`GoatRemoteManager`) must be scheduled via Android `WorkManager` with `NetworkType.UNMETERED` and `requiresCharging(true)` constraints.
2. **Sensor Stream Throttling**: Continuous hardware sensors (Accelerometer, Gyroscope, Compass) must throttle event emissions to a maximum rate of **20 Hz (50ms interval)** to prevent JS bridge saturation and CPU wake-lock battery drain.
3. **Thermal Throttling Resilience**: When the OS reports thermal throttling (`PowerManager.getThermalHeadroom() > 0.8`), background WebViews must invoke `WebView.onPause()` to suspend requestAnimationFrame loops and V8 JIT activity.

---

## 5. Accessibility (a11y) & WCAG 2.2 Standards

1. **System Font Scaling**: The web container must respect dynamic system font sizing without breaking layouts (`settings.textZoom = 100` synchronized with native `LocalDensity`).
2. **TalkBack & VoiceOver Compatibility**: Interactive web elements must use semantic HTML5 (`<button>`, `<nav>`, `<main>`) with valid `aria-label` attributes.
3. **Reduced Motion**: The CSS layer must honor system reduced motion preferences:
   ```css
   @media (prefers-reduced-motion: reduce) {
     *, ::before, ::after {
       animation-duration: 0.01ms !important;
       transition-duration: 0.01ms !important;
     }
   }
   ```

---

## 6. Observability, Telemetry & Performance Standards

1. **Structured Logging Standard**:
   - `DEBUG`: Verbose internal lifecycle state transitions (omitted in release builds via R8/ProGuard).
   - `INFO`: Bundle version updates, cache hits, pool acquisitions.
   - `WARN`: Bridge action timeouts, fallback degradations.
   - `ERROR`: Security breaches, renderer crashes, cryptographic failures.
   - **Zero PII Policy**: Never log tokens, passwords, GPS coordinates, or personal identifiers in logcat.
2. **Core Web Vitals Telemetry**:
   - The Web container automatically measures and emits performance metrics to native telemetry:
     - **FCP (First Contentful Paint)**: SLA < 50 ms.
     - **LCP (Largest Contentful Paint)**: SLA < 120 ms.
     - **INP (Interaction to Next Paint)**: SLA < 16 ms (60 FPS responsiveness).

---

## 7. Wire Contract, API Versioning & Backward Compatibility

1. **Protocol Schema Invariants**: All IPC requests and responses adhere strictly to the typed JSON contract:
   - **Request**: `{"id": "req_uuid", "action": "ACTION_NAME", "payload": { ... }}`
   - **Response**: `{"id": "req_uuid", "success": true, "data": { ... }, "error": null}`
2. **Forward & Backward Compatibility**:
   - New payload fields must always be **optional** with safe fallback defaults.
   - Renaming or removing existing action strings is strictly forbidden.
   - Deprecated actions must follow a minimum **2-minor-version grace period** before removal.
3. **Feature Detection**: Mini-apps must query capability availability dynamically using `bridge.canIUse(actionName)` before invoking platform-specific APIs.

---

## 8. Documentation & Deprecation Standards

Every public class, interface, method, and bridge action must be fully documented using formal docstrings.

### 8.1 TypeScript / JavaScript (JSDoc Standards)
```typescript
/**
 * Dispatches an asynchronous request to the native host container via the WebMessageListener bridge.
 *
 * @template T - Expected return type of the payload.
 * @param action - The UPPER_SNAKE_CASE action identifier (e.g., `GET_DEVICE_INFO`).
 * @param payload - Optional key-value payload parameters sent to native handler.
 * @param timeoutMs - Optional timeout in milliseconds before rejecting (default: 5000ms).
 * @returns A promise that resolves with the native response data payload.
 * @throws {BridgeError} If bridge is unavailable, action times out, or native execution fails.
 *
 * @example
 * ```typescript
 * const deviceInfo = await bridge.callNative<DeviceInfo>('GET_DEVICE_INFO');
 * console.log(deviceInfo.model);
 * ```
 */
public callNative<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
  timeoutMs: number = 5000
): Promise<T> { ... }
```

### 8.2 Flutter / Dart (DartDoc Standards)
```dart
/// Controller for interacting with the underlying hardware-accelerated [GoatWebView].
///
/// Provides bi-directional communication channels, dynamic theme synchronization,
/// and native navigation stack controls.
///
/// See also:
///  * [GoatWebViewWidget], the widget embedding this controller.
class GoatWebViewController {
  /// Invokes a JavaScript function registered on the mini-app `window` object.
  ///
  /// [functionName] is the global method name to invoke.
  /// [args] is a list of JSON-serializable arguments.
  ///
  /// Returns the JSON-decoded result returned by the JavaScript function.
  /// Throws [PlatformException] if the evaluation fails or bridge times out.
  Future<dynamic> evaluateJsFunction(String functionName, List<dynamic> args) async { ... }
}
```

### 8.3 Kotlin / Android (KDoc Standards)
```kotlin
/**
 * Manages the extraction, integrity validation, and atomic version swapping
 * of mini-app bundle archives stored in internal storage.
 *
 * @property context The Android application context.
 * @property assetZipName Name of the bundled ZIP archive located in `assets/`.
 */
class GoatAssetManager(
    private val context: Context,
    private val assetZipName: String = "miniapp.zip"
) {
    /**
     * Verifies bundle integrity and extracts assets atomically into internal storage.
     *
     * @param targetDirectory Destination directory inside `context.filesDir`.
     * @return [File] pointing to the verified active bundle directory.
     * @throws SecurityException If a Zip Slip directory traversal breach is detected.
     * @throws IOException If I/O or archive decompression fails.
     */
    @Throws(SecurityException::class, IOException::class)
    suspend fun ensureAssetsReady(targetDirectory: File): File { ... }
}
```

### 8.4 Deprecation Policy & Migration Rules
Whenever deprecating an API or method:
1. Mark with `@deprecated` (TS), `@Deprecated(...)` (Dart/Kotlin).
2. State the **exact reason** for deprecation.
3. Recommend the **replacement symbol**.
4. State the **target removal version**.

```kotlin
@Deprecated(
    message = "Use executeActionAsync via GoatBridgeDispatcher instead to support structured JSON payloads.",
    replaceWith = ReplaceWith("executeActionAsync(action, payload)"),
    level = DeprecationLevel.WARNING
)
fun sendRawString(rawString: String) { ... }
```

---

## 9. ProGuard & R8 Obfuscation Rules

Ensure the following keep rules are configured in `proguard-rules.pro` to prevent reflection and serialization bugs during release builds:

```proguard
# Keep WebMessageListener and AndroidX WebKit interfaces
-keepclassmembers class * implements androidx.webkit.WebViewCompat$WebMessageListener {
    public void onPostMessage(android.webkit.WebView, androidx.webkit.WebMessageCompat, android.net.Uri, boolean, androidx.webkit.JavaScriptReplyProxy);
}

# Keep Kotlinx Serialization models
-keepattributes *Annotation*, InnerClasses
-dontwarn kotlinx.serialization.**
-keepclassmembers class com.goat.webview.** {
    *** Companion;
}

# Keep React Native TurboModule & Fabric bindings
-keep class com.goat.webview.rn.** { *; }

# Keep Flutter Pigeon generated interfaces
-keep class com.goat.webview.flutter.** { *; }
```

---

## 10. Testing Pyramid & Verification SLAs

```
              / \
             /   \
            / E2E \        Detox (RN) / Patrol (Flutter) / Android Benchmark
           /-------\
          /  Integ  \      ComposeTestRule / PlatformView Hybrid Tests
         /-----------\
        /    Unit     \    JUnit 5 (Kotlin), flutter_test (Dart), Jest/Vitest (TS)
       /---------------\
```

| Test Layer | Framework | Minimum Target Coverage | Focus Area |
| :--- | :--- | :--- | :--- |
| **Unit Tests** | JUnit 5, `flutter_test`, Jest/Vitest | **> 90% Branch Coverage** | Business logic, JSON serialization, state machines, timeouts. |
| **Security Tests** | Mockito, JUnit | **100% Pass Rate** | Zip Slip exploits, CSP compliance, origin whitelisting. |
| **Integration Tests** | Compose Test Rule, Patrol | **100% Critical Flows** | WebView mounting, back-press history, multi-file upload. |
| **Performance SLA** | Android Macrobenchmark | **SLA Enforcement** | Cold start <120ms, Warm start <15ms, Base RAM <45MB. |

---

## 11. Git Branching, Conventional Commits & Husky Pre-Commit Enforcement

```
+-------------------------------------------------------------------------------------------------------------------------+
|                                        GIT CONVENTIONS & HUSKY PRE-COMMIT PIPELINE                                      |
|                                                                                                                         |
|  [CONVENTIONAL COMMITS]                      [HUSKY PRE-COMMIT HOOKS]               [COMMIT QUALITY GUARANTEE]          |
|  - Structure: <type>(<scope>): <message>     - 1. Android Unit Tests (JUnit)        - Zero broken commits on main       |
|  - Types: feat, fix, perf, refactor, test,   - 2. React Native Unit Tests (Jest)    - Confident commits with full tests |
|    docs, ci, tooling, chore                  - 3. Flutter Unit Tests (flutter_test) - Test libraries AND example apps   |
|  - Breaking: BREAKING CHANGE / !:            - 4. Web Mini-App Build & TypeCheck    - Husky commit-msg regex validation |
+-------------------------------------------------------------------------------------------------------------------------+
```

### 11.1 Conventional Commits Specification
All commit messages must strictly adhere to the [Conventional Commits](https://www.conventionalcommits.org/) standard.

#### Message Structure:
```
<type>(<optional scope>): <short imperative description>

[optional body explaining motivation and architectural context]

[optional footer(s) for breaking changes or task references]
```

#### Allowed Types:
| Type | Purpose | Example |
| :--- | :--- | :--- |
| **`feat`** | A new feature, bridge action, or capability | `feat(bridge): implement BIOMETRIC_AUTH fingerprint and face unlock` |
| **`fix`** | A bug fix or security patch | `fix(security): resolve Zip Slip directory traversal vulnerability` |
| **`perf`** | Performance optimization or latency reduction | `perf(pool): reduce warm start latency to <10ms via GoatFastPool` |
| **`refactor`** | Code change that neither fixes a bug nor adds a feature | `refactor(core): decouple GoatBridgeDispatcher from Compose UI` |
| **`test`** | Adding missing tests or correcting existing tests | `test(android): add unit tests for GoatStorageSandboxing` |
| **`docs`** | Documentation only changes | `docs(rules): update CODE_RULE.md with Husky pre-commit standards` |
| **`tooling`** | Changes to build scripts, VS Code snippets, or configs | `tooling(vscode): add Goat WebView code snippets` |
| **`ci`** | Changes to CI workflows or GitHub Actions | `ci(github): add pre-commit test pipeline workflow` |
| **`chore`** | Maintenance changes that do not modify src or test files | `chore(deps): bump androidx.webkit from 1.10.0 to 1.11.0` |

#### Common Scopes:
- `core`, `bridge`, `pool`, `storage`, `security`, `startup`, `navigation`, `flutter`, `react-native`, `web`, `example`

### 11.2 Husky Pre-Commit Automated Verification Workflow
The repository utilizes **Husky git hooks** (`.husky/pre-commit` and `.husky/commit-msg`) to guarantee that every commit is safe, tested, and compliant.

Before any commit is created, Husky automatically executes the full **5-tier test runner**:
1. **Android Core Tests**: `./android/gradlew -p android test --quiet` (JUnit & Coroutines tests).
2. **React Native Library Tests**: `npm --prefix react-native-goat-webview test -- --silent` (Jest & RNTL).
3. **Flutter Plugin Tests**: `cd goat_webview && flutter test` (`flutter_test` suite).
4. **Flutter Example App Verification**: `cd goat_webview/example && flutter analyze` (Clean code & static analysis).
5. **Web Mini-App Build**: `npm --prefix miniapp-web run build` (TypeScript check & Vite bundling).

> **Important**: If any unit test fails or compilation errors occur in either the libraries or example apps, **Husky aborts the commit immediately**.

### 11.3 Husky Commit-Msg Format Validator
`.husky/commit-msg` automatically asserts that your commit message adheres to the Conventional Commits regex pattern:
```regex
^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|tooling)(\([a-zA-Z0-9_\/\-]+\))?!?: .+$
```

### 11.4 Task-by-Task Commit Best Practices
1. **Atomic Commits**: Commit changes task-by-task (e.g. implementation + matching unit test in one commit).
1. **Atomic Commits**: Commit changes task-by-task or component-by-component (e.g. implementation + matching unit test in one commit).
2. **Confidence Guarantee**: Ensure both the library code and example application build and pass 100% of unit tests before committing.
3. **Traceability**: Reference task IDs in the commit message or body when applicable (e.g., `feat(storage): implement multi-tenant sandboxing (Task 10066)`).

### 11.5 AI Assistant & CLI Tooling Compliance Standard (Claude Code, Antigravity / `agy cli`, and Autonomous Agents)

> [!CRITICAL]
> **Strict Prohibition of Bulk Staging (`git add .`)**  
> AI coding assistants, automated agents, and contributors MUST NEVER perform blanket staging commands:
> - ❌ **BANNED**: `git add .`
> - ❌ **BANNED**: `git add -A`
> - ❌ **BANNED**: `git add *`
> - ❌ **BANNED**: Catch-all omnibus commits (e.g., `git add . && git commit -m "chore: various changes"`)
>
> Bulk staging obscures git blame history, destroys bisectability, risks committing sensitive scratch data or build artifacts, and violates repository compliance.

#### Mandatory Part-by-Part (Granular) Commit Protocol

Every AI agent (Claude Code, `agy cli`, Antigravity) and human contributor must adhere to the following sequence when committing:

1. **Explicit File Staging Only**:
   Stage only specific, related files for one discrete logical domain using explicit file paths:
   ```bash
   # ✅ Compliant: Staging specific files belonging to one logical subsystem
   git add android/feature-bluetooth/src/main/java/... android/feature-bluetooth/src/test/...
   git commit -m "feat(android/features): introduce BLE transport abstraction and add instrumentation suites"
   ```

2. **Standard Domain Partitioning Matrix**:
   When multiple files across the repository have changed, partition them into separate, sequential commits:
   | Partition | Typical Scope | Conventional Commit Format |
   | :--- | :--- | :--- |
   | **CI & Quality Gates** | `.github/workflows/`, `scripts/verify-*.sh` | `ci: add test suite coverage gating and companion action verification` |
   | **Android Core** | `android/core/`, `android/app/`, `android/benchmark/` | `refactor(android/core): ...` or `test(android): ...` |
   | **Android Features** | `android/feature-*/`, `android/features-all-in/` | `feat(android/features): ...` |
   | **iOS Native** | `ios/Sources/`, `ios/Tests/`, `ios/*.podspec` | `feat(ios): ...` or `test(ios): ...` |
   | **Companion Packages** | `packages/flutter/*`, `packages/react-native/*`, `goat_webview/` | `feat(packages): ...` |
   | **Bridge & DSL Tools** | `packages/bridge-mock/`, `packages/adapter-dsl/` | `feat(bridge-mock): ...` or `feat(adapter-dsl): ...` |
   | **Web Mini-App Runtime**| `miniapp-web/` | `feat(miniapp-web): ...` |
   | **Game Demos & E2E** | `tests/games/`, `tests/e2e/` | `test(games): ...` |
   | **Docs & Tracking** | `docs/`, `TASKS.md`, `PROJECT.md`, `CODE_RULE.md` | `docs: ...` |
   | **Agent & Handoff Assets** | `CLAUDE.md`, `.claude/`, `.antigravity/`, `assets_*/` | `chore(agents): ...` |

3. **Pre-Commit Hygiene & Workspace Sanitization**:
   Before staging any commit:
   - **Audit Uncommitted Changes**: Run `git status --short` or `git status --porcelain` to review every modified and untracked file.
   - **Purge Scratch & Temporary Files**: Remove scratch scripts (e.g. `update_tasks*.py`, one-off debug scripts, scratch logs, temporary dumps) BEFORE staging.
   - **Reject 0-Byte / Broken Files**: Never commit empty stub files (0 bytes) or corrupted cache artifacts.
   - **Pre-Commit Staging Audit**: Always run `git diff --staged --name-only` to visually verify exactly what is staged before executing `git commit`.

4. **Agent Autonomous Commit Restrictions**:
   - AI assistants (Claude Code, `agy cli`, Antigravity) must **NEVER** commit autonomously unless explicitly instructed by the user (e.g., `"please commit part by part"`).
   - When instructed to commit, the agent MUST follow this part-by-part protocol and must NEVER take the shortcut of `git add .`.

---

## 12. Modular Multi-Module Architecture & Binary Footprint Rules (Zero-Bloat Policy)

```
+-------------------------------------------------------------------------------------------------------------------------+
|                                    MODULAR ARCHITECTURE & ZERO-BLOAT COMPLIANCE                                         |
|                                                                                                                         |
|  1. CORE ENGINE FOOTPRINT                2. ISOLATED FEATURE SUB-MODULES         3. EXTENSIBLE PLUGIN SPI (GoatBridge)   |
|  - Strictly capped at < 500 KB          - ML Kit / CameraX / Location separated  - Interface: GoatBridgePlugin          |
|  - Zero heavy 3rd-party C++ libraries    - Media/ExoPlayer in optional module    - Thread-safe ConcurrentHashMap registry|
|  - Contains FastPool, Bridge, Storage    - Biometrics in optional module         - Dynamic canIUse capability discovery  |
|                                                                                                                         |
|  4. CONSUMER DEPENDENCY CONFIGURATIONS                                                                                  |
|  - Option A (Granular Zero-Bloat):  implementation "com.goat.webview:core:1.0.0" + individual feature modules           |
|  - Option B (All-In-One Full Suite): implementation "com.goat.webview:features-all-in:1.0.0"                            |
+-------------------------------------------------------------------------------------------------------------------------+
```

### 12.1 Core SDK Zero-Bloat Invariant
1. **Hard Ceiling on Core Size**: `com.goat.webview:core` MUST NEVER exceed **500 KB** in binary size.

> **v1.0.0 Documented Deviation**: the core AAR currently ships at ~1.4 MB (the inline 18-domain
> dispatcher, payments gateway and Compose UI have not yet been extracted into the `feature-*`
> modules). This deviation is recorded in `CHANGELOG.md`; the extraction is scheduled for the
> 1.1.0 line, and the interim CI size gate is set at 1,600 KB (`scripts/check-size-budget.sh`).
> The 500 KB ceiling itself remains mandatory and unchanged.
2. **Prohibition of Heavy Monolithic Dependencies in Core**:
   - `core` MUST NOT declare dependencies on Google Play Services (`play-services-location`), ML Kit (`barcode-scanning`), CameraX (`camera-camera2`), or Media3/ExoPlayer (`media3-exoplayer`).
   - All heavyweight third-party libraries MUST be encapsulated within dedicated, optional feature sub-modules.

### 12.2 Sub-Module Partitioning Standards
1. **`com.goat.webview:feature-media`**: Contains ExoPlayer audio playback, audio recording, and media picker (~3.5 MB).
2. **`com.goat.webview:feature-scanner`**: Contains CameraX and ML Kit Barcode/QR scanning engines (~25 MB).
3. **`com.goat.webview:feature-location`**: Contains Google Play Services Fused Location Provider and Geofencing (~4.0 MB).
4. **`com.goat.webview:feature-biometrics`**: Contains AndroidX Biometrics and Hardware Keystore authentication (~250 KB).
5. **`com.goat.webview:feature-bluetooth`**: Contains Bluetooth Low Energy (BLE) and NFC NDEF transceivers (~300 KB).
6. **`com.goat.webview:feature-network`**: Contains Native Multipart Uploader and WebSocket engines (~500 KB).

### 12.3 Dual Consumer Dependency Rule
Host applications must be supported with two official dependency integration paths:
- **Option A (Granular Zero-Bloat)**: Host app declares `com.goat.webview:core` and adds only the feature modules needed (e.g. `:feature-media` only).
- **Option B (All-In-One Full Suite)**: Host app declares `com.goat.webview:core` + `com.goat.webview:features-all-in` to pull all capabilities transitively.

### 12.4 Plugin SPI Implementation Rule (`GoatBridgePlugin`)
1. All feature sub-modules MUST implement `GoatBridgePlugin`:
   ```kotlin
   interface GoatBridgePlugin {
       val pluginId: String
       val supportedActions: List<String>
       suspend fun execute(action: String, payload: JsonObject): Result<JsonObject>
       fun canHandle(action: String): Boolean = supportedActions.contains(action)
   }
   ```
2. Feature plugins MUST register dynamically with `GoatBridgeActionHandler.registerPlugin(plugin)`.
3. Mini-app calls to `canIUse("FEATURE")` MUST dynamically return `true` if the plugin is registered in the host build and `false` otherwise.
4. Calling an unbundled/unregistered feature action MUST fail gracefully with `Result.failure` without crashing the host application process.

---

## 13. Senior Staff Pull Request Review Checklist (Definition of Done)

Before merging any pull request, the author and reviewer must verify:

- [ ] **Architecture**: Adheres strictly to SOLID principles and decouples the core engine from specific UI hosts.
- [ ] **Zero-Bloat Footprint**: Core SDK remains `<500KB`; heavy native libraries are quarantined in feature sub-modules.
- [ ] **Memory**: Verified via Android Memory Profiler that active RAM is `<45MB` and suspended RAM is `<8MB`.
- [ ] **Security**: 100% compliant with OWASP MASVS (Anti-Zip Slip verified, zero `@JavascriptInterface`, HTTPS virtual origin whitelisted).
- [ ] **Thread Safety**: All WebKit calls run on `Dispatchers.Main`; all disk/network I/O runs on `Dispatchers.IO`.
- [ ] **Battery & Thermal**: Sensors throttled to `<20Hz`; WorkManager constraints applied for background transfers.
- [ ] **Accessibility**: Tested with TalkBack / VoiceOver; dynamic text scaling and reduced motion supported.
- [ ] **Documentation**: Full KDoc / DartDoc / JSDoc comments on all public symbols; deprecations follow migration policy.
- [ ] **Tests**: Unit test coverage added with `>90%` branch coverage; zero flaky tests.
- [ ] **Linters & CI**: CI passes with zero warnings (`ktlint`, `flutter analyze`, `eslint`, `tsc`).

