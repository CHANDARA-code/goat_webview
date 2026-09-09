package com.goat.webview.feature.wallet.passes.spi

object PassErrorCode {
    const val PASS_PROVIDER_UNAVAILABLE = "PASS_PROVIDER_UNAVAILABLE"
    const val PASS_ALREADY_ADDED = "PASS_ALREADY_ADDED"
    const val PASS_NOT_FOUND = "PASS_NOT_FOUND"
    const val PASS_INVALID = "PASS_INVALID"
    const val USER_CANCELLED = "USER_CANCELLED"
    const val INVALID_PARAMETERS = "INVALID_PARAMETERS"
    const val INTERNAL_ERROR = "INTERNAL_ERROR"
}

class PassException(
    val code: String,
    message: String,
    cause: Throwable? = null
) : Exception("$code: $message", cause)

enum class PassProvider {
    GOOGLE_WALLET,
    APPLE_WALLET,
    GENERIC;

    companion object {
        fun fromWireName(raw: String?): PassProvider? = when (raw?.trim()?.uppercase()) {
            "GOOGLE_WALLET", "GOOGLE" -> GOOGLE_WALLET
            "APPLE_WALLET", "APPLE", "PASSKIT" -> APPLE_WALLET
            "GENERIC" -> GENERIC
            else -> null
        }
    }
}

/** Where a pass is, from the caller's point of view. */
enum class PassState {
    /** Present in the platform wallet (or the generic vault). */
    ADDED,
    /** Not present, and can be offered for saving. */
    NOT_ADDED,
    /** The provider exists but cannot answer — treat as unknown, never as NOT_ADDED. */
    UNKNOWN,
    /** No wallet provider on this device. */
    UNSUPPORTED
}

/**
 * The barcode payload a pass carries. Formats mirror the PassKit/Google Wallet sets; rendering is
 * left to a host-supplied renderer rather than pulling a barcode library into the SDK.
 */
data class PassBarcode(
    val format: String,
    val message: String,
    val altText: String? = null,
    val encoding: String = "iso-8859-1"
) {
    companion object {
        val SUPPORTED_FORMATS = setOf("QR", "PDF417", "AZTEC", "CODE128")
    }
}

data class PassMetadata(
    val passTypeIdentifier: String,
    val serialNumber: String,
    val provider: PassProvider,
    val description: String? = null,
    val organizationName: String? = null,
    val barcode: PassBarcode? = null,
    val savedAtEpochMs: Long = 0L
) {
    /** Stable identity of a pass, as both Google Wallet and PassKit define it. */
    val passId: String get() = "$passTypeIdentifier:$serialNumber"
}

data class PassSaveResult(
    val state: PassState,
    val passId: String?,
    val provider: PassProvider,
    val alreadyAdded: Boolean = false
)
