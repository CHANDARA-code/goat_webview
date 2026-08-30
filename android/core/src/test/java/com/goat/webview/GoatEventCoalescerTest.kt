package com.goat.webview

import com.goat.webview.ipc.GoatEventCoalescer
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

@OptIn(ExperimentalCoroutinesApi::class)
class GoatEventCoalescerTest {

    /**
     * Test 1: Synthetic flood of 1,000 identical-payload calls to emit() results in exactly 1 JS-side dispatch.
     */
    @Test
    fun testSyntheticFloodOf1000IdenticalPayloadsResultsInExactlyOneDispatch() = runTest {
        val coalescer = GoatEventCoalescer(
            scope = this,
            defaultMinIntervalMs = 50L,
            timeProvider = { testScheduler.currentTime }
        )
        val dispatchCount = AtomicInteger(0)
        val payload = buildJsonObject {
            put("width", 1080)
            put("height", 1920)
            put("scale", 2.0)
        }

        var acceptedCount = 0
        for (i in 1..1000) {
            val accepted = coalescer.emit("ON_VIEWPORT_CHANGED", payload) { _, _ ->
                dispatchCount.incrementAndGet()
            }
            if (accepted) acceptedCount++
        }

        advanceTimeBy(100)

        assertEquals("Expected exactly 1 accepted emit out of 1000 identical calls", 1, acceptedCount)
        assertEquals("Expected exactly 1 JS-side dispatch", 1, dispatchCount.get())
        assertEquals(payload, coalescer.getLastEmitted("ON_VIEWPORT_CHANGED"))
        assertNull(coalescer.getPending("ON_VIEWPORT_CHANGED"))
    }

    /**
     * Test 2: Rapidly changing payload bursts dispatch updates <= once per minIntervalMs, always delivering latest state.
     */
    @Test
    fun testRapidlyChangingPayloadBurstsDeliverAtMostOncePerMinIntervalWithLatestState() = runTest {
        val coalescer = GoatEventCoalescer(
            scope = this,
            defaultMinIntervalMs = 50L,
            timeProvider = { testScheduler.currentTime }
        )
        val dispatchedPayloads = mutableListOf<JsonObject>()

        // Burst 1: t=0ms. 10 rapid samples (10 to 100).
        for (i in 1..10) {
            val payload = buildJsonObject { put("scrollOffset", i * 10) }
            coalescer.emit("ON_PAGE_SCROLL", payload, minIntervalMs = 50L) { _, p ->
                dispatchedPayloads.add(p)
            }
        }

        // Leading edge emitted offset 10 immediately at t=0ms
        assertEquals(1, dispatchedPayloads.size)
        assertEquals("10", dispatchedPayloads[0]["scrollOffset"]?.jsonPrimitive?.content)

        // Advance past throttle window (50ms) -> trailing edge fires at t=50ms
        advanceTimeBy(60)

        // Trailing edge should have emitted offset 100
        assertEquals(2, dispatchedPayloads.size)
        assertEquals("100", dispatchedPayloads[1]["scrollOffset"]?.jsonPrimitive?.content)
        assertNull(coalescer.getPending("ON_PAGE_SCROLL"))

        // Advance further to t=110ms (more than 50ms after the t=50ms trailing dispatch)
        advanceTimeBy(50)

        // Burst 2: t=110ms. 5 rapid samples (200 to 600)
        for (i in 2..6) {
            val payload = buildJsonObject { put("scrollOffset", i * 100) }
            coalescer.emit("ON_PAGE_SCROLL", payload, minIntervalMs = 50L) { _, p ->
                dispatchedPayloads.add(p)
            }
        }

        // Leading edge for second burst emits 200 immediately at t=110ms
        assertEquals(3, dispatchedPayloads.size)
        assertEquals("200", dispatchedPayloads[2]["scrollOffset"]?.jsonPrimitive?.content)

        advanceTimeBy(60)

        // Trailing edge for second burst emits 600 at t=160ms
        assertEquals(4, dispatchedPayloads.size)
        assertEquals("600", dispatchedPayloads[3]["scrollOffset"]?.jsonPrimitive?.content)
    }

    /**
     * Test 3: Multi-key isolation (e.g. "KEYBOARD" and "SENSOR" operating simultaneously without interference).
     */
    @Test
    fun testMultiKeyIsolationBetweenIndependentEventStreams() = runTest {
        val coalescer = GoatEventCoalescer(
            scope = this,
            defaultMinIntervalMs = 50L,
            timeProvider = { testScheduler.currentTime }
        )
        val keyboardDispatches = mutableListOf<JsonObject>()
        val sensorDispatches = mutableListOf<JsonObject>()

        // Emit initial keyboard event
        val kb1 = buildJsonObject { put("height", 300) }
        coalescer.emit("KEYBOARD", kb1, minIntervalMs = 50L) { _, p ->
            keyboardDispatches.add(p)
        }

        // Emit initial sensor event (16ms interval)
        val s1 = buildJsonObject { put("x", 1.0f); put("y", 2.0f) }
        coalescer.emit("SENSOR", s1, minIntervalMs = 16L) { _, p ->
            sensorDispatches.add(p)
        }

        assertEquals(1, keyboardDispatches.size)
        assertEquals(1, sensorDispatches.size)

        // Rapid burst of sensor updates
        for (i in 2..5) {
            val s = buildJsonObject { put("x", i.toFloat()); put("y", (i * 2).toFloat()) }
            coalescer.emit("SENSOR", s, minIntervalMs = 16L) { _, p ->
                sensorDispatches.add(p)
            }
        }

        // Rapid burst of keyboard updates
        for (h in listOf(310, 320, 350)) {
            val kb = buildJsonObject { put("height", h) }
            coalescer.emit("KEYBOARD", kb, minIntervalMs = 50L) { _, p ->
                keyboardDispatches.add(p)
            }
        }

        // Advance 20ms: Sensor (16ms) fires trailing edge, but Keyboard (50ms) remains pending
        advanceTimeBy(20)
        assertEquals(2, sensorDispatches.size)
        assertEquals("5.0", sensorDispatches[1]["x"]?.jsonPrimitive?.content)
        assertEquals(1, keyboardDispatches.size) // Keyboard still pending at t=20ms

        // Advance remaining 35ms: Keyboard reaches 50ms and fires trailing edge
        advanceTimeBy(35)
        assertEquals(2, keyboardDispatches.size)
        assertEquals("350", keyboardDispatches[1]["height"]?.jsonPrimitive?.content)
    }

    /**
     * Test 4: Explicit flush(eventKey) and flushAll() delivering pending payloads immediately and cancelling timers.
     */
    @Test
    fun testFlushAndFlushAllDeliverPendingPayloadsImmediatelyAndCancelTimers() = runTest {
        val coalescer = GoatEventCoalescer(
            scope = this,
            defaultMinIntervalMs = 50L,
            timeProvider = { testScheduler.currentTime }
        )
        val dispatched = mutableListOf<Pair<String, JsonObject>>()

        // Leading edge
        val kb1 = buildJsonObject { put("height", 100) }
        coalescer.emit("KEYBOARD", kb1, 50L) { k, p -> dispatched.add(k to p) }
        assertEquals(1, dispatched.size)

        // Trailing pending
        val kb2 = buildJsonObject { put("height", 250) }
        coalescer.emit("KEYBOARD", kb2, 50L) { k, p -> dispatched.add(k to p) }
        assertEquals(1, dispatched.size)
        assertEquals(kb2, coalescer.getPending("KEYBOARD"))

        // Flush single key immediately before timer expiration
        val flushed = coalescer.flush("KEYBOARD")
        assertTrue("Expected flush to return true", flushed)
        assertEquals(2, dispatched.size)
        assertEquals("250", dispatched[1].second["height"]?.jsonPrimitive?.content)
        assertNull(coalescer.getPending("KEYBOARD"))

        // Further time advance does NOT dispatch duplicate
        advanceTimeBy(100)
        assertEquals(2, dispatched.size)

        // Test flushAll across multiple keys
        val s1 = buildJsonObject { put("x", 10.0) }
        val s2 = buildJsonObject { put("x", 20.0) }
        val v1 = buildJsonObject { put("scale", 1.0) }
        val v2 = buildJsonObject { put("scale", 1.5) }

        coalescer.emit("SENSOR", s1, 50L) { k, p -> dispatched.add(k to p) }
        coalescer.emit("SENSOR", s2, 50L) { k, p -> dispatched.add(k to p) }
        coalescer.emit("VIEWPORT", v1, 50L) { k, p -> dispatched.add(k to p) }
        coalescer.emit("VIEWPORT", v2, 50L) { k, p -> dispatched.add(k to p) }

        // Leading edges dispatched immediately
        assertEquals(4, dispatched.size)
        assertEquals(s2, coalescer.getPending("SENSOR"))
        assertEquals(v2, coalescer.getPending("VIEWPORT"))

        val flushCount = coalescer.flushAll()
        assertEquals(2, flushCount)
        assertEquals(6, dispatched.size)
        assertNull(coalescer.getPending("SENSOR"))
        assertNull(coalescer.getPending("VIEWPORT"))

        // Calling flush on empty pending returns false / 0
        assertFalse(coalescer.flush("SENSOR"))
        assertEquals(0, coalescer.flushAll())
    }

    /**
     * Test 5: cancel(eventKey) and cancelAll() discarding pending payloads and cancelling jobs.
     */
    @Test
    fun testCancelAndCancelAllDiscardPendingPayloadsAndCancelJobs() = runTest {
        val coalescer = GoatEventCoalescer(
            scope = this,
            defaultMinIntervalMs = 50L,
            timeProvider = { testScheduler.currentTime }
        )
        val dispatched = mutableListOf<JsonObject>()

        val p1 = buildJsonObject { put("val", 1) }
        val p2 = buildJsonObject { put("val", 2) }

        coalescer.emit("KEY1", p1, 50L) { _, p -> dispatched.add(p) }
        coalescer.emit("KEY1", p2, 50L) { _, p -> dispatched.add(p) }

        assertEquals(1, dispatched.size)
        assertEquals(p2, coalescer.getPending("KEY1"))

        // Cancel KEY1
        coalescer.cancel("KEY1")
        assertNull(coalescer.getPending("KEY1"))
        assertEquals(p1, coalescer.getLastEmitted("KEY1")) // Last emitted history preserved

        // Advance time — should not fire p2
        advanceTimeBy(100)
        assertEquals(1, dispatched.size)

        // Test cancelAll across multiple active keys
        val p3 = buildJsonObject { put("val", 3) }
        val p4 = buildJsonObject { put("val", 4) }
        coalescer.emit("KEY2", p1, 50L) { _, p -> dispatched.add(p) }
        coalescer.emit("KEY2", p3, 50L) { _, p -> dispatched.add(p) }
        coalescer.emit("KEY3", p1, 50L) { _, p -> dispatched.add(p) }
        coalescer.emit("KEY3", p4, 50L) { _, p -> dispatched.add(p) }

        assertEquals(3, dispatched.size) // Leading edges for KEY1, KEY2, KEY3
        assertEquals(p3, coalescer.getPending("KEY2"))
        assertEquals(p4, coalescer.getPending("KEY3"))

        coalescer.cancelAll()
        assertNull(coalescer.getPending("KEY2"))
        assertNull(coalescer.getPending("KEY3"))

        advanceTimeBy(100)
        assertEquals(3, dispatched.size) // No trailing dispatches occurred
    }

    /**
     * Test 6: Multi-threaded concurrent emissions stress test.
     */
    @Test
    fun testMultiThreadedConcurrentEmissionsStressTest() {
        val coalescer = GoatEventCoalescer(defaultMinIntervalMs = 20L)
        val dispatchCount = AtomicInteger(0)
        val threadCount = 10
        val iterationsPerThread = 50
        val latch = CountDownLatch(threadCount)
        val executor = Executors.newFixedThreadPool(threadCount)

        for (t in 0 until threadCount) {
            executor.submit {
                try {
                    for (i in 0 until iterationsPerThread) {
                        val payload = buildJsonObject {
                            put("thread", t)
                            put("index", i)
                        }
                        coalescer.emit("CONCURRENT_KEY", payload, minIntervalMs = 20L) { _, _ ->
                            dispatchCount.incrementAndGet()
                        }
                        Thread.sleep(1)
                    }
                } finally {
                    latch.countDown()
                }
            }
        }

        assertTrue("Timed out waiting for concurrent threads", latch.await(10, TimeUnit.SECONDS))
        executor.shutdown()

        // Wait brief moment or flush trailing
        Thread.sleep(50)
        coalescer.flush("CONCURRENT_KEY") { _, _ ->
            dispatchCount.incrementAndGet()
        }

        val totalEmits = threadCount * iterationsPerThread
        val finalDispatches = dispatchCount.get()
        assertTrue("Expected positive dispatches, got $finalDispatches", finalDispatches > 0)
        assertTrue(
            "Expected throttling to reduce $totalEmits events to far fewer dispatches (got $finalDispatches)",
            finalDispatches < totalEmits
        )

        coalescer.reset()
        assertNull(coalescer.getLastEmitted("CONCURRENT_KEY"))
        assertNull(coalescer.getPending("CONCURRENT_KEY"))
    }

    /**
     * Test: Alternating values deduplication and zero interval handling.
     */
    @Test
    fun testAlternatingValuesAndZeroInterval() {
        val testScope = TestScope(StandardTestDispatcher())
        val coalescer = GoatEventCoalescer(
            scope = testScope,
            defaultMinIntervalMs = 0L,
            timeProvider = { testScope.testScheduler.currentTime }
        )
        val dispatched = mutableListOf<String>()

        val a = buildJsonObject { put("state", "A") }
        val b = buildJsonObject { put("state", "B") }

        // A -> A -> B -> B -> A -> A
        coalescer.emit("STATE", a, 0L) { _, p -> dispatched.add(p["state"]!!.jsonPrimitive.content) }
        coalescer.emit("STATE", a, 0L) { _, p -> dispatched.add(p["state"]!!.jsonPrimitive.content) }
        coalescer.emit("STATE", b, 0L) { _, p -> dispatched.add(p["state"]!!.jsonPrimitive.content) }
        coalescer.emit("STATE", b, 0L) { _, p -> dispatched.add(p["state"]!!.jsonPrimitive.content) }
        coalescer.emit("STATE", a, 0L) { _, p -> dispatched.add(p["state"]!!.jsonPrimitive.content) }
        coalescer.emit("STATE", a, 0L) { _, p -> dispatched.add(p["state"]!!.jsonPrimitive.content) }

        assertEquals(listOf("A", "B", "A"), dispatched)

        coalescer.reset()
        assertNull(coalescer.getLastEmitted("STATE"))
    }
}
