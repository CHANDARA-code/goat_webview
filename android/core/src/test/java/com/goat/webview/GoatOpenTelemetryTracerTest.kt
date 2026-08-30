package com.goat.webview

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GoatOpenTelemetryTracerTest {

    private lateinit var tracer: GoatOpenTelemetryTracer

    @Before
    fun setUp() {
        tracer = GoatOpenTelemetryTracer()
    }

    @Test
    fun testSpanLifecycleAndW3cHeader() {
        val span = tracer.startSpan("bridge.callNative")
        assertNotNull(span)
        assertEquals(1, tracer.getActiveSpanCount())

        val traceparent = tracer.formatW3cTraceparent(span)
        assertTrue(traceparent.startsWith("00-"))
        assertEquals(55, traceparent.length) // 00-32hex-16hex-01 = 2+1+32+1+16+1+2 = 55

        val duration = tracer.endSpan(span.spanId)
        assertNotNull(duration)
        assertEquals(0, tracer.getActiveSpanCount())
        assertEquals(1, tracer.getCompletedSpanCount())
    }
}
