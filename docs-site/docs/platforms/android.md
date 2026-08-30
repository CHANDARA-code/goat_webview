---
sidebar_position: 1
title: Android Integration
---

# Android SDK Integration

Integrate the Goat WebView Engine into native Android apps using Kotlin and Jetpack Compose.

## Jetpack Compose Setup

```kotlin
import java.io.File
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.goat.webview.compose.GoatWebView
import kotlinx.serialization.json.JsonObject

@Composable
fun MiniAppContainer(assetDir: File, appId: String) {
    GoatWebView(
        assetDir = assetDir,
        appId = appId,
        modifier = Modifier.fillMaxSize(),
        onBridgeAction = { action: String, payload: JsonObject ->
            // Handle custom host bridge action
            Result.success(payload)
        },
        onLoadingStateChanged = { isLoading ->
            // Update UI loading overlay
        }
    )
}
```

## Advanced Configuration

```kotlin
val config = GoatConfig.Builder()
    .setStorageQuotaBytes(100 * 1024 * 1024)
    .setOtaUpdateChannel("production")
    .setEnableBytecodeCache(true)
    .build()

GoatRuntime.getInstance(context).initialize(config)
```
