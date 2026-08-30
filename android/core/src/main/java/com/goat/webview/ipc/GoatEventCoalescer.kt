package com.goat.webview.ipc

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import java.util.concurrent.ConcurrentHashMap

/**
 * Generic Bridge Event Coalescing and Change Deduplication Manager (Task 10200 / Pillar 3).
 *
 * Implements two Telegram-inspired optimizations for high-frequency native-to-JS bridge events:
 * 1. Dedup-on-change: Discards events whose payload is identical to the last emitted (or currently pending) payload.
 * 2. Trailing-edge throttling: Defers delivery to align with a configurable interval (default 50ms),
 *    guaranteeing that the latest state is always delivered without flooding the IPC bridge.
 */
class GoatEventCoalescer(
    private val scope: CoroutineScope = CoroutineScope(Dispatchers.Default),
    val defaultMinIntervalMs: Long = 50L,
    private val timeProvider: () -> Long = { System.currentTimeMillis() }
) {
    private val lock = Any()

    private val lastEmittedPayloads = HashMap<String, JsonObject>()
    private val pendingPayloads = HashMap<String, JsonObject>()
    private val pendingJobs = HashMap<String, Job>()
    private val lastEmitTimes = HashMap<String, Long>()
    private val lastDispatchers = HashMap<String, (String, JsonObject) -> Unit>()

    /**
     * Emits a native event with deduplication and trailing-edge interval throttling.
     *
     * @param eventKey Event name or unique key identifier.
     * @param payload Current event payload.
     * @param minIntervalMs Minimum time interval in ms between consecutive dispatches.
     * @param dispatcher Callback that performs the actual bridge dispatch to Web JS.
     * @return true if payload is new/changed and scheduled/delivered, false if dropped as duplicate.
     */
    fun emit(
        eventKey: String,
        payload: JsonObject,
        minIntervalMs: Long = defaultMinIntervalMs,
        dispatcher: (eventKey: String, payload: JsonObject) -> Unit
    ): Boolean {
        var shouldDispatchImmediately = false

        synchronized(lock) {
            val effectiveCurrent = pendingPayloads[eventKey] ?: lastEmittedPayloads[eventKey]
            if (effectiveCurrent != null && effectiveCurrent == payload) {
                // Consecutive unchanged payload — drop immediately
                return false
            }

            lastDispatchers[eventKey] = dispatcher
            val now = timeProvider()
            val hasEmittedBefore = lastEmitTimes.containsKey(eventKey)
            val lastTime = lastEmitTimes[eventKey] ?: 0L
            val elapsed = if (!hasEmittedBefore) minIntervalMs else now - lastTime

            if (elapsed >= minIntervalMs && pendingJobs[eventKey] == null) {
                // Sufficient time has elapsed and no pending job — emit immediately on leading edge
                lastEmittedPayloads[eventKey] = payload
                lastEmitTimes[eventKey] = now
                pendingPayloads.remove(eventKey)
                shouldDispatchImmediately = true
            } else {
                // Buffer latest payload for trailing-edge delivery
                pendingPayloads[eventKey] = payload
                if (pendingJobs[eventKey] == null || pendingJobs[eventKey]?.isActive != true) {
                    val delayMs = (minIntervalMs - elapsed).coerceAtLeast(1L)
                    val job = scope.launch {
                        delay(delayMs)
                        val dispatchData = synchronized(lock) {
                            val latestPayload = pendingPayloads.remove(eventKey)
                            pendingJobs.remove(eventKey)
                            if (latestPayload != null && latestPayload != lastEmittedPayloads[eventKey]) {
                                lastEmittedPayloads[eventKey] = latestPayload
                                lastEmitTimes[eventKey] = timeProvider()
                                val targetDisp = lastDispatchers[eventKey]
                                Pair(latestPayload, targetDisp)
                            } else {
                                null
                            }
                        }
                        dispatchData?.let { (latest, disp) ->
                            disp?.invoke(eventKey, latest)
                        }
                    }
                    pendingJobs[eventKey] = job
                }
            }
        }

        if (shouldDispatchImmediately) {
            dispatcher(eventKey, payload)
        }
        return true
    }

    /**
     * Retrieves the last emitted payload for an event key.
     */
    fun getLastEmitted(eventKey: String): JsonObject? = synchronized(lock) {
        lastEmittedPayloads[eventKey]
    }

    /**
     * Retrieves the currently pending/buffered payload for an event key, if any.
     */
    fun getPending(eventKey: String): JsonObject? = synchronized(lock) {
        pendingPayloads[eventKey]
    }

    /**
     * Forces immediate dispatch of any pending trailing-edge payload for the given event key,
     * cancelling the active timer job.
     *
     * @param eventKey Event name or unique key identifier.
     * @param dispatcher Optional override dispatcher; falls back to the last registered dispatcher.
     * @return true if a pending payload was flushed and dispatched, false if no pending payload existed.
     */
    fun flush(
        eventKey: String,
        dispatcher: ((eventKey: String, payload: JsonObject) -> Unit)? = null
    ): Boolean {
        val dispatchData: Pair<JsonObject, ((String, JsonObject) -> Unit)?>? = synchronized(lock) {
            val pendingJob = pendingJobs.remove(eventKey)
            pendingJob?.cancel()

            val latestPayload = pendingPayloads.remove(eventKey) ?: return@synchronized null
            if (latestPayload != lastEmittedPayloads[eventKey]) {
                lastEmittedPayloads[eventKey] = latestPayload
                lastEmitTimes[eventKey] = timeProvider()
                val targetDisp = dispatcher ?: lastDispatchers[eventKey]
                Pair(latestPayload, targetDisp)
            } else {
                null
            }
        }

        return if (dispatchData != null) {
            val (payload, disp) = dispatchData
            disp?.invoke(eventKey, payload)
            true
        } else {
            false
        }
    }

    /**
     * Forces immediate dispatch of all pending trailing-edge payloads across all event keys,
     * cancelling all active timer jobs.
     *
     * @param dispatcher Optional override dispatcher; falls back to the last registered dispatcher per key.
     * @return The number of event keys that were flushed.
     */
    fun flushAll(
        dispatcher: ((eventKey: String, payload: JsonObject) -> Unit)? = null
    ): Int {
        val toDispatch = mutableListOf<Triple<String, JsonObject, ((String, JsonObject) -> Unit)?>>()

        synchronized(lock) {
            val keys = pendingPayloads.keys.toList()
            for (key in keys) {
                pendingJobs.remove(key)?.cancel()
                val latestPayload = pendingPayloads.remove(key)
                if (latestPayload != null && latestPayload != lastEmittedPayloads[key]) {
                    lastEmittedPayloads[key] = latestPayload
                    lastEmitTimes[key] = timeProvider()
                    val targetDisp = dispatcher ?: lastDispatchers[key]
                    toDispatch.add(Triple(key, latestPayload, targetDisp))
                }
            }
        }

        for ((key, payload, disp) in toDispatch) {
            disp?.invoke(key, payload)
        }

        return toDispatch.size
    }

    /**
     * Cancels any pending throttling job and clears the buffered payload for the given event key.
     * Does not clear the last emitted payload history.
     */
    fun cancel(eventKey: String) {
        synchronized(lock) {
            pendingJobs.remove(eventKey)?.cancel()
            pendingPayloads.remove(eventKey)
        }
    }

    /**
     * Cancels all pending throttling jobs and clears all buffered payloads.
     * Does not clear the last emitted payload history.
     */
    fun cancelAll() {
        synchronized(lock) {
            pendingJobs.values.forEach { it.cancel() }
            pendingJobs.clear()
            pendingPayloads.clear()
        }
    }

    /**
     * Clears all state, cancels pending throttling jobs, and resets emission history.
     */
    fun reset() {
        synchronized(lock) {
            pendingJobs.values.forEach { it.cancel() }
            pendingJobs.clear()
            pendingPayloads.clear()
            lastEmittedPayloads.clear()
            lastEmitTimes.clear()
            lastDispatchers.clear()
        }
    }
}
