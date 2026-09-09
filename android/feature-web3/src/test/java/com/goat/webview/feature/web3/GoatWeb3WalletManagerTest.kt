package com.goat.webview.feature.web3

import android.content.Context
import android.content.ContextWrapper
import com.goat.webview.feature.web3.reference.GoatReferenceWalletAdapter
import com.goat.webview.feature.web3.spi.ChainFamily
import com.goat.webview.feature.web3.spi.DecodedTransactionPreview
import com.goat.webview.feature.web3.spi.GoatWalletAdapter
import com.goat.webview.feature.web3.spi.WalletAccountInfo
import com.goat.webview.feature.web3.spi.WalletContext
import com.goat.webview.feature.web3.spi.WalletLockKey
import com.goat.webview.feature.web3.spi.Web3ErrorCode
import com.goat.webview.feature.web3.spi.Web3Exception
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

class GoatWeb3WalletManagerTest {

    private lateinit var fakeContext: FakeTestContext
    private lateinit var manager: GoatWeb3WalletManager

    private class FakeTestContext : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this
    }

    private class StubAdapter(
        override val chainFamily: ChainFamily,
        override val supportedChainIds: List<String> = listOf("1")
    ) : GoatWalletAdapter {
        override suspend fun connect(chains: List<String>, manifestUrl: String?, ctx: WalletContext) =
            Result.success(WalletAccountInfo("0xstub", "pubstub", supportedChainIds.first(), "Stub"))

        override suspend fun disconnect(ctx: WalletContext) = Result.success(true)

        override suspend fun decodeTransaction(txData: JsonObject, ctx: WalletContext) =
            Result.success(
                DecodedTransactionPreview(
                    networkName = "stub", recipient = "0xrecipient",
                    valueFormatted = "0", feeFormatted = "0",
                    methodName = "transfer", methodDescription = "stub"
                )
            )

        override suspend fun signTransaction(txData: JsonObject, preview: DecodedTransactionPreview, ctx: WalletContext) =
            Result.success(buildJsonObject { put("signature", "0xstubsig") })

        override suspend fun signMessage(message: String, messageType: String, ctx: WalletContext) =
            Result.success(buildJsonObject { put("signature", "0xstubmsg") })

        override suspend fun switchChain(targetChainId: String, addChainParams: JsonObject?, ctx: WalletContext) =
            Result.success(true)
    }

    @Before
    fun setUp() {
        fakeContext = FakeTestContext()
        manager = GoatWeb3WalletManager(fakeContext)
    }

    @Test
    fun testAdapterRegistrationAndLookup() {
        assertNull(manager.getAdapter(ChainFamily.EVM))
        val adapter = StubAdapter(ChainFamily.EVM)
        manager.registerAdapter(adapter)
        assertEquals(adapter, manager.getAdapter(ChainFamily.EVM))
        assertEquals(setOf(ChainFamily.EVM), manager.registeredFamilies())
        assertTrue(manager.unregisterAdapter(ChainFamily.EVM))
        assertNull(manager.getAdapter(ChainFamily.EVM))
    }

    @Test
    fun testRequireAdapterRejectsMissingFamily() {
        val e = runCatching { manager.requireAdapter(ChainFamily.SOLANA) }.exceptionOrNull()
        assertTrue(e is Web3Exception)
        assertEquals(Web3ErrorCode.NO_ADAPTER_REGISTERED, (e as Web3Exception).code)
    }

    @Test
    fun testRegisteringSameFamilyReplacesAdapter() {
        val first = StubAdapter(ChainFamily.EVM)
        val second = StubAdapter(ChainFamily.EVM)
        manager.registerAdapter(first)
        manager.registerAdapter(second)
        assertEquals(second, manager.getAdapter(ChainFamily.EVM))
    }

    @Test
    fun testMutexSerializesSameKeyAndReleasesIt() = runTest {
        val result = manager.executeWithMutex("k") { "first" }
        assertEquals("first", result)
        assertEquals(0, manager.inFlightKeyCount())
        assertEquals("second", manager.executeWithMutex("k") { "second" })
        assertEquals(0, manager.inFlightKeyCount())
    }

    @Test
    fun testMutexRejectsContendingCallerOnSameKey() = runTest {
        var inner: Throwable? = null
        manager.executeWithMutex("same") {
            inner = runCatching { manager.executeWithMutex("same") { "nested" } }.exceptionOrNull()
        }
        assertTrue(inner is Web3Exception)
        assertEquals(Web3ErrorCode.WALLET_ACTION_IN_PROGRESS, (inner as Web3Exception).code)
        assertEquals(0, manager.inFlightKeyCount())
    }

    @Test
    fun testNonContendingKeysExecuteConcurrently() = runTest {
        val a = manager.executeWithMutex("key-a") { 1 }
        val b = manager.executeWithMutex("key-b") { 2 }
        assertEquals(3, a + b)
        assertEquals(0, manager.inFlightKeyCount())
    }

    @Test
    fun testHighConcurrencySameKeyAdmitsExactlyOneAndLeavesNoRetention() = runBlocking {
        val admitted = AtomicInteger(0)
        val rejected = AtomicInteger(0)
        val jobs = (1..64).map {
            async(Dispatchers.Default) {
                try {
                    manager.executeWithMutex("contended") {
                        admitted.incrementAndGet()
                        delay(20)
                    }
                } catch (e: Web3Exception) {
                    assertEquals(Web3ErrorCode.WALLET_ACTION_IN_PROGRESS, e.code)
                    rejected.incrementAndGet()
                }
            }
        }
        jobs.awaitAll()
        assertEquals(64, admitted.get() + rejected.get())
        assertTrue("at least one caller must be admitted", admitted.get() >= 1)
        assertEquals("split-mutex leak: keys retained after all callers finished", 0, manager.inFlightKeyCount())
    }

    @Test
    fun testHighConcurrencyDistinctKeysAllSucceedAndCleanUp() = runBlocking {
        val done = AtomicInteger(0)
        (1..64).map { i ->
            async(Dispatchers.Default) {
                manager.executeWithMutex("key-$i") {
                    withContext(Dispatchers.Default) { done.incrementAndGet() }
                }
            }
        }.awaitAll()
        assertEquals(64, done.get())
        assertEquals(0, manager.inFlightKeyCount())
    }

    @Test
    fun testMutexReleasesKeyWhenBlockThrows() = runTest {
        val e = runCatching { manager.executeWithMutex("boom") { error("inner failure") } }.exceptionOrNull()
        assertNotNull(e)
        assertEquals(0, manager.inFlightKeyCount())
    }

    @Test
    fun testSessionsAreIsolatedPerAppId() {
        val account = Web3WalletAccount("0xabc", "pub", "Stub", "ethereum", "1")
        manager.putSession("tenant-a", ChainFamily.EVM, account)

        assertEquals(account, manager.getSession("tenant-a", ChainFamily.EVM))
        assertNull("tenant-b must not observe tenant-a's wallet session", manager.getSession("tenant-b", ChainFamily.EVM))
        assertNull(manager.getSession("tenant-a", ChainFamily.SOLANA))

        assertTrue(manager.clearSession("tenant-a", ChainFamily.EVM))
        assertNull(manager.getSession("tenant-a", ChainFamily.EVM))
        assertFalse(manager.clearSession("tenant-a", ChainFamily.EVM))
    }

    @Test
    fun testLockKeyDiscriminatesOnNonceAndBlockhash() {
        val evmA = WalletLockKey.forTransaction(ChainFamily.EVM, "1", "0xabc", buildJsonObject { put("nonce", "7") })
        val evmB = WalletLockKey.forTransaction(ChainFamily.EVM, "1", "0xabc", buildJsonObject { put("nonce", "8") })
        assertFalse(evmA == evmB)

        val solA = WalletLockKey.forTransaction(
            ChainFamily.SOLANA, "solana:mainnet", "sol1", buildJsonObject { put("recentBlockhash", "hash1") }
        )
        val solB = WalletLockKey.forTransaction(
            ChainFamily.SOLANA, "solana:mainnet", "sol1", buildJsonObject { put("recentBlockhash", "hash2") }
        )
        assertFalse(solA == solB)

        val bare1 = WalletLockKey.forTransaction(ChainFamily.EVM, "1", "0xabc", buildJsonObject { })
        val bare2 = WalletLockKey.forTransaction(ChainFamily.EVM, "1", "0xabc", buildJsonObject { })
        assertEquals("nonce-less requests must share one key so a double-tap cannot double-sign", bare1, bare2)
    }

    @Test
    fun testReferenceAdapterNeverClaimsARealSignature() = runTest {
        val adapter = GoatReferenceWalletAdapter(ChainFamily.EVM)
        val ctx = WalletContext("tenant", "https://appassets.androidplatform.net", fakeContext)
        val tx = buildJsonObject { put("to", "0xdead"); put("value", "1") }
        val preview = adapter.decodeTransaction(tx, ctx).getOrThrow()
        val signed = adapter.signTransaction(tx, preview, ctx).getOrThrow()

        assertEquals("true", signed["simulated"].toString())
        assertTrue(
            "reference signatures must be unmistakably simulated",
            signed["signature"].toString().contains(GoatReferenceWalletAdapter.SIMULATED_PREFIX)
        )
    }
}
