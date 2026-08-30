# Goat WebView: Production R8 & ProGuard Obfuscation Keep Rules (Task 10133)
# Compliance Reference: CODE_RULE.md Section 9

# Keep WebMessageListener and AndroidX WebKit interfaces
-keepclassmembers class * implements androidx.webkit.WebViewCompat$WebMessageListener {
    public void onPostMessage(android.webkit.WebView, androidx.webkit.WebMessageCompat, android.net.Uri, boolean, androidx.webkit.JavaScriptReplyProxy);
}

# Keep Kotlinx Serialization models and companions
-keepattributes *Annotation*, InnerClasses, Signature
-dontwarn kotlinx.serialization.**
-keepclassmembers class com.goat.webview.** {
    *** Companion;
}
-keepclassmembers class * {
    @kotlinx.serialization.Serializable <fields>;
}

# GoatBridgeActionHandler resolves these registries by string name via Class.forName,
# so R8 must not rename or strip them or plugin/payment auto-registration fails at runtime.
-keep class com.goat.webview.features.GoatPluginRegistry { *; }
-keep class com.goat.webview.features.GoatPaymentPluginRegistry { *; }

# Keep Goat WebView Core Plugin SPI and Bridge Dispatcher
-keep class com.goat.webview.GoatBridgePlugin { *; }
-keep class com.goat.webview.GoatBridgeActionHandler { *; }
-keep class com.goat.webview.GoatBridgeResponse { *; }
-keep class com.goat.webview.GoatBridgeMessage { *; }

# Keep React Native TurboModule & Fabric bindings
-keep class com.goat.webview.rn.** { *; }

# Keep Flutter Pigeon and MethodChannel generated interfaces
-keep class com.goat.webview.flutter.** { *; }

# Preserve Line Numbers for Crash Reporting (MASVS-CODE)
-keepattributes SourceFile, LineNumberTable
-renamesourcefileattribute SourceFile
