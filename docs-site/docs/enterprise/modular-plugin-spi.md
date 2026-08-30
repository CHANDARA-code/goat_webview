---
sidebar_position: 1
title: Modular Plugin SPI
---

# Modular Plugin SPI

The Goat WebView Service Provider Interface (SPI) allows enterprise teams to inject custom native plugins without modifying the core runtime.

## Android Plugin Implementation (Kotlin)

```kotlin
class CustomAnalyticsPlugin : GoatBridgePlugin {
    override val pluginId: String = "com.company.analytics"
    override val supportedActions: List<String> = listOf("CUSTOM_ANALYTICS_EVENT")

    override fun canHandle(action: String): Boolean = supportedActions.contains(action)

    override suspend fun execute(action: String, payload: JsonObject): JsonObject {
        val eventName = payload["event"]?.jsonPrimitive?.content ?: "unknown"
        // Forward to native enterprise analytics SDK
        return buildJsonObject {
            put("tracked", true)
            put("event", eventName)
        }
    }
}

// Registration
GoatPluginRegistry.register(CustomAnalyticsPlugin())
```

## iOS Plugin Implementation (Swift)

```swift
final class CustomPaymentPlugin: GoatBridgePlugin {
    let pluginId = "com.company.payment"
    let supportedActions: [String] = ["PROCESS_ENTERPRISE_PAYMENT"]

    func canHandle(action: String) -> Bool {
        return supportedActions.contains(action)
    }

    func execute(action: String, payload: [String: Any]) async throws -> [String: Any] {
        // Execute native payment flow
        return ["status": "SUCCESS", "txId": "tx_998877"]
    }
}

// Registration
handler.registerPlugin(CustomPaymentPlugin())
```
