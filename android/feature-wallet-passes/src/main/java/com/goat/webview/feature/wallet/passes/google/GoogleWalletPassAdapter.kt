package com.goat.webview.feature.wallet.passes.google

import com.goat.webview.feature.wallet.passes.spi.GoatPassAdapter
import com.goat.webview.feature.wallet.passes.spi.GoogleWalletJwtValidator
import com.goat.webview.feature.wallet.passes.spi.GoogleWalletLauncher
import com.goat.webview.feature.wallet.passes.spi.GoogleWalletSaveOutcome
import com.goat.webview.feature.wallet.passes.spi.PassErrorCode
import com.goat.webview.feature.wallet.passes.spi.PassException
import com.goat.webview.feature.wallet.passes.spi.PassMetadata
import com.goat.webview.feature.wallet.passes.spi.PassProvider
import com.goat.webview.feature.wallet.passes.spi.PassSaveResult
import com.goat.webview.feature.wallet.passes.spi.PassState
import java.util.concurrent.ConcurrentHashMap

/**
 * Google Wallet pass adapter.
 *
 * The JWT is validated structurally here before it reaches the platform, so a malformed payload
 * fails with a useful message instead of an opaque Play Services error.
 *
 * Google's API cannot be queried for "does the user already hold this pass" — `savePassesJwt`
 * simply reports that it was already added. So state is tracked locally from save outcomes, and
 * anything unobserved is reported UNKNOWN rather than NOT_ADDED: telling a caller a pass is absent
 * when it may not be would have them issue a duplicate.
 */
class GoogleWalletPassAdapter(
    private val launcher: GoogleWalletLauncher = UnlinkedLauncher
) : GoatPassAdapter {

    override val provider: PassProvider = PassProvider.GOOGLE_WALLET

    private val knownStates = ConcurrentHashMap<String, PassState>()

    override suspend fun isAvailable(): Boolean =
        runCatching { launcher.isGoogleWalletAvailable() }.getOrDefault(false)

    override suspend fun savePass(payload: String, metadata: PassMetadata?): PassSaveResult {
        GoogleWalletJwtValidator.validate(payload)

        if (!isAvailable()) {
            throw PassException(
                PassErrorCode.PASS_PROVIDER_UNAVAILABLE,
                "Google Wallet is not available on this device"
            )
        }

        val passId = metadata?.passId
        return when (launcher.savePassesJwt(payload)) {
            GoogleWalletSaveOutcome.SAVED -> {
                passId?.let { knownStates[it] = PassState.ADDED }
                PassSaveResult(PassState.ADDED, passId, provider)
            }
            GoogleWalletSaveOutcome.ALREADY_ADDED -> {
                passId?.let { knownStates[it] = PassState.ADDED }
                PassSaveResult(PassState.ADDED, passId, provider, alreadyAdded = true)
            }
            GoogleWalletSaveOutcome.CANCELLED ->
                throw PassException(PassErrorCode.USER_CANCELLED, "User dismissed the Google Wallet save sheet")
            GoogleWalletSaveOutcome.UNAVAILABLE ->
                throw PassException(
                    PassErrorCode.PASS_PROVIDER_UNAVAILABLE,
                    "Google Wallet became unavailable during the save"
                )
            GoogleWalletSaveOutcome.FAILED ->
                throw PassException(PassErrorCode.INTERNAL_ERROR, "Google Wallet rejected the pass")
        }
    }

    override suspend fun getPassState(passId: String): PassState {
        if (!isAvailable()) return PassState.UNSUPPORTED
        return knownStates[passId] ?: PassState.UNKNOWN
    }

    override suspend fun openPass(passId: String): Boolean =
        runCatching { launcher.openWallet(passId) }.getOrDefault(false)

    companion object {
        val UnlinkedLauncher = object : GoogleWalletLauncher {
            override suspend fun isGoogleWalletAvailable(): Boolean = false
            override suspend fun savePassesJwt(jwt: String): GoogleWalletSaveOutcome =
                throw PassException(
                    PassErrorCode.PASS_PROVIDER_UNAVAILABLE,
                    "The Google Pay SDK is not linked on this host. Construct GoogleWalletPassAdapter " +
                        "with a GoogleWalletLauncher backed by PayClient.savePassesJwt and an " +
                        "ActivityResultLauncher for SAVE_PASSES_RESULT."
                )
            override suspend fun openWallet(passId: String): Boolean = false
        }
    }
}
