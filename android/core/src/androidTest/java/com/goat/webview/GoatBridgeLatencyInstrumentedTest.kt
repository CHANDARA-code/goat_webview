package com.goat.webview

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Bridge round-trip latency verification: bridge round-trip warm path < 5 ms.
 *
 * Measures `BRIDGE_PING`, the engine's zero-dispatch probe — it is the first branch of
 * `GoatBridgeActionHandler.executeAction` and returns the payload before any manager access,
 * permission check or abuse-guard evaluation. That makes it a measure of dispatch overhead itself,
 * with no feature work mixed in.
 *
 * **What this does and does not include.** It is the native handler round trip on a real device:
 * coroutine dispatch, JSON payload handling and the action switch. It does **not** include the
 * JavaScript-to-native `WebMessageListener` hop, so it is a floor for the full round trip rather
 * than the whole of it. Labelled precisely because a latency number attributed to the wrong span
 * is how this repo has produced confident, wrong figures before.
 *
 * Run: `./gradlew -p android :core:connectedDebugAndroidTest --tests '*BridgeLatency*'`
 */
@RunWith(AndroidJUnit4::class)
class GoatBridgeLatencyInstrumentedTest {

    private val warmupIterations = 200
    private val measuredIterations = 1000
    private val budgetMs = 5.0

    @Test
    fun bridgePingWarmPathStaysUnderTheFiveMillisecondBudget() = runBlocking {
        val context: Context = ApplicationProvider.getApplicationContext()
        val handler = GoatBridgeActionHandler(context = context, appId = "latency_probe")
        val payload = buildJsonObject {
            put("probe", "bridge-latency")
            put("nonce", 42)
        }

        repeat(warmupIterations) { handler.executeAction("BRIDGE_PING", payload) }

        val samples = DoubleArray(measuredIterations)
        for (i in 0 until measuredIterations) {
            val started = System.nanoTime()
            val result = handler.executeAction("BRIDGE_PING", payload)
            samples[i] = (System.nanoTime() - started) / 1_000_000.0
            assertTrue("BRIDGE_PING must echo successfully", result.isSuccess)
        }

        samples.sort()
        val p50 = samples[measuredIterations / 2]
        val p95 = samples[(measuredIterations * 95) / 100]
        val p99 = samples[(measuredIterations * 99) / 100]

        // Printed so the benchmark script can surface real numbers rather than a bare pass/fail.
        println("BENCHMARK bridge_ping_native_dispatch p50Ms=$p50 p95Ms=$p95 p99Ms=$p99")

        assertTrue(
            "BRIDGE_PING p95 was ${p95}ms, over the ${budgetMs}ms warm-path budget",
            p95 < budgetMs
        )
    }

    @Test
    fun anUnknownActionIsRejectedWithoutCostingMoreThanTheBudget() {
        // A hostile page can spray unknown actions; rejection must be as cheap as a hit, or the
        // rejection path itself becomes the denial-of-service.
        runBlocking {
            val context: Context = ApplicationProvider.getApplicationContext()
            val handler = GoatBridgeActionHandler(context = context, appId = "latency_probe")
            val payload = buildJsonObject { put("probe", "unknown") }

            repeat(warmupIterations) { handler.executeAction("NOT_A_REAL_ACTION", payload) }

            val started = System.nanoTime()
            repeat(measuredIterations) { handler.executeAction("NOT_A_REAL_ACTION", payload) }
            val perCallMs = (System.nanoTime() - started) / measuredIterations / 1_000_000.0

            println("BENCHMARK unknown_action_rejection perCallMs=$perCallMs")
            assertTrue(
                "Unknown-action rejection took ${perCallMs}ms/call, over the ${budgetMs}ms budget",
                perCallMs < budgetMs
            )
        }
    }
}
