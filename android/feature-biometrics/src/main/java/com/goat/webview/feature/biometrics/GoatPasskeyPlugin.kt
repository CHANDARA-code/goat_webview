package com.goat.webview.feature.biometrics

import android.app.Activity
import android.content.Context
import android.os.Build
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import com.goat.webview.GoatBridgePlugin
import com.goat.webview.feature.biometrics.passkey.AndroidCredentialManagerEngine
import com.goat.webview.feature.biometrics.passkey.CredentialManagerEngine
import com.goat.webview.feature.biometrics.passkey.PasskeyErrorCode
import com.goat.webview.feature.biometrics.passkey.PasskeyException
import com.goat.webview.feature.biometrics.passkey.PasskeySupportReport
import com.goat.webview.feature.biometrics.passkey.RpIdValidator
import com.goat.webview.feature.biometrics.passkey.VaultMode
import com.goat.webview.feature.biometrics.vault.AndroidKeyStoreSecretSource
import com.goat.webview.feature.biometrics.vault.GoatVaultEngine
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/**
 * W3C WebAuthn passkeys and the hardware vault, as a modular plugin.
 *
 * Two invariants this class exists to hold:
 *  - the calling mini-app may only touch relying-party ids its signed manifest declares
 *    (`RpIdValidator`), because every tenant shares one virtual origin; and
 *  - `clientExtensionResults.prf` is stripped from every response, so the vault master key never
 *    reaches page JavaScript. The vault is reachable only through VAULT_ENCRYPT / VAULT_DECRYPT,
 *    which derive, use and zero the key entirely in native memory.
 */
class GoatPasskeyPlugin(
    private val context: Context,
    private val activityProvider: () -> Activity? = { null },
    private val appIdProvider: () -> String = { DEFAULT_APP_ID },
    private val engine: CredentialManagerEngine = AndroidCredentialManagerEngine(activityProvider),
    private val rpIdValidator: RpIdValidator = RpIdValidator(),
    private val vaultEngine: GoatVaultEngine = GoatVaultEngine(AndroidKeyStoreSecretSource())
) : GoatBridgePlugin {

    companion object {
        const val DEFAULT_APP_ID = "default"
        private const val PRF_MIN_SDK = 34
        private val json = Json { ignoreUnknownKeys = true; isLenient = true }
    }

    override val pluginId: String = "passkey"

    override val supportedActions: List<String> = listOf(
        "PASSKEY_CHECK_SUPPORT",
        "CHECK_PASSKEY_SUPPORT",
        "PASSKEY_REGISTER",
        "REGISTER_CREDENTIAL",
        "PASSKEY_ASSERT",
        "ASSERT_CREDENTIAL",
        "VAULT_ENCRYPT",
        "VAULT_DECRYPT"
    )

    override suspend fun execute(action: String, payload: JsonObject): Result<JsonObject> = try {
        when (action) {
            "PASSKEY_CHECK_SUPPORT", "CHECK_PASSKEY_SUPPORT" -> Result.success(checkSupport().toJson())
            "PASSKEY_REGISTER", "REGISTER_CREDENTIAL" -> Result.success(register(payload))
            "PASSKEY_ASSERT", "ASSERT_CREDENTIAL" -> Result.success(assert(payload))
            "VAULT_ENCRYPT" -> Result.success(encryptVault(payload))
            "VAULT_DECRYPT" -> Result.success(decryptVault(payload))
            else -> Result.failure(IllegalArgumentException("Unsupported passkey action: $action"))
        }
    } catch (e: PasskeyException) {
        Result.failure(e)
    } catch (e: CancellationException) {
        Result.failure(PasskeyException(PasskeyErrorCode.USER_CANCELLED, "Passkey operation cancelled", e))
    } catch (e: Throwable) {
        Result.failure(PasskeyException(PasskeyErrorCode.INTERNAL_ERROR, e.message ?: "Passkey operation failed", e))
    }

    fun checkSupport(): PasskeySupportReport {
        val biometricStatus = try {
            BiometricManager.from(context).canAuthenticate(BIOMETRIC_STRONG)
        } catch (e: Throwable) {
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE
        }
        val hasEnrolled = biometricStatus == BiometricManager.BIOMETRIC_SUCCESS
        val hasHardware = hasEnrolled || biometricStatus == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED
        val platformAuthenticator = hasHardware && Build.VERSION.SDK_INT >= 28
        val prfSupported = platformAuthenticator && Build.VERSION.SDK_INT >= PRF_MIN_SDK

        return PasskeySupportReport(
            supported = platformAuthenticator && hasEnrolled,
            platformAuthenticator = platformAuthenticator,
            conditionalMediation = false,
            prfSupported = prfSupported,
            biometryType = if (hasHardware) "fingerprint" else "none",
            hasEnrolledBiometrics = hasEnrolled,
            vaultMode = if (hasHardware) VaultMode.HARDWARE_KEYSTORE else VaultMode.NONE
        )
    }

    private suspend fun register(payload: JsonObject): JsonObject {
        val appId = resolveAppId()
        val optionsJson = payload.str("optionsJson")
            ?: throw PasskeyException(PasskeyErrorCode.INVALID_PARAMETERS, "Missing optionsJson")
        val rpId = payload.str("rpId") ?: optionsRpId(optionsJson, "rp")
        rpIdValidator.validate(appId, rpId)

        return sanitize(parse(engine.register(optionsJson)))
    }

    private suspend fun assert(payload: JsonObject): JsonObject {
        val appId = resolveAppId()
        val optionsJson = payload.str("optionsJson")
            ?: throw PasskeyException(PasskeyErrorCode.INVALID_PARAMETERS, "Missing optionsJson")
        val rpId = payload.str("rpId") ?: optionsRpId(optionsJson, "rpId")
        rpIdValidator.validate(appId, rpId)

        return sanitize(parse(engine.assert(optionsJson)))
    }

    private fun encryptVault(payload: JsonObject): JsonObject {
        val vaultId = payload.str("vaultId")
            ?: throw PasskeyException(PasskeyErrorCode.INVALID_PARAMETERS, "Missing vaultId")
        val plaintext = payload.str("plaintext")
            ?: throw PasskeyException(PasskeyErrorCode.INVALID_PARAMETERS, "Missing plaintext")
        return vaultEngine.encrypt(resolveAppId(), vaultId, plaintext)
    }

    private fun decryptVault(payload: JsonObject): JsonObject {
        val vaultId = payload.str("vaultId")
            ?: throw PasskeyException(PasskeyErrorCode.INVALID_PARAMETERS, "Missing vaultId")
        val envelope = payload["envelope"]?.let { runCatching { it.jsonObject }.getOrNull() }
            ?: throw PasskeyException(PasskeyErrorCode.INVALID_PARAMETERS, "Missing envelope")
        return vaultEngine.decrypt(resolveAppId(), vaultId, envelope)
    }

    /**
     * The tenant is always the container's own appId. A payload-supplied appId is attacker
     * controlled and would let one mini-app borrow another's allowedRpIds.
     */
    private fun resolveAppId(): String = appIdProvider()

    private fun parse(raw: String): JsonObject = try {
        json.parseToJsonElement(raw).jsonObject
    } catch (e: Throwable) {
        throw PasskeyException(PasskeyErrorCode.INTERNAL_ERROR, "Authenticator returned malformed JSON", e)
    }

    /**
     * Strips the CTAP2 PRF evaluation output before the response leaves native memory. Returning
     * it would hand any script in the WebView the vault master key.
     */
    internal fun sanitize(response: JsonObject): JsonObject = buildJsonObject {
        response.forEach { (key, value) ->
            if (key == "clientExtensionResults" && value is JsonObject) {
                put(key, buildJsonObject {
                    value.forEach { (extKey, extValue) ->
                        if (extKey != "prf" && extKey != "hmacGetSecret" && extKey != "hmac-secret") {
                            put(extKey, extValue)
                        }
                    }
                })
            } else {
                put(key, value)
            }
        }
    }

    private fun optionsRpId(optionsJson: String, key: String): String? = try {
        val root = json.parseToJsonElement(optionsJson).jsonObject
        when (key) {
            "rp" -> root["rp"]?.jsonObject?.get("id")?.jsonPrimitive?.content
            else -> root[key]?.jsonPrimitive?.content
        }
    } catch (e: Throwable) {
        null
    }

    private fun PasskeySupportReport.toJson(): JsonObject = buildJsonObject {
        put("supported", supported)
        put("platformAuthenticator", platformAuthenticator)
        put("conditionalMediation", conditionalMediation)
        put("prfSupported", prfSupported)
        put("biometryType", biometryType)
        put("hasEnrolledBiometrics", hasEnrolledBiometrics)
        put("vaultMode", vaultMode)
    }

    private fun JsonObject.str(key: String): String? =
        this[key]?.let { runCatching { it.jsonPrimitive.content }.getOrNull() }
            ?.takeIf { it.isNotBlank() && it != "null" }
}
