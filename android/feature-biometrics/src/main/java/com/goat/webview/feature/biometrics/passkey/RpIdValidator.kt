package com.goat.webview.feature.biometrics.passkey

import com.goat.webview.manifest.GoatMiniAppManifestStore
import com.goat.webview.manifest.MiniAppManifest

/**
 * Decides whether a mini-app may run a passkey ceremony for a given relying-party id.
 *
 * Mini-apps share one virtual origin, so the browser's own rpId/origin check cannot separate
 * tenants here: without this, any bundle could assert credentials for any other tenant's rpId.
 * Authority comes from the signed manifest's `security.allowedRpIds`, never from the request.
 */
class RpIdValidator(
    private val manifestLookup: (String) -> MiniAppManifest? = { GoatMiniAppManifestStore.get(it) }
) {

    fun validate(appId: String, rpId: String?) {
        if (rpId.isNullOrBlank()) {
            throw PasskeyException(PasskeyErrorCode.INVALID_PARAMETERS, "Missing rpId")
        }
        val normalizedRpId = normalize(rpId)
        if (normalizedRpId.isEmpty() || normalizedRpId.contains('/') || normalizedRpId.contains(':')) {
            throw PasskeyException(PasskeyErrorCode.RP_ID_NOT_ALLOWED, "rpId '$rpId' is not a bare domain")
        }

        val manifest = manifestLookup(appId)
            ?: throw PasskeyException(
                PasskeyErrorCode.RP_ID_NOT_ALLOWED,
                "No manifest is registered for appId '$appId'; passkey ceremonies are refused"
            )

        val allowed = manifest.allowedRpIds.map(::normalize).filter { it.isNotEmpty() }
        if (allowed.isEmpty()) {
            throw PasskeyException(
                PasskeyErrorCode.RP_ID_NOT_ALLOWED,
                "appId '$appId' declares no security.allowedRpIds"
            )
        }
        if (allowed.none { it == normalizedRpId || isRegistrableSuffix(normalizedRpId, it) }) {
            throw PasskeyException(
                PasskeyErrorCode.RP_ID_NOT_ALLOWED,
                "rpId '$rpId' is not declared in the manifest for appId '$appId'"
            )
        }
    }

    private fun normalize(value: String): String =
        value.trim().lowercase().removeSuffix(".")

    /**
     * W3C registrable-suffix rule: `login.shop.com` is acceptable when the manifest declares
     * `shop.com`, but `evilshop.com` is not, and a bare TLD never matches.
     */
    internal fun isRegistrableSuffix(candidate: String, declared: String): Boolean {
        if (candidate == declared) return true
        if (!candidate.endsWith(".$declared")) return false
        return declared.contains('.')
    }
}
