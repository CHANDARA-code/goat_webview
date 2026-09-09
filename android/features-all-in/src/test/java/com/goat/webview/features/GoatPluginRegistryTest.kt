package com.goat.webview.features

import android.content.Context
import android.content.ContextWrapper
import com.goat.webview.GoatBridgeActionHandler
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class GoatPluginRegistryTest {

    private lateinit var fakeContext: FakeTestContext

    private class FakeTestContext : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this
        override fun getSystemService(name: String): Any? = null
    }

    @Before
    fun setUp() {
        fakeContext = FakeTestContext()
    }

    @Test
    fun testCreateAllPluginsReturnsEveryBundledPlugin() {
        val plugins = GoatPluginRegistry.createAllPlugins(fakeContext)
        assertEquals(10, plugins.size)
        val pluginIds = plugins.map { it.pluginId }.toSet()
        assertTrue(pluginIds.contains("biometrics"))
        assertTrue(pluginIds.contains("bluetooth"))
        assertTrue(pluginIds.contains("location"))
        assertTrue(pluginIds.contains("media"))
        assertTrue(pluginIds.contains("network"))
        assertTrue(pluginIds.contains("scanner"))
        assertTrue(pluginIds.contains("sensors"))
        assertTrue(pluginIds.contains("web3"))
        assertTrue(pluginIds.contains("passkey"))
        assertTrue(pluginIds.contains("wallet_passes"))
    }

    @Test
    fun testRegisterAllWiresAllPluginsIntoHandler() = runTest {
        val handler = GoatBridgeActionHandler(fakeContext)
        assertEquals(0, handler.getRegisteredPlugins().size)

        GoatPluginRegistry.registerAll(handler, fakeContext)
        assertEquals(10, handler.getRegisteredPlugins().size)

        val supportedActions = handler.getSupportedActions()
        assertTrue(supportedActions.contains("GET_LOCATION"))
        assertTrue(supportedActions.contains("SCAN_CODE"))
        assertTrue(supportedActions.contains("CHECK_BIOMETRIC_SUPPORT"))
        assertTrue(supportedActions.contains("PASSKEY_REGISTER"))
        assertTrue(supportedActions.contains("VAULT_ENCRYPT"))
        assertTrue(supportedActions.contains("CHOOSE_MEDIA"))
        assertTrue(supportedActions.contains("GET_NETWORK_TYPE"))
        assertTrue(supportedActions.contains("BLE_START_SCAN"))
        // Domain 6 and 13b now arrive through plugins rather than the core dispatcher.
        assertTrue(supportedActions.contains("START_COMPASS"))
        assertTrue(supportedActions.contains("STOP_COMPASS"))
        assertTrue(supportedActions.contains("START_DEVICE_MOTION"))
        assertTrue(supportedActions.contains("WEB3_CONNECT_WALLET"))
    }

    @Test
    fun testCoreAloneDoesNotAdvertiseExtractedFeatureActions() = runTest {
        // G8: a host linking only :core must report these as unavailable rather than
        // dispatching them, so canIUse reflects what is actually linked.
        val coreOnly = GoatBridgeActionHandler(fakeContext).getSupportedActions()
        assertTrue(!coreOnly.contains("START_COMPASS"))
        assertTrue(!coreOnly.contains("WEB3_CONNECT_WALLET"))
        assertTrue(!coreOnly.contains("SCAN_CODE"))
    }
}

class GoatPaymentAutoRegistrationTest {

    private class FakeTestContext : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this
        override fun getSystemService(name: String): Any? = null
    }

    @Test
    fun autoRegisterPaymentsReflectivelyLoadsGatewayManager() {
        val context = FakeTestContext()
        val manager = GoatPaymentPluginRegistry.createGatewayManager(context, "tenant-1")
        assertNotNull(manager)
        val providerIds = manager.getRegisteredProviderIds()
        assertTrue("stripe" in providerIds)
        assertTrue("alipay" in providerIds)
        assertTrue("paypay" in providerIds)
        assertTrue("bakong_khqr" in providerIds)

        val handler = GoatBridgeActionHandler(context, appId = "tenant-1", autoRegisterPayments = true)
        assertNotNull(handler.paymentGateway)
        assertNotNull(handler.paymentGateway?.getRegisteredProviderIds())
    }
}
