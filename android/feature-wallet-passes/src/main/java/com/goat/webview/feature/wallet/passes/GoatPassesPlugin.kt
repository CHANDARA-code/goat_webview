package com.goat.webview.feature.wallet.passes

import android.content.Context
import com.goat.webview.GoatBridgePlugin
import com.goat.webview.feature.wallet.passes.generic.GenericPassStore
import com.goat.webview.feature.wallet.passes.google.GoogleWalletPassAdapter
import com.goat.webview.feature.wallet.passes.spi.GoatPassAdapter
import com.goat.webview.feature.wallet.passes.spi.PassBarcode
import com.goat.webview.feature.wallet.passes.spi.PassErrorCode
import com.goat.webview.feature.wallet.passes.spi.PassException
import com.goat.webview.feature.wallet.passes.spi.PassMetadata
import com.goat.webview.feature.wallet.passes.spi.PassProvider
import com.goat.webview.feature.wallet.passes.spi.PassState
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import java.util.concurrent.ConcurrentHashMap

/**
 * Digital wallet passes as a modular bridge plugin.
 *
 * Registers on the existing `GoatBridgePlugin` SPI rather than introducing a parallel wallet
 * router: the engine already has the dispatcher, origin sandbox, gesture gate and plugin registry
 * the wallet spec's Section 12 describes, and a second security gate alongside the first is a
 * second thing to drift.
 *
 * goat holds no issuer keys. It validates payload shape, tracks pass state and routes to a
 * host-registered [GoatPassAdapter]; the platform SDK stays with the host.
 */
class GoatPassesPlugin(
    private val context: Context,
    adapters: List<GoatPassAdapter> = emptyList(),
    private val genericStore: GenericPassStore? = null,
    private val appIdProvider: () -> String = { DEFAULT_APP_ID }
) : GoatBridgePlugin {

    companion object {
        const val DEFAULT_APP_ID = "default"
    }

    private val adaptersByProvider = ConcurrentHashMap<PassProvider, GoatPassAdapter>()

    init {
        val supplied = adapters.ifEmpty { listOf(GoogleWalletPassAdapter()) }
        supplied.forEach { adaptersByProvider[it.provider] = it }
    }

    override val pluginId: String = "wallet_passes"

    override val supportedActions: List<String> = listOf(
        "WALLET_SAVE_PASS",
        "WALLET_GET_PASS_STATE",
        "WALLET_OPEN_PASS",
        "WALLET_LIST_PASSES",
        "WALLET_DELETE_PASS"
    )

    override suspend fun execute(action: String, payload: JsonObject): Result<JsonObject> = try {
        when (action) {
            "WALLET_SAVE_PASS" -> savePass(payload)
            "WALLET_GET_PASS_STATE" -> getPassState(payload)
            "WALLET_OPEN_PASS" -> openPass(payload)
            "WALLET_LIST_PASSES" -> listPasses()
            "WALLET_DELETE_PASS" -> deletePass(payload)
            else -> Result.failure(IllegalArgumentException("Unsupported passes action: $action"))
        }
    } catch (e: PassException) {
        Result.failure(e)
    }

    fun registerAdapter(adapter: GoatPassAdapter) {
        adaptersByProvider[adapter.provider] = adapter
    }

    internal fun registeredProviders(): Set<PassProvider> = adaptersByProvider.keys.toSet()

    private fun requireAdapter(provider: PassProvider): GoatPassAdapter =
        adaptersByProvider[provider]
            ?: throw PassException(
                PassErrorCode.PASS_PROVIDER_UNAVAILABLE,
                "No pass adapter registered for $provider"
            )

    private suspend fun savePass(payload: JsonObject): Result<JsonObject> {
        val provider = PassProvider.fromWireName(payload.str("provider"))
            ?: throw PassException(
                PassErrorCode.INVALID_PARAMETERS,
                "Unknown or missing 'provider'; expected GOOGLE_WALLET, APPLE_WALLET or GENERIC"
            )
        val passPayload = payload.str("payload")
            ?: throw PassException(PassErrorCode.INVALID_PARAMETERS, "Missing 'payload'")
        val metadata = parseMetadata(payload, provider)

        if (provider == PassProvider.GENERIC) {
            val store = genericStore
                ?: throw PassException(
                    PassErrorCode.PASS_PROVIDER_UNAVAILABLE,
                    "No generic pass store is configured on this host"
                )
            val required = metadata
                ?: throw PassException(
                    PassErrorCode.INVALID_PARAMETERS,
                    "A generic pass needs passTypeIdentifier and serialNumber"
                )
            val stored = store.storePass(appIdProvider(), required, passPayload)
            return Result.success(buildJsonObject {
                put("state", PassState.ADDED.name)
                put("passId", stored.passId)
                put("provider", provider.name)
                put("alreadyAdded", false)
            })
        }

        val result = requireAdapter(provider).savePass(passPayload, metadata)
        return Result.success(buildJsonObject {
            put("state", result.state.name)
            result.passId?.let { put("passId", it) }
            put("provider", result.provider.name)
            put("alreadyAdded", result.alreadyAdded)
        })
    }

    private suspend fun getPassState(payload: JsonObject): Result<JsonObject> {
        val passId = payload.str("passId")
            ?: throw PassException(PassErrorCode.INVALID_PARAMETERS, "Missing 'passId'")
        val provider = PassProvider.fromWireName(payload.str("provider")) ?: PassProvider.GENERIC

        val state = if (provider == PassProvider.GENERIC) {
            val store = genericStore
            when {
                store == null -> PassState.UNSUPPORTED
                store.hasPass(appIdProvider(), passId) -> PassState.ADDED
                else -> PassState.NOT_ADDED
            }
        } else {
            requireAdapter(provider).getPassState(passId)
        }

        return Result.success(buildJsonObject {
            put("passId", passId)
            put("provider", provider.name)
            put("state", state.name)
        })
    }

    private suspend fun openPass(payload: JsonObject): Result<JsonObject> {
        val passId = payload.str("passId")
            ?: throw PassException(PassErrorCode.INVALID_PARAMETERS, "Missing 'passId'")
        val provider = PassProvider.fromWireName(payload.str("provider")) ?: PassProvider.GENERIC
        val opened = if (provider == PassProvider.GENERIC) false else requireAdapter(provider).openPass(passId)
        return Result.success(buildJsonObject {
            put("passId", passId)
            put("opened", opened)
        })
    }

    private fun listPasses(): Result<JsonObject> {
        val ids = genericStore?.listPasses(appIdProvider()).orEmpty()
        return Result.success(buildJsonObject {
            put("count", ids.size)
            put("passIds", kotlinx.serialization.json.JsonArray(ids.map { JsonPrimitive(it) }))
        })
    }

    private fun deletePass(payload: JsonObject): Result<JsonObject> {
        val passId = payload.str("passId")
            ?: throw PassException(PassErrorCode.INVALID_PARAMETERS, "Missing 'passId'")
        // Only goat's own store can be deleted from; the platform wallets deliberately give no
        // programmatic removal, and pretending otherwise would be a lie to the caller.
        val deleted = genericStore?.deletePass(appIdProvider(), passId) ?: false
        return Result.success(buildJsonObject {
            put("passId", passId)
            put("deleted", deleted)
        })
    }

    private fun parseMetadata(payload: JsonObject, provider: PassProvider): PassMetadata? {
        val meta = payload["metadata"]?.let { runCatching { it.jsonObject }.getOrNull() } ?: return null
        val typeId = meta.str("passTypeIdentifier") ?: return null
        val serial = meta.str("serialNumber") ?: return null
        val barcode = meta["barcode"]?.let { runCatching { it.jsonObject }.getOrNull() }?.let { b ->
            PassBarcode(
                format = b.str("format")?.uppercase() ?: "QR",
                message = b.str("message") ?: "",
                altText = b.str("altText"),
                encoding = b.str("encoding") ?: "iso-8859-1"
            )
        }
        return PassMetadata(
            passTypeIdentifier = typeId,
            serialNumber = serial,
            provider = provider,
            description = meta.str("description"),
            organizationName = meta.str("organizationName"),
            barcode = barcode,
            savedAtEpochMs = System.currentTimeMillis()
        )
    }

    private fun JsonObject.str(key: String): String? =
        this[key]?.let { runCatching { (it as JsonPrimitive).content }.getOrNull() }
            ?.takeIf { it.isNotBlank() && it != "null" }
}
