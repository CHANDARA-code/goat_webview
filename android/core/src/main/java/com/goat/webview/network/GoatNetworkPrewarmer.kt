package com.goat.webview.network

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Socket

object GoatNetworkPrewarmer {

    private const val TAG = "GoatNetworkPrewarmer"

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun prewarm(hosts: List<String>) {
        if (hosts.isEmpty()) return
        scope.launch {
            prewarmSuspending(hosts)
        }
    }

    internal suspend fun prewarmSuspending(hosts: List<String>) {
        for (rawHost in hosts) {
            val host = rawHost.trim()
                .removePrefix("https://")
                .removePrefix("http://")
                .substringBefore("/")
                .substringBefore(":")
            if (host.isBlank()) continue
            try {
                val addresses = InetAddress.getAllByName(host)
                for (addr in addresses) {
                    try {
                        Socket().use { socket ->
                            socket.connect(InetSocketAddress(addr, 443), 800)
                        }
                    } catch (_: Exception) {
                    }
                }
                Log.d(TAG, "Prewarmed DNS and socket for $host")
            } catch (_: Exception) {
            }
        }
    }
}
