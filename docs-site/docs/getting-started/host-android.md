---
sidebar_position: 6
title: Android Host Integration (Compose & Kotlin)
---

# Android Host Integration (Jetpack Compose & Kotlin)

The **Goat Android SDK** (`com.goat.webview:core:1.0.0`) provides enterprise-grade, hardware-accelerated WebView hosting for Android applications. Built natively for **Jetpack Compose**, it features the lean **`GoatFastPool` 2-instance recycler**, zero-flash rendering, automatic keyboard (IME) synchronization, multi-file upload management, and background RAM trimming.

---

## 📦 Installation

Add the Goat WebView core dependency to your app module's `build.gradle.kts`:

```kotlin
dependencies {
    implementation("com.goat.webview:core:1.0.0")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("androidx.activity:activity-compose:1.9.1")
    implementation("androidx.compose.ui:ui:1.6.8")
    implementation("androidx.compose.material3:material3:1.2.1")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
}
```

---

## 🚀 Application-Level Initialization & Fast Pool Setup

In your `Application` class, initialize the **`GoatFastPool`** memory hooks and pre-warm the standby pool during idle startup:

```kotlin
package com.example.hostapp

import android.app.Application
import com.goat.webview.GoatFastPool

class HostApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        // 1. Register ComponentCallbacks2 memory trimming hooks
        GoatFastPool.registerMemoryCallbacks(this)

        // 2. Pre-warm standby WebView instance in pool (sub-10ms route launches)
        GoatFastPool.prewarmPool(this)
    }
}
```

---

## 🧩 Embedding `GoatWebView` in Jetpack Compose

Use the `GoatWebView` composable in your UI screen. It binds directly to the active Activity lifecycle, listens for native back-button presses, handles multi-file chooser dialogs, and coordinates custom bridge actions:

```kotlin
package com.example.hostapp.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.goat.webview.compose.GoatWebView
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.io.File

class MiniAppActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Path to extracted mini-app bundle
        val assetDir = File(filesDir, "miniapps/shop_app/1.0.0")

        setContent {
            MiniAppContainer(
                assetDir = assetDir,
                appId = "shop_app"
            )
        }
    }
}

@Composable
fun MiniAppContainer(assetDir: File, appId: String) {
    GoatWebView(
        assetDir = assetDir,
        appId = appId,
        modifier = Modifier.fillMaxSize(),
        onBridgeAction = { action: String, payload: JsonObject ->
            handleCustomBridgeAction(action, payload)
        },
        onLoadingStateChanged = { isLoading: Boolean ->
            // Host-side loading skeleton / progress bar indicator
        }
    )
}

suspend fun handleCustomBridgeAction(action: String, payload: JsonObject): Result<JsonObject> {
    return when (action) {
        "HOST_QUERY_USER_PROFILE" -> {
            Result.success(buildJsonObject {
                put("userId", "usr_99812")
                put("tier", "VIP_GOLD")
            })
        }
        "HOST_TRIGGER_NATIVE_CHECKOUT" -> {
            Result.success(buildJsonObject {
                put("status", "SUCCESS")
                put("transactionId", "tx_3049281")
            })
        }
        else -> {
            Result.failure(UnsupportedOperationException("Unhandled host action: $action"))
        }
    }
}
```

---

## ⚙️ Core Technical Capabilities

### 1. The Lean 2-Instance `GoatFastPool`

`GoatFastPool` maintains up to **2 pre-warmed WebView instances** (1 Active + 1 Standby). When a user navigates to a new mini-app screen:
1. `GoatFastPool.acquire(context)` fetches the standby instance and rebinds its `MutableContextWrapper` base context to the current Activity in **sub-10ms**.
2. When the screen exits, `GoatFastPool.recycle(webView)` applies an **8-step state sanitization**:
   - `stopLoading()` — Aborts pending downloads and script loops.
   - `loadUrl("about:blank")` — Navigates away from tenant DOM.
   - `clearHistory()` — Erases back/forward navigation history stack.
   - `WebStorage.deleteAllData()` — Purges DOM localStorage and sessionStorage.
   - `CookieManager.removeAllCookies()` — Purges session and persistent cookies.
   - `WebViewDatabase.clearFormData()` — Erases autocomplete credentials.
   - `clearCache(true)` — Flushes RAM/Disk HTTP caches and SSL certificates.
   - Detaches client delegates and restores `Color.TRANSPARENT`.

### 2. Zero White Flash Rendering

To eliminate the unsightly white flash during WebView initialization:
- Background color is initialized to `android.graphics.Color.TRANSPARENT`.
- `AnimatedVisibility` with cross-fading (`fadeIn()` / `fadeOut()`) keeps the container invisible until `onPageFinished` fires.

### 3. Dynamic Keyboard (IME) Inset Synchronization

`GoatWebView` binds to Compose's `WindowInsets.ime`:
```kotlin
Modifier.windowInsetsPadding(WindowInsets.ime)
```
As the software keyboard animates open or closed, the native container resizes smoothly without jumpy viewport repositioning.

### 4. Native Multi-File Chooser (`onShowFileChooser`)

`GoatWebView` automatically binds `WebChromeClient.onShowFileChooser` to the modern Android `ActivityResultContracts.OpenMultipleDocuments()` contract, enabling mini-apps to seamlessly open system photo pickers or file managers:

```kotlin
val filePickerLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.OpenMultipleDocuments()
) { uris: List<Uri>? ->
    filePathCallback?.onReceiveValue(uris?.toTypedArray())
    filePathCallback = null
}
```

### 5. Background RAM Trimming & Crash Isolation

- **Lifecycle Observers:** In `ON_PAUSE`, `GoatWebView` invokes `pauseTimers()` on the V8 engine and disables `offscreenPreRaster` to free GPU texture memory.
- **Process Termination Recovery:** Implements `onRenderProcessGone` to return `true` on Chromium renderer process terminations (OOM jetsam), preventing host application crashes and allowing graceful reloads.
