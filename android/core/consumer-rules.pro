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

# Keep GoatBridgePlugin SPI
-keep interface com.goat.webview.GoatBridgePlugin { *; }
-keep class * implements com.goat.webview.GoatBridgePlugin { *; }

# GoatBridgeActionHandler resolves these registries by string name via Class.forName,
# so R8 must not rename or strip them or plugin/payment auto-registration fails at runtime.
-keep class com.goat.webview.features.GoatPluginRegistry { *; }
-keep class com.goat.webview.features.GoatPaymentPluginRegistry { *; }
