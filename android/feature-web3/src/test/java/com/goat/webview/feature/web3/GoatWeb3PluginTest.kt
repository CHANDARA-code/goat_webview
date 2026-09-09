package com.goat.webview.feature.web3

import android.content.Context
import android.content.ContextWrapper
import com.goat.webview.feature.web3.reference.GoatReferenceWalletAdapter
import com.goat.webview.feature.web3.spi.ChainFamily
import com.goat.webview.feature.web3.spi.DecodedTransactionPreview
import com.goat.webview.feature.web3.spi.GoatWalletAdapter
import com.goat.webview.feature.web3.spi.WalletAccountInfo
import com.goat.webview.feature.web3.spi.WalletContext
import com.goat.webview.feature.web3.spi.Web3ErrorCode
import com.goat.webview.feature.web3.spi.Web3Exception
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GoatWeb3PluginTest {

    private lateinit var plugin: GoatWeb3Plugin

    private class FakeTestContext : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this
    }

    private class RecordingAdapter(
        override val chainFamily: ChainFamily = ChainFamily.EVM,
        override val supportedChainIds: List<String> = listOf("1", "137")
    ) : GoatWalletAdapter {
        var connectCalls = 0
        var lastMessageType: String? = null
        var lastPreview: DecodedTransactionPreview? = null
        var lastSwitchTarget: String? = null
        var disconnectCalls = 0

        override suspend fun connect(chains: List<String>, manifestUrl: String?, ctx: WalletContext): Result<WalletAccountInfo> {
            connectCalls++
            return Result.success(WalletAccountInfo("0xhost", "pubhost", "1", "HostWallet"))
        }

        override suspend fun disconnect(ctx: WalletContext): Result<Boolean> {
            disconnectCalls++
            return Result.success(true)
        }

        override suspend fun decodeTransaction(txData: JsonObject, ctx: WalletContext): Result<DecodedTransactionPreview> =
            Result.success(
                DecodedTransactionPreview(
                    networkName = "ethereum",
                    recipient = txData["to"]?.jsonPrimitive?.content ?: "",
                    valueFormatted = "1",
                    feeFormatted = "0.001",
                    methodName = "approve",
                    methodDescription = "Unlimited approval",
                    isDangerousApproval = true,
                    isPermit2Unlimited = true
                )
            )

        override suspend fun signTransaction(
            txData: JsonObject,
            preview: DecodedTransactionPreview,
            ctx: WalletContext
        ): Result<JsonObject> {
            lastPreview = preview
            return Result.success(buildJsonObject { put("signature", "0xhostsig"); put("txHash", "0xhosthash") })
        }

        override suspend fun signMessage(message: String, messageType: String, ctx: WalletContext): Result<JsonObject> {
            lastMessageType = messageType
            return Result.success(buildJsonObject { put("signature", "0xhostmsgsig"); put("address", "0xhost") })
        }

        override suspend fun switchChain(targetChainId: String, addChainParams: JsonObject?, ctx: WalletContext): Result<Boolean> {
            lastSwitchTarget = targetChainId
            return Result.success(supportedChainIds.contains(targetChainId.removePrefix("eip155:")))
        }
    }

    @Before
    fun setUp() {
        plugin = GoatWeb3Plugin(FakeTestContext())
    }

    private fun String?.orEmptyContent() = this ?: ""

    @Test
    fun testPluginIdentityAndActionSurface() {
        assertEquals("web3", plugin.pluginId)
        assertEquals(6, plugin.supportedActions.size)
        listOf(
            "WEB3_CONNECT_WALLET", "WEB3_SIGN_TRANSACTION", "WEB3_SIGN_MESSAGE",
            "WEB3_SWITCH_CHAIN", "WEB3_DISCONNECT", "WEB3_GET_ACCOUNT"
        ).forEach { assertTrue("$it not handled", plugin.canHandle(it)) }
        assertFalse(plugin.canHandle("REQUEST_PAYMENT"))
    }

    @Test
    fun testDefaultsToReferenceAdaptersForEveryChainFamily() {
        assertEquals(
            setOf(ChainFamily.EVM, ChainFamily.SOLANA, ChainFamily.TON),
            plugin.manager.registeredFamilies()
        )
        assertTrue(plugin.manager.getAdapter(ChainFamily.EVM) is GoatReferenceWalletAdapter)
    }

    @Test
    fun testHostSuppliedAdapterReplacesTheReferenceOne() = runTest {
        val adapter = RecordingAdapter()
        val hosted = GoatWeb3Plugin(FakeTestContext(), adapters = listOf(adapter))

        assertEquals(setOf(ChainFamily.EVM), hosted.manager.registeredFamilies())
        val res = hosted.execute("WEB3_CONNECT_WALLET", buildJsonObject { put("network", "ethereum") })
        assertTrue(res.isSuccess)
        assertEquals(1, adapter.connectCalls)
        assertEquals("HostWallet", res.getOrNull()?.get("wallet")?.jsonPrimitive?.content)
        assertEquals("0xhost", res.getOrNull()?.get("address")?.jsonPrimitive?.content)
    }

    @Test
    fun testConnectSignDisconnectLifecycle() = runTest {
        val connectRes = plugin.execute("WEB3_CONNECT_WALLET", buildJsonObject { put("network", "ton-mainnet") })
        assertTrue(connectRes.isSuccess)
        assertEquals("ton-mainnet", connectRes.getOrNull()?.get("network")?.jsonPrimitive?.content)

        val accountRes = plugin.execute("WEB3_GET_ACCOUNT", buildJsonObject { })
        assertEquals("true", accountRes.getOrNull()?.get("connected")?.jsonPrimitive?.content)

        val signRes = plugin.execute("WEB3_SIGN_TRANSACTION", buildJsonObject {
            put("network", "ton-mainnet")
            put("to", "EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N")
            put("amount", "100000000")
        })
        assertTrue(signRes.exceptionOrNull()?.message ?: "", signRes.isSuccess)
        assertTrue(
            signRes.getOrNull()?.get("signature")?.jsonPrimitive?.content
                .orEmptyContent().startsWith(GoatReferenceWalletAdapter.SIMULATED_PREFIX)
        )

        val disconnectRes = plugin.execute("WEB3_DISCONNECT", buildJsonObject { })
        assertEquals("true", disconnectRes.getOrNull()?.get("disconnected")?.jsonPrimitive?.content)

        val afterRes = plugin.execute("WEB3_GET_ACCOUNT", buildJsonObject { })
        assertEquals("false", afterRes.getOrNull()?.get("connected")?.jsonPrimitive?.content)
    }

    @Test
    fun testGetAccountReportsDisconnectedBeforeAnyConnect() = runTest {
        val res = plugin.execute("WEB3_GET_ACCOUNT", buildJsonObject { })
        assertTrue(res.isSuccess)
        assertEquals("false", res.getOrNull()?.get("connected")?.jsonPrimitive?.content)
    }

    @Test
    fun testSignTransactionRequiresAConnectedWallet() = runTest {
        val res = plugin.execute("WEB3_SIGN_TRANSACTION", buildJsonObject {
            put("network", "ethereum")
            put("to", "0xdead")
            put("amount", "1")
        })
        assertTrue(res.isFailure)
        assertEquals(Web3ErrorCode.WALLET_NOT_CONNECTED, (res.exceptionOrNull() as Web3Exception).code)
    }

    @Test
    fun testSignTransactionRequiresRecipient() = runTest {
        plugin.execute("WEB3_CONNECT_WALLET", buildJsonObject { put("network", "ton-mainnet") })
        val res = plugin.execute("WEB3_SIGN_TRANSACTION", buildJsonObject {
            put("network", "ton-mainnet")
            put("amount", "1")
        })
        assertTrue(res.isFailure)
        assertTrue(res.exceptionOrNull() is IllegalArgumentException)
    }

    @Test
    fun testSignTransactionPassesDecodedPreviewToTheAdapter() = runTest {
        val adapter = RecordingAdapter()
        val hosted = GoatWeb3Plugin(FakeTestContext(), adapters = listOf(adapter))
        hosted.execute("WEB3_CONNECT_WALLET", buildJsonObject { put("network", "ethereum") })

        val res = hosted.execute("WEB3_SIGN_TRANSACTION", buildJsonObject {
            put("network", "ethereum")
            put("to", "0xdead")
            put("amount", "1")
        })
        assertTrue(res.isSuccess)
        assertNotNull(adapter.lastPreview)
        assertTrue("decoded preview must reach the signer", adapter.lastPreview!!.isPermit2Unlimited)
        assertEquals("0xdead", adapter.lastPreview!!.recipient)
    }

    @Test
    fun testSignMessageRoutesMessageTypeThrough() = runTest {
        val adapter = RecordingAdapter()
        val hosted = GoatWeb3Plugin(FakeTestContext(), adapters = listOf(adapter))
        hosted.execute("WEB3_CONNECT_WALLET", buildJsonObject { put("network", "ethereum") })

        val res = hosted.execute("WEB3_SIGN_MESSAGE", buildJsonObject {
            put("network", "ethereum")
            put("message", "{\"primaryType\":\"PermitSingle\"}")
            put("messageType", "eth_signTypedData_v4")
        })
        assertTrue(res.isSuccess)
        assertEquals("eth_signTypedData_v4", adapter.lastMessageType)
        assertEquals("0xhostmsgsig", res.getOrNull()?.get("signature")?.jsonPrimitive?.content)
    }

    @Test
    fun testSignMessageRequiresMessage() = runTest {
        plugin.execute("WEB3_CONNECT_WALLET", buildJsonObject { put("network", "ethereum") })
        val res = plugin.execute("WEB3_SIGN_MESSAGE", buildJsonObject { put("network", "ethereum") })
        assertTrue(res.isFailure)
        assertTrue(res.exceptionOrNull() is IllegalArgumentException)
    }

    @Test
    fun testSwitchChainUpdatesSessionChainId() = runTest {
        val adapter = RecordingAdapter()
        val hosted = GoatWeb3Plugin(FakeTestContext(), adapters = listOf(adapter))
        hosted.execute("WEB3_CONNECT_WALLET", buildJsonObject { put("network", "ethereum") })

        val res = hosted.execute("WEB3_SWITCH_CHAIN", buildJsonObject {
            put("network", "ethereum")
            put("chainId", "eip155:137")
        })
        assertTrue(res.isSuccess)
        assertEquals("137", res.getOrNull()?.get("chainId")?.jsonPrimitive?.content)
        assertEquals("eip155:137", adapter.lastSwitchTarget)

        val account = hosted.execute("WEB3_GET_ACCOUNT", buildJsonObject { })
        assertEquals("137", account.getOrNull()?.get("chainId")?.jsonPrimitive?.content)
    }

    @Test
    fun testSwitchChainRejectsUnsupportedChain() = runTest {
        plugin.execute("WEB3_CONNECT_WALLET", buildJsonObject { put("network", "ethereum") })
        val res = plugin.execute("WEB3_SWITCH_CHAIN", buildJsonObject {
            put("network", "ethereum")
            put("chainId", "99999")
        })
        assertTrue(res.isFailure)
        assertEquals(Web3ErrorCode.CHAIN_UNSUPPORTED, (res.exceptionOrNull() as Web3Exception).code)
    }

    @Test
    fun testUnknownChainFamilyIsRejected() = runTest {
        val res = plugin.execute("WEB3_CONNECT_WALLET", buildJsonObject { put("chainFamily", "DOGECHAIN") })
        assertTrue(res.isFailure)
        assertEquals(Web3ErrorCode.CHAIN_UNSUPPORTED, (res.exceptionOrNull() as Web3Exception).code)
    }

    @Test
    fun testMissingAdapterForFamilyIsRejected() = runTest {
        val hosted = GoatWeb3Plugin(FakeTestContext(), adapters = listOf(RecordingAdapter(ChainFamily.EVM)))
        val res = hosted.execute("WEB3_CONNECT_WALLET", buildJsonObject { put("chainFamily", "SOLANA") })
        assertTrue(res.isFailure)
        assertEquals(Web3ErrorCode.NO_ADAPTER_REGISTERED, (res.exceptionOrNull() as Web3Exception).code)
    }

    @Test
    fun testSessionsDoNotLeakBetweenTenants() = runTest {
        val shared = GoatWeb3WalletManager(FakeTestContext())
        val tenantA = GoatWeb3Plugin(FakeTestContext(), walletManager = shared, appIdProvider = { "tenant-a" })
        val tenantB = GoatWeb3Plugin(FakeTestContext(), walletManager = shared, appIdProvider = { "tenant-b" })

        tenantA.execute("WEB3_CONNECT_WALLET", buildJsonObject { put("network", "ethereum") })

        assertEquals("true", tenantA.execute("WEB3_GET_ACCOUNT", buildJsonObject { })
            .getOrNull()?.get("connected")?.jsonPrimitive?.content)
        assertEquals("false", tenantB.execute("WEB3_GET_ACCOUNT", buildJsonObject { })
            .getOrNull()?.get("connected")?.jsonPrimitive?.content)
    }

    @Test
    fun testReferenceAdapterDerivesDistinctAddressesPerTenant() = runTest {
        val shared = GoatWeb3WalletManager(FakeTestContext())
        val a = GoatWeb3Plugin(FakeTestContext(), walletManager = shared, appIdProvider = { "tenant-a" })
        val b = GoatWeb3Plugin(FakeTestContext(), walletManager = shared, appIdProvider = { "tenant-b" })

        val addrA = a.execute("WEB3_CONNECT_WALLET", buildJsonObject { put("network", "ethereum") })
            .getOrNull()?.get("address")?.jsonPrimitive?.content
        val addrB = b.execute("WEB3_CONNECT_WALLET", buildJsonObject { put("network", "ethereum") })
            .getOrNull()?.get("address")?.jsonPrimitive?.content

        assertNotNull(addrA)
        assertFalse("tenants must not share a derived wallet address", addrA == addrB)
    }

    @Test
    fun testUnsupportedActionFails() = runTest {
        val res = plugin.execute("NOT_A_WEB3_ACTION", buildJsonObject { })
        assertTrue(res.isFailure)
        assertTrue(res.exceptionOrNull() is IllegalArgumentException)
    }
}
