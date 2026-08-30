package com.goat.webview

import com.sun.net.httpserver.HttpServer
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import java.io.IOException
import java.net.InetSocketAddress

class GoatQuicNetworkTransportTest {

    private lateinit var transport: GoatQuicNetworkTransport
    private var httpServer: HttpServer? = null
    private var serverPort: Int = 0

    @Before
    fun setUp() {
        transport = GoatQuicNetworkTransport()
        httpServer = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0).apply {
            createContext("/assets/bundle.wasm") { exchange ->
                val responseBytes = "wasm_binary_bytes_12345".toByteArray(Charsets.UTF_8)
                exchange.responseHeaders.set("Content-Type", "application/wasm")
                exchange.sendResponseHeaders(200, responseBytes.size.toLong())
                exchange.responseBody.use { it.write(responseBytes) }
            }
            createContext("/alt-svc-test") { exchange ->
                val responseBytes = "quic_test_ok".toByteArray(Charsets.UTF_8)
                exchange.responseHeaders.set("Alt-Svc", "h3=\":443\"; ma=86400")
                exchange.sendResponseHeaders(200, responseBytes.size.toLong())
                exchange.responseBody.use { it.write(responseBytes) }
            }
            createContext("/api/error") { exchange ->
                val responseBytes = "not found".toByteArray(Charsets.UTF_8)
                exchange.sendResponseHeaders(404, responseBytes.size.toLong())
                exchange.responseBody.use { it.write(responseBytes) }
            }
            start()
            serverPort = address.port
        }
    }

    @After
    fun tearDown() {
        httpServer?.stop(0)
    }

    @Test
    fun testRealHttpFetchAndByteAccounting() = runBlocking {
        val payload = "wasm_binary_bytes_12345".toByteArray(Charsets.UTF_8)
        val expectedSize = payload.size.toLong()

        val result = transport.fetch("http://127.0.0.1:$serverPort/assets/bundle.wasm")
        assertNotNull(result)
        assertEquals(200, result.status)
        assertEquals("http/1.1", result.protocol)
        assertEquals("127.0.0.1", result.host)
        assertEquals(expectedSize, result.bytesReceived)
        assertFalse(result.cachedSession) // First request to host
        assertEquals(1, transport.getActiveConnectionCount())
        assertEquals(expectedSize, transport.getTotalBytesTransferred())

        // Second request to same host marks session as cached
        val secondResult = transport.fetch("http://127.0.0.1:$serverPort/assets/bundle.wasm")
        assertTrue(secondResult.cachedSession)
        assertEquals(expectedSize * 2, transport.getTotalBytesTransferred())

        transport.closeConnection("127.0.0.1")
        assertEquals(0, transport.getActiveConnectionCount())
    }

    @Test
    fun testAltSvcHttp3ProtocolInspection() = runBlocking {
        val result = transport.fetch("http://127.0.0.1:$serverPort/alt-svc-test")
        assertEquals(200, result.status)
        assertEquals("h3", result.protocol)
    }

    @Test
    fun testOfflineOrUnreachableHostThrowsRealNetworkException() = runBlocking {
        // Connecting to a closed port must throw real IOException, NOT return fake 200 OK / h3 / 1024 bytes
        val closedPort = 59991
        try {
            transport.fetch("http://127.0.0.1:$closedPort/offline")
            fail("Expected network IOException for unreachable host")
        } catch (e: IOException) {
            assertTrue(e.message != null || e.cause != null || e is java.net.ConnectException)
        }

        val resultFailure = transport.fetchResult("http://127.0.0.1:$closedPort/offline")
        assertTrue(resultFailure.isFailure)
        assertTrue(resultFailure.exceptionOrNull() is IOException)
    }
}
