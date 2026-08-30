package com.goat.webview

import android.content.Context
import android.content.ContextWrapper
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GoatWeb3WalletManagerTest {

    private lateinit var fakeContext: FakeTestContext
    private lateinit var walletManager: GoatWeb3WalletManager

    private class FakeTestContext : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this
    }

    @Before
    fun setUp() {
        fakeContext = FakeTestContext()
        walletManager = GoatWeb3WalletManager(fakeContext)
    }

    @Test
    fun testTonConnectWorkflow() = runTest {
        assertNull(walletManager.getAccount())

        val account = walletManager.connectWallet(
            network = "ton-mainnet",
            manifestUrl = "https://goat.io/tonconnect-manifest.json"
        )
        assertNotNull(account)
        assertTrue(account.address.startsWith("EQB"))
        assertEquals("Tonkeeper", account.wallet)
        assertEquals("ton-mainnet", account.network)
        assertEquals("-239", account.chainId)

        // Sign transaction
        val txResult = walletManager.signTransaction(
            to = "EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N",
            amount = "1000000000",
            payload = "Payment for SuperApp Order #1234"
        )
        assertNotNull(txResult)
        assertTrue(txResult.signature.startsWith("sig_ed25519_"))
        assertTrue(txResult.txHash.startsWith("0x"))
        assertEquals(account.address, txResult.from)

        // Disconnect
        val disconnected = walletManager.disconnectWallet()
        assertTrue(disconnected)
        assertNull(walletManager.getAccount())
    }

    @Test
    fun testEthereumEvmConnectWorkflow() = runTest {
        val account = walletManager.connectWallet(network = "ethereum-mainnet")
        assertTrue(account.address.startsWith("0x"))
        assertEquals("MetaMask", account.wallet)
        assertEquals("1", account.chainId)
    }
}
