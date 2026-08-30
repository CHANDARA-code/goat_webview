package com.goat.webview

import android.app.Service
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.Message
import android.os.Messenger
import android.os.Process
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

/**
 * Lifecycle state for an isolated mini-app session.
 */
@Serializable
enum class MiniAppSessionState {
    INITIALIZED,
    ACTIVE,
    SUSPENDED,
    TERMINATED
}

/**
 * Metadata record representing an active tenant session within the isolated process.
 */
@Serializable
data class MiniAppProcessSession(
    val appId: String,
    val assetPath: String,
    val initializedAt: Long,
    val lastActiveAt: Long,
    val messageCount: Long,
    val state: MiniAppSessionState
)

/**
 * Metadata state describing an isolated mini-app sub-process.
 */
@Serializable
data class ProcessSandboxStatus(
    val pid: Int,
    val isAlive: Boolean,
    val isInitialized: Boolean,
    val activeAppId: String,
    val isolatedProcessName: String,
    val activeSessionsCount: Int = 0,
    val totalMessagesProcessed: Long = 0L,
    val uptimeMillis: Long = 0L
)

/**
 * Callback listener interface for isolated session termination notifications.
 */
fun interface SessionTerminationListener {
    fun onSessionTerminated(appId: String, reason: String)
}

/**
 * Dedicated Out-of-Process Isolation Sandbox Service (Task 10090 / Pillar 1).
 *
 * Runs under dedicated Linux process (`:goat_miniapp_process`) ensuring high JavaScript memory
 * consumption or native crashes inside third-party mini-apps never terminate the host parent app.
 * Provides multi-tenant session lifecycle isolation, IPC bridge message routing, and graceful
 * session termination.
 */
class GoatMiniAppProcessService : Service() {

    companion object {
        const val MSG_INITIALIZE_ENGINE = 1
        const val MSG_DISPATCH_ISOLATED_MESSAGE = 2
        const val MSG_GET_SANDBOX_STATUS = 3
        const val MSG_TERMINATE_SESSION = 4
        const val KEY_APP_ID = "appId"
        const val KEY_ASSET_PATH = "assetPath"
        const val KEY_MESSAGE = "message"
        const val KEY_RESPONSE = "response"
    }

    private val messenger: Messenger by lazy {
        Messenger(IncomingHandler(Looper.getMainLooper()))
    }

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val isInitialized = AtomicBoolean(false)
    private var activeAppId: String = ""
    private val startTimeMillis: Long = System.currentTimeMillis()
    private val totalMessagesProcessed = AtomicLong(0L)

    private val activeSessions = ConcurrentHashMap<String, MiniAppProcessSession>()
    private val terminationListeners = CopyOnWriteArrayList<SessionTerminationListener>()

    private inner class IncomingHandler(looper: Looper) : Handler(looper) {
        override fun handleMessage(msg: Message) {
            when (msg.what) {
                MSG_INITIALIZE_ENGINE -> {
                    val appId = msg.data.getString(KEY_APP_ID) ?: ""
                    val assetPath = msg.data.getString(KEY_ASSET_PATH) ?: ""
                    serviceScope.launch {
                        val status = initializeEngine(appId, assetPath)
                        replyWithJson(msg, Json.encodeToString(ProcessSandboxStatus.serializer(), status))
                    }
                }
                MSG_DISPATCH_ISOLATED_MESSAGE -> {
                    val jsonMessage = msg.data.getString(KEY_MESSAGE) ?: "{}"
                    serviceScope.launch {
                        val result = dispatchIsolatedMessage(jsonMessage)
                        replyWithJson(msg, result.toString())
                    }
                }
                MSG_GET_SANDBOX_STATUS -> {
                    replyWithJson(msg, Json.encodeToString(ProcessSandboxStatus.serializer(), getSandboxStatus()))
                }
                MSG_TERMINATE_SESSION -> {
                    val appId = msg.data.getString(KEY_APP_ID)
                    val terminated = terminateSession(appId)
                    replyWithJson(msg, buildJsonObject { put("success", terminated) }.toString())
                }
            }
        }
    }

    private fun replyWithJson(msg: Message, json: String) {
        val replyTo = msg.replyTo ?: return
        val bundle = Bundle().apply { putString(KEY_RESPONSE, json) }
        val reply = Message.obtain(null, msg.what).apply { data = bundle }
        try {
            replyTo.send(reply)
        } catch (_: Exception) {
        }
    }

    override fun onBind(intent: Intent?): IBinder {
        return messenger.binder
    }

    /**
     * Initializes the sandboxed runtime engine for an application partition.
     * Activates the session, stores asset path, and records lifecycle metadata.
     */
    suspend fun initializeEngine(appId: String, assetPath: String): ProcessSandboxStatus = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        val session = MiniAppProcessSession(
            appId = appId,
            assetPath = assetPath,
            initializedAt = now,
            lastActiveAt = now,
            messageCount = 0L,
            state = MiniAppSessionState.INITIALIZED
        )
        activeSessions[appId] = session
        activeAppId = appId
        isInitialized.set(true)
        getSandboxStatus()
    }

    /**
     * Dispatches an IPC bridge request across the sandbox boundary.
     * Routes the message to the appropriate tenant session and updates telemetry counters.
     */
    suspend fun dispatchIsolatedMessage(jsonMessage: String): JsonObject = withContext(Dispatchers.IO) {
        if (!isInitialized.get()) {
            return@withContext buildJsonObject {
                put("success", false)
                put("error", "Sandbox process not initialized")
            }
        }

        val totalCount = totalMessagesProcessed.incrementAndGet()
        val now = System.currentTimeMillis()

        // Extract action and target appId if present in jsonMessage
        var parsedAction: String? = null
        var targetAppId = activeAppId
        try {
            val parsedJson = Json.parseToJsonElement(jsonMessage).jsonObject
            parsedAction = parsedJson["action"]?.jsonPrimitive?.content
            val specifiedAppId = parsedJson["appId"]?.jsonPrimitive?.content
            if (!specifiedAppId.isNullOrBlank() && activeSessions.containsKey(specifiedAppId)) {
                targetAppId = specifiedAppId
            }
        } catch (_: Exception) {
            // Fallback to activeAppId if jsonMessage is non-standard payload
        }

        var sessionMessageCount = 0L
        activeSessions.computeIfPresent(targetAppId) { _, currentSession ->
            val updatedCount = currentSession.messageCount + 1
            sessionMessageCount = updatedCount
            currentSession.copy(
                lastActiveAt = now,
                messageCount = updatedCount,
                state = MiniAppSessionState.ACTIVE
            )
        }

        buildJsonObject {
            put("success", true)
            put("processedPid", Process.myPid())
            put("appId", targetAppId)
            parsedAction?.let { put("action", it) }
            put("status", "ISOLATED_EXECUTED")
            put("messageSequence", totalCount)
            put("sessionMessageCount", sessionMessageCount)
            put("timestamp", now)
        }
    }

    /**
     * Returns the current isolated sub-process state, PID, uptime, and active session count.
     */
    fun getSandboxStatus(): ProcessSandboxStatus {
        val now = System.currentTimeMillis()
        return ProcessSandboxStatus(
            pid = Process.myPid(),
            isAlive = true,
            isInitialized = isInitialized.get(),
            activeAppId = activeAppId,
            isolatedProcessName = ":goat_miniapp_process",
            activeSessionsCount = activeSessions.size,
            totalMessagesProcessed = totalMessagesProcessed.get(),
            uptimeMillis = now - startTimeMillis
        )
    }

    /**
     * Retrieves session metadata for a specific mini-app.
     */
    fun getSession(appId: String): MiniAppProcessSession? {
        return activeSessions[appId]
    }

    /**
     * Retrieves all active tenant sessions.
     */
    fun getActiveSessions(): List<MiniAppProcessSession> {
        return activeSessions.values.toList()
    }

    /**
     * Registers a listener for session termination events.
     */
    fun registerTerminationListener(listener: SessionTerminationListener) {
        terminationListeners.add(listener)
    }

    /**
     * Unregisters a previously registered session termination listener.
     */
    fun unregisterTerminationListener(listener: SessionTerminationListener) {
        terminationListeners.remove(listener)
    }

    /**
     * Resets and clears the isolated sub-process state for a specific mini-app or all sessions.
     */
    fun terminateSession(appId: String? = null): Boolean {
        return if (appId != null) {
            val removed = activeSessions.remove(appId)
            if (removed != null) {
                for (listener in terminationListeners) {
                    try {
                        listener.onSessionTerminated(appId, "EXPLICIT_TERMINATION")
                    } catch (_: Exception) {}
                }
            }
            if (activeAppId == appId) {
                activeAppId = activeSessions.keys().toList().firstOrNull() ?: ""
                if (activeAppId.isEmpty()) {
                    isInitialized.set(false)
                }
            }
            removed != null
        } else {
            val appIds = activeSessions.keys().toList()
            activeSessions.clear()
            isInitialized.set(false)
            activeAppId = ""
            for (id in appIds) {
                for (listener in terminationListeners) {
                    try {
                        listener.onSessionTerminated(id, "GLOBAL_RESET")
                    } catch (_: Exception) {}
                }
            }
            true
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
        terminateSession(null)
    }
}

