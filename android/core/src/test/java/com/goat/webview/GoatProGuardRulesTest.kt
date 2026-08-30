package com.goat.webview

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class GoatProGuardRulesTest {

    @Test
    fun testProGuardRulesFileContainsMandatoryKeepRules() {
        val candidates = listOf(
            File("consumer-rules.pro"),
            File("proguard-rules.pro"),
            File("../app/proguard-rules.pro"),
            File("app/proguard-rules.pro"),
            File("android/app/proguard-rules.pro"),
            File("../core/consumer-rules.pro")
        )
        val rulesFile = candidates.firstOrNull { it.exists() } ?: File("consumer-rules.pro")
        assertTrue("proguard-rules.pro or consumer-rules.pro must exist", rulesFile.exists())

        val appRulesFile = listOf(
            File("../app/proguard-rules.pro"),
            File("app/proguard-rules.pro"),
            File("android/app/proguard-rules.pro"),
            rulesFile
        ).firstOrNull { it.exists() } ?: rulesFile

        val content = appRulesFile.readText()

        // 1. Assert WebMessageListener keep rules
        assertTrue(
            "Must keep WebViewCompat\$WebMessageListener",
            content.contains("WebViewCompat\$WebMessageListener")
        )

        // 2. Assert Kotlinx Serialization keep rules
        assertTrue(
            "Must keep kotlinx.serialization annotations",
            content.contains("kotlinx.serialization")
        )

        // 3. Assert Goat WebView Core and Plugin SPI
        assertTrue(
            "Must keep GoatBridgePlugin SPI",
            content.contains("GoatBridgePlugin")
        )

        // 4. Assert React Native & Flutter keep rules
        assertTrue(
            "Must keep React Native bindings",
            content.contains("com.goat.webview.rn")
        )
        assertTrue(
            "Must keep Flutter bindings",
            content.contains("com.goat.webview.flutter")
        )
    }
}
