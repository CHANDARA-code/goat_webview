package com.goat.webview.feature.wallet.passes.spi

/**
 * A wallet that can hold passes, behind an interface.
 *
 * goat performs validation, state tracking and the bridge plumbing; the platform SDK
 * (`PayClient` on Android, `PKPassLibrary` on iOS) is supplied by the host, so the SDK carries no
 * compile-time dependency on Google Play Services or PassKit. This is the same launcher-SPI shape
 * the payment adapters use.
 */
interface GoatPassAdapter {
    val provider: PassProvider

    /** Whether this device actually has the provider's wallet available right now. */
    suspend fun isAvailable(): Boolean

    /**
     * Hands the signed pass payload to the platform wallet. [payload] is a Google Wallet
     * "save to wallet" JWT or a Base64 `.pkpass` bundle, depending on the provider.
     */
    suspend fun savePass(payload: String, metadata: PassMetadata?): PassSaveResult

    suspend fun getPassState(passId: String): PassState

    /** Opens the pass in the platform wallet app. Returns false when it could not be shown. */
    suspend fun openPass(passId: String): Boolean
}

/**
 * The Google Wallet save flow, narrowed to what goat needs.
 *
 * `PayClient.savePassesJwt` needs an Activity and an `ActivityResultLauncher`, so the lifecycle
 * plumbing stays in the host. An unlinked host gets a clear refusal rather than a silent failure.
 */
interface GoogleWalletLauncher {
    suspend fun isGoogleWalletAvailable(): Boolean
    /** Mirrors PayClient.savePassesJwt; resolves once SAVE_PASSES_RESULT arrives. */
    suspend fun savePassesJwt(jwt: String): GoogleWalletSaveOutcome
    suspend fun openWallet(passId: String): Boolean
}

enum class GoogleWalletSaveOutcome { SAVED, ALREADY_ADDED, CANCELLED, UNAVAILABLE, FAILED }

/**
 * Structural validation of a Google Wallet "save to wallet" JWT.
 *
 * Deliberately structural only: goat does not hold the issuer's signing key and cannot verify the
 * signature, so it checks the shape and refuses anything malformed rather than forwarding garbage
 * to the platform. Claiming verification it cannot perform would be worse than not checking.
 */
object GoogleWalletJwtValidator {

    private val BASE64URL = Regex("^[A-Za-z0-9_-]+$")

    fun validate(jwt: String?) {
        if (jwt.isNullOrBlank()) {
            throw PassException(PassErrorCode.INVALID_PARAMETERS, "Missing pass JWT")
        }
        val parts = jwt.split('.')
        if (parts.size != 3) {
            throw PassException(
                PassErrorCode.PASS_INVALID,
                "Pass JWT must have three dot-separated segments, found ${parts.size}"
            )
        }
        parts.forEachIndexed { index, part ->
            if (part.isEmpty()) {
                throw PassException(PassErrorCode.PASS_INVALID, "Pass JWT segment $index is empty")
            }
            if (!BASE64URL.matches(part)) {
                throw PassException(
                    PassErrorCode.PASS_INVALID,
                    "Pass JWT segment $index is not Base64URL"
                )
            }
        }
    }

    fun isValid(jwt: String?): Boolean = runCatching { validate(jwt) }.isSuccess

    /** Decodes the payload segment without verifying the signature. */
    fun decodePayload(jwt: String): String {
        validate(jwt)
        return String(decodeBase64Url(jwt.split('.')[1]), Charsets.UTF_8)
    }

    private fun decodeBase64Url(value: String): ByteArray {
        val table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
        val out = java.io.ByteArrayOutputStream()
        var buffer = 0
        var bits = 0
        for (ch in value) {
            val index = table.indexOf(ch)
            if (index < 0) throw PassException(PassErrorCode.PASS_INVALID, "Pass JWT is not Base64URL")
            buffer = (buffer shl 6) or index
            bits += 6
            if (bits >= 8) {
                bits -= 8
                out.write((buffer shr bits) and 0xff)
            }
        }
        return out.toByteArray()
    }
}
