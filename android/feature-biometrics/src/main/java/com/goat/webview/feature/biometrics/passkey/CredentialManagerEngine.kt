package com.goat.webview.feature.biometrics.passkey

import android.app.Activity
import androidx.credentials.CreatePublicKeyCredentialRequest
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetPublicKeyCredentialOption
import androidx.credentials.PublicKeyCredential
import androidx.credentials.exceptions.CreateCredentialCancellationException
import androidx.credentials.exceptions.CreateCredentialException
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException

/**
 * The platform passkey ceremony, behind an interface.
 *
 * `CredentialManager` needs a live `Activity` and a real authenticator, so the seam exists to keep
 * the plugin's routing, RP-ID gate and PRF scrubbing unit-testable off-device. The Android
 * implementation below is the only thing that cannot run in a JVM test.
 */
interface CredentialManagerEngine {
    suspend fun register(optionsJson: String): String
    suspend fun assert(optionsJson: String): String
}

class AndroidCredentialManagerEngine(
    private val activityProvider: () -> Activity?,
    private val credentialManagerProvider: (Activity) -> CredentialManager = { CredentialManager.create(it) }
) : CredentialManagerEngine {

    override suspend fun register(optionsJson: String): String {
        val activity = requireActivity()
        return try {
            val response = credentialManagerProvider(activity).createCredential(
                activity,
                CreatePublicKeyCredentialRequest(requestJson = optionsJson)
            )
            response.data.getString("androidx.credentials.BUNDLE_KEY_REGISTRATION_RESPONSE_JSON")
                ?: throw PasskeyException(
                    PasskeyErrorCode.INTERNAL_ERROR,
                    "CredentialManager returned an empty registration response"
                )
        } catch (e: CreateCredentialCancellationException) {
            throw PasskeyException(PasskeyErrorCode.USER_CANCELLED, "User cancelled passkey registration", e)
        } catch (e: CreateCredentialException) {
            throw PasskeyException(
                PasskeyErrorCode.PASSKEY_UNSUPPORTED,
                "Passkey registration unavailable: ${e.type}",
                e
            )
        }
    }

    override suspend fun assert(optionsJson: String): String {
        val activity = requireActivity()
        return try {
            val response = credentialManagerProvider(activity).getCredential(
                activity,
                GetCredentialRequest(listOf(GetPublicKeyCredentialOption(requestJson = optionsJson)))
            )
            val credential = response.credential as? PublicKeyCredential
                ?: throw PasskeyException(
                    PasskeyErrorCode.INVALID_STATE,
                    "Returned credential is not a PublicKeyCredential"
                )
            credential.authenticationResponseJson
        } catch (e: GetCredentialCancellationException) {
            throw PasskeyException(PasskeyErrorCode.USER_CANCELLED, "User cancelled passkey assertion", e)
        } catch (e: NoCredentialException) {
            throw PasskeyException(PasskeyErrorCode.NO_CREDENTIAL_FOUND, "No matching passkey on this device", e)
        } catch (e: GetCredentialException) {
            throw PasskeyException(
                PasskeyErrorCode.PASSKEY_UNSUPPORTED,
                "Passkey assertion unavailable: ${e.type}",
                e
            )
        }
    }

    private fun requireActivity(): Activity = activityProvider()
        ?: throw PasskeyException(
            PasskeyErrorCode.INVALID_STATE,
            "CredentialManager requires a live Activity; none was supplied by the host"
        )
}
