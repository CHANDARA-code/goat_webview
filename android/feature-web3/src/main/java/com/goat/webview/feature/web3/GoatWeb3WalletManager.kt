package com.goat.webview.feature.web3

import android.content.Context
import com.goat.webview.feature.web3.spi.ChainFamily
import com.goat.webview.feature.web3.spi.GoatWalletAdapter
import com.goat.webview.feature.web3.spi.WalletAccountInfo
import com.goat.webview.feature.web3.spi.Web3ErrorCode
import com.goat.webview.feature.web3.spi.Web3Exception
import kotlinx.coroutines.sync.Mutex
import kotlinx.serialization.Serializable
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

@Serializable
data class Web3WalletAccount(
    val address: String,
    val publicKey: String,
    val wallet: String,
    val network: String,
    val chainId: String
)

@Serializable
data class Web3SignedTransactionResult(
    val signature: String,
    val txHash: String,
    val network: String,
    val from: String
)

/**
 * Registry and concurrency arbiter for [GoatWalletAdapter] implementations.
 *
 * Holds no keys and performs no signing: a host application registers an adapter per
 * [ChainFamily] and this class routes to it, serialising operations that must not interleave.
 * Wallet sessions are keyed by `appId` so one mini-app can never observe or reuse another's
 * connected account.
 */
class GoatWeb3WalletManager(
    private val context: Context
) {

    private class RefCountedMutex {
        val mutex = Mutex()
        val refCount = AtomicInteger(1)
    }

    private val adapters = ConcurrentHashMap<ChainFamily, GoatWalletAdapter>()
    private val inFlightMutexes = ConcurrentHashMap<String, RefCountedMutex>()
    private val sessions = ConcurrentHashMap<String, Web3WalletAccount>()

    val applicationContext: Context get() = context

    fun registerAdapter(adapter: GoatWalletAdapter) {
        adapters[adapter.chainFamily] = adapter
    }

    fun unregisterAdapter(family: ChainFamily): Boolean = adapters.remove(family) != null

    fun getAdapter(family: ChainFamily): GoatWalletAdapter? = adapters[family]

    fun registeredFamilies(): Set<ChainFamily> = adapters.keys.toSet()

    fun requireAdapter(family: ChainFamily): GoatWalletAdapter =
        adapters[family] ?: throw Web3Exception(
            Web3ErrorCode.NO_ADAPTER_REGISTERED,
            "No GoatWalletAdapter registered for chain family $family. " +
                "Register one via GoatWeb3Plugin(context, adapters = listOf(...))."
        )

    /**
     * Runs [block] under mutual exclusion for [lockKey]. A second caller contending for the same
     * key fails fast with `WALLET_ACTION_IN_PROGRESS` rather than queueing, so a double-tap or a
     * replayed payload cannot open two signing ceremonies for one account/nonce.
     */
    suspend fun <T> executeWithMutex(lockKey: String, block: suspend () -> T): T {
        val ref = inFlightMutexes.compute(lockKey) { _, existing ->
            if (existing == null) {
                RefCountedMutex()
            } else {
                existing.refCount.incrementAndGet()
                existing
            }
        }!!

        if (!ref.mutex.tryLock()) {
            cleanRef(lockKey, ref)
            throw Web3Exception(
                Web3ErrorCode.WALLET_ACTION_IN_PROGRESS,
                "Another wallet operation is already in progress for $lockKey"
            )
        }

        return try {
            block()
        } finally {
            ref.mutex.unlock()
            cleanRef(lockKey, ref)
        }
    }

    private fun cleanRef(key: String, ref: RefCountedMutex) {
        inFlightMutexes.compute(key) { _, current ->
            when {
                current == null -> null
                current === ref && current.refCount.decrementAndGet() <= 0 -> null
                else -> current
            }
        }
    }

    internal fun inFlightKeyCount(): Int = inFlightMutexes.size

    fun putSession(appId: String, family: ChainFamily, account: Web3WalletAccount) {
        sessions[sessionKey(appId, family)] = account
    }

    fun getSession(appId: String, family: ChainFamily): Web3WalletAccount? =
        sessions[sessionKey(appId, family)]

    fun getAnySession(appId: String): Web3WalletAccount? =
        ChainFamily.entries.firstNotNullOfOrNull { sessions[sessionKey(appId, it)] }

    fun clearSession(appId: String, family: ChainFamily): Boolean =
        sessions.remove(sessionKey(appId, family)) != null

    fun clearAllSessions(appId: String): Boolean =
        ChainFamily.entries.map { clearSession(appId, it) }.any { it }

    fun toWalletAccount(
        info: WalletAccountInfo,
        network: String
    ): Web3WalletAccount = Web3WalletAccount(
        address = info.address,
        publicKey = info.publicKey,
        wallet = info.walletName,
        network = network,
        chainId = info.chainId
    )

    private fun sessionKey(appId: String, family: ChainFamily) = "$appId:$family"
}
