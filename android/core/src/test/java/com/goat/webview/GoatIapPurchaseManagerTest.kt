package com.goat.webview

import android.content.Context
import android.content.ContextWrapper
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GoatIapPurchaseManagerTest {

    private lateinit var fakeContext: FakeTestContext
    private lateinit var iapManager: GoatIapPurchaseManager

    private class FakeTestContext : ContextWrapper(null) {
        override fun getApplicationContext(): Context = this
    }

    @Before
    fun setUp() {
        fakeContext = FakeTestContext()
        iapManager = GoatIapPurchaseManager(fakeContext, hmacSecretKey = "test_hmac_secret_key_for_unit_tests")
    }

    @Test
    fun testGetPurchaseProductsCatalog() = runTest {
        val allProducts = iapManager.getPurchaseProducts(emptyList())
        assertTrue(allProducts.size >= 4)

        val specificProducts = iapManager.getPurchaseProducts(listOf("stars_100", "vip_monthly"))
        assertEquals(2, specificProducts.size)
        assertEquals("100 Stars", specificProducts[0].title)
        assertEquals("subs", specificProducts[1].type)
    }

    @Test
    fun testOpenInvoiceAndHmacVerification() = runTest {
        val paymentResult = iapManager.openInvoice(
            invoiceSlug = "inv_stars_9981",
            title = "100 Game Credits",
            amount = 100,
            currency = "XTR"
        )
        assertNotNull(paymentResult)
        assertEquals("PAID", paymentResult.status)
        assertEquals("inv_stars_9981", paymentResult.invoiceSlug)
        assertEquals(100L, paymentResult.amount)
        assertEquals("XTR", paymentResult.currency)
        assertTrue(paymentResult.signature.isNotBlank())
        assertTrue(paymentResult.transactionId.startsWith("tx_inv_stars_9981_"))

        // Restore purchases
        val restored = iapManager.restorePurchases()
        assertEquals(1, restored.size)
        assertEquals(paymentResult.transactionId, restored[0].transactionId)
    }

    @Test
    fun testNullHmacSecretKeyDeterministicDerivation() = runTest {
        val managerWithNullKey = GoatIapPurchaseManager(fakeContext, hmacSecretKey = null)
        val paymentResult = managerWithNullKey.openInvoice(
            invoiceSlug = "inv_stars_default_key",
            title = "50 Credits",
            amount = 50,
            currency = "USD"
        )
        assertNotNull(paymentResult)
        assertEquals("PAID", paymentResult.status)
        assertTrue(paymentResult.signature.isNotBlank())
    }
}

