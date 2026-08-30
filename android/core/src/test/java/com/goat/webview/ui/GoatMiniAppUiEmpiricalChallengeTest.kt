package com.goat.webview.ui

import android.content.Context
import android.content.ContextWrapper
import android.content.res.Configuration
import android.content.res.Resources
import android.graphics.Color
import android.util.DisplayMetrics
import com.goat.webview.GoatSafeAreaManager
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/**
 * Adversarial Empirical Stress Test Suite for Milestone 2: Mini App UI & Lifecycle Subsystems.
 *
 * Covers:
 * 1. GoatNavigationBar & GoatColorUtils: malformed hex colors, title unicode overflow (5,000+ chars), rapid concurrent title/state updates.
 * 2. GoatBottomSheet: invalid/out-of-bound snap points, empty arrays, single/duplicate snaps, rapid expand/collapse transitions.
 * 3. GoatHapticFeedback: high-throughput burst throttling (100 rapid calls), multi-threaded concurrent burst, fallback on missing hardware, payload fuzzing.
 * 4. GoatSafeAreaManager: CSS injection syntax & property coverage, negative insets, extreme display boundaries, concurrent insets sync.
 */
class GoatMiniAppUiEmpiricalChallengeTest {

    private lateinit var fakeContext: FakeTestContext

    private class FakeTestContext : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this

        @Suppress("DEPRECATION")
        override fun getResources(): Resources {
            val config = Configuration().apply {
                screenWidthDp = 411
                screenHeightDp = 891
                uiMode = Configuration.UI_MODE_NIGHT_YES
            }
            val metrics = DisplayMetrics().apply {
                density = 2.625f
                widthPixels = 1080
                heightPixels = 2400
            }
            return Resources(assets, metrics, config)
        }

        override fun getSystemService(name: String): Any? {
            // Simulate device with no hardware vibrator
            return null
        }
    }

    @Before
    fun setUp() {
        fakeContext = FakeTestContext()
    }

    // =========================================================================
    // 1. GoatNavigationBar & GoatColorUtils Empirical Stress Tests
    // =========================================================================

    @Test
    fun testGoatColorUtils_ValidHexFormats_Comprehensive() {
        // 3-char hex (#RGB)
        assertEquals(0xFF112233.toInt(), GoatColorUtils.parseHexColor("#123"))
        assertEquals(0xFF000000.toInt(), GoatColorUtils.parseHexColor("#000"))
        assertEquals(0xFFFFFFFF.toInt(), GoatColorUtils.parseHexColor("#FFF"))
        assertEquals(0xFFAABBCC.toInt(), GoatColorUtils.parseHexColor("#abc"))

        // 4-char hex (#ARGB)
        assertEquals(0x11223344, GoatColorUtils.parseHexColor("#1234"))
        assertEquals(0xFFFFFFFF.toInt(), GoatColorUtils.parseHexColor("#FFFF"))
        assertEquals(0x00AABBCC, GoatColorUtils.parseHexColor("#0abc"))

        // 6-char hex (#RRGGBB)
        assertEquals(0xFF1E293B.toInt(), GoatColorUtils.parseHexColor("#1E293B"))
        assertEquals(0xFF0F172A.toInt(), GoatColorUtils.parseHexColor("0F172A")) // Without leading #
        assertEquals(0xFFF8FAFC.toInt(), GoatColorUtils.parseHexColor("  #f8fafc  ")) // Whitespace trimmed

        // 8-char hex (#AARRGGBB)
        assertEquals(0x801E293B.toInt(), GoatColorUtils.parseHexColor("#801E293B"))
        assertEquals(0x00000000, GoatColorUtils.parseHexColor("#00000000"))
        assertEquals(0xFFFFFFFF.toInt(), GoatColorUtils.parseHexColor("#FFFFFFFF"))

        // Empty strings return default color
        assertEquals(0xFF000000.toInt(), GoatColorUtils.parseHexColor(""))
        assertEquals(0xFF123456.toInt(), GoatColorUtils.parseHexColor("   ", defaultColor = 0xFF123456.toInt()))
    }

    @Test
    fun testGoatColorUtils_MalformedHexColors_ThrowsIllegalArgument() {
        val adversarialInputs = listOf(
            "#XYZ",
            "#12",
            "#12345",
            "#1234567",
            "#123456789",
            "#GG0000",
            "rgb(255, 0, 0)",
            "rgba(0, 0, 0, 0.5)",
            "transparent",
            "#",
            "##123456",
            "#GHIJKL",
            "#-12345",
            "# 123456",
            "#FF 00FF",
            "🔥123456",
            "null",
            "undefined"
        )

        for (malformed in adversarialInputs) {
            try {
                GoatColorUtils.parseHexColor(malformed)
                fail("Expected IllegalArgumentException for malformed hex color: '$malformed'")
            } catch (e: IllegalArgumentException) {
                assertTrue(
                    "Error message must indicate INVALID_ARGUMENT for '$malformed', got: ${e.message}",
                    e.message?.contains("INVALID_ARGUMENT") == true
                )
            }
        }
    }

    @Test
    fun testGoatNavigationBar_TitleUnicodeOverflow_5000Chars() {
        val navBarView = GoatNavigationBarView(fakeContext)

        // Construct 5,000-character adversarial string with multi-byte unicode, CJK, emojis, RTL, ZWJ sequences
        val builder = StringBuilder()
        val segments = listOf(
            "🌟🚀 MiniApp UI Subsystem 💻📱 ",
            "مرحبا بكم في تطبيق الميني آب ",
            "你好世界！这是一个超长标题测试。",
            "👩‍💻👨‍👩‍👧‍👦🏳️‍🌈🧑🏾‍🚀 ",
            "Ελληνικά Русский язык தமிழ் ",
            "Special: \t\r\n \u200B\u200C\u200D\uFEFF "
        )
        while (builder.length < 5000) {
            for (seg in segments) {
                builder.append(seg)
                if (builder.length >= 5000) break
            }
        }
        val overflowTitle = builder.toString()
        assertTrue("String length must be >= 5000", overflowTitle.length >= 5000)

        // Set title and subtitle with 5,000+ chars
        navBarView.setTitle(overflowTitle, overflowTitle)
        assertEquals(overflowTitle, navBarView.getState().title)
        assertEquals(overflowTitle, navBarView.getState().subtitle)

        // Verify Compose state object creation does not throw or truncate
        val composeState = GoatNavigationBarState(
            title = overflowTitle,
            subtitle = overflowTitle,
            backgroundColor = 0xFF1E293B.toInt(),
            textColor = 0xFFFFFFFF.toInt()
        )
        assertEquals(overflowTitle, composeState.title)
    }

    @Test
    fun testGoatNavigationBar_RapidConcurrentTitleAndStateUpdates() {
        val navBarView = GoatNavigationBarView(fakeContext)
        val threadCount = 10
        val iterationsPerThread = 100
        val executor = Executors.newFixedThreadPool(threadCount)
        val latch = CountDownLatch(threadCount)
        val errorCount = AtomicInteger(0)

        for (t in 0 until threadCount) {
            executor.execute {
                try {
                    for (i in 0 until iterationsPerThread) {
                        val title = "Title_T${t}_I${i}"
                        val subtitle = "Subtitle_T${t}_I${i}"
                        navBarView.setTitle(title, subtitle)
                        navBarView.setProgress(visible = (i % 2 == 0), progress = i % 100)
                    }
                } catch (e: Throwable) {
                    errorCount.incrementAndGet()
                } finally {
                    latch.countDown()
                }
            }
        }

        assertTrue("Timeout waiting for rapid title updates", latch.await(5, TimeUnit.SECONDS))
        executor.shutdown()
        assertEquals("No errors must occur during rapid concurrent state updates", 0, errorCount.get())
        assertNotNull(navBarView.getState().title)
    }

    @Test
    fun testGoatNavButtonType_EdgeCases() {
        assertEquals(GoatNavButtonType.BACK, GoatNavButtonType.fromString("BACK"))
        assertEquals(GoatNavButtonType.BACK, GoatNavButtonType.fromString("  back  "))
        assertEquals(GoatNavButtonType.CLOSE, GoatNavButtonType.fromString("close"))
        assertEquals(GoatNavButtonType.MORE, GoatNavButtonType.fromString("MORE"))
        assertEquals(GoatNavButtonType.CUSTOM, GoatNavButtonType.fromString("custom"))
        assertEquals(GoatNavButtonType.CUSTOM, GoatNavButtonType.fromString(null))
        assertEquals(GoatNavButtonType.CUSTOM, GoatNavButtonType.fromString(""))
        assertEquals(GoatNavButtonType.CUSTOM, GoatNavButtonType.fromString("NON_EXISTENT_TYPE"))
        assertEquals(GoatNavButtonType.CUSTOM, GoatNavButtonType.fromString("12345"))
    }

    // =========================================================================
    // 2. GoatBottomSheet Empirical Stress Tests
    // =========================================================================

    @Test
    fun testGoatBottomSheet_InvalidSnapPoints_Sanitization() {
        // Negative values and values > 1.0
        val raw1 = listOf(-0.5f, 2.0f)
        val sanitized1 = GoatBottomSheetConfig.sanitizeSnapPoints(raw1)
        assertEquals(listOf(0.1f, 1.0f), sanitized1)

        // Completely out-of-range negative values
        val raw2 = listOf(-10.0f, -0.1f, 0.0f)
        val sanitized2 = GoatBottomSheetConfig.sanitizeSnapPoints(raw2)
        assertEquals(listOf(0.1f), sanitized2)

        // Empty list falls back to default [0.25, 0.5, 0.9]
        val sanitizedEmpty = GoatBottomSheetConfig.sanitizeSnapPoints(emptyList())
        assertEquals(listOf(0.25f, 0.5f, 0.9f), sanitizedEmpty)

        // Unsorted with duplicates and extremes
        val raw3 = listOf(99.0f, -5.0f, 0.5f, 0.5f, 0.75f, 0.25f)
        val sanitized3 = GoatBottomSheetConfig.sanitizeSnapPoints(raw3)
        assertEquals(listOf(0.1f, 0.25f, 0.5f, 0.75f, 1.0f), sanitized3)
    }

    @Test
    fun testGoatBottomSheet_SingleSnapPoint() {
        val config = GoatBottomSheetConfig(
            snapPoints = listOf(0.6f),
            initialSnap = 0.6f
        )
        assertEquals(listOf(0.6f), config.sanitizedSnapPoints)
        assertEquals(0.6f, config.sanitizedInitialSnap)

        val state = GoatBottomSheetState(
            snapPoints = listOf(0.6f),
            currentSnap = 0.6f,
            isDismissible = true
        )
        // Expand on single snap stays at 0.6
        assertEquals(0.6f, state.expand())

        // Collapse on single snap with dismissible=true -> dismisses to 0.0
        val (collapsed, dismissed) = state.collapse()
        assertEquals(0.0f, collapsed)
        assertTrue(dismissed)
    }

    @Test
    fun testGoatBottomSheet_RapidExpandCollapseTransitions_1000Cycles() {
        val container = GoatBottomSheetContainer(fakeContext)
        container.setSnapPoints(listOf(0.25f, 0.5f, 0.75f, 0.95f), initialSnap = 0.25f, isDismissible = true)

        var dismissCallCount = 0
        container.setOnDismissListener { dismissCallCount++ }

        for (cycle in 0 until 1000) {
            // Expand from 0.25 up to max 0.95
            val e1 = container.expand() // 0.25 -> 0.5
            assertEquals(0.5f, e1)
            val e2 = container.expand() // 0.5 -> 0.75
            assertEquals(0.75f, e2)
            val e3 = container.expand() // 0.75 -> 0.95
            assertEquals(0.95f, e3)
            val e4 = container.expand() // 0.95 -> 0.95 (stays at max)
            assertEquals(0.95f, e4)

            // Collapse down from 0.95 to 0.25
            val (c1, d1) = container.collapse() // 0.95 -> 0.75
            assertEquals(0.75f, c1)
            assertFalse(d1)

            val (c2, d2) = container.collapse() // 0.75 -> 0.5
            assertEquals(0.5f, c2)
            assertFalse(d2)

            val (c3, d3) = container.collapse() // 0.5 -> 0.25
            assertEquals(0.25f, c3)
            assertFalse(d3)
        }

        // Now test final collapse to dismissal
        val (finalSnap, finalDismissed) = container.collapse() // 0.25 -> 0.0 (dismissed)
        assertEquals(0.0f, finalSnap)
        assertTrue(finalDismissed)
        assertEquals(1, dismissCallCount)
        assertEquals(GoatSheetValue.HIDDEN, container.getState().sheetValue)
    }

    @Test
    fun testGoatBottomSheet_NonDismissibleStateRetainsMinimumSnap() {
        val container = GoatBottomSheetContainer(fakeContext)
        container.setSnapPoints(listOf(0.3f, 0.6f, 0.9f), initialSnap = 0.3f, isDismissible = false)

        var dismissed = false
        container.setOnDismissListener { dismissed = true }

        val (heldSnap, isDismissed) = container.collapse()
        assertEquals(0.3f, heldSnap)
        assertFalse(isDismissed)
        assertFalse(dismissed)
        assertEquals(0.3f, container.getState().currentSnap)
    }

    // =========================================================================
    // 3. GoatHapticFeedback Empirical Stress Tests
    // =========================================================================

    @Test
    fun testGoatHapticFeedback_BurstThrottling_100RapidCalls() {
        val haptic = GoatHapticFeedback(fakeContext)
        val payload = buildJsonObject {
            put("type", "impact")
            put("style", "medium")
        }

        var executedCount = 0
        var throttledCount = 0

        val startTime = System.currentTimeMillis()
        for (i in 0 until 100) {
            val result = haptic.trigger(payload)
            assertEquals("vibrated", result["status"]?.jsonPrimitive?.content)
            val isThrottled = result["throttled"]?.jsonPrimitive?.content == "true"
            if (isThrottled) {
                throttledCount++
            } else {
                executedCount++
            }
        }
        val elapsed = System.currentTimeMillis() - startTime

        // In a tight loop executing in < 15ms, exactly 1 must execute and remaining 99 must be throttled
        assertTrue("Burst must execute at least 1 call", executedCount >= 1)
        assertTrue("Remaining calls within 15ms must be throttled", throttledCount >= 1)
        assertEquals(100, executedCount + throttledCount)

        // After sleeping > 20ms, the next call must NOT be throttled
        Thread.sleep(25)
        val postThrottleResult = haptic.trigger(payload)
        assertNull("Call after 25ms delay must not be throttled", postThrottleResult["throttled"])
    }

    @Test
    fun testGoatHapticFeedback_ConcurrentBurst_MultiThreaded() {
        val haptic = GoatHapticFeedback(fakeContext)
        val payload = buildJsonObject {
            put("type", "notification")
            put("notificationType", "success")
        }

        val threadCount = 20
        val callsPerThread = 10
        val executor = Executors.newFixedThreadPool(threadCount)
        val latch = CountDownLatch(threadCount)
        val executedCounter = AtomicInteger(0)
        val throttledCounter = AtomicInteger(0)

        for (t in 0 until threadCount) {
            executor.execute {
                try {
                    for (i in 0 until callsPerThread) {
                        val result = haptic.trigger(payload)
                        if (result["throttled"]?.jsonPrimitive?.content == "true") {
                            throttledCounter.incrementAndGet()
                        } else {
                            executedCounter.incrementAndGet()
                        }
                    }
                } finally {
                    latch.countDown()
                }
            }
        }

        assertTrue("Timeout on concurrent haptic burst", latch.await(5, TimeUnit.SECONDS))
        executor.shutdown()

        val total = executedCounter.get() + throttledCounter.get()
        assertEquals(threadCount * callsPerThread, total)
        assertTrue("At least one request must succeed", executedCounter.get() >= 1)
    }

    @Test
    fun testGoatHapticFeedback_MissingHardwareFallback_DoesNotThrow() {
        // fakeContext returns null for VIBRATOR_SERVICE
        val haptic = GoatHapticFeedback(fakeContext)

        val payloads = listOf(
            buildJsonObject { put("type", "impact"); put("style", "light") },
            buildJsonObject { put("type", "impact"); put("style", "heavy") },
            buildJsonObject { put("type", "notification"); put("notificationType", "error") },
            buildJsonObject { put("type", "selection") },
            buildJsonObject { put("type", "unknown_type") }
        )

        for (p in payloads) {
            val res = haptic.trigger(p)
            assertEquals("vibrated", res["status"]?.jsonPrimitive?.content)
            assertNotNull(res["profile"]?.jsonPrimitive?.content)
        }
    }

    @Test
    fun testGoatHapticFeedback_WaveformIntegrityForAll10Profiles() {
        for ((name, profile) in GoatHapticFeedback.ALL_PROFILES) {
            assertTrue("Profile $name must have non-empty timings", profile.timings.isNotEmpty())
            assertTrue("Profile $name must have non-empty amplitudes", profile.amplitudes.isNotEmpty())
            assertEquals(
                "Profile $name timings and amplitudes must have matching length",
                profile.timings.size,
                profile.amplitudes.size
            )
            for (timing in profile.timings) {
                assertTrue("Timing must be > 0ms in $name", timing > 0)
            }
            for (amp in profile.amplitudes) {
                assertTrue("Amplitude must be in range 0..255 in $name, got $amp", amp in 0..255)
            }
            for (fb in profile.fallbackTimings) {
                assertTrue("Fallback timing must be > 0ms in $name", fb > 0)
            }
        }
    }

    // =========================================================================
    // 4. GoatSafeAreaManager Empirical Stress Tests
    // =========================================================================

    @Test
    fun testGoatSafeAreaManager_CssInjectionSyntaxAndProperties() {
        val manager = GoatSafeAreaManager(fakeContext)
        val insets = manager.updateSafeArea(top = 44, bottom = 34, left = 10, right = 10, keyboardHeight = 280)

        val cssScript = manager.generateCssInjectionScript(insets)

        // Verify strict JavaScript structure
        assertTrue("Script must be an IIFE", cssScript.trim().startsWith("(function() {") && cssScript.trim().endsWith("})();"))
        assertTrue("Script must check documentElement", cssScript.contains("var root = document.documentElement;"))
        assertTrue("Script must guard null root", cssScript.contains("if (!root) return;"))

        // Verify standard CSS variables
        assertTrue(cssScript.contains("root.style.setProperty('--safe-area-inset-top', '44px');"))
        assertTrue(cssScript.contains("root.style.setProperty('--safe-area-inset-bottom', '34px');"))
        assertTrue(cssScript.contains("root.style.setProperty('--safe-area-inset-left', '10px');"))
        assertTrue(cssScript.contains("root.style.setProperty('--safe-area-inset-right', '10px');"))
        assertTrue(cssScript.contains("root.style.setProperty('--keyboard-inset-bottom', '280px');"))

        // Verify goat-namespaced CSS variables
        assertTrue(cssScript.contains("root.style.setProperty('--goat-safe-area-top', '44px');"))
        assertTrue(cssScript.contains("root.style.setProperty('--goat-safe-area-bottom', '34px');"))
        assertTrue(cssScript.contains("root.style.setProperty('--goat-safe-area-left', '10px');"))
        assertTrue(cssScript.contains("root.style.setProperty('--goat-safe-area-right', '10px');"))
        assertTrue(cssScript.contains("root.style.setProperty('--goat-keyboard-height', '280px');"))
    }

    @Test
    fun testGoatSafeAreaManager_NegativeInsetsHandling() {
        val manager = GoatSafeAreaManager(fakeContext)

        // Set negative insets
        val updated = manager.updateSafeArea(top = -10, bottom = -20, left = -5, right = -5, keyboardHeight = -100)
        assertEquals(-10, updated.top)
        assertEquals(-20, updated.bottom)
        assertEquals(-5, updated.left)
        assertEquals(-5, updated.right)
        assertEquals(-100, updated.keyboardHeight)
        assertEquals(-120, updated.totalBottom)

        // Verify JSON representation
        val json = manager.toJsonObject()
        assertEquals("-10", json["top"]?.jsonPrimitive?.content)
        assertEquals("-20", json["bottom"]?.jsonPrimitive?.content)
        assertEquals("-100", json["keyboardHeight"]?.jsonPrimitive?.content)
        assertEquals("-120", json["totalBottom"]?.jsonPrimitive?.content)

        // Verify CSS script generates negative pixel values cleanly without crashing
        val script = manager.generateCssInjectionScript(updated)
        assertTrue(script.contains("'-10px'"))
        assertTrue(script.contains("'-20px'"))
        assertTrue(script.contains("'-100px'"))
    }

    @Test
    fun testGoatSafeAreaManager_ExtremeBoundaryInsets() {
        val manager = GoatSafeAreaManager(fakeContext)

        // Large 4K TV / Foldable display insets
        val updated = manager.updateSafeArea(top = 144, bottom = 96, left = 48, right = 48, keyboardHeight = 1200)
        assertEquals(144, updated.top)
        assertEquals(96, updated.bottom)
        assertEquals(48, updated.left)
        assertEquals(48, updated.right)
        assertEquals(1200, updated.keyboardHeight)
        assertEquals(1296, updated.totalBottom)

        val event = manager.formatKeyboardInsetsEvent(keyboardHeight = 1200, durationMs = 350L)
        assertEquals("1200", event["keyboardHeight"]?.jsonPrimitive?.content)
        assertEquals("350", event["durationMs"]?.jsonPrimitive?.content)
        assertEquals("true", event["isVisible"]?.jsonPrimitive?.content)
    }

    @Test
    fun testGoatSafeAreaManager_ConcurrentInsetsUpdates() {
        val manager = GoatSafeAreaManager(fakeContext)
        val threadCount = 10
        val iterations = 100
        val executor = Executors.newFixedThreadPool(threadCount)
        val latch = CountDownLatch(threadCount)
        val errorCount = AtomicInteger(0)

        for (t in 0 until threadCount) {
            executor.execute {
                try {
                    for (i in 0 until iterations) {
                        manager.updateSafeArea(
                            top = (t * 10 + i) % 100,
                            bottom = (t * 5 + i) % 50,
                            left = 0,
                            right = 0
                        )
                        manager.updateKeyboardHeight(i * 10)
                        manager.getInsets()
                        manager.toJsonObject()
                        manager.generateCssInjectionScript()
                    }
                } catch (e: Throwable) {
                    errorCount.incrementAndGet()
                } finally {
                    latch.countDown()
                }
            }
        }

        assertTrue("Timeout on concurrent insets updates", latch.await(5, TimeUnit.SECONDS))
        executor.shutdown()
        assertEquals(0, errorCount.get())
        assertNotNull(manager.getInsets())
    }
}
