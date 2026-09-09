package com.goat.webview.feature.web3

import android.content.Context
import com.goat.webview.GoatBridgePlugin
import com.goat.webview.GoatWebViewClient
import com.goat.webview.feature.web3.reference.GoatReferenceWalletAdapter
import com.goat.webview.feature.web3.spi.ChainFamily
import com.goat.webview.feature.web3.spi.GoatWalletAdapter
import com.goat.webview.feature.web3.spi.WalletContext
import com.goat.webview.feature.web3.spi.WalletLockKey
import com.goat.webview.feature.web3.spi.Web3ErrorCode
import com.goat.webview.feature.web3.spi.Web3Exception
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/**
 * Domain 13b (Web3 & Wallet Signing) as a standalone feature module.
 *
 * Routes every `WEB3_*` action to the [GoatWalletAdapter] registered for the requested
 * [ChainFamily]. This module never holds key material; a host supplies signing by registering its
 * own adapter. When [adapters] is empty the simulated [GoatReferenceWalletAdapter] set is
 * registered so the bridge surface stays exercisable — every response it produces is tagged
 * `"simulated": true`.
 *
 * The L1 user-gesture gate is enforced centrally by `GoatBridgeActionHandler` via
 * `GoatAbuseGuardManager.PRIVILEGED_ACTIONS`, which this module's signing actions are listed in.
 */
class GoatWeb3Plugin(
    private val context: Context,
    adapters: List<GoatWalletAdapter> = emptyList(),
    walletManager: GoatWeb3WalletManager? = null,
    private val appIdProvider: () -> String = { DEFAULT_APP_ID }
) : GoatBridgePlugin {

    companion object {
        const val DEFAULT_APP_ID = "default"

        const val ACTION_CONNECT = "WEB3_CONNECT_WALLET"
        const val ACTION_SIGN_TRANSACTION = "WEB3_SIGN_TRANSACTION"
        const val ACTION_SIGN_MESSAGE = "WEB3_SIGN_MESSAGE"
        const val ACTION_SWITCH_CHAIN = "WEB3_SWITCH_CHAIN"
        const val ACTION_DISCONNECT = "WEB3_DISCONNECT"
        const val ACTION_GET_ACCOUNT = "WEB3_GET_ACCOUNT"
    }

    val manager: GoatWeb3WalletManager = walletManager ?: GoatWeb3WalletManager(context)

    init {
        val supplied = adapters.ifEmpty { GoatReferenceWalletAdapter.defaultSet() }
        supplied.forEach { manager.registerAdapter(it) }
    }

    override val pluginId: String = "web3"

    override val supportedActions: List<String> = listOf(
        ACTION_CONNECT,
        ACTION_SIGN_TRANSACTION,
        ACTION_SIGN_MESSAGE,
        ACTION_SWITCH_CHAIN,
        ACTION_DISCONNECT,
        ACTION_GET_ACCOUNT
    )

    override suspend fun execute(action: String, payload: JsonObject): Result<JsonObject> = try {
        when (action) {
            "WEB3_CONNECT_WALLET" -> connect(payload)
            "WEB3_SIGN_TRANSACTION" -> signTransaction(payload)
            "WEB3_SIGN_MESSAGE" -> signMessage(payload)
            "WEB3_SWITCH_CHAIN" -> switchChain(payload)
            "WEB3_DISCONNECT" -> disconnect(payload)
            "WEB3_GET_ACCOUNT" -> getAccount(payload)
            else -> Result.failure(IllegalArgumentException("Unsupported web3 action: $action"))
        }
    } catch (e: Web3Exception) {
        Result.failure(e)
    } catch (e: IllegalArgumentException) {
        Result.failure(e)
    }

    private fun walletContext(): WalletContext {
        val appId = appIdProvider()
        return WalletContext(
            appId = appId,
            origin = "https://" + GoatWebViewClient.resolveDomain(appId),
            context = context
        )
    }

    private fun resolveFamily(payload: JsonObject): ChainFamily {
        payload.str("chainFamily")?.let { raw ->
            return ChainFamily.fromWireName(raw)
                ?: throw Web3Exception(Web3ErrorCode.CHAIN_UNSUPPORTED, "Unknown chainFamily '$raw'")
        }
        return ChainFamily.fromNetworkName(payload.str("network"))
    }

    private fun requestedChains(payload: JsonObject): List<String> {
        payload["chains"]?.let { element ->
            runCatching { element.jsonArray }.getOrNull()?.let { arr: JsonArray ->
                return arr.mapNotNull { runCatching { it.jsonPrimitive.content }.getOrNull() }
            }
        }
        return listOfNotNull(payload.str("chainId"))
    }

    private fun networkLabel(payload: JsonObject, family: ChainFamily): String =
        payload.str("network") ?: when (family) {
            ChainFamily.EVM -> "ethereum"
            ChainFamily.SOLANA -> "solana"
            ChainFamily.TON -> "ton"
            ChainFamily.CUSTOM -> "custom"
        }

    private suspend fun connect(payload: JsonObject): Result<JsonObject> {
        val family = resolveFamily(payload)
        val adapter = manager.requireAdapter(family)
        val ctx = walletContext()
        val network = networkLabel(payload, family)

        val info = manager.executeWithMutex(
            WalletLockKey.forSession(family, payload.str("chainId") ?: "-", ctx.appId)
        ) {
            adapter.connect(requestedChains(payload), payload.str("manifestUrl"), ctx).getOrThrow()
        }

        val account = manager.toWalletAccount(info, network)
        manager.putSession(ctx.appId, family, account)
        return Result.success(account.toJson())
    }

    private suspend fun signTransaction(payload: JsonObject): Result<JsonObject> {
        val family = resolveFamily(payload)
        val adapter = manager.requireAdapter(family)
        val ctx = walletContext()
        val account = manager.getSession(ctx.appId, family)
            ?: throw Web3Exception(
                Web3ErrorCode.WALLET_NOT_CONNECTED,
                "Wallet not connected. Call WEB3_CONNECT_WALLET first."
            )

        val txData = payload.objectOf("txData") ?: legacyTxData(payload)
        if (txData.str("to").isNullOrBlank() && txData.str("address").isNullOrBlank()) {
            return Result.failure(IllegalArgumentException("Missing 'to'"))
        }

        val lockKey = WalletLockKey.forTransaction(family, account.chainId, account.address, txData)
        val signed = manager.executeWithMutex(lockKey) {
            val preview = adapter.decodeTransaction(txData, ctx).getOrThrow()
            adapter.signTransaction(txData, preview, ctx).getOrThrow()
        }

        return Result.success(buildJsonObject {
            signed.forEach { (k, v) -> put(k, v) }
            if (!signed.containsKey("network")) put("network", account.network)
            if (!signed.containsKey("from")) put("from", account.address)
        })
    }

    private suspend fun signMessage(payload: JsonObject): Result<JsonObject> {
        val family = resolveFamily(payload)
        val adapter = manager.requireAdapter(family)
        val ctx = walletContext()
        val account = manager.getSession(ctx.appId, family)
            ?: throw Web3Exception(
                Web3ErrorCode.WALLET_NOT_CONNECTED,
                "Wallet not connected. Call WEB3_CONNECT_WALLET first."
            )

        val message = payload.str("message")
            ?: return Result.failure(IllegalArgumentException("Missing 'message'"))
        val messageType = payload.str("messageType") ?: "personal_sign"

        val signed = manager.executeWithMutex(
            WalletLockKey.forSession(family, account.chainId, account.address)
        ) {
            adapter.signMessage(message, messageType, ctx).getOrThrow()
        }
        return Result.success(signed)
    }

    private suspend fun switchChain(payload: JsonObject): Result<JsonObject> {
        val family = resolveFamily(payload)
        val adapter = manager.requireAdapter(family)
        val ctx = walletContext()
        val target = payload.str("chainId") ?: payload.str("targetChainId")
            ?: return Result.failure(IllegalArgumentException("Missing 'chainId'"))

        val switched = adapter.switchChain(target, payload.objectOf("addChainParams"), ctx).getOrThrow()
        if (switched) {
            manager.getSession(ctx.appId, family)?.let { current ->
                manager.putSession(ctx.appId, family, current.copy(chainId = target.removePrefix("eip155:")))
            }
        }
        return Result.success(buildJsonObject {
            put("switched", switched)
            put("chainId", target.removePrefix("eip155:"))
        })
    }

    private suspend fun disconnect(payload: JsonObject): Result<JsonObject> {
        val ctx = walletContext()
        val family = payload.str("chainFamily")?.let { ChainFamily.fromWireName(it) }
        val hadSession = if (family != null) {
            manager.getAdapter(family)?.disconnect(ctx)
            manager.clearSession(ctx.appId, family)
        } else {
            manager.registeredFamilies().forEach { manager.getAdapter(it)?.disconnect(ctx) }
            manager.clearAllSessions(ctx.appId)
        }
        return Result.success(buildJsonObject { put("disconnected", hadSession) })
    }

    private fun getAccount(payload: JsonObject): Result<JsonObject> {
        val ctx = walletContext()
        val family = payload.str("chainFamily")?.let { ChainFamily.fromWireName(it) }
        val account = if (family != null) {
            manager.getSession(ctx.appId, family)
        } else {
            manager.getAnySession(ctx.appId)
        }
        return Result.success(
            if (account != null) {
                buildJsonObject {
                    put("connected", true)
                    account.toJson().forEach { (k, v) -> put(k, v) }
                }
            } else {
                buildJsonObject { put("connected", false) }
            }
        )
    }

    private fun legacyTxData(payload: JsonObject): JsonObject = buildJsonObject {
        payload.str("to")?.let { put("to", it) }
        payload.str("amount")?.let { put("value", it); put("amount", it) }
        payload.str("value")?.let { put("value", it) }
        payload.str("payload")?.let { put("data", it) }
        payload.str("data")?.let { put("data", it) }
        payload.str("nonce")?.let { put("nonce", it) }
    }

    private fun Web3WalletAccount.toJson(): JsonObject = buildJsonObject {
        put("address", address)
        put("publicKey", publicKey)
        put("wallet", wallet)
        put("network", network)
        put("chainId", chainId)
    }

    private fun JsonObject.str(key: String): String? =
        this[key]?.let { runCatching { (it as JsonPrimitive).content }.getOrNull() }
            ?.takeIf { it.isNotBlank() && it != "null" }

    private fun JsonObject.objectOf(key: String): JsonObject? =
        this[key]?.let { runCatching { it.jsonObject }.getOrNull() }
}
