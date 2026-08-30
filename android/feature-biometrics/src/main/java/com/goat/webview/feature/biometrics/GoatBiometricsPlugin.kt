package com.goat.webview.feature.biometrics

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.goat.webview.GoatBridgePlugin
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlin.coroutines.resume

/**
 * Modular AndroidX Biometrics & Keystore Feature Plugin (Task 10103 / Task 10152).
 *
 * Implements genuine BiometricPrompt & BiometricManager capabilities:
 * - Capability check (CHECK_BIOMETRIC_SUPPORT) with BIOMETRIC_STRONG and BIOMETRIC_WEAK authenticators.
 * - Interactive BiometricPrompt authentication (BIOMETRIC_AUTH) with fail-closed security.
 */
class GoatBiometricsPlugin(
    private val context: Context
) : GoatBridgePlugin {

    override val pluginId: String = "biometrics"

    override val supportedActions: List<String> = listOf(
        "CHECK_BIOMETRIC_SUPPORT",
        "BIOMETRIC_AUTH"
    )

    override suspend fun execute(action: String, payload: JsonObject): Result<JsonObject> {
        return when (action) {
            "CHECK_BIOMETRIC_SUPPORT" -> checkBiometricSupport()
            "BIOMETRIC_AUTH" -> authenticate(payload)
            else -> Result.failure(IllegalArgumentException("Unsupported biometrics action: $action"))
        }
    }

    private fun checkBiometricSupport(): Result<JsonObject> {
        val canAuth = try {
            val biometricManager = BiometricManager.from(context)
            biometricManager.canAuthenticate(BIOMETRIC_STRONG or BIOMETRIC_WEAK)
        } catch (e: Throwable) {
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE
        }
        return when (canAuth) {
            BiometricManager.BIOMETRIC_SUCCESS -> {
                Result.success(buildJsonObject {
                    put("supported", true)
                    put("biometryType", "biometrics")
                    put("status", "BIOMETRIC_SUCCESS")
                })
            }
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> {
                Result.success(buildJsonObject {
                    put("supported", false)
                    put("biometryType", "none")
                    put("reason", "NO_HARDWARE")
                })
            }
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> {
                Result.success(buildJsonObject {
                    put("supported", false)
                    put("biometryType", "none")
                    put("reason", "HW_UNAVAILABLE")
                })
            }
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> {
                Result.success(buildJsonObject {
                    put("supported", false)
                    put("biometryType", "none")
                    put("reason", "NONE_ENROLLED")
                })
            }
            else -> {
                Result.success(buildJsonObject {
                    put("supported", false)
                    put("biometryType", "none")
                    put("reason", "UNSUPPORTED_STATUS_$canAuth")
                })
            }
        }
    }

    private suspend fun authenticate(payload: JsonObject): Result<JsonObject> {
        val canAuth = try {
            val biometricManager = BiometricManager.from(context)
            biometricManager.canAuthenticate(BIOMETRIC_STRONG or BIOMETRIC_WEAK)
        } catch (e: Throwable) {
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE
        }
        if (canAuth != BiometricManager.BIOMETRIC_SUCCESS) {
            return Result.success(buildJsonObject {
                put("authenticated", false)
                put("error", "BIOMETRIC_UNAVAILABLE")
                put("status", canAuth)
            })
        }

        val activity = context as? FragmentActivity
        if (activity == null) {
            return Result.success(buildJsonObject {
                put("authenticated", false)
                put("error", "ACTIVITY_CONTEXT_REQUIRED")
            })
        }

        val title = payload["title"]?.jsonPrimitive?.content ?: "Biometric Authentication"
        val subtitle = payload["subtitle"]?.jsonPrimitive?.content ?: "Confirm your identity"
        val negativeButtonText = payload["cancelText"]?.jsonPrimitive?.content ?: "Cancel"

        return withContext(Dispatchers.Main) {
            suspendCancellableCoroutine { continuation ->
                val executor = ContextCompat.getMainExecutor(activity)
                val callback = object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        val token = "bio_auth_${System.currentTimeMillis()}_${result.authenticationType}"
                        continuation.resume(Result.success(buildJsonObject {
                            put("authenticated", true)
                            put("authType", if (result.authenticationType == BiometricPrompt.AUTHENTICATION_RESULT_TYPE_BIOMETRIC) "BIOMETRIC" else "DEVICE_CREDENTIAL")
                            put("token", token)
                        }))
                    }

                    override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                        continuation.resume(Result.success(buildJsonObject {
                            put("authenticated", false)
                            put("error", errString.toString())
                            put("errorCode", errorCode)
                        }))
                    }

                    override fun onAuthenticationFailed() {
                        // Keep prompt active for retries
                    }
                }

                val promptInfo = BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title)
                    .setSubtitle(subtitle)
                    .setNegativeButtonText(negativeButtonText)
                    .setAllowedAuthenticators(BIOMETRIC_STRONG or BIOMETRIC_WEAK)
                    .build()

                try {
                    val prompt = BiometricPrompt(activity, executor, callback)
                    prompt.authenticate(promptInfo)
                } catch (e: Exception) {
                    continuation.resume(Result.success(buildJsonObject {
                        put("authenticated", false)
                        put("error", e.message ?: "Authentication failed to start")
                    }))
                }
            }
        }
    }
}
