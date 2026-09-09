package com.goat.webview.feature.biometrics.passkey

object PasskeyErrorCode {
    const val PASSKEY_UNSUPPORTED = "PASSKEY_UNSUPPORTED"
    const val USER_CANCELLED = "USER_CANCELLED"
    const val NO_CREDENTIAL_FOUND = "NO_CREDENTIAL_FOUND"
    const val RP_ID_NOT_ALLOWED = "RP_ID_NOT_ALLOWED"
    const val ORIGIN_NOT_ALLOWED = "ORIGIN_NOT_ALLOWED"
    const val CONSTRAINT_ERROR = "CONSTRAINT_ERROR"
    const val INVALID_STATE = "INVALID_STATE"
    const val INVALID_PARAMETERS = "INVALID_PARAMETERS"
    const val VAULT_DECRYPTION_FAILED = "VAULT_DECRYPTION_FAILED"
    const val VAULT_UNAVAILABLE = "VAULT_UNAVAILABLE"
    const val INTERNAL_ERROR = "INTERNAL_ERROR"
}

class PasskeyException(
    val code: String,
    message: String,
    cause: Throwable? = null
) : Exception("$code: $message", cause)

data class PasskeySupportReport(
    val supported: Boolean,
    val platformAuthenticator: Boolean,
    val conditionalMediation: Boolean,
    val prfSupported: Boolean,
    val biometryType: String,
    val hasEnrolledBiometrics: Boolean,
    val vaultMode: String
)

object VaultMode {
    const val WEBAUTHN_PRF = "webauthn_prf"
    const val HARDWARE_KEYSTORE = "hardware_keystore"
    const val NONE = "none"
}
