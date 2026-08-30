package com.goat.webview

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class GoatEnterpriseManagersHardeningTest {

    @Test
    fun `test Secure Enclave key generation, rotation, and retirement`() = runTest {
        val rotator = GoatSecureEnclaveKeyRotator()

        // 1. Initial key generation — rotateKey returns version Int
        val version1 = rotator.rotateKey("tenant_enterprise_1")
        assertEquals(1, version1)
        assertEquals(1, rotator.getActiveKeyVersion("tenant_enterprise_1"))

        // 2. Key rotation increments version
        val version2 = rotator.rotateKey("tenant_enterprise_1")
        assertEquals(2, version2)
        assertEquals(2, rotator.getActiveKeyVersion("tenant_enterprise_1"))

        // 3. Retrieval of active key (latest)
        val activeKey = rotator.getKey("tenant_enterprise_1")
        assertNotNull(activeKey)

        // 4. Retrieval of retired version 1
        val retiredKey = rotator.getKey("tenant_enterprise_1", version = 1)
        assertNotNull(retiredKey)

        // 5. Purge all keys for tenant
        rotator.purgeTenantKeys("tenant_enterprise_1")
        assertEquals(0, rotator.getActiveKeyVersion("tenant_enterprise_1"))
        assertFalse(rotator.getKey("tenant_enterprise_1") != null)
    }

    @Test
    fun `test QUIC transport fetching, response metrics, and connection lifecycle`() = runTest {
        val transport = GoatQuicNetworkTransport()

        val response = transport.fetch("https://example.com/api/test")
        assertNotNull(response)
        assertEquals("example.com", response.host)
        assertTrue(response.bytesReceived > 0)
        assertEquals(1, transport.getActiveConnectionCount())

        // Fetch same host records cached session
        val response2 = transport.fetch("https://example.com/api/test2")
        assertTrue(response2.cachedSession)

        transport.closeConnection("example.com")
        assertEquals(0, transport.getActiveConnectionCount())
    }

    @Test
    fun `test WebAssembly SIMD and isolation headers audit`() = runTest {
        val wasmManager = GoatWasmWorkerManager()

        val probe = wasmManager.validateWasmSupport()
        assertTrue(probe.wasmSupported)

        // Audit with COOP + COEP isolation headers
        val isolatedAudit = wasmManager.auditSandboxHeaders(
            mapOf(
                "Cross-Origin-Opener-Policy" to "same-origin",
                "Cross-Origin-Embedder-Policy" to "require-corp"
            )
        )
        assertTrue(isolatedAudit.isIsolatedContext)
        assertEquals("CROSS_ORIGIN_ISOLATED", isolatedAudit.status)

        // Audit with standard non-isolated headers
        val nonIsolatedAudit = wasmManager.auditSandboxHeaders(
            mapOf("Content-Type" to "text/html")
        )
        assertFalse(nonIsolatedAudit.isIsolatedContext)
        assertEquals("STANDARD_ISOLATION", nonIsolatedAudit.status)
    }

    @Test
    fun `test OpenTelemetry distributed tracer and OTLP JSON export`() {
        val tracer = GoatOpenTelemetryTracer()

        val span = tracer.startSpan("bridge.execute.COOKIE_SET")
        val w3cHeader = tracer.formatW3cTraceparent(span)
        assertTrue(w3cHeader.startsWith("00-"))
        assertTrue(w3cHeader.endsWith("-01"))
        assertEquals(1, tracer.getActiveSpanCount())

        val duration = tracer.endSpan(span.spanId)
        assertNotNull(duration)
        assertEquals(0, tracer.getActiveSpanCount())
        assertEquals(1, tracer.getCompletedSpanCount())

        val otlpJson = tracer.exportOtlpJson()
        assertTrue(otlpJson.contains("resourceSpans"))
        assertTrue(otlpJson.contains("bridge.execute.COOKIE_SET"))
        assertTrue(otlpJson.contains(span.traceId))
    }
}
