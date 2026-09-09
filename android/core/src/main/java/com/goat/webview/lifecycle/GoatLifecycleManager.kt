package com.goat.webview.lifecycle

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.atomic.AtomicReference
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

enum class GoatLifecycleState {
    UNINITIALIZED,
    LAUNCHING,
    FOREGROUND_ACTIVE,
    BACKGROUND_PAUSED,
    TERMINATED
}

data class GoatLaunchOptions(
    val entryRoute: String = "/",
    val queryParams: Map<String, String> = emptyMap(),
    val referrerInfo: Map<String, Any> = emptyMap(),
    val scene: Int = 1000,
    val timestamp: Long = System.currentTimeMillis()
) {
    fun toMap(): Map<String, Any> {
        val map = mutableMapOf<String, Any>(
            "entryRoute" to entryRoute,
            "queryParams" to queryParams,
            "referrerInfo" to referrerInfo,
            "scene" to scene,
            "timestamp" to timestamp
        )
        return map
    }
}

interface GoatLifecycleListener {
    fun onStateChanged(from: GoatLifecycleState, to: GoatLifecycleState)
    fun onEventDispatched(event: String, payload: Map<String, Any?>) {}
}

class GoatLifecycleManager {
    private val stateRef = AtomicReference(GoatLifecycleState.UNINITIALIZED)
    private val lock = ReentrantLock()
    private val listeners = CopyOnWriteArraySet<GoatLifecycleListener>()
    private val eventObservers = ConcurrentHashMap<String, CopyOnWriteArraySet<(Map<String, Any?>) -> Unit>>()
    private var scriptEvaluator: ((String) -> Unit)? = null

    var lastLaunchOptions: GoatLaunchOptions? = null
        private set

    val state: GoatLifecycleState
        get() = stateRef.get()

    fun attachScriptEvaluator(evaluator: ((String) -> Unit)?) {
        this.scriptEvaluator = evaluator
    }

    fun startLaunch(options: GoatLaunchOptions = GoatLaunchOptions()): Boolean {
        lock.withLock {
            val current = stateRef.get()
            if (current != GoatLifecycleState.UNINITIALIZED) {
                return false
            }
            lastLaunchOptions = options
            stateRef.set(GoatLifecycleState.LAUNCHING)
            notifyStateChanged(current, GoatLifecycleState.LAUNCHING)
            return true
        }
    }

    fun enterForeground(options: GoatLaunchOptions? = null): Boolean {
        lock.withLock {
            val current = stateRef.get()
            if (current != GoatLifecycleState.LAUNCHING && current != GoatLifecycleState.BACKGROUND_PAUSED) {
                return false
            }
            if (options != null) {
                lastLaunchOptions = options
            }
            stateRef.set(GoatLifecycleState.FOREGROUND_ACTIVE)
            notifyStateChanged(current, GoatLifecycleState.FOREGROUND_ACTIVE)
            val launchOpts = lastLaunchOptions ?: GoatLaunchOptions()
            dispatchAppShow(launchOpts)
            return true
        }
    }

    fun enterBackground(): Boolean {
        lock.withLock {
            val current = stateRef.get()
            if (current != GoatLifecycleState.FOREGROUND_ACTIVE) {
                return false
            }
            stateRef.set(GoatLifecycleState.BACKGROUND_PAUSED)
            notifyStateChanged(current, GoatLifecycleState.BACKGROUND_PAUSED)
            dispatchAppHide()
            return true
        }
    }

    fun terminate(): Boolean {
        lock.withLock {
            val current = stateRef.get()
            if (current == GoatLifecycleState.TERMINATED) {
                return false
            }
            stateRef.set(GoatLifecycleState.TERMINATED)
            notifyStateChanged(current, GoatLifecycleState.TERMINATED)
            return true
        }
    }

    fun dispatchAppShow(options: GoatLaunchOptions = lastLaunchOptions ?: GoatLaunchOptions()) {
        val payload = options.toMap()
        dispatchEvent("ON_APP_SHOW", payload)
        dispatchEvent("onAppShow", payload)
    }

    fun dispatchAppHide() {
        val payload = mapOf<String, Any?>("timestamp" to System.currentTimeMillis())
        dispatchEvent("ON_APP_HIDE", payload)
        dispatchEvent("onAppHide", payload)
    }

    fun dispatchPageScroll(scrollTop: Int, scrollLeft: Int, scrollHeight: Int, scrollWidth: Int) {
        val payload = mapOf<String, Any?>(
            "scrollTop" to scrollTop,
            "scrollLeft" to scrollLeft,
            "scrollHeight" to scrollHeight,
            "scrollWidth" to scrollWidth
        )
        dispatchEvent("ON_PAGE_SCROLL", payload)
        dispatchEvent("onPageScroll", payload)
    }

    fun dispatchMemoryWarning(level: Int, memoryPressure: String = "warning") {
        val payload = mapOf<String, Any?>(
            "level" to level,
            "memoryPressure" to memoryPressure
        )
        dispatchEvent("ON_MEMORY_WARNING", payload)
        dispatchEvent("onMemoryWarning", payload)
    }

    fun dispatchWindowResize(width: Int, height: Int, windowWidth: Int, windowHeight: Int, orientation: String) {
        val payload = mapOf<String, Any?>(
            "width" to width,
            "height" to height,
            "windowWidth" to windowWidth,
            "windowHeight" to windowHeight,
            "orientation" to orientation
        )
        dispatchEvent("ON_WINDOW_RESIZE", payload)
        dispatchEvent("onWindowResize", payload)
    }

    fun dispatchEvent(action: String, payload: Map<String, Any?>) {
        eventObservers[action]?.forEach { observer ->
            try {
                observer(payload)
            } catch (_: Throwable) {
            }
        }
        listeners.forEach { listener ->
            try {
                listener.onEventDispatched(action, payload)
            } catch (_: Throwable) {
            }
        }
        val evaluator = scriptEvaluator ?: return
        try {
            val jsonPayload = (toJsonElement(payload) as JsonObject).toString()
            val quotedAction = JsonPrimitive(action).toString()
            val script = """
                (function() {
                    if (window.dispatchEvent) {
                        window.dispatchEvent(new CustomEvent('native_call', {
                            detail: { action: $quotedAction, payload: $jsonPayload }
                        }));
                    }
                    if (window.GoatBridge && typeof window.GoatBridge.emit === 'function') {
                        window.GoatBridge.emit($quotedAction, $jsonPayload);
                    }
                })();
            """.trimIndent()
            evaluator(script)
        } catch (_: Throwable) {
        }
    }

    fun addLifecycleListener(listener: GoatLifecycleListener) {
        listeners.add(listener)
    }

    fun removeLifecycleListener(listener: GoatLifecycleListener) {
        listeners.remove(listener)
    }

    fun addEventObserver(event: String, observer: (Map<String, Any?>) -> Unit) {
        val set = eventObservers.computeIfAbsent(event) { CopyOnWriteArraySet() }
        set.add(observer)
    }

    fun removeEventObserver(event: String, observer: (Map<String, Any?>) -> Unit) {
        eventObservers[event]?.remove(observer)
    }

    private fun notifyStateChanged(from: GoatLifecycleState, to: GoatLifecycleState) {
        listeners.forEach { listener ->
            try {
                listener.onStateChanged(from, to)
            } catch (_: Throwable) {
            }
        }
    }

    private fun toJsonElement(value: Any?): JsonElement {
        return when (value) {
            null -> JsonNull
            is Number -> JsonPrimitive(value)
            is Boolean -> JsonPrimitive(value)
            is String -> JsonPrimitive(value)
            is Map<*, *> -> JsonObject(value.entries.associate { it.key.toString() to toJsonElement(it.value) })
            is Collection<*> -> JsonArray(value.map { toJsonElement(it) })
            is Array<*> -> JsonArray(value.map { toJsonElement(it) })
            else -> JsonPrimitive(value.toString())
        }
    }
}

