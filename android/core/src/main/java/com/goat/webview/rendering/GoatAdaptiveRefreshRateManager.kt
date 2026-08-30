package com.goat.webview.rendering

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class GoatAdaptiveRefreshRateManager(
    private val idleSettleAfterMs: Long = 300L,
    private val scope: CoroutineScope = CoroutineScope(SupervisorJob() + kotlinx.coroutines.Dispatchers.Default)
) {

    var onElevateRefreshRate: ((elevate: Boolean) -> Boolean)? = null

    private var enabled = true
    private var elevated = false
    private var settleJob: Job? = null

    fun setEnabled(value: Boolean) {
        enabled = value
        if (!value) {
            settleJob?.cancel()
            settleJob = null
            if (elevated) {
                onElevateRefreshRate?.invoke(false)
                elevated = false
            }
        }
    }

    fun onGestureActive() {
        if (!enabled || elevated) return
        settleJob?.cancel()
        settleJob = null
        elevated = onElevateRefreshRate?.invoke(true) == true
    }

    fun onGestureSettled() {
        settleJob?.cancel()
        settleJob = scope.launch {
            delay(idleSettleAfterMs)
            if (enabled && elevated) {
                onElevateRefreshRate?.invoke(false)
                elevated = false
            }
        }
    }

    fun isElevated(): Boolean = elevated

    fun dispose() {
        settleJob?.cancel()
        settleJob = null
        if (elevated) {
            onElevateRefreshRate?.invoke(false)
            elevated = false
        }
    }
}
