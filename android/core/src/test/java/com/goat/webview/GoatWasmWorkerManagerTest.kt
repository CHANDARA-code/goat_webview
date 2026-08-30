package com.goat.webview

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GoatWasmWorkerManagerTest {

    private lateinit var wasmManager: GoatWasmWorkerManager

    @Before
    fun setUp() {
        wasmManager = GoatWasmWorkerManager()
    }

    @Test
    fun testWasmCapabilitiesRuntimeProbing() = runTest {
        val result = wasmManager.validateWasmSupport()
        assertTrue(result.wasmSupported)
        assertTrue(result.simdSupported)
        assertTrue(result.maxMemoryPages >= 32768)
        assertTrue(result.architecture.isNotEmpty())
    }

    @Test
    fun testSandboxHeadersAudit() = runTest {
        // Headers without COOP/COEP
        val nonIsolated = wasmManager.auditSandboxHeaders(mapOf("Content-Type" to "text/html"))
        assertFalse(nonIsolated.isIsolatedContext)
        assertEquals("STANDARD_ISOLATION", nonIsolated.status)

        // Headers with COOP and COEP require-corp
        val isolatedRequireCorp = wasmManager.auditSandboxHeaders(
            mapOf(
                "Cross-Origin-Opener-Policy" to "same-origin",
                "Cross-Origin-Embedder-Policy" to "require-corp"
            )
        )
        assertTrue(isolatedRequireCorp.isIsolatedContext)
        assertEquals("CROSS_ORIGIN_ISOLATED", isolatedRequireCorp.status)

        // Headers with COOP and COEP credentialless
        val isolatedCredentialless = wasmManager.auditSandboxHeaders(
            mapOf(
                "Cross-Origin-Opener-Policy" to "same-origin",
                "Cross-Origin-Embedder-Policy" to "credentialless"
            )
        )
        assertTrue(isolatedCredentialless.isIsolatedContext)
        assertEquals("CROSS_ORIGIN_ISOLATED", isolatedCredentialless.status)

        // Mismatched COOP header
        val unsafeCoop = wasmManager.auditSandboxHeaders(
            mapOf(
                "Cross-Origin-Opener-Policy" to "unsafe-none",
                "Cross-Origin-Embedder-Policy" to "require-corp"
            )
        )
        assertFalse(unsafeCoop.isIsolatedContext)
    }

    @Test
    fun testSharedArrayBufferGatedByCrossOriginIsolation() = runTest {
        // When non-isolated headers are evaluated, SharedArrayBuffer and multithreading must be disabled
        val unisolatedResult = wasmManager.validateWasmSupport(
            responseHeaders = mapOf("Content-Type" to "application/wasm")
        )
        assertTrue(unisolatedResult.wasmSupported)
        assertFalse("SharedArrayBuffer must be blocked without COOP/COEP isolation", unisolatedResult.sharedArrayBufferSupported)
        assertFalse("WebWorker threads must be blocked without COOP/COEP isolation", unisolatedResult.threadsSupported)

        // When valid COOP + COEP headers are evaluated, SharedArrayBuffer and multithreading are enabled
        val isolatedResult = wasmManager.validateWasmSupport(
            responseHeaders = mapOf(
                "Cross-Origin-Opener-Policy" to "same-origin",
                "Cross-Origin-Embedder-Policy" to "require-corp"
            )
        )
        assertTrue(isolatedResult.wasmSupported)
        assertTrue(isolatedResult.sharedArrayBufferSupported)
        assertTrue(isolatedResult.threadsSupported)
    }
}
