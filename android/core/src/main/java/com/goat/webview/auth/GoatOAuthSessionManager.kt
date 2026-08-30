package com.goat.webview.auth

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.browser.customtabs.CustomTabsIntent
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicReference

/**
 * In-App OAuth Web Authentication Session Manager (Task 10182).
 *
 * Launches a system browser intent for OAuth 2.0 / OIDC login flows and intercepts
 * the callback URL scheme redirect to dispatch ON_OAUTH_RESULT bridge events.
 * Uses CustomTabsIntent with FLAG_ACTIVITY_NEW_TASK.
 */
class GoatOAuthSessionManager(
    private val context: Context,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) {
    companion object {
        private const val TAG = "GoatOAuthSessionManager"
    }

    data class ActiveSession(
        val sessionId: String,
        val authUrl: String,
        val callbackUrlScheme: String,
        val onResult: (Result<JsonObject>) -> Unit
    )

    private val currentSession = AtomicReference<ActiveSession?>(null)
    private val sessionHistory = ConcurrentHashMap<String, ActiveSession>()

    /**
     * Starts an in-app OAuth authentication session via the system browser.
     */
    suspend fun startOAuthSession(
        sessionId: String,
        authUrl: String,
        callbackUrlScheme: String,
        onResult: (Result<JsonObject>) -> Unit
    ): JsonObject = withContext(ioDispatcher) {
        require(authUrl.isNotBlank()) { "authUrl cannot be blank" }
        require(callbackUrlScheme.isNotBlank()) { "callbackUrlScheme cannot be blank" }

        val session = ActiveSession(
            sessionId = sessionId,
            authUrl = authUrl,
            callbackUrlScheme = callbackUrlScheme.lowercase(),
            onResult = onResult
        )

        val previous = currentSession.getAndSet(session)
        previous?.let { prev ->
            prev.onResult(Result.failure(GoatOAuthException("AUTH_CANCELLED", "Previous session superseded")))
        }
        sessionHistory[sessionId] = session

        try {
            val uri = Uri.parse(authUrl)
            val customTabsIntent = CustomTabsIntent.Builder()
                .setShowTitle(true)
                .build()

            customTabsIntent.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            customTabsIntent.launchUrl(context, uri)
            Log.d(TAG, "Launched CustomTabs OAuth session $sessionId for scheme: $callbackUrlScheme")
        } catch (e: Exception) {
            currentSession.compareAndSet(session, null)
            val error = GoatOAuthException("LAUNCH_FAILED", "Failed to launch browser: ${e.message}")
            onResult(Result.failure(error))
            throw error
        }

        buildJsonObject {
            put("sessionId", sessionId)
            put("status", "STARTED")
            put("callbackUrlScheme", callbackUrlScheme)
        }
    }

    /**
     * Intercepts a redirected URI. Returns true if consumed.
     */
    fun handleRedirectUri(uri: Uri): Boolean {
        val scheme = uri.scheme?.lowercase() ?: return false
        val active = currentSession.get() ?: return false
        if (scheme != active.callbackUrlScheme) return false

        currentSession.compareAndSet(active, null)
        val result = buildJsonObject {
            put("success", true)
            put("callbackUrl", uri.toString())
            put("sessionId", active.sessionId)
        }
        active.onResult(Result.success(result))
        Log.i(TAG, "OAuth session ${active.sessionId} completed with redirect URI")
        return true
    }

    /**
     * Cancels any active OAuth session.
     */
    fun cancelOAuthSession(sessionId: String? = null): Boolean {
        val active = currentSession.get() ?: return false
        if (sessionId != null && active.sessionId != sessionId) return false
        if (currentSession.compareAndSet(active, null)) {
            active.onResult(Result.failure(GoatOAuthException("AUTH_CANCELLED", "User dismissed authentication")))
            return true
        }
        return false
    }

    fun hasActiveSession(): Boolean = currentSession.get() != null
}

class GoatOAuthException(val code: String, message: String) : Exception("[$code] $message")
