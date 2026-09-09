package com.goat.webview.feature.wallet.passes.generic

import com.goat.webview.feature.wallet.passes.spi.PassBarcode
import com.goat.webview.feature.wallet.passes.spi.PassErrorCode
import com.goat.webview.feature.wallet.passes.spi.PassException
import com.goat.webview.feature.wallet.passes.spi.PassMetadata
import com.goat.webview.feature.wallet.passes.spi.PassProvider

/**
 * Where a stored pass's bytes live.
 *
 * Deliberately an interface over an *already encrypted* store rather than new crypto: the hardware
 * vault built for the passkey work (`GoatVaultEngine`, AES-256-GCM keyed by an AndroidKeyStore
 * secret, device-verified) already does exactly what PASS-GEN-02 asks for. A host wires it in;
 * adding a second encryption path here would mean a second thing to get wrong.
 */
interface EncryptedPassVault {
    fun put(appId: String, passId: String, plaintext: String)
    fun get(appId: String, passId: String): String?
    fun remove(appId: String, passId: String): Boolean
    fun listIds(appId: String): List<String>
}

/**
 * Renders a barcode for display. Left to the host so the SDK does not carry a barcode library —
 * the same reason the Bakong adapter takes a `KhqrPresenter` rather than drawing its own QR.
 */
fun interface PassBarcodeRenderer {
    /** Returns a Base64 PNG for [barcode], or null when the format is unsupported. */
    fun render(barcode: PassBarcode, sizePx: Int): String?
}

/**
 * Passes goat holds itself, for issuers that target neither Google Wallet nor PassKit.
 *
 * Every stored pass is scoped to the calling `appId`: one mini-app can neither read nor delete
 * another's passes, which matters because a pass is a bearer token — its barcode message is
 * usually all that is needed to use it.
 */
class GenericPassStore(
    private val vault: EncryptedPassVault,
    private val renderer: PassBarcodeRenderer? = null
) {

    fun storePass(appId: String, metadata: PassMetadata, payload: String): PassMetadata {
        if (metadata.passTypeIdentifier.isBlank() || metadata.serialNumber.isBlank()) {
            throw PassException(
                PassErrorCode.INVALID_PARAMETERS,
                "A generic pass needs both passTypeIdentifier and serialNumber"
            )
        }
        metadata.barcode?.let { barcode ->
            if (barcode.format !in PassBarcode.SUPPORTED_FORMATS) {
                throw PassException(
                    PassErrorCode.PASS_INVALID,
                    "Unsupported barcode format '${barcode.format}'; supported: " +
                        PassBarcode.SUPPORTED_FORMATS.sorted().joinToString()
                )
            }
            if (barcode.message.isBlank()) {
                throw PassException(PassErrorCode.PASS_INVALID, "Barcode message is empty")
            }
        }
        vault.put(appId, metadata.passId, payload)
        return metadata.copy(provider = PassProvider.GENERIC)
    }

    fun exportPass(appId: String, passId: String): String =
        vault.get(appId, passId)
            ?: throw PassException(PassErrorCode.PASS_NOT_FOUND, "No stored pass '$passId'")

    fun hasPass(appId: String, passId: String): Boolean = vault.get(appId, passId) != null

    fun listPasses(appId: String): List<String> = vault.listIds(appId)

    fun deletePass(appId: String, passId: String): Boolean = vault.remove(appId, passId)

    /**
     * Overwrites a stored pass, for the webhook refresh flow. Refusing to create on refresh is
     * deliberate: a refresh for a pass the user deleted must not silently resurrect it.
     */
    fun refreshPass(appId: String, passId: String, payload: String): Boolean {
        if (vault.get(appId, passId) == null) return false
        vault.put(appId, passId, payload)
        return true
    }

    fun renderBarcode(barcode: PassBarcode, sizePx: Int = 512): String? = renderer?.render(barcode, sizePx)
}
