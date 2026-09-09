package com.goat.webview.network

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Socket

object GoatNetworkPrewarmer {

    private const val TAG = "GoatNetworkPrewarmer"

    private const val CONNECT_TIMEOUT_MS = 800

    /** Bounded, finite retry schedule -- deliberately not a periodic ticker. */
    internal val RETRY_DELAYS_MS = longArrayOf(1_000, 2_000, 4_000)

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun prewarm(hosts: List<String>) {
        if (hosts.isEmpty()) return
        scope.launch {
            prewarmSuspending(hosts)
        }
    }

    internal fun normalizeHost(rawHost: String): String =
        rawHost.trim()
            .substringAfter("://")
            .substringBefore("/")
            .substringBefore(":")

    internal suspend fun prewarmSuspending(hosts: List<String>) = coroutineScope {
        // Hosts are independent, so resolve them concurrently. Serially this cost
        // hosts x addresses x CONNECT_TIMEOUT_MS in the worst case -- three hosts behind four
        // addresses each could spend ~9.6 s of a startup-time coroutine before finishing.
        hosts.map { rawHost ->
            async { prewarmHost(rawHost) }
        }.awaitAll()
        Unit
    }

    private suspend fun prewarmHost(rawHost: String) {
        val host = normalizeHost(rawHost)
        if (host.isBlank()) return
        // A resolution failure at startup is usually "connectivity has not settled yet", not "this
        // host does not exist" -- an app launched from cold can easily reach here before the radio
        // is up. Without a retry that warm is lost for the whole process lifetime. The schedule is
        // bounded and finite, so this never becomes a background poller.
        for (attempt in 0..RETRY_DELAYS_MS.size) {
            if (resolveAndConnect(host)) return
            if (attempt < RETRY_DELAYS_MS.size) {
                delay(RETRY_DELAYS_MS[attempt])
            }
        }
        Log.d(TAG, "Gave up prewarming $host after ${RETRY_DELAYS_MS.size + 1} attempts")
    }

    /** @return true when the host resolved; a failed TCP connect still counts, since the resolver
     *  cache -- the part that helps the WebView -- is already populated by then. */
    private fun resolveAndConnect(host: String): Boolean {
        return try {
            // getAllByName populates the system resolver cache, which is what Chromium's own
            // lookups go through -- that is the part of this that actually helps the WebView.
            val addresses = InetAddress.getAllByName(host)
            // Connect to one address only. The socket is closed immediately, so nothing here is
            // reused as a connection; dialling every A/AAAA record just spent the timeout budget
            // again on records the system would not have picked, including unreachable IPv6.
            val first = addresses.firstOrNull() ?: return true
            try {
                Socket().use { socket ->
                    socket.connect(InetSocketAddress(first, 443), CONNECT_TIMEOUT_MS)
                }
            } catch (_: Exception) {
            }
            Log.d(TAG, "Prewarmed DNS and socket for $host")
            true
        } catch (_: Exception) {
            false
        }
    }
}
