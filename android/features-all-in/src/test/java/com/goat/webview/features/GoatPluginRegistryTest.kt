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
    fun testCreateAllPluginsReturnsAllSixPlugins() {
        val plugins = GoatPluginRegistry.createAllPlugins(fakeContext)
        assertEquals(6, plugins.size)
        val pluginIds = plugins.map { it.pluginId }.toSet()
        assertTrue(pluginIds.contains("biometrics"))
        assertTrue(pluginIds.contains("bluetooth"))
        assertTrue(pluginIds.contains("location"))
        assertTrue(pluginIds.contains("media"))
        assertTrue(pluginIds.contains("network"))
        assertTrue(pluginIds.contains("scanner"))
    }

    @Test
    fun testRegisterAllWiresAllPluginsIntoHandler() = runTest {
        val handler = GoatBridgeActionHandler(fakeContext)
        assertEquals(0, handler.getRegisteredPlugins().size)

        GoatPluginRegistry.registerAll(handler, fakeContext)
        assertEquals(6, handler.getRegisteredPlugins().size)

        val supportedActions = handler.getSupportedActions()
        assertTrue(supportedActions.contains("GET_LOCATION"))
        assertTrue(supportedActions.contains("SCAN_CODE"))
        assertTrue(supportedActions.contains("CHECK_BIOMETRIC_SUPPORT"))
        assertTrue(supportedActions.contains("CHOOSE_MEDIA"))
        assertTrue(supportedActions.contains("GET_NETWORK_TYPE"))
        assertTrue(supportedActions.contains("BLE_START_SCAN"))
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
